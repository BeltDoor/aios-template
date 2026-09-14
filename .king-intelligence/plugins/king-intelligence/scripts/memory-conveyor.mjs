#!/usr/bin/env node
// memory-conveyor.mjs — keeps the auto-memory index (MEMORY.md) inside Claude Code's
// load budget so 100% of it loads every session, ages older/unimportant notes into a
// dated archive (never deletes), and never touches the per-note topic files.
//
// WHY THIS EXISTS: Claude Code loads only the first 200 lines OR first 25KB of MEMORY.md,
// whichever comes first (verified: code.claude.com/docs/en/memory.md). The index had grown
// to ~252KB / 353 entries, so ~90% never loaded. This tool runs it like a conveyor:
//   - PINNED entries (marked "[PIN]") never age out, sit at the top.
//   - FRESH entries flow newest-first; when the budget is hit, the OLDEST non-pinned ones
//     drop off the bottom into ARCHIVE-<YYYY-MM>.md (verbatim, recoverable).
//   - Nothing is ever hard-deleted. Topic files are never modified.
//
// MODES:
//   --analyze         read-only: parse, classify, report the cliff + a PIN/FRESH/EVICT table
//   --collapse        one-time: rewrite fat multi-line entries into one-liners, seed the bands,
//                     archive overflow + EVICT-marked entries. Atomic, gated by conservation checks.
//   --verify          read-only: confirm MEMORY.md + the archive together still cover every original
//                     note (run after any hand-edit), and that MEMORY.md is under budget.
//   --enforce         ongoing (called by /end-session): entries are already one-liners; archive
//                     overflow + EVICT-marked, atomic write, print a one-line receipt.
//   --pin-candidates  read-only: lists the N weakest pins (oldest first, longest index line as
//                     tiebreak) so a human can decide what comes off when the pinned band is over
//                     the 12,000-byte ceiling. Never writes anything. `--n <count>` (default 5).
//
//   Index formats: this repo's "## " heading index AND Claude Code's default bullet index
//   ("- [Title](file.md) — hook", newest at the bottom) are both read. Which entries age out is
//   decided by each entry's own recency (topic-file `modified:`, else mtime, else the date in the
//   line), never by file order. Bullets are written back verbatim, one per line.
//
// _updated: 09/11/26 - 17:45 EDT
//
// CORRECTNESS NOTES (these bit us before):
//   - All size math counts UTF-8 BYTES via Buffer.byteLength, never String.length.
//   - Code-fence aware: a "## " inside a ``` fence is NOT a section break. Fence state
//     toggles only when a line, trimmed, STARTS with ``` (one entry has ``` mid-line).
//   - The memory dir is OUTSIDE git — no backup. This tool only ever MOVES content to the
//     archive and writes atomically (temp + rename). Snapshot before --collapse anyway.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const ARGV = process.argv.slice(2);
/** Value of a `--flag value` style arg, or null. */
function argVal(name) {
  const i = ARGV.indexOf(name);
  return i !== -1 && i + 1 < ARGV.length ? ARGV[i + 1] : null;
}

/**
 * Locate THIS repo's auto-memory folder at runtime (portable: ships to client repos via the
 * plugin, so it must never hardcode one person's path). Mirrors the /end-session "Phase 0"
 * discovery: Claude Code keeps per-project memory under ~/.claude/projects/<project-slug>/memory,
 * where the slug is the repo's absolute path with every non-alphanumeric char turned into "-".
 * We construct that slug, but to be robust to slug-algorithm quirks (Windows drive letters,
 * single-vs-double separators, case) we VERIFY against what's actually on disk and fall back to a
 * normalized match. --mem-dir overrides everything (handy for tests / non-standard setups).
 */
function deriveMemDir() {
  const override = argVal('--mem-dir');
  if (override) return path.resolve(override);

  // ~/.claude unless the person moved Claude Code's config folder with CLAUDE_CONFIG_DIR (9/14/26)
  const projectsDir = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
  const cwd = path.resolve(process.cwd());

  // primary: the conventional slug (every non-alphanumeric char → "-")
  const slug = cwd.replace(/[^A-Za-z0-9]/g, '-');
  const direct = path.join(projectsDir, slug, 'memory');
  if (fs.existsSync(path.join(direct, 'MEMORY.md'))) return direct;

  // fallback: scan the projects dir for a folder whose name matches this cwd, tolerant of
  // case + separator differences (Windows "C:/…" slugs differ from this construction)
  let entries = [];
  try {
    entries = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(e => e.isDirectory()).map(e => e.name);
  } catch { /* no projects dir yet */ }
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  let match = entries.find(n => norm(n) === norm(cwd));
  if (!match) {
    const base = norm(path.basename(cwd));
    match = entries
      .filter(n => fs.existsSync(path.join(projectsDir, n, 'memory', 'MEMORY.md')))
      .find(n => norm(n).endsWith(base));
  }
  if (match) return path.join(projectsDir, match, 'memory');

  // nothing on disk yet — return the conventional path (may not exist; modes handle that)
  return direct;
}

