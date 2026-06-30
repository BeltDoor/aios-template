#!/usr/bin/env node
// Session-start AUTO-UPDATE. Per the 6/24/26 dial: TOOLS update silently on their own, while
// anything that touches the client's OWN files stays a one-tap, never-overwrite suggestion that
// lives in /king-intelligence:update Part 3. So this hook refreshes the catalog and, when a newer
// version exists, SILENTLY APPLIES it (claude plugin update), then NARRATES what landed and INVITES
// the client to review file-level suggestions. It never edits the client's files itself. When
// there is no new version it still surfaces unseen suggestions. Throttled to once / ~20h. ALWAYS
// exits 0. Set KI_AUTOUPDATE_DRYRUN=1 (+ optional KI_AUTOUPDATE_FAKE_LATEST=x.y.z) to exercise the
// message paths without touching the real install.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
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

  // throttle
  const marker = join(data, ".last-autocheck");
  const now = Date.now();
  let last = 0; try { last = parseInt(readFileSync(marker, "utf8"), 10) || 0; } catch {}
  const TWENTY_H = 20 * 60 * 60 * 1000;
  if (now - last < TWENTY_H) process.exit(0);

  // gate: only keyed clients can pull from the marketplace. A free-starter / offline client
  // makes the catalog refresh throw; we swallow it and fall back to the pattern nudge.
  const DRY = process.env.KI_AUTOUPDATE_DRYRUN === "1";
  const installed = readVersion(join(root, ".claude-plugin", "plugin.json"));

  // refresh the catalog (gate: a free-starter / offline client makes this throw, so we fall back
  // to the unseen-suggestion path and never apply anything).
  let catalogRefreshed = false;
  if (DRY) { catalogRefreshed = true; }
  else { try { execSync('claude plugin marketplace update king-intelligence', { timeout: 30000, stdio: "ignore" }); catalogRefreshed = true; } catch {} }

  let msg = null;
  if (catalogRefreshed) {
    const latest = DRY ? (process.env.KI_AUTOUPDATE_FAKE_LATEST || null) : latestFromCatalog();
    if (latest && installed && semverGt(latest, installed)) {
      // SILENT APPLY: tools update on their own (the dial). Best-effort; it lands on next restart.
      let applied = false;
      if (DRY) { applied = true; }
      else { try { execSync('claude plugin update king-intelligence@king-intelligence', { timeout: 60000, stdio: "ignore" }); applied = true; } catch {} }

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
      mkdirSync(data, { recursive: true });
      writeFileSync(marker, String(now));
      const cfgPath = join(data, "config.json");
      if (existsSync(cfgPath)) {
        const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
        cfg.autoUpdate = { ...(cfg.autoUpdate || {}), lastCheckedVersion: installed, lastCheckedAt: now };
        writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
      }
    } catch {}
  } else {
    // quiet session: still stamp so we don't recheck for 20h
    try { mkdirSync(data, { recursive: true }); writeFileSync(marker, String(now)); } catch {}
  }
} catch {}
process.exit(0);
