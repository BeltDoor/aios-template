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
//   --analyze   read-only: parse, classify, report the cliff + a PIN/FRESH/EVICT table
//   --collapse  one-time: rewrite fat multi-line entries into one-liners, seed the bands,
//               archive overflow + EVICT-marked entries. Atomic, gated by conservation checks.
//   --verify    read-only: confirm MEMORY.md + the archive together still cover every original
//               note (run after any hand-edit), and that MEMORY.md is under budget.
//   --enforce   ongoing (called by /end-session): entries are already one-liners; archive
//               overflow + EVICT-marked, atomic write, print a one-line receipt.
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

  const projectsDir = path.join(os.homedir(), '.claude', 'projects');
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

// ---------- parsing ----------

/** Split MEMORY.md into a preamble + an array of entry sections, fence-aware. */
function parse(text) {
  const lines = text.split('\n');
  const sections = [];
  let inFence = false;
  let preambleEnd = lines.length;
  let cur = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('```')) inFence = !inFence;      // fence toggle: trimmed line STARTS with ```
    const isHeading = !inFence && /^##\s/.test(line);
    if (isHeading) {
      if (cur === null && sections.length === 0) preambleEnd = i;     // first heading ends the preamble
      if (cur) sections.push(cur);
      cur = { startLine: i, lines: [line] };
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur) sections.push(cur);

  const preamble = lines.slice(0, preambleEnd).join('\n');
  return { preamble, sections: sections.map(enrich) };
}

/** Pull the fields we care about out of a raw section. */
function enrich(sec) {
  const raw = sec.lines.join('\n').replace(/\s+$/, '');               // trim trailing blank lines
  const heading = sec.lines[0];
  const headline = heading.replace(/^##\s+/, '').trim();
  const mdLinks = [...raw.matchAll(/\]\(([^)\s]+\.md)\)/g)].map(m => m[1]);
  const wikilinks = [...raw.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[0]);
  const primary = mdLinks[0] || null;
  // stable identity: its topic file if it has one, else a hash of the headline
  const id = primary ? `file:${primary}` : `noref:${crypto.createHash('sha1').update(headline).digest('hex').slice(0, 12)}`;
  const dateMatch = headline.match(/\((\d{1,2})\/(\d{1,2})\/(\d{2})\)/) || (primary && primary.match(/_(\d{1,2})_(\d{1,2})_(\d{2})\b/));
  const isPinned = /^\s*\[PIN\]/.test(headline) || /^##\s*\[PIN\]/.test(heading);
  return { ...sec, raw, heading, headline, mdLinks, primary, wikilinks, id, dateMatch, isPinned, bytes: Buffer.byteLength(raw + '\n\n', 'utf8'), klass: classify(headline, raw) };
}

/** Mechanical PIN / EVICT / FRESH proposal. Conservative: only strong signals move an entry;
 *  everything else is FRESH and rides the newest-first conveyor (oldest archived when over budget).
 *  NOTE: "supersedes [[X]]" means THIS entry replaced an OLDER one (this entry is the winner), so it
 *  is NOT an evict signal. Only unambiguous dead-markers evict. The newest-first conveyor ages out
 *  genuinely-old superseded notes on its own. */