const MEM_DIR = deriveMemDir();
const MEMORY_PATH = path.join(MEM_DIR, 'MEMORY.md');
const EOL = '\n';                      // MEMORY.md is LF-only (verified)
const HARD_CAP = 25600;                // the real 25KB load cliff
const BUDGET = 16800;                  // safety budget: Claude Code's built-in PostToolUse memory hook (verified firing 7/5/26) warns at 24.4KB and demands <=17.1KB, tighter than the old 25KB cliff — stay under the hook's target
const LINE_BUDGET = 185;               // Claude Code loads first 200 LINES *or* 25KB, whichever first; cap lines too (margin under 200)
const MAX_LINE = 240;                  // max bytes for a single one-liner index entry
const PIN_TAG = '[PIN]';
const PIN_BAND_CEILING = 12000;        // "The pinned band never exceeds 12,000 bytes." — references/operating/memory-pins.md

// ---------- parsing ----------

/** Split MEMORY.md into a preamble + an array of entry sections, fence-aware.
 *
 *  Two index formats exist (9/11/26). This repo's own index is HEADING format: every entry is a
 *  "## " line, and the lines beneath it belong to it. Claude Code's DEFAULT index, the one every
 *  member's machine writes, is BULLET format: one complete entry per top-level "- " line, newest
 *  appended at the BOTTOM. The parser only knew headings, so a member's 168-entry index read as
 *  0 entries and the conveyor could never trim it. The format is decided for the whole file: a
 *  file with any "## " entry is heading format (bullets inside it are body text, as before); a
 *  file with none is bullet format. A bullet never absorbs the lines beneath it. */
function parse(text) {
  const lines = text.split('\n');
  const sections = [];
  let inFence = false;
  let preambleEnd = lines.length;
  let cur = null;

  // pass 1: which format is this file?
  let hasHeading = false;
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) inFence = !inFence;
    if (!inFence && /^##\s/.test(line)) { hasHeading = true; break; }
  }
  const format = hasHeading ? 'heading' : 'bullet';
  inFence = false;

  const stray = [];                                                  // bullet format: non-entry text after the first entry (kept, never lost)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('```')) inFence = !inFence;      // fence toggle: trimmed line STARTS with ```
    if (format === 'heading') {
      const isHeading = !inFence && /^##\s/.test(line);
      if (isHeading) {
        if (cur === null && sections.length === 0) preambleEnd = i;   // first heading ends the preamble
        if (cur) sections.push(cur);
        cur = { startLine: i, lines: [line], kind: 'heading', format };
      } else if (cur) {
        cur.lines.push(line);
      }
    } else {
      const isBullet = !inFence && /^- \S/.test(line);
      if (isBullet) {
        if (sections.length === 0) preambleEnd = i;                  // first bullet ends the preamble
        sections.push({ startLine: i, lines: [line], kind: 'bullet', format });
      } else if (sections.length && line.trim() !== '') {
        stray.push(line);
      }
    }
  }
  if (cur) sections.push(cur);

  let preamble = lines.slice(0, preambleEnd).join('\n');
  if (stray.length) preamble = preamble.trimEnd() + '\n\n' + stray.join('\n');
  return { preamble, format, sections: sections.map(enrich) };
}

/** Pull the fields we care about out of a raw section. */
function enrich(sec) {
  const raw = sec.lines.join('\n').replace(/\s+$/, '');               // trim trailing blank lines
  const heading = sec.lines[0];
  const headline = (sec.kind === 'bullet' ? heading.replace(/^- /, '') : heading.replace(/^##\s+/, '')).trim();
  const mdLinks = [...raw.matchAll(/\]\(([^)\s]+\.md)\)/g)].map(m => m[1]);
  const wikilinks = [...raw.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[0]);
  const primary = mdLinks[0] || null;
  // stable identity: its topic file if it has one, else a hash of the headline
  const id = primary ? `file:${primary}` : `noref:${crypto.createHash('sha1').update(headline).digest('hex').slice(0, 12)}`;
  const dateMatch = headline.match(/\((\d{1,2})\/(\d{1,2})\/(\d{2})\)/) || (primary && primary.match(/_(\d{1,2})_(\d{1,2})_(\d{2})\b/));
  const isPinned = PIN_RE.test(headline) || /^##\s*\[PIN\]/.test(heading);
  const sep = sec.kind === 'bullet' ? EOL : EOL + EOL;              // a bullet costs one line, a heading entry a line plus a blank
  const enriched = { ...sec, raw, heading, headline, mdLinks, primary, wikilinks, id, dateMatch, isPinned, sep, bytes: Buffer.byteLength(raw + sep, 'utf8'), klass: classify(headline, raw) };
  enriched.stamp = entryStamp(enriched);
  return enriched;
}

/** "[PIN]" at the start of a headline, allowing the bold wrapper a bullet index tends to carry. */
const PIN_RE = /^\s*(?:\*\*)?\[PIN\]/;

