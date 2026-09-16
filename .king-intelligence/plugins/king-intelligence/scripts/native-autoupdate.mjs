#!/usr/bin/env node
// native-autoupdate.mjs - switch ON Claude Code's OWN auto-update for the King Intelligence
// marketplace, once, on the member's settings file. Created 09/16/26 - 14:23 EDT.
//
// WHY. Members were sitting weeks behind because the toolkit's own session-start updater is a
// single rail, and when it fails it fails silently. Claude Code has had its own background
// updater for marketplaces since 2.0.70; it is simply OFF for anything that is not Anthropic's.
// Turning it on gives every member a second, independent rail.
//
// WHICH FILE, AND WHY NOT THE OTHER ONE. The decision inside the Claude Code binary reads the
// SETTINGS value first and only falls back to the marketplace registry's own key. Claude Code
// then syncs settings down into ~/.claude/plugins/known_marketplaces.json under its own lock,
// several times a session. So we write <configDir>/settings.json and NEVER the registry: losing
// a race on the registry file can leave a member with no marketplace for a whole session, which
// costs them every skill.
//
// SEVEN GUARDS, all required:
//   1. Never create the entry, and never create the container key. The kill switch REMOVES this
//      marketplace on a confirmed-ended membership; a blind write would resurrect a revoked
//      member's source with auto-update newly switched on.
//   2. Alias aware. Read `extraKnownMarketplaces`, else the documented alias `knownMarketplaces`.
//      Write back into whichever key already holds the entry.
//   3. Exact name "king-intelligence". Never the starter; members can hold both.
//   4. The portal source only, by the same exact-string regex portalToken() uses.
//   5. Only when autoUpdate is undefined. A member who switched it off in /plugin stays off by
//      construction. No flag file: a write we lost is simply retried next session, which is
//      strictly better than a write-once marker that records intent even when the effect was lost.
//   6. Locked write, the house pattern (mkdir lock, 5 minute stale reclaim, re-read inside the
//      lock, temp plus rename). Bail silently if held. Refuse if the file does not parse.
//      Plainly: this serializes OUR writers. It cannot prevent a lost update against Claude
//      Code's own writer, which is a further reason to write once and never re-assert.
//   7. Preserve the file mode. settings.json holds the env block; a member whose file is 0600
//      must not have it silently widened to 0644.
//
// The kill switch calls the same writer with want:false. It sets one boolean. It never deletes a
// key and never touches enabledPlugins: the file also holds env, model, theme and permissions,
// and the promise in auto-update.mjs is that a rejoin restores the member's setup exactly.
//
//   node native-autoupdate.mjs          run it (this is also its own session-start hook entry)
//   node native-autoupdate.mjs --print  print what it would do, change nothing
//
// Always exits 0.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MARKETPLACE = "king-intelligence";

// NO TOP-LEVEL IMPORT OF A SIBLING MODULE (fixed 9/16/26). This file now has its OWN entry in
// hooks.json, so a module-scope `import { configDir } from "./local-scripts.mjs"` would kill the
// whole hook with a stack trace and a non-zero exit the moment that sibling is missing or broken:
// a half-fetched clone, a bad publish, a version folder swept mid-write. Proven: copied alone into
// a folder, this file used to die with ERR_MODULE_NOT_FOUND and exit 1. A hook exits 0 or it is a
// bug. So the two-line answer lives here, and main() still PREFERS the shared helper, loaded with
// await import() inside a try, so the two cannot drift in the normal case.
function fallbackConfigDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

// The same exact-string discipline portalToken() uses in auto-update.mjs. It deliberately
// excludes the GitHub-PAT era installs and the free starter: neither can receive this rail.
export const PORTAL_URL_RE = /^https:\/\/[^@/]+@members\.king-intelligence\.com\/marketplace\.git$/;

const LOCK_STALE_MS = 5 * 60 * 1000;

/**
 * PURE. Given a parsed settings object, should we write, and into which container key?
 * Returns { write, reason, key, want }. Never throws, never touches the disk.
 */
