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
//
// Windows-safe: os.homedir() + path.join only, temp-file + rename writes, natural exit.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The scripts a member's repo keeps a copy of. measure-sessions.mjs is NOT here on purpose:
 *  it imports a sibling module, and time-saved-sync.mjs already resolves it from the newest
 *  installed toolkit at run time. */
export const MANAGED = ["org-check.mjs", "memory-conveyor.mjs", "time-saved-sync.mjs", "endless.mjs"];

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

export function candidateRoots(projectDir) {
  const plugins = path.join(configDir(), "plugins");
  const list = [];
  if (process.env.CLAUDE_PLUGIN_ROOT) list.push(process.env.CLAUDE_PLUGIN_ROOT);
  // the marketplace clone that `claude plugin marketplace update` refreshes (keyed members)
  list.push(path.join(plugins, "marketplaces", "king-intelligence", "plugins", "king-intelligence"));
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
export function newestPluginRoot(projectDir) {
  let best = null, bestV = null;
  for (const dir of candidateRoots(projectDir)) {
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
    if (!fs.existsSync(dest) && !isBrain(projectDir)) { out.skipped = "not a second brain"; return out; }
    out.version = found.version;
    out.root = found.root;
    fs.mkdirSync(dest, { recursive: true });
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
  else console.log("usage: node local-scripts.mjs refresh <projectDir> | newest [projectDir]");
  process.exitCode = 0;
}