/** When was this entry last true? Epoch ms, or null when nothing on disk says. Read from the
 *  topic file's frontmatter `modified:` (anywhere in the block, quoted or bare), else the topic
 *  file's mtime, else the (M/D/YY) date in the headline or filename. This is what decides which
 *  entries age out: the conveyor used to trust FILE ORDER as newest-first, which is backwards for
 *  a bullet index (newest at the bottom), so a parser-only fix would have archived a member's
 *  newest memories and kept the oldest (9/11/26). */
function entryStamp(sec) {
  if (sec.primary) {
    const file = path.join(MEM_DIR, sec.primary);
    try {
      const text = fs.readFileSync(file, 'utf8');
      const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const m = fm && fm[1].match(/^\s*modified:\s*["']?([^"'\r\n]+?)["']?\s*$/m);
      if (m) { const t = Date.parse(m[1]); if (!Number.isNaN(t)) return t; }
    } catch { /* no file, or unreadable: fall through */ }
    try { return fs.statSync(file).mtimeMs; } catch { /* fall through */ }
  }
  const d = sec.dateMatch;
  if (d) { const t = new Date(2000 + parseInt(d[3], 10), parseInt(d[1], 10) - 1, parseInt(d[2], 10)).getTime(); if (!Number.isNaN(t)) return t; }
  return null;
}

/** Mechanical PIN / EVICT / FRESH proposal. Conservative: only strong signals move an entry;
 *  everything else is FRESH and rides the newest-first conveyor (oldest archived when over budget).
 *  NOTE: "supersedes [[X]]" means THIS entry replaced an OLDER one (this entry is the winner), so it
 *  is NOT an evict signal. Only unambiguous dead-markers evict. The newest-first conveyor ages out
 *  genuinely-old superseded notes on its own. */
function classify(headline, raw) {
  if (PIN_RE.test(headline)) return 'PIN';
  // unambiguous dead-weight markers → archive
  if (/\bCORRECTION\b/.test(raw) || /\(PRUNED/i.test(raw) || /\(Collapsed/i.test(raw) ||
      /\bDEPRECATED\b/.test(raw) || /\btombstone\b/i.test(raw)) return 'EVICT';
  // REMOVED 8/3/26: a rule that auto-pinned any headline matching "HARD RULE|STANDING RULE|
  // HARD FEEDBACK|...|MANDATORY". It force-promoted entries regardless of the literal [PIN] tag,
  // which is how the index reached 72-of-72 pinned and froze (nothing left the conveyor was
  // allowed to move; PINNED-exceed-budget error, 8/2/26). Pinning is now ALWAYS an explicit,
  // human/session decision via the literal "[PIN]" tag — the four-gate test + 12,000-byte band
  // ceiling live in references/operating/memory-pins.md.
  return 'FRESH';
}

// ---------- one-liner generation ----------

/** Collapse a (possibly fat, multi-line) entry into a single "## …" index line, capped to
 *  MAX_LINE bytes. The topic-file pointer is preserved and never truncated. */
function oneLiner(sec) {
  const pin = sec.isPinned || sec.klass === 'PIN';
  let head = sec.headline.replace(/^\[PIN\]\s*/, '').trim();
  // idempotency: strip any pointer this entry already carries so --enforce can't double it
  head = head.replace(/\s*->\s*\[[^\]]+\]\([^)]+\)\s*$/, '').trim();
  const pointer = sec.primary ? ` -> [${sec.primary}](${sec.primary})` : '';
  const prefix = `## ${pin ? PIN_TAG + ' ' : ''}`;
  const fixedBytes = Buffer.byteLength(prefix + pointer, 'utf8');
  const headBudget = MAX_LINE - fixedBytes;
  if (Buffer.byteLength(head, 'utf8') > headBudget) {
    // truncate on a word boundary, ASCII ellipsis (no multibyte surprise)
    let cut = head;
    while (Buffer.byteLength(cut, 'utf8') > headBudget - 3 && cut.includes(' ')) {
      cut = cut.slice(0, cut.lastIndexOf(' '));
    }
    head = cut.replace(/[\s,;:.\-]+$/, '') + '...';
  }
  return prefix + head + pointer;
}

// ---------- atomic write ----------

function atomicWrite(file, content) {
  const tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, content, 'utf8');
  try {
    fs.renameSync(tmp, file);                                          // atomic on POSIX
  } catch {
    if (fs.existsSync(file)) fs.rmSync(file);                          // Windows: rename-over can throw
    fs.renameSync(tmp, file);
  }
}

/** Full path to the newest pre-collapse snapshot (rollback master + verify baseline). */
function latestSnapshot() {
  const dir = path.join(MEM_DIR, '_snapshots');
  if (!fs.existsSync(dir)) return null;
  const snaps = fs.readdirSync(dir).filter(f => /^MEMORY\.PRECONVEYOR\..*\.md$/.test(f)).sort();
  return snaps.length ? path.join(dir, snaps[snaps.length - 1]) : null;
}

