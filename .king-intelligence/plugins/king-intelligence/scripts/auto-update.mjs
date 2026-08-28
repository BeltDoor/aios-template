#!/usr/bin/env node
// Session-start AUTO-UPDATE. Per the 6/24/26 dial: TOOLS update silently on their own, while
// anything that touches the client's OWN files stays a one-tap, never-overwrite suggestion that
// lives in /king-intelligence:update Part 3. So this hook refreshes the catalog and, when a newer
// version exists, SILENTLY APPLIES it (claude plugin update), then NARRATES what landed and INVITES
// the client to review file-level suggestions. It never edits the client's files itself. When
// there is no new version it still surfaces unseen suggestions. Throttled to once / ~20h. ALWAYS
// exits 0. Set KI_AUTOUPDATE_DRYRUN=1 (+ optional KI_AUTOUPDATE_FAKE_LATEST=x.y.z) to exercise the
// message paths without touching the real install.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from "node:fs";
// (rmSync + existsSync are also used by the update-failure record added 8/21/26)
import { execSync } from "node:child_process";
import { join } from "node:path";
// The removal judgement lives in its own module so it can be tested; this file does its
// work on import and reaches the network, so nothing here could otherwise be exercised.
import { confirmEnded } from "./kill-switch-rules.mjs";
import { homedir } from "node:os";

const emit = (msg) => {
  try {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: msg },
    }));
  } catch {}
};

const semverGt = (a, b) => {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false; }
  return false;
};

const readVersion = (p) => { try { return JSON.parse(readFileSync(p, "utf8")).version || null; } catch { return null; } };

// Find the latest available plugin version from the refreshed marketplace cache (best-effort).
function latestFromCatalog() {
  const base = join(homedir(), ".claude", "plugins", "marketplaces");
  const candidates = [
    join(base, "king-intelligence", "plugins", "king-intelligence", ".claude-plugin", "plugin.json"),
  ];
  for (const c of candidates) { const v = readVersion(c); if (v) return v; }
  // fallback: shallow-scan marketplace dirs for any king-intelligence plugin manifest
  try {
    for (const dir of readdirSync(base)) {
      const p = join(base, dir, "plugins", "king-intelligence", ".claude-plugin", "plugin.json");
      const v = readVersion(p); if (v) return v;
    }
  } catch {}
  return null;
}

// The plain, client-friendly one-line "what's new" for the version just pulled. Authored per release
// in defaults/whats-new.txt (NOT the technical CHANGELOG). Read from the refreshed marketplace cache,
// same place as the version. Fully optional: any miss returns null and the message stays generic.
function latestWhatsNew() {
  if (process.env.KI_AUTOUPDATE_DRYRUN === "1") return process.env.KI_AUTOUPDATE_FAKE_WHATSNEW || null;
  const base = join(homedir(), ".claude", "plugins", "marketplaces");
  const first = (p) => { try { const t = readFileSync(p, "utf8").trim(); return t ? t.split("\n")[0].trim() : null; } catch { return null; } };
  const direct = first(join(base, "king-intelligence", "plugins", "king-intelligence", "defaults", "whats-new.txt"));
  if (direct) return direct;
  try { for (const dir of readdirSync(base)) { const v = first(join(base, dir, "plugins", "king-intelligence", "defaults", "whats-new.txt")); if (v) return v; } } catch {}
  return null;
}

// PER-SKILL OPT-OUT (added 7/20/26, client feedback). A client can turn off individual skills by
// listing folder names under `disabledSkills` in $CLAUDE_PLUGIN_DATA/config.json, e.g.
// { "disabledSkills": ["email", "brainstorming"] }. This prunes those folders from the installed
// plugin so they never load — and because it runs EVERY session start (before the 20h throttle)
// and again right after a silent update applies, an update can never resurrect a disabled skill.
// Unknown names are ignored; native commands (adapt/update) are untouchable by design. Returns the
// number of folders pruned this run (0 when already clean).
function pruneDisabledSkills(root, data) {
  try {
    const cfg = JSON.parse(readFileSync(join(data, "config.json"), "utf8"));
    const list = Array.isArray(cfg.disabledSkills) ? cfg.disabledSkills : [];
    let pruned = 0;
    for (const name of list) {
      if (typeof name !== "string" || !/^[a-z0-9][a-z0-9-]*$/i.test(name)) continue; // no path tricks
      const dir = join(root, "skills", name);
      if (existsSync(dir)) { try { rmSync(dir, { recursive: true, force: true }); pruned++; } catch {} }
    }
    return pruned;
  } catch { return 0; }
}

