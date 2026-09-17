#!/usr/bin/env node
// claude-cli.mjs - the ONE place that knows how to find the Claude Code command line, run it,
// and describe what happened when it did not work. Created 09/16/26 - 14:23 EDT.
//
// WHY THIS FILE EXISTS. The session-start updater used to run the command line through
// execSync('claude plugin ...') with stdio "ignore" and store only Node's own error message.
// Node writes the byte-identical sentence "Command failed: <cmd>" for a missing binary, any
// non-zero exit, and a timeout kill, so every one of the five real causes arrived on the owner's
// desk as the same useless sentence. Three member machines carried that sentence for weeks and
// nobody could say why. Everything here exists to turn that one sentence back into a cause.
//
// Two rules this module holds for the whole plugin:
//
//   1. THE CHILD'S PATH GETS THE BINARY'S OWN FOLDER PLUS THE SYSTEM FOLDERS. `claude plugin
//      marketplace update` shells out to `git`. Fixing only the `claude` lookup would leave a
//      missing `git` failing in exactly the same silent way one rung down.
//   2. MASK BEFORE ANYTHING IS STORED. The members marketplace remote is
//      https://<member token>@members.king-intelligence.com/marketplace.git and git echoes that
//      URL verbatim in its errors. This text lands on disk, rides to the portal, and is stored in
//      a database row. Without masking, switching stderr capture on would publish every failing
//      member's token.
//
// Nothing here ever throws out of an export, and nothing here reaches the network by itself.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync, readlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const IS_WIN = process.platform === "win32";

/**
 * Strip every credential shape we know how to recognise. Applied to EVERY string before it is
 * written to disk, sent to the portal, or printed. Deliberately blunt: a diagnostic that is
 * slightly less readable costs nothing, a leaked member token costs the member.
 */
export function maskSecrets(text) {
  let s = String(text == null ? "" : text);
  try {
    // https://<anything>@host/... - the members marketplace remote, and any other userinfo URL
    s = s.replace(/https?:\/\/[^@\s/]+@/gi, "https://TOKEN@");
    // GitHub classic and fine-grained tokens (the pre-portal era members are still on these)
    s = s.replace(/github_pat_[A-Za-z0-9_]{8,}/g, "TOKEN");
    s = s.replace(/gh[pousr]_[A-Za-z0-9]{8,}/g, "TOKEN");
    // Anthropic / OpenAI style keys
    s = s.replace(/sk-[A-Za-z0-9_-]{8,}/g, "TOKEN");
    // Authorization headers echoed back in an error
    s = s.replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer TOKEN");
  } catch { return ""; }
  return s;
}