function archivePath() {
  // dated, NON-loading file. NOT a CLAUDE.md, not in any load path. Current month.
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return path.join(MEM_DIR, `ARCHIVE-${ym}.md`);
}

// ---------- modes ----------

function readMemory() {
  return parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
}

function findCliff(sections, preamble) {
  let acc = Buffer.byteLength(preamble + '\n', 'utf8');
  for (let i = 0; i < sections.length; i++) {
    acc += sections[i].bytes;
    if (acc > HARD_CAP) return { entriesLoading: i, cliffByte: acc };
  }
  return { entriesLoading: sections.length, cliffByte: acc };
}

function analyze() {
  const { preamble, format, sections } = readMemory();
  const counts = { PIN: 0, FRESH: 0, EVICT: 0 };
  for (const s of sections) counts[s.klass]++;
  const totalBytes = Buffer.byteLength(fs.readFileSync(MEMORY_PATH, 'utf8'), 'utf8');
  const cliff = findCliff(sections, preamble);
  // --json: one machine-readable line first, for the session-start tidy hook (9/14/26)
  if (ARGV.includes('--json')) {
    console.log(JSON.stringify({ memDir: MEM_DIR, format, entries: sections.length, bytes: totalBytes, loadsFully: totalBytes <= HARD_CAP, budget: BUDGET, hardCap: HARD_CAP, pin: counts.PIN, fresh: counts.FRESH, evict: counts.EVICT }));
  }
  console.log(`MEMORY.md: ${sections.length} entries, ${totalBytes} bytes`);
  console.log(`Load cliff (25KB): only the top ${cliff.entriesLoading} entries load today; ${sections.length - cliff.entriesLoading} are below it.`);
  console.log(`Proposed: PIN ${counts.PIN} · FRESH ${counts.FRESH} · EVICT ${counts.EVICT}`);
  printPinBandStatus(sections);
  const noRef = sections.filter(s => !s.primary);
  if (noRef.length) console.log(`Note: ${noRef.length} entries have no .md pointer (identified by headline hash):`);
  for (const s of noRef) console.log(`   - ${s.headline.slice(0, 80)}`);
  // duplicate primary-file check (identity integrity)
  const seen = new Map();
  for (const s of sections) { if (s.primary) seen.set(s.primary, (seen.get(s.primary) || 0) + 1); }
  const dupes = [...seen].filter(([, n]) => n > 1);
  if (dupes.length) { console.log(`WARNING: ${dupes.length} topic files are referenced by >1 entry (identity collision):`); dupes.forEach(([f, n]) => console.log(`   ${n}x ${f}`)); }
  // sample EVICT list
  console.log('\nEVICT sample (first 15):');
  sections.filter(s => s.klass === 'EVICT').slice(0, 15).forEach(s => console.log(`   - ${s.headline.slice(0, 90)}`));
}

/** What a kept entry looks like in the new index: a one-liner if its detail lives in a topic
 *  file (the pointer), otherwise its FULL original block (self-contained entries keep their
 *  inline detail — we never one-line away content that isn't stored elsewhere). */
function renderKept(s) {
  if (s.kind === 'bullet') return s.raw;                             // a bullet is already one line; written back verbatim, never as "## "
  return s.primary ? oneLiner(s) : s.raw;
}

/** Newest first. Stamped entries by stamp; an unstamped entry ranks by its place in the file
 *  (heading format: top is newest; bullet format: bottom is newest) and after every stamped one. */
function newestFirst(sections, format) {
  const pos = new Map(sections.map((s, i) => [s.id, format === 'bullet' ? i : -i]));
  return [...sections].sort((a, b) => {
    if (a.stamp != null && b.stamp != null) return b.stamp - a.stamp;
    if (a.stamp != null) return -1;
    if (b.stamp != null) return 1;
    return pos.get(b.id) - pos.get(a.id);
  });
}

// ---------- pin band (references/operating/memory-pins.md: never exceeds 12,000 bytes) ----------

/** The contiguous run of pinned sections at the top of the file (parse() preserves file order,
 *  and MEMORY.md's own convention is pins-first) — stops at the first non-pinned section, so a
 *  stray out-of-place pin doesn't get silently pulled into the band. */
function pinBandSections(sections) {
  const band = [];
  for (const s of sections) {
    if (!s.isPinned) break;
    band.push(s);
  }
  return band;
}

/** {bytes, count} for the pin band AS RENDERED (same accounting `build()` uses: renderKept() plus
 *  the blank-line separator each entry costs in the assembled file). Accepts either a sections
 *  array or a parse()-shaped {preamble, sections} object. */
function pinBandBytes(index) {
  const sections = Array.isArray(index) ? index : index.sections;
  const band = pinBandSections(sections);
  const bytes = band.reduce((acc, s) => acc + Buffer.byteLength(renderKept(s) + s.sep, 'utf8'), 0);
  return { bytes, count: band.length };
}

/** Prints the one-line pin-band status every mode shares, and returns {bytes, count} so callers
 *  (--verify) can also fold the numbers into a machine-readable line. */