// KILL SWITCH (added 8/26/26). A machine whose membership has ENDED turns the toolkit off
// itself. The portal's /api/plugin-access/status answers with the machine's own marketplace
// token: "live" (carry on), "ended" (membership positively over -> disable the plugin locally),
// "unknown" (the token matches nothing — a regenerated line — tell the member, never disable).
// A network error, timeout, or 5xx answers null and NOTHING happens: only a confirmed "ended"
// from a successful database read ever disables, the same never-cut-off-on-an-outage law the
// portal's own revoke cron follows. Free-starter installs have no portal marketplace and are
// skipped entirely.
function portalToken() {
  try {
    const km = JSON.parse(readFileSync(join(homedir(), ".claude", "plugins", "known_marketplaces.json"), "utf8"));
    const url = km?.["king-intelligence"]?.source?.url || "";
    const m = url.match(/^https:\/\/([^@/]+)@members\.king-intelligence\.com\/marketplace\.git$/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

async function accessStatus(token) {
  if (process.env.KI_AUTOUPDATE_DRYRUN === "1") return process.env.KI_AUTOUPDATE_FAKE_ACCESS || null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch("https://members.king-intelligence.com/api/plugin-access/status", {
      headers: { Authorization: "Bearer " + token },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.status !== 200) return null; // 5xx / anything odd = could not check = do nothing
    const body = await res.json();
    return body && (body.access === "live" || body.access === "ended" || body.access === "unknown")
      ? body.access
      : null;
  } catch { return null; }
}

function unseenPatternCount(root, data) {
  try {
    const shipped = readdirSync(join(root, "patterns")).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
    let cfg = {}; try { cfg = JSON.parse(readFileSync(join(data, "config.json"), "utf8")); } catch {}
    const p = cfg.patterns || {};
    const seen = new Set([...(p.adopted || []), ...(p.declined || [])]);
    return shipped.filter((id) => !seen.has(id)).length;
  } catch { return 0; }
}

try {
  const data = process.env.CLAUDE_PLUGIN_DATA;
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  if (!data || !root) process.exit(0);

  // enforce the client's per-skill opt-out on EVERY session start, before the throttle can exit —
  // cheap, and it guarantees a disabled skill stays gone no matter when the last update landed.
  pruneDisabledSkills(root, data);

  // throttle
  const marker = join(data, ".last-autocheck");
  const now = Date.now();
  const TWENTY_H = 20 * 60 * 60 * 1000;
  const ONE_H = 60 * 60 * 1000;
  // marker format is "<epoch>" (old) or "<epoch>:<waitMs>" (new). A run that FAILED writes the
  // short wait, so a machine that cannot update retries within the hour instead of once a day.
  // A machine can otherwise sit versions behind for weeks while in daily use, silently.
  let last = 0, wait = TWENTY_H;
  try {
    const raw = String(readFileSync(marker, "utf8")).trim().split(":");
    last = parseInt(raw[0], 10) || 0;
    if (raw[1]) wait = parseInt(raw[1], 10) || TWENTY_H;
  } catch {}
  if (now - last < wait) process.exit(0);

  // Whatever happens below, leave a record of it. It rides up to the portal on the next snapshot,
  // which is the only way the owner ever finds out a client's updates are failing.
  // Is this machine even ON the updatable rail? A free-starter install has only a local
  // marketplace (king-intelligence-starter) and can never pull a release, by design. Telling
  // those two cases apart is what keeps the short retry meaningful.
  const onKeyedRail = (() => {
    try {
      const km = JSON.parse(readFileSync(join(homedir(), ".claude", "plugins", "known_marketplaces.json"), "utf8"));
      return Object.keys(km || {}).some((k) => k === "king-intelligence");
    } catch { return false; }
  })();

  // WRITTEN WHERE THE ENGINE ACTUALLY READS (fixed 8/28/26).
  //
  // This note is the ONLY way anyone finds out that a member's updates are failing. It was
  // being written under the plugin's own data folder while measure-sessions.mjs reads from
  // the home folder, which is where the ledger moved on 8/21 when per-machine state was
  // taken out of CLAUDE_PLUGIN_DATA. The reader moved and the writer did not, so the note
  // landed somewhere nothing looks: every machine in the fleet reported no update failure,
  // and that read as "everyone is updating cleanly" when it only ever meant "nobody can
  // see". Same resolution as the engine, override included, so the two cannot drift again.
  const errDir =
    process.env.KI_TIME_SAVED_DIR ||
    join(homedir(), ".claude", "king-intelligence", "time-saved");
  const errPath = join(errDir, "update-error.json");
  // The old location, still cleared on success so a stale note from a previous version
  // cannot sit there for ever claiming a failure that has since been fixed.
  const legacyErrPath = join(data, "time-saved", "update-error.json");
  const noteFailure = (stage, detail) => {
    try {
      mkdirSync(errDir, { recursive: true });
      writeFileSync(errPath, JSON.stringify({ stage, detail: String(detail || "").slice(0, 300), at: new Date().toISOString() }));
    } catch {}
  };
  const clearFailure = () => {
    for (const p of [errPath, legacyErrPath]) {
      try { if (existsSync(p)) rmSync(p, { force: true }); } catch {}
    }
  };
  const stamp = (waitMs) => { try { mkdirSync(data, { recursive: true }); writeFileSync(marker, now + ":" + waitMs); } catch {} };

  // gate: only keyed clients can pull from the marketplace. A free-starter / offline client
  // makes the catalog refresh throw; we swallow it and fall back to the pattern nudge.
  const DRY = process.env.KI_AUTOUPDATE_DRYRUN === "1";
  const installed = readVersion(join(root, ".claude-plugin", "plugin.json"));

  // ---- KILL SWITCH: is this machine's membership still live? ----
  // Runs before the catalog refresh so an ended membership is handled in one clean step
  // instead of surfacing as a mysterious failed update. Only a portal-keyed machine is
  // checked; GitHub-PAT and free-starter machines have no portal token and are skipped.
  {
    const tok = DRY ? "dry-run" : portalToken();
    if (tok) {
      const status = await accessStatus(tok);

      // ONE answer is not enough to take a paying member's toolkit away (8/28/26).
      //
      // "ended" is a reading of two database columns, and those columns have been WRONG for
      // real members twice: two were keyed with a subscription status of "none" (8/21/26),
      // and an expired-trial sweep stamped another as revoked the day before Jacob
      // reinstated her (8/24/26). Every one of them would have read as ended here.
      //
      // What made that dangerous is that the act is not reversible from the member's side:
      // removing the plugin removes the hook that would have healed it, so recovery needs a
      // fresh install line from /system, which needs a live membership to view. A member
      // wrongly cut off cannot get themselves back.
      //
      // So it now takes TWO confirmations at least six hours apart. A membership that has
      // really ended is still ended six hours later, so a genuine removal is delayed by a
      // session or two and nothing else. A wrong column, or a bad minute in the database,
      // gets the chance to be right before anyone's tools are taken.
      // The judgement itself lives in kill-switch-rules.mjs, next to its test. Everything
      // here is the filing: read the note, do what it says, write the note back.
      const streakFile = join(data, ".ended-confirmations");
      let raw = null;
      try { raw = existsSync(streakFile) ? readFileSync(streakFile, "utf8") : null; } catch {}
      const verdict = confirmEnded(status, now, raw);
      if (verdict.write !== null) { try { writeFileSync(streakFile, String(verdict.write)); } catch {} }
      if (verdict.clear) { try { if (existsSync(streakFile)) rmSync(streakFile, { force: true }); } catch {} }
      const confirmed = verdict.confirmed;

      if (status === "ended" && confirmed) {
        // REMOVE, not just disable (Jacob's call, 8/26/26): the skills must not remain on a
        // non-member's machine. Uninstall the plugin (fallback: disable), drop the keyed
        // marketplace (the cached clone is a second on-disk copy of every skill), then sweep
        // any leftover king-intelligence folders under ~/.claude/plugins. ONLY those two
        // exactly-named folders are ever touched — never the member's own files, never other
        // plugins, and never CLAUDE_PLUGIN_DATA (their config survives so a rejoin restores
        // their setup exactly). The starter marketplace (king-intelligence-starter) is not
        // touched either; a machine on it never reaches this code (no portal token).
        if (!DRY) {
          try { execSync('claude plugin uninstall king-intelligence@king-intelligence', { timeout: 60000, stdio: "ignore" }); }
          catch {
            try { execSync('claude plugin disable king-intelligence@king-intelligence', { timeout: 30000, stdio: "ignore" }); }
            catch (e) { noteFailure("kill-switch-disable", e && e.message); }
          }
          try { execSync('claude plugin marketplace remove king-intelligence', { timeout: 30000, stdio: "ignore" }); } catch {}
          for (const leftover of [
            join(homedir(), ".claude", "plugins", "marketplaces", "king-intelligence"),
            join(homedir(), ".claude", "plugins", "cache", "king-intelligence"),
          ]) {
            try { if (existsSync(leftover)) rmSync(leftover, { recursive: true, force: true }); } catch {}
          }
        }
        emit(
          "Your King Intelligence membership has ended, so the toolkit has been removed from this computer. " +
          "Nothing of yours was touched: your files, your notes, and everything you built are exactly where they were. " +
          "Rejoin any time at https://members.king-intelligence.com and your tools come right back. " +
          "IMPORTANT: tell the user the line above in your own first reply, then carry on with whatever they asked."
        );
        stamp(ONE_H); // if the disable didn't stick, try again within the hour
        process.exit(0);
      }
      if (status === "unknown") {
        emit(
          "King Intelligence: this computer's access line is out of date (it was probably regenerated on the member page). " +
          "Updates are paused until it's refreshed. Tell the user: grab the new install line from " +
          "https://members.king-intelligence.com/system and paste it here. Mention this once, briefly, then carry on."
        );
        stamp(TWENTY_H); // don't nag every session; tools keep working locally meanwhile
        process.exit(0);
      }
      // "live" or null (couldn't check) -> carry on to the normal update path.
    }
  }

  // refresh the catalog (gate: a free-starter / offline client makes this throw, so we fall back
  // to the unseen-suggestion path and never apply anything).
  let catalogRefreshed = false;
  if (DRY) { catalogRefreshed = true; }
  else {
    try { execSync('claude plugin marketplace update king-intelligence', { timeout: 30000, stdio: "ignore" }); catalogRefreshed = true; }
    catch (e) { if (onKeyedRail) noteFailure("marketplace-refresh", e && e.message); }
  }

  let msg = null;
  if (catalogRefreshed) {
    const latest = DRY ? (process.env.KI_AUTOUPDATE_FAKE_LATEST || null) : latestFromCatalog();
    if (latest && installed && semverGt(latest, installed)) {
      // SILENT APPLY: tools update on their own (the dial). Best-effort; it lands on next restart.
      let applied = false;
      if (DRY) { applied = true; }
      else {
        try { execSync('claude plugin update king-intelligence@king-intelligence', { timeout: 60000, stdio: "ignore" }); applied = true; clearFailure(); }
        catch (e) { noteFailure("apply-update", e && e.message); }
      }

      // the fresh update just restored every skill folder — re-apply the client's opt-out now
      if (applied && !DRY) pruneDisabledSkills(root, data);

      const n = unseenPatternCount(root, data); // file-level "ways of working" not yet seen
      const whatsNew = latestWhatsNew();
      const head = applied
        ? `King Intelligence just updated itself in the background. You're now on v${latest} (up from v${installed}).${whatsNew ? ` What's new: ${whatsNew}` : ""} Your tools are current; reopen Claude Code when you can, to load them.`
        : `King Intelligence has a newer version (v${latest}, you're on v${installed}). Run /king-intelligence:update to finish pulling it.`;
      const invite = n > 0
        ? ` I also have ${n} suggestion${n === 1 ? "" : "s"} for your own setup. Want me to walk through ${n === 1 ? "it" : "them"}? I never change anything you've already set up, and nothing happens without your yes. Say yes, or run /king-intelligence:update.`
        : ` To see exactly what changed, run /king-intelligence:update.`;
      msg = head + invite;
    }
  }

  if (catalogRefreshed) clearFailure(); // reaching the marketplace at all means the rail is alive

  // no new version -> still surface unseen file-level suggestions (these never auto-apply).
  if (!msg) {
    const unseen = unseenPatternCount(root, data);
    if (unseen > 0) {
      msg = `King Intelligence: I have ${unseen} new way${unseen === 1 ? "" : "s"} of working to suggest. Run /king-intelligence:update to review ${unseen === 1 ? "it" : "them"}, one tap each. I never overwrite what you already have, and nothing changes without your yes.`;
    }
  }

  if (msg) {
    emit(msg);
    // record + stamp only after emitting, so a write failure never silences the next session
    try {
      stamp(catalogRefreshed || !onKeyedRail ? TWENTY_H : ONE_H);
      const cfgPath = join(data, "config.json");
      if (existsSync(cfgPath)) {
        const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
        cfg.autoUpdate = { ...(cfg.autoUpdate || {}), lastCheckedVersion: installed, lastCheckedAt: now };
        writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
      }
    } catch {}
  } else {
    // quiet session: stamp so we do not recheck for 20h. But if the marketplace could not be
    // reached at all, that is NOT a quiet session, it is a broken rail: retry within the hour.
    stamp(catalogRefreshed || !onKeyedRail ? TWENTY_H : ONE_H);
  }
} catch {}
process.exit(0);