function posixCandidates() {
  const home = os.homedir();
  return [
    path.join(home, ".local", "bin", "claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    path.join(home, ".npm-global", "bin", "claude"),
  ];
}

function windowsCandidates() {
  const up = process.env.USERPROFILE || os.homedir();
  const local = process.env.LOCALAPPDATA || path.join(up, "AppData", "Local");
  const roaming = process.env.APPDATA || path.join(up, "AppData", "Roaming");
  // .exe before .cmd on purpose: a .cmd shim needs a shell, an .exe does not, and a shell is
  // where Windows quoting goes wrong.
  return [
    path.join(up, ".local", "bin", "claude.exe"),
    path.join(up, ".local", "bin", "claude.cmd"),
    path.join(local, "Programs", "claude", "claude.exe"),
    path.join(roaming, "npm", "claude.cmd"),
  ];
}

// ---------------------------------------------------------------------------------------------
// THE REMEMBERED ADDRESS (9/17/26). The one file this module writes. Once any rung has found the
// command line for real, its path is written here, so the next session start does not have to
// search again, and a rung that only works from inside Claude Code (the pasted repair, the health
// check) can leave the answer for the hook, which runs with a thin PATH and no way to ask.
//
// Same fixed home as the hours ledger, on purpose: it must survive a plugin reinstall, a version
// folder sweep and a config folder move, and it must be findable by a one-line command that has
// no access to this module. It is validated on every read (the file may name a version folder
// that Claude Code has since replaced), so a stale address costs one search, never a failure.
// ---------------------------------------------------------------------------------------------
function rememberedFile() {
  const cfg = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  return path.join(cfg, "king-intelligence", "claude-bin.json");
}

function readRemembered() {
  try {
    const j = JSON.parse(readFileSync(rememberedFile(), "utf8"));
    const p = j && typeof j.path === "string" ? j.path : "";
    if (p && path.isAbsolute(p) && existsSync(p)) return p;
  } catch { /* nothing remembered, or it moved */ }
  return null;
}

/**
 * Write the address down. Only a real, absolute, existing path is ever stored, and only when it
 * was found by a rung worth remembering: the bare word is not an address, and the remembered
 * rung itself would just rewrite what it read. Temp plus rename, mode 0600, never throws.
 */
export function rememberClaudeBin(binPath, how) {
  try {
    if (!binPath || !path.isAbsolute(binPath) || !existsSync(binPath)) return false;
    if (how === "bare" || how === "remembered") return false;
    const f = rememberedFile();
    mkdirSync(path.dirname(f), { recursive: true });
    const t = `${f}.${process.pid}.tmp`;
    writeFileSync(t, JSON.stringify({ path: binPath, how: how || "unknown", at: new Date().toISOString() }) + "\n", { mode: 0o600 });
    renameSync(t, f);
    return true;
  } catch { return false; }
}

/**
 * The editor extensions bundle their own copy of Claude Code inside a versioned folder, and that
 * folder is where a member who lives in VS Code actually runs it from (proven on 9/17/26: a Mac
 * whose command line lived nowhere else than
 * ~/.vscode/extensions/anthropic.claude-code-<version>-<platform>/resources/native-binary/claude).
 * The folder name moves with every extension update, so this is a search, not a fixed address.
 * Newest folder wins, by name, which sorts by version.
 */
function editorExtensionCandidates() {
  const home = process.env.USERPROFILE && IS_WIN ? process.env.USERPROFILE : os.homedir();
  const exe = IS_WIN ? "claude.exe" : "claude";
  const roots = [".vscode", ".vscode-insiders", ".vscode-server", ".cursor", ".windsurf"].map((d) => path.join(home, d, "extensions"));
  const out = [];
  for (const root of roots) {
    let names = [];
    try { names = readdirSync(root).filter((n) => /^anthropic\.claude-code-/i.test(n)); } catch { continue; }
    names.sort().reverse();
    for (const n of names) out.push(path.join(root, n, "resources", "native-binary", exe));
  }
  return out;
}

/**
 * Ask the operating system which program started us. The session-start hook is a child of Claude
 * Code (usually through one shell), so walking up the parents finds the exact binary that is
 * running right now, wherever it was installed and whatever PATH this hook was given. This is the
 * rung that needs no guessing at all. Capped at eight generations and a few seconds, and it only
 * runs when every cheaper rung has already missed.
 *
 * On Windows it is ONE PowerShell call that walks the chain in-process (one call per generation
 * would cost a second each). On a Mac `ps` prints the full executable path; on Linux `comm` is
 * truncated, so /proc/<pid>/exe is read first where it exists.
 */
export function ancestorClaudeBin(timeoutMs = 6000) {
  const isClaude = (p) => /^claude(\.exe)?$/i.test(path.basename(String(p || "")));
  try {
    if (IS_WIN) {
      const script =
        `$p=${process.ppid};for($i=0;$i -lt 8 -and $p;$i++){` +
        `$x=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $p) -ErrorAction SilentlyContinue;` +
        `if(-not $x){break};if($x.ExecutablePath){Write-Output $x.ExecutablePath};$p=$x.ParentProcessId}`;
      const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
        timeout: timeoutMs, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"],
      });
      for (const line of String(r.stdout || "").split(/\r?\n/)) {
        const p = line.trim();
        if (p && isClaude(p) && existsSync(p)) return p;
      }
      return null;
    }
    let pid = process.ppid;
    for (let i = 0; i < 8 && pid && pid > 1; i++) {
      let exe = null, ppid = null;
      try { exe = readlinkSync(`/proc/${pid}/exe`); } catch { /* not Linux, or no permission */ }
      const r = spawnSync("ps", ["-o", "ppid=", "-o", "comm=", "-p", String(pid)], {
        timeout: Math.max(1000, Math.floor(timeoutMs / 4)), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
      });
      const m = String(r.stdout || "").trim().match(/^(\d+)\s+(.*)$/);
      if (m) { ppid = parseInt(m[1], 10); if (!exe) exe = m[2].trim(); }
      if (exe && isClaude(exe) && path.isAbsolute(exe) && existsSync(exe)) return exe;
      if (!ppid || ppid === pid) break;
      pid = ppid;
    }
  } catch { /* the walk is best effort */ }
  return null;
}