function classify(headline, raw) {
  if (/^\s*\[PIN\]/.test(headline)) return 'PIN';
  // unambiguous dead-weight markers → archive
  if (/\bCORRECTION\b/.test(raw) || /\(PRUNED/i.test(raw) || /\(Collapsed/i.test(raw) ||
      /\bDEPRECATED\b/.test(raw) || /\btombstone\b/i.test(raw)) return 'EVICT';
  // deliberate standing rules → pin (protected from age-out)
  if (/HARD RULE|STANDING RULE|HARD FEEDBACK|HARD LINE|HARD GLOBAL|MANDATORY/.test(headline)) return 'PIN';
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
  const { preamble, sections } = readMemory();
  const counts = { PIN: 0, FRESH: 0, EVICT: 0 };
  for (const s of sections) counts[s.klass]++;
  const totalBytes = Buffer.byteLength(fs.readFileSync(MEMORY_PATH, 'utf8'), 'utf8');
  const cliff = findCliff(sections, preamble);
  console.log(`MEMORY.md: ${sections.length} entries, ${totalBytes} bytes`);
  console.log(`Load cliff (25KB): only the top ${cliff.entriesLoading} entries load today; ${sections.length - cliff.entriesLoading} are below it.`);
  console.log(`Proposed: PIN ${counts.PIN} · FRESH ${counts.FRESH} · EVICT ${counts.EVICT}`);
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
  return s.primary ? oneLiner(s) : s.raw;
}

function build(sections, preamble) {
  const pins = sections.filter(s => s.klass === 'PIN');
  const fresh = sections.filter(s => s.klass === 'FRESH');           // file order = newest first
  const evicts = sections.filter(s => s.klass === 'EVICT');

  // assemble kept index up to BUDGET (pins always kept; fresh newest-first until full)
  const head = preamble.trimEnd() + EOL + EOL;
  let bytes = Buffer.byteLength(head, 'utf8');
  let lineCount = head.split('\n').length;                           // lines used so far (each entry below = 1 line + 1 blank)

  const pinLines = pins.map(renderKept);
  for (const l of pinLines) { bytes += Buffer.byteLength(l + EOL + EOL, 'utf8'); lineCount += 2; }
  if (bytes > BUDGET) throw new Error(`PINNED entries alone exceed budget (${bytes} > ${BUDGET}). Demote some [PIN] entries.`);
  if (lineCount > LINE_BUDGET) throw new Error(`PINNED entries alone exceed the ${LINE_BUDGET}-line budget (${lineCount} lines). Demote some [PIN] entries.`);

  const freshKept = [];
  for (const s of fresh) {
    const cost = Buffer.byteLength(renderKept(s) + EOL + EOL, 'utf8');
    if (bytes + cost > BUDGET || lineCount + 2 > LINE_BUDGET) break;  // overflow to archive on byte OR line cap
    freshKept.push(s);
    bytes += cost;
    lineCount += 2;
  }
  const freshOverflow = fresh.slice(freshKept.length);

  // new MEMORY.md text
  let body = head;
  if (pinLines.length) body += pinLines.join(EOL + EOL) + EOL + EOL;
  body += freshKept.map(renderKept).join(EOL + EOL) + EOL;

  // archive = evicts + fresh overflow, in original file order, verbatim
  const archivedSet = new Set([...evicts, ...freshOverflow].map(s => s.id));
  const archivedSecs = sections.filter(s => archivedSet.has(s.id));   // preserves newest-first order

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

function collapse() {
  const { preamble, sections } = readMemory();
  const r = build(sections, preamble);
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

  atomicWrite(MEMORY_PATH, r.body);
  atomicWrite(arcPath, arcContent);

  // post-write sanity
  const after = fs.readFileSync(MEMORY_PATH, 'utf8');
  const afterBytes = Buffer.byteLength(after, 'utf8');
  const afterEntries = (after.match(/^##\s/gm) || []).length;
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
  const memIds = new Set(readMemory().sections.map(s => s.id));
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
  if (missing.length) { console.error(`FAIL — ${missing.length} notes missing from both MEMORY and archive:`); missing.slice(0, 20).forEach(id => console.error('   ' + id)); process.exit(1); }
  console.log('OK — every snapshot note is covered by MEMORY.md or the archive.');
}

function enforce() {
  // ongoing conveyor: entries are already one-liners. Archive EVICT-marked + oldest non-pin overflow.
  const { preamble, sections } = readMemory();
  const r = build(sections, preamble);
  const cons = conservation(sections, r.keptSet, r.archivedSet);
  if (!cons.ok) { console.error('HALT — conservation failed, MEMORY.md untouched.'); process.exit(1); }
  if (r.archivedSecs.length === 0 && r.bytes <= BUDGET) { console.log('Memory: already lean, nothing to age out.'); return; }
  const arcPath = archivePath();
  const stamp = new Date().toISOString().slice(0, 10);               // note: --enforce is run live, date is fine here
  const arcBlocks = r.archivedSecs.map(s => `<!-- aged ${stamp} -->\n${s.raw}`).join('\n\n');
  let arcContent = fs.existsSync(arcPath)
    ? fs.readFileSync(arcPath, 'utf8').trimEnd() + '\n\n' + arcBlocks + '\n'
    : `# Memory archive (not auto-loaded)\n\n${arcBlocks}\n`;
  atomicWrite(MEMORY_PATH, r.body);
  if (r.archivedSecs.length) atomicWrite(arcPath, arcContent);
  console.log(`Memory: kept ${r.pins.length + r.freshKept.length} loading, aged ${r.archivedSecs.length} older notes into ${path.basename(arcPath)} (nothing deleted).`);
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

const mode = ['--analyze', '--collapse', '--verify', '--enforce'].find(m => ARGV.includes(m));
try {
  if (mode === '--analyze') analyze();
  else if (mode === '--collapse') collapse();
  else if (mode === '--verify') verify();
  else if (mode === '--enforce') enforce();
  else { console.error('usage: node memory-conveyor.mjs --analyze | --collapse | --verify | --enforce [--mem-dir <path>]'); process.exit(2); }
  orphanCheck();
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}
