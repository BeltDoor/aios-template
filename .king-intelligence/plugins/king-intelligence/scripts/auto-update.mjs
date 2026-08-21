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
  const errPath = join(data, "time-saved", "update-error.json");
  const noteFailure = (stage, detail) => {
    try {
      mkdirSync(join(data, "time-saved"), { recursive: true });
      writeFileSync(errPath, JSON.stringify({ stage, detail: String(detail || "").slice(0, 300), at: new Date().toISOString() }));
    } catch {}
  };
  const clearFailure = () => { try { if (existsSync(errPath)) rmSync(errPath, { force: true }); } catch {} };
  const stamp = (waitMs) => { try { mkdirSync(data, { recursive: true }); writeFileSync(marker, now + ":" + waitMs); } catch {} };

  // gate: only keyed clients can pull from the marketplace. A free-starter / offline client
  // makes the catalog refresh throw; we swallow it and fall back to the pattern nudge.
  const DRY = process.env.KI_AUTOUPDATE_DRYRUN === "1";
  const installed = readVersion(join(root, ".claude-plugin", "plugin.json"));

  // refresh the catalog (gate: a free-starter / offline client makes this throw, so we fall back
  // to the unseen-suggestion path and never apply anything).
  let catalogRefreshed = false;
  if (DRY) { catalogRefreshed = true; }
  else {
    try { execSync('claude plugin marketplace update king-intelligence', { timeout: 30000, stdio: "ignore" }); catalogRefreshed = true; }
    catch (e) { noteFailure("marketplace-refresh", e && e.message); }
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
      stamp(catalogRefreshed ? TWENTY_H : ONE_H);
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
    stamp(catalogRefreshed ? TWENTY_H : ONE_H);
  }
} catch {}
process.exit(0);