/**
 * Windows keeps the member's real PATH in the registry, and a hook subprocess often gets a thinner
 * one. `reg query` is on every Windows since XP. This reads the user's PATH and the machine's,
 * expands %VAR% pieces with what we have, and looks for the command line in each folder. It is
 * what turns "'claude' is not recognized" (David Russo's PC, 9/17/26) into an address.
 */
export function registryPathClaudeBin(timeoutMs = 4000) {
  if (!IS_WIN) return null;
  const keys = [
    ["HKCU\\Environment", "Path"],
    ["HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment", "Path"],
  ];
  const dirs = [];
  for (const [key, name] of keys) {
    try {
      const r = spawnSync("reg", ["query", key, "/v", name], {
        timeout: timeoutMs, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"],
      });
      const m = String(r.stdout || "").match(/\bPath\s+REG_(?:EXPAND_)?SZ\s+(.+)$/im);
      if (!m) continue;
      const expanded = m[1].trim().replace(/%([^%]+)%/g, (_, v) => process.env[v] || process.env[v.toUpperCase()] || "");
      for (const d of expanded.split(";")) if (d.trim()) dirs.push(d.trim());
    } catch { /* next key */ }
  }
  for (const d of dirs) {
    for (const name of ["claude.exe", "claude.cmd"]) {
      const p = path.join(d, name);
      try { if (existsSync(p)) return p; } catch { /* next */ }
    }
  }
  return null;
}

/**
 * Where is the Claude Code command line on this computer? First rung that actually exists.
 * Never returns null: the last rung is the bare word, which is what the old code always used.
 *
 * `how` is recorded in every failure note, so the fleet finally learns which rung real member
 * machines land on instead of us guessing. The order is cheapest first; the two rungs that ask
 * the operating system run only when everything before them has missed.
 */
export function resolveClaudeBin() {
  try {
    // 1. the support and sandbox lever
    const override = process.env.KI_CLAUDE_BIN;
    if (override && existsSync(override)) return { path: override, how: "override" };
    // 2. the path Claude Code itself was started from. READ LIVE, NEVER CACHED: on a machine
    //    running the VS Code extension this points inside a versioned extension folder, which
    //    moves with every extension update.
    const exec = process.env.CLAUDE_CODE_EXECPATH;
    if (exec && existsSync(exec)) return { path: exec, how: "execpath" };
    // 3. what a previous run, the pasted repair or the health check wrote down
    const remembered = readRemembered();
    if (remembered) return { path: remembered, how: "remembered" };
    // 4. the places the installers put it
    for (const c of IS_WIN ? windowsCandidates() : posixCandidates()) {
      if (existsSync(c)) return { path: c, how: "known" };
    }
    // 5. inside an editor extension (VS Code, Cursor, Windsurf), newest first
    for (const c of editorExtensionCandidates()) {
      if (existsSync(c)) return { path: c, how: "extension" };
    }
    // 6. the program that started this hook, asked of the operating system
    const anc = process.env.KI_NO_ANCESTOR_WALK === "1" ? null : ancestorClaudeBin();
    if (anc) return { path: anc, how: "ancestor" };
    // 7. the member's real PATH, read from the Windows registry
    const reg = registryPathClaudeBin();
    if (reg) return { path: reg, how: "registry" };
  } catch { /* fall through to the bare word */ }
  // 8. whatever the shell can find
  return { path: "claude", how: "bare" };
}

