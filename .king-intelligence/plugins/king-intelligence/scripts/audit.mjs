#!/usr/bin/env node
// audit.mjs — the read-only inspector behind /king-intelligence:update Part 3.
// Looks at FOUR pillars of the client's setup (folders, Claude Code config, connections, skills),
// figures out what changed since they last synced, and prints ONE JSON report. It NEVER writes
// anything and ALWAYS exits 0, so it can't break a session. update.md reads the report, shows the
// deep read, and surfaces only the ACTIONABLE items in a pick list.
//
// Usage: node audit.mjs <pluginRoot> <pluginData> <projectDir>
//   (same arg order as patterns-context.mjs; falls back to env / cwd)
//
// Output (stdout): a single JSON object. Shape:
// {
//   version: { installed, lastSynced, isFirstSync },
//   changelog: [ { version, tags:[...], text } ],          // entries newer than lastSynced
//   pillars: {
//     folders:     { available, ok, missingClaudeMd:[], layoutDrift, migrationDone, note },
//     config:      { available, wouldChange, added:[...], note },
//     connections: { available, servers:[...], gaps:[...], note },
//     skills:      { installed:[...], duplicates:[...], note }
//   },
//   rules:   { unseen:[{id,title,whatThisIs}], changed:[{id,title,whatThisIs,since}] },
//   actionable: { rules:[...], connections:[...], duplicates:[...] },   // what the pick list offers
//   migrations: { outstanding:[...] }                                   // Part 2 owns these; surfaced for the summary
// }

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || process.env.CLAUDE_PLUGIN_ROOT || ".";
const data = process.argv[3] || process.env.CLAUDE_PLUGIN_DATA || ".";
const proj = process.argv[4] || process.env.CLAUDE_PROJECT_DIR || process.cwd();

// --- tiny helpers, all failure-tolerant ---
const semverGt = (a, b) => {
  const pa = String(a || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "0").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
};
const readJSON = (p, fallback) => {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; }
};
const readText = (p) => {
  try { return readFileSync(p, "utf8"); } catch { return ""; }
};
const tryExec = (cmd, args) => {
  // run a command, return stdout string or null on any failure (missing binary, nonzero exit, prompt)
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 20000 });
  } catch (e) {
    return (e && e.stdout) ? String(e.stdout) : null;
  }
};
// pull a single scalar field out of a markdown frontmatter block
const frontmatterField = (text, key) => {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const line = m[1].split("\n").find((l) => l.trim().startsWith(key + ":"));
  return line ? line.slice(line.indexOf(":") + 1).trim() : null;
};

const report = {
  version: {}, changelog: [], pillars: {}, rules: { unseen: [], changed: [] },
  actionable: { rules: [], connections: [], duplicates: [] }, migrations: { outstanding: [] },
};

// ===== version + config =====
const installed = (readJSON(join(root, ".claude-plugin", "plugin.json"), {}) || {}).version || "0.0.0";
const cfg = readJSON(join(data, "config.json"), {}) || {};
const patterns = (cfg.patterns && typeof cfg.patterns === "object") ? cfg.patterns : { adopted: [], declined: [], lastSyncedVersion: null };
const adopted = new Set(Array.isArray(patterns.adopted) ? patterns.adopted : []);
const declined = new Set(Array.isArray(patterns.declined) ? patterns.declined : []);
const lastSynced = patterns.lastSyncedVersion || null;
report.version = { installed, lastSynced, isFirstSync: !lastSynced };

// ===== changelog diff (what shipped since they last synced) =====
try {
  const cl = readText(join(root, "CHANGELOG.md"));
  // each entry: "## X.Y.Z — <date> — <note>" possibly with [tag] markers anywhere in the heading
  const re = /^##\s+([0-9]+\.[0-9]+\.[0-9]+)\b(.*)$/gm;
  let m;
  while ((m = re.exec(cl)) !== null) {
    const v = m[1];
    if (lastSynced && !semverGt(v, lastSynced)) continue; // only newer than last sync
    const heading = (m[2] || "").trim();
    const tags = (heading.match(/\[(additive|bugfix|rules|migration)\]/g) || []).map((t) => t.slice(1, -1));
    report.changelog.push({ version: v, tags, text: ("## " + v + " " + heading).trim() });
  }
} catch { /* report.changelog stays [] */ }

