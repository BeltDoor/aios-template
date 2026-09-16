#!/usr/bin/env node
// King Intelligence - keep a member repo's own copies of the maintenance scripts equal to the
// NEWEST toolkit installed on the machine.
//
// WHY THIS FILE EXISTS (9/14/26). /end-session and /endless run four scripts from a copy inside
// the member's repo (.claude/scripts/), because a skill's shell call cannot expand the plugin
// folder path. That copy was written once by the org migration and refreshed only by
// /king-intelligence:update, whose copy line read from CLAUDE_PLUGIN_ROOT: the folder of the
// version the SESSION STARTED ON, so it copied the old scripts even right after an update. The
// silent session-start updater never touched the copies at all. Result: a member's toolkit
// reported 0.52.2 while the memory tidy she actually ran was the pre-0.52.2 one, which read her
// 129-entry index as 0 entries. The fix shipped 9/11 and reached nobody.
//
// So the copies now refresh themselves every session start, from whichever installed toolkit
// folder carries the highest version, never from the pinned one. Idempotent, no network, never
// throws out of its exports, never deletes: a copy that differs from the shipped file (a member
// hand-patched it) is parked in .claude/scripts/_replaced-<date>/ before it is replaced.
//
//   node local-scripts.mjs refresh <projectDir>   -> refresh the copies, print a JSON receipt
//   node local-scripts.mjs newest  [projectDir]   -> print the newest toolkit folder + version
//   node local-scripts.mjs refresh-data           -> refresh the copies in the plugin's data folder
//   node local-scripts.mjs data                   -> print the data folder and how it was found
//
// Windows-safe: os.homedir() + path.join only, temp-file + rename writes, natural exit.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The scripts a member's repo keeps a copy of. measure-sessions.mjs is NOT here on purpose:
 *  it imports a sibling module, and time-saved-sync.mjs already resolves it from the newest
 *  installed toolkit at run time.
 *
 *  ki-run.mjs and local-scripts.mjs joined on 9/16/26 and must land TOGETHER: ki-run.mjs imports
 *  ./local-scripts.mjs as a sibling, so a repo holding one without the other has a runner that
 *  falls back to its own folder instead of the newest toolkit. They are here because a command's
 *  setup line and a door skill both need a runner that lives in the member's OWN repo: the
 *  toolkit folder a window opened on is marked orphaned when an update lands and swept away
 *  later, and from that moment every path into it is gone. */
export const MANAGED = ["org-check.mjs", "memory-conveyor.mjs", "time-saved-sync.mjs", "endless.mjs", "ki-run.mjs", "local-scripts.mjs"];

export function semverGt(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

export function readVersion(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, ".claude-plugin", "plugin.json"), "utf8")).version || null; }
  catch { return null; }
}

/** Every folder on this machine that could hold a King Intelligence toolkit, in no particular
 *  order. The version inside each decides; the caller never trusts the order. */
/** Claude Code's config folder: ~/.claude unless the person moved it with CLAUDE_CONFIG_DIR. */
export function configDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

/** Claude Code's own settings file. Callers read it, and the one writer that exists takes a lock
 *  first: Claude Code rewrites this file itself, several times a session, under its own lock. */
export function settingsPath() {
  return path.join(configDir(), "settings.json");
}

/**
 * The King Intelligence plugin's own data folder: where config.json lives (the member's disabled
 * skills and their adopted / declined rules) and where a door skill parks a small list.
 *
 * WHY THIS IS NOT JUST CLAUDE_PLUGIN_DATA (9/16/26). Inside a hook that variable is right. Inside
 * a plain command the model runs it is wrong: verified on this machine it held
 * .../plugins/data/codex-openai-codex, ANOTHER plugin's folder. A read there returns nothing and a
 * write lands in someone else's directory with no error at all, which is worse than a crash.
 * So the variable is trusted only when it is named for this plugin, and otherwise the folder is
 * found on disk.
 *
 * Two King Intelligence folders exist side by side on a machine that was ever installed inline
 * (verified here: king-intelligence-king-intelligence, live, and king-intelligence-inline, stale
 * since July). Guessing the wrong one reads an empty opt-out list, re-offers rules the member
 * already declined, and can write an adoption into a folder nothing reads. So the folder that
 * actually holds a config.json wins, newest first.
 *
 * Returns { dir, via } where via is one of: "env" (the variable, named for us), "config" (the
 * folder holding the newest config.json), "only" (the one folder there is), "default" (nothing
 * installed yet, so the canonical name, NOT created here). Never creates a directory.
 */