function printPinBandStatus(sections) {
  const { bytes, count } = pinBandBytes(sections);
  let line = `pin band: ${bytes} bytes / ${PIN_BAND_CEILING.toLocaleString('en-US')} ceiling (${count} pins)`;
  if (bytes > PIN_BAND_CEILING) line += ` — OVER by ${bytes - PIN_BAND_CEILING}; run --pin-candidates`;
  console.log(line);
  return { bytes, count };
}

/** Best-effort read of a topic file's frontmatter `description:` field (quoted or bare). Returns
 *  null on any miss — a missing/unreadable file, no frontmatter, no description key — so callers
 *  can fall back to a placeholder rather than throwing. */
function readDescription(file) {
  if (!file) return null;
  try {
    const text = fs.readFileSync(path.join(MEM_DIR, file), 'utf8');
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) return null;
    const m = fm[1].match(/^description:\s*(.*)$/m);
    if (!m) return null;
    let desc = m[1].trim();
    if (desc.startsWith('"') && desc.endsWith('"')) {
      desc = desc.slice(1, -1).replace(/\\"/g, '"');
    } else if (desc.startsWith("'") && desc.endsWith("'")) {
      desc = desc.slice(1, -1);
    }
    return desc || null;
  } catch { return null; }
}

/** Oldest-first, unknown-dates-as-oldest, then longest-index-line-first tiebreak — the "weakest
 *  pin" ordering --pin-candidates lists in. sec.dateMatch is already parsed by enrich() from
 *  either the headline's "(M/D/YY)" or the topic file's "_M_D_YY" suffix. */
function candidateSort(a, b) {
  const val = s => {
    if (!s.dateMatch) return -Infinity;                              // unknown date sorts oldest
    const [, m, d, yy] = s.dateMatch;
    return new Date(2000 + Number(yy), Number(m) - 1, Number(d)).getTime();
  };
  const va = val(a), vb = val(b);
  if (va !== vb) return va - vb;                                     // oldest first
  return Buffer.byteLength(renderKept(b), 'utf8') - Buffer.byteLength(renderKept(a), 'utf8'); // longest first
}

function pinCandidates() {
  const { sections } = readMemory();
  const band = pinBandSections(sections);
  const n = Math.max(1, Number(argVal('--n')) || 5);
  const chosen = [...band].sort(candidateSort).slice(0, n);

  chosen.forEach((s, i) => {
    const bytes = Buffer.byteLength(renderKept(s) + s.sep, "utf8");
    const dateStr = s.dateMatch ? `${s.dateMatch[1]}/${s.dateMatch[2]}/${s.dateMatch[3]}` : 'unknown';
    const file = s.primary || '(no file)';
    let desc = (s.primary && readDescription(s.primary)) || '(no description)';
    if (desc.length > 90) desc = desc.slice(0, 90) + '...';
    console.log(`${i + 1}. ${bytes}B  ${dateStr}  ${file}  — ${desc}`);
  });

  const total = pinBandBytes(sections);
  const freed = chosen.reduce((acc, s) => acc + Buffer.byteLength(renderKept(s) + s.sep, "utf8"), 0);
  console.log(`pin band: ${total.bytes} / ${PIN_BAND_CEILING.toLocaleString('en-US')} — unpinning these ${chosen.length} would free ${freed} bytes`);
}

function build(sections, preamble, format = 'heading') {
  const pins = sections.filter(s => s.klass === 'PIN');
  const fresh = sections.filter(s => s.klass === 'FRESH');
  const evicts = sections.filter(s => s.klass === 'EVICT');
  const lines = (s) => s.sep === EOL ? 1 : 2;                        // lines an entry costs in the assembled file

  // assemble kept index up to BUDGET (pins always kept; fresh newest-first until full)
  const head = preamble.trimEnd() + EOL + EOL;
  let bytes = Buffer.byteLength(head, 'utf8');
  let lineCount = head.split('\n').length;

  for (const s of pins) { bytes += Buffer.byteLength(renderKept(s) + s.sep, 'utf8'); lineCount += lines(s); }
  if (bytes > BUDGET) throw new Error(`PINNED entries alone exceed budget (${bytes} > ${BUDGET}). Demote some [PIN] entries.`);
  if (lineCount > LINE_BUDGET) throw new Error(`PINNED entries alone exceed the ${LINE_BUDGET}-line budget (${lineCount} lines). Demote some [PIN] entries.`);

  // WHICH fresh entries stay is decided newest-first by each entry's own stamp (see entryStamp),
  // never by where it sits in the file. HOW they are written keeps the file's own order.
  const keptIds = new Set();
  for (const s of newestFirst(fresh, format)) {
    const cost = Buffer.byteLength(renderKept(s) + s.sep, 'utf8');
    if (bytes + cost > BUDGET || lineCount + lines(s) > LINE_BUDGET) break;  // overflow to archive on byte OR line cap
    keptIds.add(s.id);
    bytes += cost;
    lineCount += lines(s);
  }
  const freshKept = fresh.filter(s => keptIds.has(s.id));
  const freshOverflow = fresh.filter(s => !keptIds.has(s.id));

  // new MEMORY.md text. Heading format: pins first, then fresh (this repo's convention).
  // Bullet format: every kept entry in its original order, one per line, the way Claude Code
  // itself maintains that file.
  let body = head;
  if (format === 'bullet') {
    const kept = sections.filter(s => s.klass === 'PIN' || keptIds.has(s.id));
    body += kept.map(renderKept).join(EOL) + EOL;
  } else {
    const pinLines = pins.map(renderKept);
    if (pinLines.length) body += pinLines.join(EOL + EOL) + EOL + EOL;
    body += freshKept.map(renderKept).join(EOL + EOL) + EOL;
  }

  // archive = evicts + fresh overflow, in original file order, verbatim
  const archivedSet = new Set([...evicts, ...freshOverflow].map(s => s.id));
  const archivedSecs = sections.filter(s => archivedSet.has(s.id));

  const keptSet = new Set([...pins, ...freshKept].map(s => s.id));
  return { body, bytes, pins, freshKept, freshOverflow, evicts, archivedSecs, keptSet, archivedSet };
}