/** The child's PATH: the binary's own folder first, then the system folders, then what we have. */
export function withBinDir(binPath) {
  const sep = IS_WIN ? ";" : ":";
  const system = IS_WIN
    ? [
        path.join(process.env.SystemRoot || "C:\\Windows", "System32"),
        path.join(process.env.ProgramFiles || "C:\\Program Files", "Git", "cmd"),
      ]
    : ["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
  const parts = [];
  try {
    if (binPath && binPath !== "claude" && path.isAbsolute(binPath)) parts.push(path.dirname(binPath));
  } catch { /* keep going */ }
  for (const s of system) parts.push(s);
  for (const s of String(process.env.PATH || "").split(sep)) parts.push(s);
  return [...new Set(parts.filter(Boolean))].join(sep);
}

/**
 * Does this command need to go through a shell?
 *
 * TWO CASES, AND THE SECOND ONE COST US WINDOWS (fixed 9/16/26). The bare word needs a shell
 * because that is the only thing that searches PATH (and, on Windows, PATHEXT). A .cmd or .bat
 * file ALSO needs one: since the Node security fix shipped in 18.20.2 / 20.12.2 / 21.7.3, spawning
 * a batch file without a shell is refused outright with ERR_CHILD_PROCESS_BAD_EXECUTABLE. Two of
 * our known Windows install locations are .cmd shims, and the npm one is the common install, so
 * without this those members' updater could never run at ALL, every session, for ever, and the
 * git fallback could not fire either because it only fires on "there is no such command".
 */
export function needsShell(binPath, how) {
  if (how === "bare") return true;
  try { return /\.(cmd|bat)$/i.test(String(binPath || "")); } catch { return false; }
}

/**
 * Run the Claude Code command line and come back with a DESCRIBABLE result. Never throws.
 *
 * Returns { ok, status, signal, code, tail, bin, how, ms }:
 *   status  the process exit code (127 = the shell could not find it, 128 = git refused)
 *   signal  set when the timeout killed it, which is how a hang tells itself apart from an exit
 *   code    the spawn error code (ENOENT = no such binary, ETIMEDOUT = we killed it)
 *   tail    the last 300 characters of stderr + stdout, MASKED
 *   how     which rung of resolveClaudeBin() answered
 *
 * spawnSync takes an ARGUMENT ARRAY, never a command string, so an absolute Windows path with a
 * space in it cannot be mis-quoted. shell:true is used only where it is unavoidable: the bare
 * word, and a .cmd / .bat shim, which modern Node refuses to spawn any other way (see needsShell).
 */
export function runClaude(args, timeoutMs) {
  const bin = resolveClaudeBin();
  const startedAt = Date.now();
  let r;
  try {
    r = spawnSync(bin.path, Array.isArray(args) ? args : [], {
      timeout: timeoutMs,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      shell: needsShell(bin.path, bin.how),
      env: { ...process.env, PATH: withBinDir(bin.path) },
    });
  } catch (e) {
    r = { error: e, status: null, signal: null, stdout: "", stderr: "" };
  }
  const tail = maskSecrets(`${r.stderr || ""}${r.stdout || ""}`).trim().slice(-300);
  return {
    ok: !r.error && r.status === 0,
    status: r.status === undefined ? null : r.status,
    signal: r.signal || null,
    code: r.error ? String(r.error.code || r.error.message || "error") : null,
    tail,
    bin: bin.path,
    how: bin.how,
    ms: Date.now() - startedAt,
  };
}

/**
 * Does git run on this computer at all? Asked only on a failure path, capped at 3 seconds.
 * It separates "our lookup of the Claude command line is wrong" from "this machine has no git",
 * which are two completely different repairs and used to arrive as the same sentence.
 */
export function gitVersionOk(timeoutMs = 3000) {
  try {
    const r = spawnSync("git", ["--version"], {
      timeout: timeoutMs, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
      // the system folders go on the child's PATH here too: a hook can be spawned with a thin
      // PATH, and "git is missing" and "git is not on this hook's PATH" are different answers
      env: { ...process.env, PATH: withBinDir(null) },
    });
    return !r.error && r.status === 0;
  } catch { return false; }
}

/**
 * The last resort, and it installs NOTHING. Fast-forward the marketplace clone so the member's
 * own repo scripts can be levelled from it even while the installed plugin stays stale.
 * GIT_TERMINAL_PROMPT=0 so a credential prompt can never hang a session start.
 */
export function gitFfPull(dir, timeoutMs = 15000) {
  const startedAt = Date.now();
  let r;
  try {
    r = spawnSync("git", ["-C", String(dir || ""), "-c", "credential.helper=", "pull", "--ff-only"], {
      timeout: timeoutMs,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PATH: withBinDir(null), GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "echo" },
    });
  } catch (e) {
    r = { error: e, status: null, signal: null, stdout: "", stderr: "" };
  }
  return {
    ok: !r.error && r.status === 0,
    status: r.status === undefined ? null : r.status,
    signal: r.signal || null,
    code: r.error ? String(r.error.code || r.error.message || "error") : null,
    tail: maskSecrets(`${r.stderr || ""}${r.stdout || ""}`).trim().slice(-300),
    bin: "git",
    how: "git",
    ms: Date.now() - startedAt,
  };
}

