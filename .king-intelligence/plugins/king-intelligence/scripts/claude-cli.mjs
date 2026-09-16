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
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

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

/**
 * Where is the Claude Code command line on this computer? First rung that actually exists.
 * Never returns null: the last rung is the bare word, which is what the old code always used.
 *
 * `how` is recorded in every failure note, so the fleet finally learns which rung real member
 * machines land on instead of us guessing.
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
    // 3. the places the installers put it
    for (const c of IS_WIN ? windowsCandidates() : posixCandidates()) {
      if (existsSync(c)) return { path: c, how: "known" };
    }
  } catch { /* fall through to the bare word */ }
  // 4. whatever the shell can find
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