function conservation(sections, keptSet, archivedSet) {
  const all = new Set(sections.map(s => s.id));
  const covered = new Set([...keptSet, ...archivedSet]);
  const missing = [...all].filter(id => !covered.has(id));
  const overlap = [...keptSet].filter(id => archivedSet.has(id));
  return { ok: missing.length === 0 && overlap.length === 0, missing, overlap, allCount: all.size, coveredCount: covered.size };
}

/**
 * Save the CURRENT index before changing it. This is the rollback master and the baseline
 * `--verify` compares against.
 *
 * IT WAS NEVER BEING WRITTEN. `latestSnapshot()` only ever read, so the newest snapshot on the
 * real machine was from 2026-06-08 and `--verify` had been comparing three months of memory
 * against a June baseline: every note written since was outside what it checked, while it
 * still printed a clean line. The rollback master was equally stale, so a bad run could only
 * be undone back to June. Found 8/28/26 by writing the first test this script has ever had.
 *
 * Only ever ADDS files. The newest ten are kept so this cannot grow without bound, and an
 * older one is only removed once ten newer ones exist.
 */
function takeSnapshot() {
  try {
    if (!fs.existsSync(MEMORY_PATH)) return null;
    const dir = path.join(MEM_DIR, '_snapshots');
    fs.mkdirSync(dir, { recursive: true });
    // SECONDS, not minutes: two runs in the same minute would otherwise write the same
    // filename and the second would overwrite the first, quietly destroying the only copy of
    // the state in between. A close and a re-run land in the same minute often enough.
    const stamp = new Date().toISOString().slice(0, 19).replace('T', '-').replace(/:/g, '');
    // NEVER overwrite an existing snapshot: even at second resolution two runs collide (a
    // close followed by a re-run does it), and overwriting destroys the only copy of the state
    // in between, which is the one thing a rollback master exists to hold.
    //
    // EVERY name carries the counter, including the first. An optional suffix looked tidier
    // and broke the ordering `latestSnapshot()` depends on: "-2.md" sorts BEFORE ".md" because
    // "-" is below "." in ASCII, so the newest snapshot would have been read as the older one.
    let file = null;
    for (let n = 0; n < 100; n++) {
      const candidate = path.join(dir, `MEMORY.PRECONVEYOR.${stamp}-${String(n).padStart(2, '0')}.md`);
      if (!fs.existsSync(candidate)) { file = candidate; break; }
    }
    if (!file) return null; // a hundred in one second is not a real situation
    fs.writeFileSync(file, fs.readFileSync(MEMORY_PATH, 'utf8'));
    const snaps = fs.readdirSync(dir).filter(f => /^MEMORY\.PRECONVEYOR\..*\.md$/.test(f)).sort();
    for (const old of snaps.slice(0, Math.max(0, snaps.length - 10))) {
      try { fs.unlinkSync(path.join(dir, old)); } catch { /* keeping it is no harm */ }
    }
    return file;
  } catch {
    return null; // never let bookkeeping stop the real work
  }
}