/**
 * FROM INSIDE CLAUDE CODE, WHERE THE ANSWER IS EASY (9/17/26). The Bash tool runs with the member's
 * full shell, so `command -v claude` (or `where claude` on Windows) simply works there, and so does
 * CLAUDE_CODE_EXECPATH. This is the search the pasted repair and the health check run, and it
 * writes the address down for the hook, which has neither. Prefers an .exe over a .cmd shim on
 * Windows, because an .exe spawns without a shell. Never throws; returns what it found.
 */
export function discoverClaudeBin() {
  const found = [];
  try {
    const exec = process.env.CLAUDE_CODE_EXECPATH;
    if (exec && existsSync(exec)) found.push({ path: exec, how: "execpath" });
  } catch { /* keep looking */ }
  try {
    const r = spawnSync(IS_WIN ? "where" : "sh", IS_WIN ? ["claude"] : ["-c", "command -v claude"], {
      timeout: 5000, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"],
    });
    const lines = String(r.stdout || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    lines.sort((a, b) => (/\.exe$/i.test(b) ? 1 : 0) - (/\.exe$/i.test(a) ? 1 : 0));
    for (const p of lines) if (path.isAbsolute(p) && existsSync(p)) found.push({ path: p, how: "shell" });
  } catch { /* keep looking */ }
  const r = resolveClaudeBin();
  if (r.how !== "bare") found.push(r);
  return found[0] || null;
}

// `node claude-cli.mjs --record` : find the command line from here and write the address down.
// Prints exactly one plain sentence and always exits 0, so it can sit inside a repair prompt.
try {
  const self = fileURLToPath(import.meta.url);
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
  if (invoked && path.resolve(self) === invoked && process.argv.includes("--record")) {
    const hit = discoverClaudeBin();
    if (!hit) console.log("Could not find where Claude Code is installed from here, nothing was written.");
    else if (hit.how === "remembered") console.log("The background updater already knows where Claude Code lives.");
    else if (rememberClaudeBin(hit.path, hit.how)) console.log("Recorded where Claude Code lives, so the background updater can always find it.");
    else console.log("Found Claude Code but could not write the address down (the settings folder would not take the file).");
  }
} catch { /* a diagnostic that fails must not fail anything else */ }