export function planAutoUpdate(settings, opts = {}) {
  const name = typeof opts.name === "string" && opts.name ? opts.name : MARKETPLACE;
  const want = opts.want === false ? false : true;
  // The kill switch passes onlyIfUndefined:false, because switching a revoked machine off is not
  // a preference question. Everything else leaves a member's own choice alone.
  const onlyIfUndefined = opts.onlyIfUndefined !== false;

  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return { write: false, reason: "the settings file did not read as settings", key: null, want };
  }
  const has = (k) =>
    settings[k] && typeof settings[k] === "object" && !Array.isArray(settings[k]) &&
    Object.prototype.hasOwnProperty.call(settings[k], name);
  const key = has("extraKnownMarketplaces") ? "extraKnownMarketplaces" : has("knownMarketplaces") ? "knownMarketplaces" : null;
  if (!key) return { write: false, reason: "this computer has no entry for that library, so there is nothing to switch", key: null, want };

  const entry = settings[key][name];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return { write: false, reason: "the entry is not in a shape we recognise", key, want };
  }
  const url = entry.source && typeof entry.source === "object" ? entry.source.url : null;
  if (typeof url !== "string" || !PORTAL_URL_RE.test(url)) {
    return { write: false, reason: "that entry does not come from the members library", key, want };
  }
  if (entry.autoUpdate === want) return { write: false, reason: "already set the way we want it", key, want };
  if (onlyIfUndefined && entry.autoUpdate !== undefined) {
    return { write: false, reason: "the member set this themselves, so it is left alone", key, want };
  }
  return { write: true, reason: want ? "switch it on" : "switch it off", key, want };
}

function takeLock(lock) {
  try { fs.mkdirSync(lock); return true; } catch { /* held, or unwritable */ }
  try {
    if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) {
      fs.rmSync(lock, { recursive: true, force: true });
      fs.mkdirSync(lock);
      return true;
    }
  } catch { /* someone else has it */ }
  return false;
}

/**
 * Read the settings file, decide, and write at most one boolean. Never throws.
 * Returns { changed, reason, key, path, error }.
 */
export function ensureNativeAutoUpdate(opts = {}) {
  const out = { changed: false, reason: "", key: null, path: null, error: null };
  try {
    const dir = typeof opts.configDir === "string" && opts.configDir ? opts.configDir : fallbackConfigDir();
    const file = path.join(dir, "settings.json");
    out.path = file;
    if (!fs.existsSync(file)) { out.reason = "there is no settings file to change"; return out; }

    let raw;
    try { raw = fs.readFileSync(file, "utf8"); }
    catch (e) { out.reason = "the settings file could not be read"; out.error = String((e && e.code) || "read failed"); return out; }

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { out.reason = "the settings file does not parse, so nothing was touched"; out.error = "unparseable"; return out; }

    const plan = planAutoUpdate(parsed, opts);
    out.key = plan.key;
    out.reason = plan.reason;
    if (!plan.write) return out;
    if (opts.dryRun) { out.reason = `${plan.reason} (dry run, nothing written)`; return out; }

    const lock = `${file}.ki-lock`;
    if (!takeLock(lock)) { out.reason = "another window is writing the settings file"; return out; }
    try {
      // Re-read INSIDE the lock: the decision above was made on a copy that another of our own
      // writers may have replaced in the meantime.
      let fresh;
      try { fresh = JSON.parse(fs.readFileSync(file, "utf8")); }
      catch { out.reason = "the settings file changed and no longer parses"; out.error = "unparseable"; return out; }
      const again = planAutoUpdate(fresh, opts);
      out.key = again.key;
      out.reason = again.reason;
      if (!again.write) return out;

      let mode = null;
      try { mode = fs.statSync(file).mode & 0o777; } catch { /* keep the default */ }

      fresh[again.key][typeof opts.name === "string" && opts.name ? opts.name : MARKETPLACE].autoUpdate = again.want;
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(fresh, null, 2) + "\n");
      if (mode !== null) { try { fs.chmodSync(tmp, mode); } catch { /* best effort */ } }
      fs.renameSync(tmp, file);
      out.changed = true;
      out.reason = again.want ? "switched on" : "switched off";
      return out;
    } finally {
      try { fs.rmSync(lock, { recursive: true, force: true }); } catch { /* it will go stale */ }
    }
  } catch (e) {
    out.error = String((e && e.message) || e);
    out.reason = "nothing was changed";
    return out;
  }
}

// ---- command line ----
// The entry call sits at the BOTTOM of the file on purpose: a call above the function and const
// declarations it uses hits the temporal dead zone and kills the hook (ki-plugin/CLAUDE.md).
async function main() {
  try {
    const dryRun = process.argv.includes("--print");
    // Prefer the shared helper when it is there, so the config folder is resolved in exactly one
    // place; fall back to our own two lines when it is not. Inside the try, never at module scope.
    let dir = null;
    try { const ls = await import("./local-scripts.mjs"); if (ls && ls.configDir) dir = ls.configDir(); } catch { /* our own answer stands */ }
    const r = ensureNativeAutoUpdate(dir ? { dryRun, configDir: dir } : { dryRun });
    if (dryRun) console.log(JSON.stringify(r));
  } catch { /* a hook never fails loudly */ }
  process.exitCode = 0;
}

const isMain = (() => {
  try { return !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (isMain) main();
