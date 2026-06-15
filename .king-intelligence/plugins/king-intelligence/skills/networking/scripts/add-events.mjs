// add-events.mjs — deterministic calendar inserter for the /networking skill.
//
// Reads a candidates JSON, dedupes each against the LIVE calendar (same local day,
// start within +/-150 min, similar title), and inserts the survivors as
// status:tentative + colorId:3 (purple) via a Google-style calendar CLI. Also dedupes
// within the batch so one run never double-adds the same event.
//
// This script is written for a Google Calendar CLI (e.g. `gws`). If no calendar
// command is configured, it prints the deduped survivor list as a handoff and writes
// nothing — the skill then hands that list to the user to add manually.
//
// Per-client settings are read at runtime, NOT hardcoded:
//   - selfEmail : env NET_SELF_EMAIL, or --config <path> -> skills.networking.selfEmail
//   - calendar command : env NET_CAL_CMD (default 'gws.cmd'), or config
// If selfEmail is empty, the user is simply not added as a guest (no RSVP prompt),
// which is fine — the event still lands as a tentative hold.
//
// Windows note: a CLI .cmd shim needs shell:true + manual cmd.exe-safe quoting
// (inner " doubled to ""). The quoting helper below handles that on every OS.
//
// Usage:
//   node scripts/add-events.mjs [candidatesPath] [--dry-run] [--window-days N] [--config <path>]
//     candidatesPath  defaults to <skill>/state/candidates.json
//     --dry-run        list what WOULD be added/skipped, insert nothing
//     --window-days N  how far ahead to read the existing calendar for dedup (default 65)
//     --config <path>  a config.json to read skills.networking.{selfEmail,calendarCmd}
//
// candidates JSON shape:
//   { "events": [
//       { "summary": "...", "location": "...", "description": "...",
//         "start": { "dateTime": "2026-06-15T08:00:00-04:00", "timeZone": "America/New_York" },
//         "end":   { "dateTime": "2026-06-15T09:30:00-04:00", "timeZone": "America/New_York" } },
//       ...
//   ] }
//
// Prints a JSON report: { added[], skipped[], errors[], handoff[], dryRun, count }.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(__dirname, '..');

// ---- args ----
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
let windowDays = 65;
let configPath = null;
const positionals = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--window-days') { windowDays = parseInt(argv[++i], 10) || 65; continue; }
  if (a === '--config') { configPath = argv[++i]; continue; }
  if (a.startsWith('--')) continue;
  positionals.push(a);
}
const candidatesPath = positionals[0] || path.join(SKILL_DIR, 'state', 'candidates.json');

// ---- per-client settings (env, then config file, then defaults) ----
let cfg = {};
if (configPath && fs.existsSync(configPath)) {
  try { cfg = (JSON.parse(fs.readFileSync(configPath, 'utf8')).skills || {}).networking || {}; } catch { /* ignore */ }
}
const SELF_EMAIL = process.env.NET_SELF_EMAIL || cfg.selfEmail || '';
const CAL_CMD = process.env.NET_CAL_CMD || cfg.calendarCmd || 'gws.cmd';

// ---- cli helpers ----
const q = (s) => `"${String(s).replace(/"/g, '""')}"`; // cmd.exe-safe quote