function collapse() {
  const { preamble, format, sections } = readMemory();
  refuseUnreadable(sections);
  const r = build(sections, preamble, format);
  const cons = conservation(sections, r.keptSet, r.archivedSet);
  if (!cons.ok) {
    console.error('HALT — conservation failed, nothing written.');
    if (cons.missing.length) console.error('  Missing (in neither kept nor archive):', cons.missing.slice(0, 10));
    if (cons.overlap.length) console.error('  In BOTH kept and archive:', cons.overlap.slice(0, 10));
    process.exit(1);
  }
  if (r.bytes > BUDGET) { console.error(`HALT — new MEMORY.md ${r.bytes} > budget ${BUDGET}.`); process.exit(1); }

  // build archive file (append if it already exists, preserving prior archived content)
  const arcPath = archivePath();
  const stamp = latestSnapshot()?.match(/PRECONVEYOR\.([\d-]+)/)?.[1] || new Date().toISOString().slice(0, 10);
  const arcHeader = `# Memory archive (not auto-loaded)\n\nEntries aged out of MEMORY.md. Their topic files still live in this folder. Recoverable any time.\n`;
  const arcBlocks = r.archivedSecs.map(s => `<!-- archived ${stamp} -->\n${s.raw}`).join('\n\n');
  let arcContent = arcHeader + '\n' + arcBlocks + '\n';
  if (fs.existsSync(arcPath)) arcContent = fs.readFileSync(arcPath, 'utf8').trimEnd() + '\n\n' + arcBlocks + '\n';

  takeSnapshot(); // rollback master + the baseline --verify reads, taken BEFORE any write
  atomicWrite(MEMORY_PATH, r.body);
  atomicWrite(arcPath, arcContent);

  // post-write sanity
  const after = fs.readFileSync(MEMORY_PATH, 'utf8');
  const afterBytes = Buffer.byteLength(after, 'utf8');
  const afterEntries = parse(after).sections.length;
  console.log(JSON.stringify({
    ok: true,
    before: { entries: sections.length, bytes: Buffer.byteLength(sections.map(s => s.raw).join('\n'), 'utf8') },
    after: { entries: afterEntries, bytes: afterBytes, loadsFully: afterBytes <= HARD_CAP },
    pinned: r.pins.length, freshKept: r.freshKept.length,
    archived: r.archivedSecs.length, archiveFile: path.basename(arcPath),
    topicFilesTouched: 0,
  }, null, 2));
}

function verify() {
  // checks current MEMORY.md + archive cover every note from the newest snapshot
  const snap = latestSnapshot();
  if (!snap) { console.error('No PRECONVEYOR snapshot found to verify against.'); process.exit(1); }
  const origIds = new Set(parse(fs.readFileSync(snap, 'utf8')).sections.map(s => s.id));
  const memSections = readMemory().sections;
  const memIds = new Set(memSections.map(s => s.id));
  // union EVERY dated archive, not just the current month's — notes aged out in a
  // prior month live in that month's ARCHIVE-*.md and are still fully covered
  const arcIds = new Set();
  for (const f of fs.readdirSync(MEM_DIR).filter(f => /^ARCHIVE-\d{4}-\d{2}\.md$/.test(f))) {
    for (const s of parse(fs.readFileSync(path.join(MEM_DIR, f), 'utf8')).sections) arcIds.add(s.id);
  }
  const covered = new Set([...memIds, ...arcIds]);
  const missing = [...origIds].filter(id => !covered.has(id));
  const memBytes = Buffer.byteLength(fs.readFileSync(MEMORY_PATH, 'utf8'), 'utf8');
  console.log(`Snapshot notes: ${origIds.size} · in MEMORY: ${memIds.size} · in archive: ${arcIds.size} · covered: ${covered.size}`);
  console.log(`MEMORY.md: ${memBytes} bytes (${memBytes <= HARD_CAP ? 'loads fully' : 'OVER CLIFF'}; budget ${BUDGET})`);
  const pinBand = printPinBandStatus(memSections);
  if (missing.length) { console.error(`FAIL — ${missing.length} notes missing from both MEMORY and archive:`); missing.slice(0, 20).forEach(id => console.error('   ' + id)); process.exit(1); }
  // Size limits are RED, not commentary (red-proof run, 9/5/26). Before this, an index over
  // the 25KB load cliff printed "OVER CLIFF" and a pin band over its documented ceiling
  // printed "OVER by N", then said OK and exited 0, so /end-session and the monthly health
  // report read the same green as a healthy file. The budget (16,800) stays a warning that
  // --enforce clears; the cliff and the ceiling are the two lines that must not be crossed.
  const over = [];
  if (memBytes > HARD_CAP) over.push(`MEMORY.md is ${memBytes} bytes, over the ${HARD_CAP}-byte load cliff, so Claude Code will not load all of it. Run --enforce.`);
  if (pinBand.bytes > PIN_BAND_CEILING) over.push(`the pinned band is ${pinBand.bytes} bytes, over its ${PIN_BAND_CEILING.toLocaleString('en-US')}-byte ceiling (references/operating/memory-pins.md). Demote a [PIN] or run --pin-candidates.`);
  // machine-readable line for scripts/end-session-verify.mjs — additive, doesn't replace the plain lines above
  console.log(JSON.stringify({ pinBandBytes: pinBand.bytes, pinCount: pinBand.count, memBytes, overCliff: memBytes > HARD_CAP, overPinCeiling: pinBand.bytes > PIN_BAND_CEILING }));
  if (over.length) { over.forEach(m => console.error(`FAIL — ${m}`)); process.exit(1); }
  console.log(`OK — every note in ${path.basename(snap)} is covered by MEMORY.md or the archive.`);
}

