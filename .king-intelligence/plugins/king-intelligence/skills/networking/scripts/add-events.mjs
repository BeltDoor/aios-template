// add-events.mjs — deterministic Google Calendar inserter for the /networking skill.
//
// Reads an APPROVED events JSON, dedupes each against the LIVE calendar (same local
// day, start within ±150 min, similar title), and inserts the survivors as
// status:confirmed + colorId:3 (purple) via the gws CLI. Also dedupes within the
// batch so one run never double-adds the same event.
//
// IMPORTANT: this script is the LAST step, not the first. It must only ever be
// handed events you explicitly approved on the networking-approval.html page.
// It does not decide anything; it writes what it is given. The pipeline is:
//   research -> check-conflicts.mjs -> preview-events.mjs -> you approve -> this.
//
// Windows note: gws is a .cmd shim, so we MUST use shell:true + manual cmd.exe-safe
// quoting (inner " doubled to "").
//
// Per-user settings are read at runtime, NOT hardcoded:
//   - selfEmail      : --self-email <addr>, or env NET_SELF_EMAIL. Pass your own
//                      address from the config. If empty,
//                      you are simply not added as a guest (no RSVP prompt) and the event
//                      still lands as a tentative hold.
//   - calendar command : env NET_CAL_CMD (default 'gws.cmd'), so the inserter can point
//                      at a different calendar CLI without editing this file.
//
// Usage:
//   node scripts/add-events.mjs [candidatesPath] [--dry-run] [--window-days N] [--self-email <addr>]
//     candidatesPath     defaults to <skill>/state/candidates.json
//     --dry-run          list what WOULD be added/skipped, insert nothing
//     --window-days N    how far ahead to read the existing calendar for dedup (default 65)
//     --self-email <addr> the address to add as a guest (or set NET_SELF_EMAIL)
//
// candidates JSON shape:
//   { "events": [
//       { "summary": "...", "location": "...", "description": "...",
//         "start": { "dateTime": "2026-06-15T08:00:00-04:00", "timeZone": "America/New_York" },
//         "end":   { "dateTime": "2026-06-15T09:30:00-04:00", "timeZone": "America/New_York" } },
//       ...
//   ] }
//
// Prints a JSON report: { added[], skipped[], errors[], dryRun, count }.

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
let selfEmailArg = '';
const positionals = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--window-days') { windowDays = parseInt(argv[++i], 10) || 65; continue; }
  if (a === '--self-email') { selfEmailArg = argv[++i] || ''; continue; }
  if (a.startsWith('--')) continue;
  positionals.push(a);
}
const candidatesPath = positionals[0] || path.join(SKILL_DIR, 'state', 'candidates.json');

// The guest added on every event so Google Calendar shows the Yes/No/Maybe RSVP
// buttons (responseStatus needsAction = the "empty" state you want). Read at
// runtime from --self-email or NET_SELF_EMAIL (the SKILL.md passes selfEmail from
// config); if empty, no guest is added and the hold still lands.
const SELF_EMAIL = selfEmailArg || process.env.NET_SELF_EMAIL || '';

// The calendar CLI is overridable via NET_CAL_CMD. On Windows gws ships as a .cmd
// shim; on macOS/Linux it is a plain `gws` binary on PATH.
const IS_WIN = process.platform === 'win32';
const CAL_CMD = process.env.NET_CAL_CMD || (IS_WIN ? 'gws.cmd' : 'gws');

// ---- gws helpers ----
// Shell quoting differs by platform. cmd.exe wants inner " doubled; POSIX sh needs
// single-quote wrapping (inner ' closed, escaped, reopened). Using the cmd.exe form
// on macOS silently collapses "" to nothing and corrupts the JSON payload.
const q = (s) =>
  IS_WIN
    ? `"${String(s).replace(/"/g, '""')}"`
    : `'${String(s).replace(/'/g, `'\\''`)}'`;

function gws(args) {
  const r = spawnSync(`${CAL_CMD} ${args.join(' ')}`, [], {
    encoding: 'utf8', shell: true, maxBuffer: 96 * 1024 * 1024,
  });
  if (r.status !== 0) return { ok: false, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
  return { ok: true, stdout: r.stdout || '' };
}

// strip characters that break cmd.exe JSON quoting or violate the no-em-dash rule
const clean = (s) => (s == null ? s : String(s).replace(/"/g, "'").replace(/[–—]/g, '-'));

// ---- date + title helpers (machine tz is Eastern, so local getters == ET) ----
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

// ---- load the live calendar window ----
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
  const r = gws(['calendar', 'events', 'list', '--params', q(params), '--format', 'json']);
  if (!r.ok) { console.error('ERROR listing calendar:', r.stderr || r.error); process.exit(2); }
  let data;
  try { data = JSON.parse(r.stdout); } catch { console.error('ERROR: could not parse gws list output'); process.exit(2); }
  const items = data.items || data.events || [];
  return items.map((e) => ({ summary: e.summary || '', start: toDate(e.start) }));
}

// ---- insert one event ----
function insertEvent(ev) {
  const body = {
    summary: ev.summary,
    ...(ev.location ? { location: ev.location } : {}),
    ...(ev.description ? { description: ev.description } : {}),
    start: ev.start,
    end: ev.end,
    // Approved on the page = a real commitment, so it lands CONFIRMED, not tentative.
    // This matters beyond tidiness: check-conflicts.mjs only blocks on confirmed
    // events, so next month's run sees these and refuses to double-book you.
    status: 'confirmed',
    colorId: '3',
    // self-as-guest -> the Yes/No/Maybe RSVP prompt shows on your calendar (only if we have an email)
    ...(SELF_EMAIL ? { attendees: [{ email: SELF_EMAIL, responseStatus: 'needsAction' }] } : {}),
  };
  // sendUpdates:none so adding yourself as a guest never emails anyone
  const params = JSON.stringify({ calendarId: 'primary', sendUpdates: 'none' });
  return gws(['calendar', 'events', 'insert', '--params', q(params), '--json', q(JSON.stringify(body)), '--format', 'json']);
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

  const existing = loadExisting();
  const added = [], skipped = [], errors = [];

  for (const c of cands) {
    const dup = findDuplicate(c, existing);
    if (dup) { skipped.push({ summary: c.summary, reason: 'already on calendar: ' + dup }); continue; }
    if (dryRun) {
      added.push({ summary: c.summary, start: c.start, dryRun: true });
      existing.push({ summary: c.summary, start: toDate(c.start) }); // intra-batch dedup
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
    added, skipped, errors, dryRun,
    count: { added: added.length, skipped: skipped.length, errors: errors.length },
  }, null, 2));
}

main();