function cal(args) {
  const r = spawnSync(`${CAL_CMD} ${args.join(' ')}`, [], {
    encoding: 'utf8', shell: true, maxBuffer: 96 * 1024 * 1024,
  });
  if (r.status !== 0) return { ok: false, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
  return { ok: true, stdout: r.stdout || '' };
}

// strip characters that break cmd.exe JSON quoting or violate the no-em-dash rule
const clean = (s) => (s == null ? s : String(s).replace(/"/g, "'").replace(/[–—]/g, '-'));

// ---- date + title helpers (local getters == machine tz) ----
function toDate(se) {
  if (!se) return null;
  const v = se.dateTime || (se.date ? se.date + 'T00:00:00' : null);
  return v ? new Date(v) : null;
}
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function normTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\[(net|tentative|networking)\]/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(the|a|an|of|for|and|with|to|at|in|on|networking|event|meeting|2026)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const tokens = (s) => new Set(normTitle(s).split(' ').filter((t) => t.length >= 3));

function titlesSimilar(a, b) {
  const na = normTitle(a), nb = normTitle(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ta = tokens(a), tb = tokens(b);
  if (!ta.size || !tb.size) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const jacc = inter / (ta.size + tb.size - inter);
  return jacc >= 0.5 || inter >= 2;
}

// existing event matching a candidate? returns the matching summary or null
function findDuplicate(cand, existing) {
  const cs = toDate(cand.start);
  if (!cs) return null;
  const ck = dayKey(cs);
  for (const ex of existing) {
    if (!ex.start) continue;
    if (dayKey(ex.start) !== ck) continue;
    const diffMin = Math.abs(ex.start.getTime() - cs.getTime()) / 60000;
    if (diffMin <= 150 && titlesSimilar(cand.summary, ex.summary)) return ex.summary;
  }
  return null;
}

// ---- load the live calendar window (best-effort; empty if no CLI) ----
function loadExisting() {
  const now = new Date();
  const min = new Date(now.getTime() - 12 * 3600 * 1000);
  const max = new Date(now.getTime() + windowDays * 24 * 3600 * 1000);
  const params = JSON.stringify({
    calendarId: 'primary',
    timeMin: min.toISOString(),
    timeMax: max.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 2500,
  });
  const r = cal(['calendar', 'events', 'list', '--params', q(params), '--format', 'json']);
  if (!r.ok) {
    // No readable calendar -> dedup only within the batch. Don't crash.
    return { items: [], readable: false, err: r.stderr || String(r.error || '') };
  }
  let data;
  try { data = JSON.parse(r.stdout); } catch { return { items: [], readable: false, err: 'unparseable list output' }; }
  const items = (data.items || data.events || []).map((e) => ({ summary: e.summary || '', start: toDate(e.start) }));
  return { items, readable: true };
}

// ---- insert one event ----
function insertEvent(ev) {
  const body = {
    summary: ev.summary,
    ...(ev.location ? { location: ev.location } : {}),
    ...(ev.description ? { description: ev.description } : {}),
    start: ev.start,
    end: ev.end,
    status: 'tentative',
    colorId: '3',
    // self-as-guest -> the Yes/No/Maybe RSVP prompt shows (only if we have an email)
    ...(SELF_EMAIL ? { attendees: [{ email: SELF_EMAIL, responseStatus: 'needsAction' }] } : {}),
  };
  // sendUpdates:none so adding self as a guest never emails anyone
  const params = JSON.stringify({ calendarId: 'primary', sendUpdates: 'none' });
  return cal(['calendar', 'events', 'insert', '--params', q(params), '--json', q(JSON.stringify(body)), '--format', 'json']);
}

// ---- main ----
function main() {
  if (!fs.existsSync(candidatesPath)) { console.error('Candidates file not found:', candidatesPath); process.exit(1); }
  let cands;
  try { cands = (JSON.parse(fs.readFileSync(candidatesPath, 'utf8')).events) || []; }
  catch { console.error('ERROR: could not parse candidates JSON:', candidatesPath); process.exit(1); }

  for (const c of cands) {
    c.summary = clean(c.summary);
    c.location = clean(c.location);
    c.description = clean(c.description);
    if (c.summary && !/^\[Net\]/i.test(c.summary)) c.summary = '[Net] ' + c.summary;
  }

  const ex = loadExisting();
  const existing = ex.items;
  const noCalendar = !ex.readable; // either no CLI, or it errored -> handoff mode
  const added = [], skipped = [], errors = [], handoff = [];

  for (const c of cands) {
    const dup = findDuplicate(c, existing);
    if (dup) { skipped.push({ summary: c.summary, reason: 'already on calendar: ' + dup }); continue; }

    if (noCalendar) {
      // No writable/readable calendar -> hand it back for the user to add.
      handoff.push({ summary: c.summary, start: c.start, location: c.location, description: c.description });
      existing.push({ summary: c.summary, start: toDate(c.start) }); // intra-batch dedup
      continue;
    }
    if (dryRun) {
      added.push({ summary: c.summary, start: c.start, dryRun: true });
      existing.push({ summary: c.summary, start: toDate(c.start) });
      continue;
    }
    const r = insertEvent(c);
    if (r.ok) {
      added.push({ summary: c.summary, start: c.start });
      existing.push({ summary: c.summary, start: toDate(c.start) });
    } else {
      errors.push({ summary: c.summary, error: String(r.stderr || r.error || 'unknown').slice(0, 200) });
    }
  }

  console.log(JSON.stringify({
    added, skipped, errors, handoff, dryRun, noCalendar,
    count: { added: added.length, skipped: skipped.length, errors: errors.length, handoff: handoff.length },
  }, null, 2));
}

main();