export function resolveDataDir() {
  const env = process.env.CLAUDE_PLUGIN_DATA;
  if (env && path.basename(env).startsWith("king-intelligence-")) return { dir: env, via: "env" };
  const base = path.join(configDir(), "plugins", "data");
  let names = [];
  try { names = fs.readdirSync(base).filter((n) => n.startsWith("king-intelligence-")); } catch { names = []; }
  let best = null, bestAt = -1;
  for (const name of names) {
    let st;
    try { st = fs.statSync(path.join(base, name, "config.json")); } catch { continue; }
    if (st.mtimeMs > bestAt) { bestAt = st.mtimeMs; best = name; }
  }
  if (best) return { dir: path.join(base, best), via: "config" };
  if (names.length === 1) return { dir: path.join(base, names[0]), via: "only" };
  return { dir: path.join(base, "king-intelligence-king-intelligence"), via: "default" };
}

/** Just the folder, for callers that do not care how it was found. */
export function dataDir() {
  return resolveDataDir().dir;
}

/** Every script named by a command line inside a hooks.json, e.g. "scripts/auto-update.mjs". */
export function hookScriptNames(root) {
  const out = [];
  let raw;
  try { raw = fs.readFileSync(path.join(root, "hooks", "hooks.json"), "utf8"); } catch { return out; }
  for (const m of raw.matchAll(/scripts\/([A-Za-z0-9._-]+\.mjs)/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

/**
 * Keep a copy of the hook scripts, the runner and its module in the plugin's DATA folder.
 *
 * WHY (9/16/26). Every hook command and every command setup line points into the toolkit folder
 * the window opened on. Claude Code marks a superseded version folder orphaned and a background
 * sweep deletes it, so a member who lives in one window for weeks ends up pointing at a folder
 * that is no longer there, and every one of those lines dies. The data folder is stable across
 * versions and is never swept, so a copy parked here is the second half of an "a || b" command.
 *
 * One stat per file decides whether to copy. Nothing is ever deleted and nothing is parked: this
 * folder is ours, not the member's, so there is no hand-patched copy to protect. Never throws.
 */
export function refreshDataScripts(root = undefined, dest = undefined) {
  const out = { refreshed: false, root: null, dest: null, version: null, copied: [], skipped: null };
  try {
    if (root === undefined) {
      const found = newestPluginRoot(process.env.CLAUDE_PROJECT_DIR || process.cwd());
      if (!found) { out.skipped = "no toolkit found on this computer"; return out; }
      root = found.root;
      out.version = found.version;
    } else {
      out.version = readVersion(root);
    }
    if (!root) { out.skipped = "no toolkit folder given"; return out; }
    const dataRoot = dest || dataDir();
    if (!dataRoot) { out.skipped = "no data folder on this computer"; return out; }
    out.root = root;
    out.dest = path.join(dataRoot, "scripts");
    const names = [...hookScriptNames(root)];
    for (const extra of ["ki-run.mjs", "local-scripts.mjs"]) if (!names.includes(extra)) names.push(extra);
    fs.mkdirSync(out.dest, { recursive: true });
    for (const name of names) {
      const src = path.join(root, "scripts", name);
      let srcStat;
      try { srcStat = fs.statSync(src); } catch { continue; }
      let dstStat = null;
      try { dstStat = fs.statSync(path.join(out.dest, name)); } catch { /* not there yet */ }
      if (dstStat && dstStat.size === srcStat.size && dstStat.mtimeMs >= srcStat.mtimeMs) continue;
      const dst = path.join(out.dest, name);
      const tmp = `${dst}.${process.pid}.tmp`;
      fs.copyFileSync(src, tmp);
      fs.renameSync(tmp, dst);
      out.copied.push(name);
    }
    out.refreshed = out.copied.length > 0;
  } catch (e) {
    out.skipped = String((e && e.message) || e);
  }
  return out;
}

export function candidateRoots(projectDir, opts = {}) {
  const plugins = path.join(configDir(), "plugins");
  const list = [];
  if (process.env.CLAUDE_PLUGIN_ROOT) list.push(process.env.CLAUDE_PLUGIN_ROOT);
  // The marketplace clone that `claude plugin marketplace update` refreshes is NOT an installed
  // toolkit: it is the catalog. Until 9/16/26 it sat here unconditionally and, being strictly
  // newer whenever a refresh succeeded but the install failed, it won outright, so a member's
  // repo scripts were levelled to a version their plugin was not running, with nothing recorded.
  // It is a candidate only when the caller asks for it (the git-fallback path, where a pull of
  // the clone is the ONLY new code this machine can get).
  if (opts.includeClone) list.push(path.join(plugins, "marketplaces", "king-intelligence", "plugins", "king-intelligence"));
  // every installed version, keyed and free-starter alike (old versions linger in the cache)
  for (const mk of ["king-intelligence", "king-intelligence-starter"]) {
    const cache = path.join(plugins, "cache", mk, "king-intelligence");
    try { for (const v of fs.readdirSync(cache)) list.push(path.join(cache, v)); } catch { /* none */ }
  }
  // the free starter's bundled marketplace inside the clone itself
  if (projectDir) list.push(path.join(projectDir, ".king-intelligence", "plugins", "king-intelligence"));
  return list;
}

/** The highest-version toolkit folder that actually carries the scripts, or null. */
export function newestPluginRoot(projectDir, opts = {}) {
  let best = null, bestV = null;
  for (const dir of candidateRoots(projectDir, opts)) {
    const v = readVersion(dir);
    if (!v) continue;
    if (!fs.existsSync(path.join(dir, "scripts", "memory-conveyor.mjs"))) continue;
    if (bestV === null || semverGt(v, bestV)) { best = dir; bestV = v; }
  }
  return best ? { root: best, version: bestV } : null;
}

/** Is this folder a King Intelligence second brain? Same three markers the other hooks use. */
export function isBrain(projectDir) {
  try { return ["CLAUDE.md", "SKILLS.md", "CONNECTIONS.md"].every((f) => fs.existsSync(path.join(projectDir, f))); }
  catch { return false; }
}

/**
 * A git-ignore for the copies we plant in a folder that is not a second brain.
 *
 * It names the files we put there and itself, so `git status` in that project stays exactly as
 * clean as it was before the toolkit ever looked at the folder. Best-effort: a folder that
 * already has one is never overwritten, and a failure here never stops the refresh.
 */
function writeIgnore(dest) {
  try {
    const f = path.join(dest, ".gitignore");
    if (fs.existsSync(f)) return;
    fs.writeFileSync(f, [
      "# King Intelligence keeps a copy of its maintenance scripts here so the tools this",
      "# computer reaches for are always the current ones. They are refreshed automatically,",
      "# they belong to this computer rather than to this project, and they are not committed.",
      "*.mjs",
      ".ki-version",
      "_replaced-*/",
      ".gitignore",
      "",
    ].join("\n"));
  } catch { /* an ignore file is a courtesy, never a reason to stop */ }
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Bring <projectDir>/.claude/scripts/ level with the newest toolkit. Returns a receipt and never
 * throws. Nothing happens unless the folder already has the copies or is a second brain.
 */
export function refreshLocalScripts(projectDir, found = undefined) {
  const out = { refreshed: false, version: null, root: null, copied: [], parked: [], skipped: null };
  try {
    if (!projectDir) { out.skipped = "no project folder"; return out; }
    projectDir = path.resolve(projectDir);
    if (found === undefined) found = newestPluginRoot(projectDir);
    if (!found) { out.skipped = "no toolkit found on this computer"; return out; }
    const dest = path.join(projectDir, ".claude", "scripts");
    const hadDest = fs.existsSync(dest);
    const brain = isBrain(projectDir);
    // WIDENED 9/16/26. It used to plant only where the copies already were, or in a full second
    // brain. A member who runs a door skill in an ordinary work folder got nothing, so the runner
    // the skill's first line asks for was never there. Any folder Claude Code is already set up in
    // (it has a .claude folder) now gets the copies too. A folder with none of the three is still
    // left completely alone.
    if (!hadDest && !brain && !fs.existsSync(path.join(projectDir, ".claude"))) {
      out.skipped = "not a second brain";
      return out;
    }
    out.version = found.version;
    out.root = found.root;
    fs.mkdirSync(dest, { recursive: true });
    // ...AND FENCED THE SAME DAY. The widening means a member who has ever used Claude Code in a
    // CLIENT'S repo gets our six files planted there, where they show up as untracked changes in
    // somebody else's project and can be committed into it. The copies belong to this computer,
    // not to that project, so a folder we create fresh outside a second brain gets a git-ignore
    // that covers the copies AND itself: nothing of ours ever appears in that project's changes.
    // A second brain is left alone on purpose (Jacob's own repo tracks these files deliberately),
    // and an existing folder is never given one, because that is the member's call to have made.
    if (!hadDest && !brain) writeIgnore(dest);
    let parkDir = null;
    for (const name of MANAGED) {
      const src = path.join(found.root, "scripts", name);
      if (!fs.existsSync(src)) continue;
      const dst = path.join(dest, name);
      const want = fs.readFileSync(src);
      let have = null;
      try { have = fs.readFileSync(dst); } catch { /* not there yet */ }
      if (have && have.equals(want)) continue;
      if (have) {
        // a copy that differs is either an older release or a member's own patch: keep it
        if (!parkDir) { parkDir = path.join(dest, `_replaced-${today()}`); fs.mkdirSync(parkDir, { recursive: true }); }
        fs.copyFileSync(dst, path.join(parkDir, name));
        out.parked.push(name);
      }
      const tmp = `${dst}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, want);
      fs.renameSync(tmp, dst);
      out.copied.push(name);
    }
    const stamp = path.join(dest, ".ki-version");
    let had = null;
    try { had = fs.readFileSync(stamp, "utf8").trim(); } catch { /* first time */ }
    if (had !== found.version) fs.writeFileSync(stamp, found.version + "\n");
    out.refreshed = out.copied.length > 0;
  } catch (e) {
    out.skipped = String((e && e.message) || e);
  }
  return out;
}

// ---- command line ----
const isMain = (() => {
  // realpath both sides: a temp folder on a Mac is /var -> /private/var, and node resolves the
  // module's own path through the symlink while argv[1] keeps what was typed
  try { return !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (isMain) {
  const [cmd, dirArg] = process.argv.slice(2);
  const projectDir = dirArg || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (cmd === "refresh") console.log(JSON.stringify(refreshLocalScripts(projectDir)));
  else if (cmd === "newest") console.log(JSON.stringify(newestPluginRoot(projectDir)));
  else if (cmd === "refresh-data") console.log(JSON.stringify(refreshDataScripts()));
  else if (cmd === "data") console.log(JSON.stringify(resolveDataDir()));
  else console.log("usage: node local-scripts.mjs refresh <projectDir> | newest [projectDir] | refresh-data | data");
  process.exitCode = 0;
}
