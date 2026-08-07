#!/usr/bin/env node
// check-conflicts.mjs — filter candidate events against your REAL commitments
// before any of them reach the approval page.
//
// Exists because an early run suggested a networking lunch on the same day as
// an already-booked speaking commitment. The old inserter deduped against
// identical events but never asked "am I already busy then?".
//
// The rule: a CONFIRMED commitment blocks the slot. Tentative holds and
// all-day / background items do not. So a client call kills a suggestion; a
// purple maybe-hold or an all-day festival banner does not.
//
// Usage:
//   node check-conflicts.mjs [candidatesPath] [--json] [--buffer N]
//     candidatesPath  defaults to <skill>/state/candidates.json
//     --buffer N      minutes of travel padding around each candidate (default 30)
//     --json          machine output only, no human summary
//
// Prints { free: [...], blocked: [{ summary, when, blockedBy, blockerWhen }] }.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const jsonOnly = argv.includes('--json');
// 30 min matches the configured travel radius: nothing in scope is further than
// that, so 30 is the honest minimum gap between a commitment and an event.
let buffer = 30;
const positionals = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--buffer') { buffer = parseInt(argv[++i], 10) || 30; continue; }
  if (a.startsWith('--')) continue;
  positionals.push(a);
}
const candidatesPath = positionals[0] || path.join(SKILL_DIR, 'state', 'candidates.json');