/** A non-empty index that parses to ZERO entries is a parser miss, never a size problem.
 *  Before 9/11/26 a member's bullet-format index hit exactly this: 0 sections, the whole file
 *  treated as preamble, and the run died with a byte-budget HALT that read as if her memory were
 *  too big. Say what actually happened, and write nothing. */
function refuseUnreadable(sections) {
  if (sections.length > 0) return;
  let text = '';
  try { text = fs.readFileSync(MEMORY_PATH, 'utf8'); } catch { return; }
  if (/^(- \S|## )/m.test(text)) {
    throw new Error('I could not read a single entry from this memory index even though it has lines that look like entries, so nothing was changed. This is a bug in the tidy tool itself, not a size problem. Send this line to King Intelligence.');
  }
}

function enforce() {
  // ongoing conveyor: entries are already one-liners. Archive EVICT-marked + oldest non-pin overflow.
  const { preamble, format, sections } = readMemory();
  refuseUnreadable(sections);
  const r = build(sections, preamble, format);
  const cons = conservation(sections, r.keptSet, r.archivedSet);
  if (!cons.ok) { console.error('HALT — conservation failed, MEMORY.md untouched.'); process.exit(1); }
  if (r.archivedSecs.length === 0 && r.bytes <= BUDGET) { console.log('Memory: already lean, nothing to age out.'); printPinBandStatus(sections); return; }
  const arcPath = archivePath();
  const stamp = new Date().toISOString().slice(0, 10);               // note: --enforce is run live, date is fine here
  const arcBlocks = r.archivedSecs.map(s => `<!-- aged ${stamp} -->\n${s.raw}`).join('\n\n');
  let arcContent = fs.existsSync(arcPath)
    ? fs.readFileSync(arcPath, 'utf8').trimEnd() + '\n\n' + arcBlocks + '\n'
    : `# Memory archive (not auto-loaded)\n\n${arcBlocks}\n`;
  takeSnapshot(); // rollback master + the baseline --verify reads, taken BEFORE any write
  atomicWrite(MEMORY_PATH, r.body);
  if (r.archivedSecs.length) atomicWrite(arcPath, arcContent);
  console.log(`Memory: kept ${r.pins.length + r.freshKept.length} loading, aged ${r.archivedSecs.length} older notes into ${path.basename(arcPath)} (nothing deleted).`);
  // re-read post-write: pins are never archived by this function, but state the true post-write count
  printPinBandStatus(readMemory().sections);
}

// ---------- orphan check (report-only) ----------

/** Every topic .md file sitting flat in MEM_DIR (excludes MEMORY.md, ARCHIVE-*.md, and
 *  anything under _snapshots/ since readdirSync here is non-recursive). */
function listTopicFiles() {
  return fs.readdirSync(MEM_DIR, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => e.name)
    .filter(n => n !== 'MEMORY.md' && !/^ARCHIVE-/.test(n));
}

/** Union of every `.md` filename linked from MEMORY.md or any ARCHIVE-*.md — the set of
 *  topic files a session can actually reach. */
function referencedFiles() {
  const indexFiles = fs.readdirSync(MEM_DIR, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => e.name)
    .filter(n => n === 'MEMORY.md' || /^ARCHIVE-/.test(n));
  const referenced = new Set();
  for (const f of indexFiles) {
    const text = fs.readFileSync(path.join(MEM_DIR, f), 'utf8');
    for (const m of text.matchAll(/\]\(([^)\s]+\.md)\)/g)) referenced.add(m[1]);
  }
  return referenced;
}

/** Report-only: topic files indexed by NEITHER MEMORY.md nor any archive, i.e. no session can
 *  ever find them by reading the loaded index. Never writes anything — a human (or a future
 *  audit pass) decides where each orphan belongs. Runs after every mode so it rides along free. */
function orphanCheck() {
  if (!fs.existsSync(MEMORY_PATH)) return;                          // nothing to check yet
  const orphans = listTopicFiles().filter(f => !referencedFiles().has(f)).sort();
  if (orphans.length === 0) {
    console.log('Orphan check: 0 unindexed topic files — everything is reachable from MEMORY.md or an archive.');
    return;
  }
  console.log(`\nWARNING — orphan check: ${orphans.length} topic file(s) exist on disk but aren't linked from MEMORY.md or any ARCHIVE-*.md, so no session can find them. Report-only, nothing auto-indexed:`);
  orphans.forEach(f => console.log('   - ' + f));
}

// ---------- entry ----------

const mode = ['--analyze', '--collapse', '--verify', '--enforce', '--pin-candidates'].find(m => ARGV.includes(m));
try {
  if (mode === '--analyze') analyze();
  else if (mode === '--collapse') collapse();
  else if (mode === '--verify') verify();
  else if (mode === '--enforce') enforce();
  else if (mode === '--pin-candidates') pinCandidates();
  else { console.error('usage: node memory-conveyor.mjs --analyze | --collapse | --verify | --enforce | --pin-candidates [--n N] [--mem-dir <path>]'); process.exit(2); }
  orphanCheck();
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}