// ===== rules (unseen + changed) =====
try {
  const pdir = join(root, "patterns");
  for (const f of readdirSync(pdir)) {
    if (!f.endsWith(".md")) continue;
    const text = readText(join(pdir, f));
    const id = frontmatterField(text, "id") || f.replace(/\.md$/, "");
    const title = frontmatterField(text, "title") || id;
    const since = frontmatterField(text, "since") || "0.0.0";
    // first non-empty line under "## What this is"
    let whatThisIs = "";
    const wm = text.match(/##\s*What this is\s*\n+([^\n]+)/i);
    if (wm) whatThisIs = wm[1].trim();
    const seen = adopted.has(id) || declined.has(id);
    if (!seen) {
      report.rules.unseen.push({ id, title, whatThisIs });
    } else if (adopted.has(id) && lastSynced && semverGt(since, lastSynced)) {
      report.rules.changed.push({ id, title, whatThisIs, since });
    }
  }
} catch { /* rules stay empty */ }

// ===== pillar: folders (org-check, read-only) =====
{
  const p = { available: false, ok: null, missingClaudeMd: [], layoutDrift: null, migrationDone: false, note: "" };
  // migration ledger tells us whether the folder-org machinery exists yet
  const ledger = readJSON(join(proj, ".claude", ".ki-migrations.json"), {}) || {};
  p.migrationDone = ledger["v1-org-gotcha"] === "done";
  const out = tryExec("node", [join(root, "scripts", "org-check.mjs"), "--json", "--root", proj]);
  if (out) {
    const parsed = (() => { try { return JSON.parse(out); } catch { return null; } })();
    if (parsed) {
      p.available = true;
      p.ok = !!parsed.ok;
      p.missingClaudeMd = Array.isArray(parsed.missingClaudeMd) ? parsed.missingClaudeMd : [];
      p.layoutDrift = !!parsed.layoutDrift;
      p.note = p.migrationDone
        ? "Folder health checked. Any fixes are owned by the org setup migration in Part 2 (additive)."
        : "Folder-org machinery not set up here yet; the Part 2 migration installs it. Reported read-only.";
    }
  }
  if (!p.available) p.note = "Couldn't read folder health (org-check unavailable here). Skipped, not blocking.";
  report.pillars.folders = p;
}

// ===== pillar: config (config-merge --check, read-only) =====
{
  const p = { available: false, wouldChange: false, added: [], note: "" };
  const defaults = join(root, "defaults", "config-defaults.json");
  const clientCfg = join(proj, "references", "king-intelligence-config.md");
  if (existsSync(defaults) && existsSync(clientCfg)) {
    const out = tryExec("node", [join(root, "scripts", "config-merge.mjs"), "--check", defaults, clientCfg]);
    const parsed = out ? (() => { try { return JSON.parse(out); } catch { return null; } })() : null;
    if (parsed) {
      p.available = true;
      p.wouldChange = !!parsed.wouldChange;
      p.added = Array.isArray(parsed.added) ? parsed.added : [];
      p.note = p.wouldChange
        ? "New canonical config keys are available; the Part 2 migration adds them additively (never changes a value you set)."
        : "Your config has all current canonical keys.";
    }
  }
  if (!p.available) p.note = "No client config file found yet (set up by the Part 2 migration). Skipped.";
  report.pillars.config = p;
}

// ===== pillar: connections (claude mcp list + requires-mcp declarations) =====
{
  const p = { available: false, servers: [], gaps: [], note: "", checkedSkillCount: 0 };
  const out = tryExec("claude", ["mcp", "list"]);
  if (out) {
    p.available = true;
    // best-effort: each non-empty line typically starts with a server name (tolerate any format).
    // Drop obvious header words and dedupe, since the list is only informational in the receipt.
    const noise = new Set(["Checking", "Health", "Name", "No", "MCP"]);
    p.servers = [...new Set(out.split("\n").map((l) => l.trim()).filter(Boolean)
      .map((l) => (l.match(/^([A-Za-z0-9_.-]+)/) || [])[1])
      .filter((n) => n && !noise.has(n)))];
  }
  // collect requires-mcp declarations from the skills the client has (frontmatter line, pipe-delimited:
  // "name | install-command | plain why"; bare "name" also accepted)
  try {
    const sdir = join(root, "skills");
    for (const name of readdirSync(sdir)) {
      const sk = join(sdir, name, "SKILL.md");
      if (!existsSync(sk)) continue;
      p.checkedSkillCount += 1;
      const decl = frontmatterField(readText(sk), "requires-mcp");
      if (!decl) continue;
      for (const part of decl.split(",")) {
        const [server, install, why] = part.split("|").map((x) => (x || "").trim());
        if (!server) continue;
        const have = p.available && p.servers.some((s) => s.toLowerCase() === server.toLowerCase());
        if (!have) p.gaps.push({ skill: name, server, install: install || null, why: why || null });
      }
    }
  } catch { /* no skills dir */ }
  // Same trap as the skills pillar: this reads the connection requirements OUT of the
  // skills on disk, and from v0.47.0 there are none. With nothing read, "all connections
  // your skills need are present" is a green tick backed by nothing. Say what is true.
  const nothingToCheck = p.checkedSkillCount === 0;
  p.note = !p.available
    ? "Couldn't read your connections (skipped, not blocking)."
    : nothingToCheck
      ? "Your skills come from your membership now, so this can't tell in advance which connections they need. If a skill asks for one, it will say so at the time."
      : p.gaps.length
        ? "Some skills need a connection you don't have set up yet."
        : "All connections your skills need are present.";
  report.pillars.connections = p;
}

// ===== pillar: skills (installed + stray duplicates) =====
{
  // From v0.47.0 the plugin ships NO skills: they are served from the member's
  // membership, one use at a time. This pillar can then only ever find zero, and the
  // danger is what it would say next. Reporting "no stray duplicates found" and "all
  // connections your skills need are present" would be a clean bill of health this
  // check can no longer back, which is exactly the failure shape Jacob has been
  // burned by before: a green tick whose scope no longer matches its claim. So when
  // there are no local skills to inspect, it says so plainly instead. (8/27/26)
  const p = { installed: [], duplicates: [], note: "", servedFromMembership: false };
  try { p.installed = readdirSync(join(root, "skills")).filter((n) => existsSync(join(root, "skills", n, "SKILL.md"))); } catch {}
  p.servedFromMembership = p.installed.length === 0;
  // a real local skill folder that duplicates one the client already gets via the plugin
  try {
    const localDir = join(proj, ".claude", "skills");
    if (existsSync(localDir)) {
      for (const name of readdirSync(localDir)) {
        const localPath = join(localDir, name);
        let isDir = false; try { isDir = statSync(localPath).isDirectory(); } catch {}
        if (isDir && p.installed.includes(name)) {
          p.duplicates.push({ name, localPath, note: "Real local copy of a skill you also get from the plugin." });
        }
      }
    }
  } catch {}
  p.note = p.servedFromMembership
    ? "Your skills come straight from your membership now, so there is nothing installed here to check. This is normal."
    : p.duplicates.length
      ? "Found local skill copies that duplicate plugin skills. Confirm against the real list before cleaning."
      : "No stray duplicate skills found.";
  report.pillars.skills = p;
}

// ===== migrations outstanding (Part 2 owns the fix; surfaced for the summary) =====
try {
  const out = tryExec("node", [join(root, "scripts", "migration.mjs"), "status", root, proj, data]);
  if (out) {
    const line = out.split("\n").find((l) => l.trim().startsWith("["));
    if (line) { try { report.migrations.outstanding = JSON.parse(line); } catch {} }
  }
} catch {}

// ===== actionable roll-up (exactly what the pick list should offer) =====
report.actionable.rules = [...report.rules.unseen.map((r) => ({ ...r, kind: "new" })),
                           ...report.rules.changed.map((r) => ({ ...r, kind: "changed" }))];
report.actionable.connections = report.pillars.connections.gaps;
report.actionable.duplicates = report.pillars.skills.duplicates;

process.stdout.write(JSON.stringify(report, null, 2) + "\n");