const IS_WIN = process.platform === 'win32';
const CAL_CMD = process.env.NET_CAL_CMD || (IS_WIN ? 'gws.cmd' : 'gws');
const q = (s) =>
  IS_WIN
    ? `"${String(s).replace(/"/g, '""')}"`
    : `'${String(s).replace(/'/g, `'\\''`)}'`;

function gws(args) {
  const r = spawnSync(`${CAL_CMD} ${args.join(' ')}`, [], {
    encoding: 'utf8', shell: true, maxBuffer: 96 * 1024 * 1024,
  });
  if (r.status !== 0) return { ok: false, stderr: r.stderr || '' };
  return { ok: true, stdout: r.stdout || '' };
}

const toDate = (se) => {
  if (!se) return null;
  const v = se.dateTime || (se.date ? se.date + 'T00:00:00' : null);
  return v ? new Date(v) : null;
};

// ---- what counts as a real commitment ---------------------------------------
// Deliberately narrow. We only consider things you've actually committed to:
//   - it has a real start/end time (all-day banners are context, not commitments)
//   - it is not a tentative hold (status tentative = a maybe, including our own)
//   - you have not declined it
//   - it is not marked free/transparent (those are background blocks)
function isCommitment(ev) {
  if (!ev.start?.dateTime) return false;            // all-day or date-only
  if (ev.status === 'tentative') return false;       // a maybe, not a commitment
  if (ev.status === 'cancelled') return false;
  if (ev.transparency === 'transparent') return false; // shows as free
  const me = (ev.attendees || []).find((a) => a.self);
  if (me && me.responseStatus === 'declined') return false;
  return true;
}

// ---- NOTHING HARD-BLOCKS (learned the hard way, twice) ----------------------
// An early version blocked on any confirmed commitment. A second version
// blocked on work commitments only and flagged personal ones. BOTH were wrong,
// and the damage was silent: a confirmed monthly meetup never reached the
// approval page because something else sat in that slot, and a chapter visit
// specifically asked for was killed by a standing weekly call. Neither miss
// was visible. The fix: "don't let anything on the calendar actually block
// things. Have the rule that everything is bendable."
//
// So this script no longer removes anything. It annotates. Every candidate
// survives and carries its collisions to the page, where you decide what bends.
// The lesson worth keeping: a filter that silently deletes options is worse than
// a page that shows a conflict you can judge in two seconds.
const HARD_BLOCK = false;

// ...with exactly ONE exception, which you can name for yourself: some single
// commitment that never bends (a standing referral-chapter meeting, say) is
// the one thing that should block outright, because suggesting anything in
// that slot wastes your attention every single time.
//
// Note this is matched on the CALENDAR event, not the candidate: any event on
// your calendar whose title matches `NET_NEVER_BENDS` (default "bni") blocks
// that slot outright.
const NEVER_BENDS = (process.env.NET_NEVER_BENDS || 'bni')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

function neverBends(summary) {
  const s = String(summary || '').toLowerCase();
  // word-ish match so "BNI" hits but a stray "combining" does not
  return NEVER_BENDS.some((p) => new RegExp(`(^|[^a-z])${p}([^a-z]|$)`).test(s));
}

function loadCommitments(minDate, maxDate) {
  const params = JSON.stringify({
    calendarId: 'primary',
    timeMin: minDate.toISOString(),
    timeMax: maxDate.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 2500,
  });
  const r = gws(['calendar', 'events', 'list', '--params', q(params), '--format', 'json']);
  if (!r.ok) { console.error('ERROR listing calendar:', r.stderr); process.exit(2); }
  let data;
  try { data = JSON.parse(r.stdout); } catch { console.error('ERROR: could not parse calendar output'); process.exit(2); }
  return (data.items || [])
    .filter(isCommitment)
    .map((e) => ({
      summary: e.summary || '(no title)',
      start: toDate(e.start), end: toDate(e.end),
    }))
    .filter((e) => e.start && e.end);
}

const fmt = (d) =>
  d.toLocaleString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function main() {
  if (!fs.existsSync(candidatesPath)) {
    console.error('Candidates file not found:', candidatesPath); process.exit(1);
  }
  let cands;
  try { cands = JSON.parse(fs.readFileSync(candidatesPath, 'utf8')).events || []; }
  catch { console.error('ERROR: could not parse candidates JSON'); process.exit(1); }
  if (!cands.length) { console.error('No candidates to check.'); process.exit(1); }

  const starts = cands.map((c) => toDate(c.start)).filter(Boolean);
  const min = new Date(Math.min(...starts.map((d) => d.getTime())) - 2 * 86400000);
  const max = new Date(Math.max(...starts.map((d) => d.getTime())) + 2 * 86400000);
  const commitments = loadCommitments(min, max);

  const free = [], blocked = [];
  for (const c of cands) {
    const cs = toDate(c.start), ce = toDate(c.end);
    if (!cs || !ce) { free.push(c); continue; }
    // pad by travel buffer on both sides so we don't book back-to-back across town
    const padStart = new Date(cs.getTime() - buffer * 60000);
    const padEnd = new Date(ce.getTime() + buffer * 60000);
    const hits = commitments.filter((k) => k.start < padEnd && k.end > padStart);
    if (hits.length) {
      // The one thing that never bends wins outright.
      const sacred = hits.find((h) => neverBends(h.summary));
      if (sacred || HARD_BLOCK) {
        const by = sacred || hits[0];
        blocked.push({
          summary: c.summary, when: fmt(cs),
          blockedBy: by.summary, blockerWhen: fmt(by.start),
        });
        continue;
      }
      // Everything else: annotate, never remove. You decide what bends.
      c.softConflict = hits.map((h) => `${h.summary} (${fmt(h.start)} to ${fmt(h.end)})`).join('; ');
    }
    free.push(c);
  }

  const softCount = free.filter((f) => f.softConflict).length;
  const report = {
    buffer, checked: cands.length, free: free.length,
    blockedCount: blocked.length, softConflictCount: softCount, blocked,
  };
  if (!jsonOnly) {
    console.error(`Checked ${cands.length} candidates against ${commitments.length} real commitments (${buffer} min travel buffer).`);
    for (const b of blocked) {
      console.error(`  BLOCKED  ${b.summary} (${b.when})  <-  ${b.blockedBy} (${b.blockerWhen})`);
    }
    for (const f of free.filter((x) => x.softConflict)) {
      console.error(`  FLAGGED  ${f.summary}  <-  overlaps ${f.softConflict}`);
    }
  }
  console.log(JSON.stringify({ ...report, freeEvents: free }, null, 2));
}

main();
