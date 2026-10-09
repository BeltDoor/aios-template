#!/usr/bin/env node
// King Intelligence - the time-saved MEASUREMENT engine (8/21/26 rebuild).
//
// Replaces the old guess-and-cap rails (action-count.mjs's tiered work floor, the 45-minute
// guard, the model-estimated ad-hoc figure). Nothing here is estimated. Every figure is read
// from Claude Code's own session records, which already carry a timestamp on every action.
//
// WHAT IT MEASURES, per session:
//   activeMin - sum of the gaps between consecutive actions, any gap over IDLE_CAP discarded.
//               An open window that nobody is using earns exactly nothing.
//   touched   - the documents the session created or changed (stored as short hashes, never
//               paths, so the ledger stays small and carries none of the owner's file names).
//   drafts    - outward artifacts that leave no file behind: an email or message drafted, a
//               post, a calendar event, a page published.
//   skills    - which King Intelligence tools ran (counts only, for the "what you used" story).
//
// WHAT IT COSTS BY HAND (the owner's price list, deliberately the floor):
//   a document created ........ MIN_CREATED
//   a document changed ........ MIN_CHANGED   (a later session touching the same document)
//   an outward artifact ....... MIN_OUTWARD
//   ...and a session never credits less than the time the machine actually worked.
//
// A document counts as CREATED the first time it is ever written and as CHANGED every later
// session that touches it, so rewriting the same file 40 times never bills 40 new documents.
// That decision is made at roll-up across the whole ledger, which is why the roll-up is the
// only place a total is computed and why the answer is identical every time it runs.
//
// STORAGE: one durable line per session in <DATA>/time-saved/sessions.jsonl, keyed by session
// id so re-measuring REPLACES instead of stacking (idempotent by construction - this is what
// the old model-generated session ids got wrong). The line outlives the transcript it came
// from, which matters because Claude Code deletes transcripts after about 30 days.
//
// Discipline mirrors backup.mjs: swallow everything, never block, always exit 0.
//
// Usage:
//   node measure-sessions.mjs sweep [--full] [--json]   measure every transcript not yet measured
//   node measure-sessions.mjs session <id> [--json]     measure one session (the SessionEnd path)
//   node measure-sessions.mjs total [--json]            roll up the ledger and print the totals
//   node measure-sessions.mjs send [--dry-run]          post the current totals to the members portal
//                                                       --dry-run prints the snapshot and posts nothing
//   node measure-sessions.mjs verify                    re-measure everything and prove the total is stable

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import readline from "node:readline";

// ---------- the price list (shipped, never invented locally) ----------
// One copy only, in rollup-rules.mjs, where it is tested. Two copies of a price list is two
// answers to "what did this save me" and only one of them is ever read.
export { MIN_CREATED, MIN_CHANGED, MIN_OUTWARD, rollup } from "./rollup-rules.mjs";
import { rollup, MIN_CREATED, MIN_CHANGED, MIN_OUTWARD, isV2Row, v2Credit, legacyCredits } from "./rollup-rules.mjs";
// Per-session rules, version 2 (10/7/26): true create versus change, Windows paths, failed and
// retried actions, non-file signals as data only. Used for NEW rows only; see measureFile.
import * as engineState from "./engine-state.mjs";
import { createCollector, RULES_VERSION } from "./session-evidence.mjs";
const IDLE_CAP_MS = 5 * 60 * 1000;

// ---------- where things live ----------
// ONE fixed home, always. This used to follow CLAUDE_PLUGIN_DATA when it was set, which meant a
// hook run and a hand run stored their ledger and their machine identity in two different places.
// The machine then registered TWICE, each copy measured the same transcripts on its own, and the
// portal summed both: the owner's own total read exactly double. It also moves with the plugin,
// so a reinstall would have orphaned the history. It lives under the home folder now and nowhere
// else. KI_TIME_SAVED_DIR stays, for tests only.
const DATA =
  process.env.KI_TIME_SAVED_DIR ||
  path.join(os.homedir(), ".claude", "king-intelligence", "time-saved");
const LEDGER = path.join(DATA, "sessions.jsonl");
adoptLegacyData();

// A build before this one may have written the ledger under the plugin's data folder. Move it in
// rather than start from nothing. Runs once: after the move the old folder holds no ledger.
function adoptLegacyData() {
  try {
    if (process.env.KI_TIME_SAVED_DIR || !process.env.CLAUDE_PLUGIN_DATA) return;
    const old = path.join(process.env.CLAUDE_PLUGIN_DATA, "time-saved");
    if (old === DATA) return;
    const oldLedger = path.join(old, "sessions.jsonl");
    if (!fs.existsSync(oldLedger)) return;
    fs.mkdirSync(DATA, { recursive: true });
    // never clobber a real ledger already in the fixed home
    if (!fs.existsSync(LEDGER)) {
      for (const f of ["sessions.jsonl", "measured.json", "machine.json"]) {
        const from = path.join(old, f);
        if (fs.existsSync(from) && !fs.existsSync(path.join(DATA, f))) fs.copyFileSync(from, path.join(DATA, f));
      }
    }
    fs.renameSync(oldLedger, oldLedger + ".migrated");
  } catch { /* a failed adoption just means a re-measure, never a crash */ }
}
const INDEX = path.join(DATA, "measured.json");
const PROJECTS = process.env.KI_PROJECTS_DIR || path.join(os.homedir(), ".claude", "projects");

const argv = process.argv.slice(2);
const cmd = argv[0];
const has = (f) => argv.includes(f);
const arg = (i) => argv[i];

// ---------- what counts as work ----------
// A path that is scratch, machinery, or someone else's dependency is not a deliverable.
// A document written through the TERMINAL rather than with the file-writing tools.
//
// Measured 8/28/26 on this machine: across 534 sessions in 14 days, 3,112 documents were
// written with the tools and 5,610 through the terminal. After stripping scratch files,
// temp paths and machinery, 626 DISTINCT real documents had been written this way and
// earned the member nothing, which is about 52 hours at the engine's own changed-a-document
// price. On one eight-hour session there were 1,657 terminal commands and not a single
// Write or Edit, so its document credit was exactly zero.
//
// These are recorded SEPARATELY and are deliberately NOT priced into anyone's total. Turning
// them on raises every member's hours at once, and that is a decision about what the number
// means, not a bug fix. Recording them makes the size of the gap a fact instead of an
// argument, and switching it on later is one line.
const TERMINAL_WRITE = /(?:cat\s*>+\s*|tee\s+(?:-a\s+)?|>>?\s*)([A-Za-z0-9._\/~$-]+\.[A-Za-z0-9]{1,5})/g;
// Only things a member would call a document. A script or a config is machinery.
const DOCLIKE = /\.(md|txt|csv|json|html|docx|pptx|pdf|xlsx)$/i;

const NOISE = /(^|\/)(node_modules|\.git|\.next|dist|build|coverage|__pycache__|\.venv)(\/|$)|(^\/tmp\/|^\/private\/tmp\/|\/scratchpad\/)|\.claude\/time-saved\//;

// Outward artifacts: a thing produced for a person outside this session. Matched on the tool's
// last name segment so a new MCP server with the same verb is covered without a code change.
const OUTWARD = new Set([
  "create_draft", "reply", "forward", "send_message", "send_mail", "send_draft",
  "outlook_create_draft", "outlook_create_reply_draft", "outlook_create_reply_all_draft",
  "outlook_send_mail", "outlook_send_draft", "outlook_forward_mail", "outlook_create_event",
  "create_event", "blotato_create_post", "blotato_send_message", "blotato_post_comment",
  "notion-create-pages", "Artifact",
]);
const WRITE_TOOLS = new Set(["Write"]);
const EDIT_TOOLS = new Set(["Edit", "NotebookEdit", "MultiEdit"]);

const shortHash = (p) => crypto.createHash("sha1").update(p).digest("hex").slice(0, 12);
const lastSegment = (name) => String(name).split("__").pop();

// ---------- measure ONE transcript ----------
//
// `legacy: true` reproduces a row exactly as every toolkit before rules version 2 wrote it (only
// `verify` uses it). "compat" is that row plus `eng` and `signals`, read the same streaming way.
//
// "v2" READS THE TRANSCRIPT ONCE (Codex round 8): the whole file is read into one buffer first, so
// a line appended while the engine is working can never be half in and half out of the measure.
function* bufferLines(buf) {
  let at = 0;
  while (at < buf.length) {
    let nl = buf.indexOf(10, at);
    if (nl === -1) nl = buf.length;
    let end = nl;
    if (end > at && buf[end - 1] === 13) end -= 1;
    yield buf.toString("utf8", at, end);
    at = nl + 1;
  }
}
function readOnce(file) {
  const fd = fs.openSync(file, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const buf = Buffer.allocUnsafe(size);
    let got = 0;
    while (got < size) { const n = fs.readSync(fd, buf, got, size - got, got); if (!n) break; got += n; }
    return buf.subarray(0, got);
  } finally { fs.closeSync(fd); }
}
// mode: "legacy" = exactly the v0.66.0 row; "compat" = that same row plus the engine marker and the
// non-file signals (fields v0.66.0 ignores); "v2" = the version-2 row (only once activated).
async function measureFile(file, { mode = "v2", legacy = false } = {}) {
  if (legacy) mode = "legacy";
  const collector = mode === "legacy" ? null : createCollector({ idleCapMs: IDLE_CAP_MS });
  const buf = mode === "v2" ? readOnce(file) : null;
  const ts = [];
  const touched = new Set();
  const touchedViaTerminal = new Set();
  const skills = [];
  let drafts = 0;
  let cwd = null;

  const rl = buf ? bufferLines(buf) : readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line) continue;
    const tm = line.match(/"timestamp":"([^"]+)"/);
    let rec = null;
    const t = tm ? Date.parse(tm[1]) || 0 : 0;
    if (collector) {
      try { rec = JSON.parse(line); } catch { rec = null; }
      if (rec) {
        try { collector.add(rec); } catch { /* one odd record never stops a measure */ }
      }
    }
    if (t) ts.push(t);
    if (!cwd) {
      const cm = line.match(/"cwd":"((?:[^"\\]|\\.)*)"/);
      if (cm) { try { cwd = JSON.parse('"' + cm[1] + '"'); } catch { /* leave null */ } }
    }
    if (line.indexOf('"tool_use"') === -1) continue;

    if (!rec) { try { rec = JSON.parse(line); } catch { continue; } }
    const content = rec && rec.message && rec.message.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (!block || block.type !== "tool_use") continue;
      const name = String(block.name || "");
      const input = block.input || {};

      if (WRITE_TOOLS.has(name) || EDIT_TOOLS.has(name)) {
        const p = input.file_path || input.notebook_path;
        if (typeof p === "string" && p && !NOISE.test(p)) touched.add(shortHash(p));
        continue;
      }
      if (name === "Bash") {
        const cmd = String(input.command || "");
        for (const m of cmd.matchAll(TERMINAL_WRITE)) {
          const p = m[1];
          if (!p || NOISE.test(p) || !DOCLIKE.test(p) || p.startsWith("/dev/")) continue;
          // Not added to `touched`: this is a measurement, not a credit.
          if (!touched.has(shortHash(p))) touchedViaTerminal.add(shortHash(p));
        }
        continue;
      }
      // Two invocation paths, one counter (Skills Door migration, 8/27/26). The local
      // Skill tool, and the door's MCP tool that every synced command stub calls. Miss
      // the second and a member's "which tools you use" breakdown silently goes dark
      // the day the plugin stops shipping skill files. Hours are unaffected either way
      // (they come from active time and touched documents, not from skill detection).
      const skillName =
        name === "Skill" && typeof input.skill === "string"
          ? input.skill
          : name === "mcp__king-intelligence__use_skill" && typeof input.name === "string"
            ? input.name
            : null;
      if (skillName !== null) {
        const s = skillName.split(":").pop().replace(/^\//, "").trim().toLowerCase();
        if (s) skills.push(s.replace(/[^a-z0-9_-]/g, "").slice(0, 64));
        continue;
      }
      if (OUTWARD.has(name) || OUTWARD.has(lastSegment(name))) drafts += 1;
    }
  }

  if (!ts.length) return null;
  ts.sort((a, b) => a - b);
  let activeMs = 0;
  for (let i = 1; i < ts.length; i++) {
    const gap = ts[i] - ts[i - 1];
    if (gap > 0 && gap <= IDLE_CAP_MS) activeMs += gap;
  }

  const row = {
    id: path.basename(file, ".jsonl"),
    folder: cwd || path.basename(path.dirname(file)),
    start: new Date(ts[0]).toISOString(),
    end: new Date(ts[ts.length - 1]).toISOString(),
    activeMin: Math.round((activeMs / 60000) * 100) / 100,
    touched: [...touched],
    touchedViaTerminal: [...touchedViaTerminal],
    drafts,
    skills: [...new Set(skills)],
    measuredAt: new Date().toISOString(),
  };
  if (!collector) return row;
  const ev = collector.finish();
  if (mode === "compat") return { ...row, eng: ENGINE_MARK, signals: ev.signals };

  // Rules version 2: the price comes from this session's own evidence (created / changed), only
  // successful actions count, retries count once.
  // `touched` IS EMPTY ON PURPOSE (Codex round 6). v0.66.0 prices `touched` through its own file
  // history (first seen = created) and SENDS that figure, so publishing changed files there let
  // an older window report more than this engine ever credits. With `touched` empty an older
  // engine prices this row at max(activeMin, drafts x 10), and both of those are this row's own
  // version-2 figures, so its report can never exceed the version-2 credit.
  return {
    ...row,
    eng: ENGINE_MARK,
    v: RULES_VERSION,
    touched: [],
    created: ev.created,
    changed: ev.changed,
    drafts: ev.drafts,
    failed: ev.failed,
    signals: ev.signals,
  };
}

// ---------- ONE SWITCH-OVER, NO OVERLAP (10/8/26, Jacob: "Remove the overlap week") ----------
//
// The first time this engine runs on a machine it switches over at once. Under the engine-state
// lock it takes ONE snapshot: v0.66.0's ledger (sessions.jsonl) plus a v0.66.0-style measure of
// every transcript on disk right then, the later end winning for a session in both. That snapshot
// is priced exactly as v0.66.0 prices it and frozen in activation.json, together with any gap up
// to v0.66.0's own total over its ledger (floorExtraMin), so the switch can never lower a total.
//
// From then on this engine NEVER reads or writes sessions.jsonl or measured.json again. It keeps
// its OWN files, sessions-v2.jsonl and measured-v2.json, written atomically under its own lock,
// and measures only sessions that START at or after the switch. A chat already open when the
// update landed earns nothing new afterwards (Jacob, 10/7). An older toolkit window still open can
// keep writing v0.66.0's files and reporting the old way; none of it reaches this engine's total,
// and the members portal ignores that window's reports once this machine has reported here.
//
//   total = the frozen snapshot + floorExtraMin + the version-2 roll-up over sessions-v2.jsonl
//
// A version-2 row's floor is its own previous credit in sessions-v2.jsonl (`floorMin`).
function parseRows(text) {
  const rows = new Map();
  for (const line of String(text).split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (r && r.id) rows.set(r.id, r);
    } catch { /* skip a torn line rather than lose the file */ }
  }
  return rows;
}
function readRowsFrom(file) {
  try { return parseRows(fs.readFileSync(file, "utf8")); } catch { return new Map(); }
}
// A FILE OF THIS ENGINE'S OWN THAT EXISTS BUT CANNOT BE READ STOPS THE RUN (Codex round 8). Treating
// it as absent would re-switch over (activation.json) or write an empty ledger over a full one
// (sessions-v2.jsonl). The run throws, writes and reports nothing, and the receipt says why.
class StateUnreadable extends Error {}
function readOwnFile(file) {
  try { return fs.readFileSync(file, "utf8"); }
  catch (e) { if (e && e.code === "ENOENT") return null; throw new StateUnreadable(path.basename(file) + " exists but cannot be read (" + ((e && e.code) || "error") + ")"); }
}
/** The v0.66.0 ledger. READ ONLY, and read only at the switch-over. */
function readShared() { return readRowsFrom(LEDGER); }
const laterEnd = (a, b) => String(a.end || "") > String(b.end || ""); // ISO strings compare in time order
/** Fold `from` into `into`: missing ids are added, an id with a later end replaces. Mutates and returns `into`. */
function mergeRows(into, from) {
  for (const [id, r] of from) {
    const mine = into.get(id);
    if (!mine || laterEnd(r, mine)) into.set(id, r);
  }
  return into;
}

/** The activated total: frozen snapshot + version-2 rows + any floor gap stored at activation. */
function activatedTotal(v2rows, act) {
  return rollup(rowsForTotal(v2rows, act), { extraMin: Number(act && act.floorExtraMin) || 0 });
}

// The clock the activation rule reads. KI_NOW (epoch ms) exists for tests only.
const nowMs = () => Number(process.env.KI_NOW) || Date.now();
const ENGINE_MARK = engineState.ENGINE_MARK;

// ---------- activation is ONE record (Codex round 9) ----------
// activation.json holds BOTH the activation moment and the frozen legacy credits, written in one
// atomic rename. It is the only thing that says "activated": there is no snapshot without an
// activation or activation without a snapshot, so an interrupted activation either happened
// completely or not at all. engine-state.json's own activatedAt is a secondary note.
const ACTIVATION = path.join(DATA, "activation.json");
function readActivation() {
  const text = readOwnFile(ACTIVATION);
  if (text === null) return null;
  let j;
  try { j = JSON.parse(text); } catch { throw new StateUnreadable("activation.json is not valid"); }
  if (!(j && typeof j.activatedAt === "string" && j.rows && typeof j.rows === "object")) throw new StateUnreadable("activation.json is not valid");
  return j;
}
function activatedAt() { const a = readActivation(); return a ? a.activatedAt : null; }
/** Written ONCE, under the engine-state lock; never overwritten. */
function writeActivation(rows, at, sharedHours = 0) {
  if (readActivation()) return;
  const tmp = ACTIVATION + "." + process.pid + ".tmp";
  engineState.faultPoint("act-tmp");
  const credits = legacyCredits(rows);
  const floorMin = Math.max(rollup(rows).hours, Number(sharedHours) || 0) * 60;
  const frozenMin = Object.values(credits).reduce((a, c) => a + (Number(c.c) || 0), 0);
  const floorExtraMin = Math.max(0, Math.round((floorMin - frozenMin) * 100) / 100);
  fs.writeFileSync(tmp, JSON.stringify({ activatedAt: at, rows: credits, ...(floorExtraMin > 0 ? { floorExtraMin } : {}) }));
  engineState.faultPoint("act-rename");
  // created, never replaced: an existing activation.json is never overwritten
  engineState.assertHeld(tmp);
  try { fs.linkSync(tmp, ACTIVATION); } finally { try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ } }
  engineState.faultPoint("act-after");
}

/**
 * The switch-over, once per machine (see ONE SWITCH-OVER above). Returns the activation record, or
 * null when another run holds the lock (it is switching over right now; this run does nothing).
 */
async function ensureActivated() {
  const have = readActivation();
  if (have) return have;
  const r = await engineState.withLockAsync(DATA, async () => {
    if (readActivation()) return readActivation();
    const at = new Date(nowMs()).toISOString();
    // EVERY SOURCE IS READ ONCE, AND COMPLETELY, OR THE SWITCH WAITS (Codex round 7). v0.66.0's total
    // is priced from this one read of its ledger (a second read could see an older window's later
    // writes); a file that exists but cannot be read defers the switch rather than freezing a
    // snapshot without it. After SWITCH_DEFER_MAX_MS of deferring, the switch goes ahead with what
    // could be read, so one damaged file can never stop a machine reporting for good.
    const problems = [];
    const shared = readSharedStrict(problems);
    let sharedHours = 0;
    try { sharedHours = rollup(shared).hours; } catch { /* priced below from the rows */ }
    const rows = new Map(shared);
    const fresh = new Map();
    for (const file of transcriptsStrict(problems)) {
      try { const row = await measureFile(file, { mode: "legacy" }); if (row) fresh.set(row.id, row); }
      catch (e) { if (!(e && e.code === "ENOENT")) problems.push(path.basename(file) + ": " + ((e && e.code) || "unreadable")); }
    }
    mergeRows(rows, fresh);
    await switchPause();
    if (problems.length && !deferredTooLong()) { noteDeferral(problems); return null; }
    writeActivation(rows, at, sharedHours);
    return readActivation();
  });
  return r && r !== engineState.BUSY ? r : null;
}
const SWITCH_DEFERRED = path.join(DATA, "switch-deferred.json");
const SWITCH_DEFER_MAX_MS = 3 * 86400000;
function deferredTooLong() {
  try { const t = Date.parse(JSON.parse(fs.readFileSync(SWITCH_DEFERRED, "utf8")).since); return Number.isFinite(t) && nowMs() - t >= SWITCH_DEFER_MAX_MS; } catch { return false; }
}
function noteDeferral(problems) {
  let since = new Date(nowMs()).toISOString();
  try { const j = JSON.parse(fs.readFileSync(SWITCH_DEFERRED, "utf8")); if (j && j.since) since = j.since; } catch { /* first deferral */ }
  try { writeAtomic(SWITCH_DEFERRED, JSON.stringify({ since, last: new Date(nowMs()).toISOString(), problems: problems.slice(0, 5) })); } catch { /* retried next run */ }
}
/** v0.66.0's ledger; a missing file is an empty ledger, any other read error is a problem. */
function readSharedStrict(problems) {
  let text;
  try { text = fs.readFileSync(LEDGER, "utf8"); }
  catch (e) { if (!(e && e.code === "ENOENT")) problems.push("sessions.jsonl: " + ((e && e.code) || "unreadable")); return new Map(); }
  return parseRows(text); // ONE read: these rows feed both the snapshot and v0.66.0's total
}
/** Every transcript; a folder that exists but cannot be listed is a problem (a missing one is not). */
function transcriptsStrict(problems) {
  const out = [];
  let dirs = [];
  try { dirs = fs.readdirSync(PROJECTS); } catch (e) { if (!(e && e.code === "ENOENT")) problems.push("projects: " + ((e && e.code) || "unreadable")); return out; }
  for (const d of dirs) {
    const dir = path.join(PROJECTS, d);
    let files = [];
    try { files = fs.readdirSync(dir); } catch (e) { if (!(e && (e.code === "ENOTDIR" || e.code === "ENOENT"))) problems.push(d + ": " + ((e && e.code) || "unreadable")); continue; }
    for (const f of files) if (f.endsWith(".jsonl")) out.push(path.join(dir, f));
  }
  return out;
}
// Test seam: KI_TEST_SWITCH_PAUSE_MS holds the switch-over inside its lock. Unset on members' machines.
const switchPause = () => new Promise((r) => setTimeout(r, Number(process.env.KI_TEST_SWITCH_PAUSE_MS) || 0));

const LEDGER_V2 = path.join(DATA, "sessions-v2.jsonl");
const INDEX_V2 = path.join(DATA, "measured-v2.json");
const LOCK_V2 = path.join(DATA, "sweep-v2.lock");
function readV2() {
  const rows = new Map();
  const text = readOwnFile(LEDGER_V2);
  if (text === null) return rows;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try { const r = JSON.parse(line); if (r && r.id && isV2Row(r)) rows.set(r.id, r); } catch { /* a torn line */ }
  }
  return rows;
}
function writeAtomic(file, text) {
  fs.mkdirSync(DATA, { recursive: true });
  const tmp = file + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, text);
  engineState.fencedRename(tmp, file);
}
function writeV2(rows) {
  writeAtomic(LEDGER_V2, [...rows.values()].sort((a, b) => String(a.start).localeCompare(String(b.start))).map((r) => JSON.stringify(r)).join("\n") + "\n");
}
function readV2Index() { try { return JSON.parse(fs.readFileSync(INDEX_V2, "utf8")); } catch { return {}; } }
function writeV2Index(idx) { writeAtomic(INDEX_V2, JSON.stringify(idx)); }

/** The version-2 storage's own lock: every read-modify-write of it, sweep and close alike. Owned (engine-state.mjs). */
async function withV2Lock(fn, waitMs = 8000) {
  const until = Date.now() + waitMs;
  fs.mkdirSync(DATA, { recursive: true });
  let token = null;
  for (;;) {
    token = engineState.tryAcquire(LOCK_V2);
    if (typeof token === "string") break;
    if (token !== null || Date.now() >= until) return { busy: true };
    await new Promise((r) => setTimeout(r, 40));
  }
  try { return await fn(); } finally { engineState.release(LOCK_V2, token); }
}

/** Every row the total is made of: the frozen snapshot (as rows) plus the version-2 rows. */
function rowsForTotal(v2rows = readV2(), snap = readActivation()) {
  const all = new Map();
  if (snap) for (const [id, f] of Object.entries(snap.rows)) all.set("legacy:" + id, { id, start: f.s, end: f.e, frozen: f, skills: Array.isArray(f.k) ? f.k : [] });
  for (const [id, r] of v2rows) all.set(id, r);
  return all;
}
/**
 * The total AND the engine mark it may be reported with, from ONE read of the activation record:
 * a ki2 mark only ever rides on a total computed from the activated storage (Codex round 9).
 */
function currentTotalMarked() {
  const act = readActivation();
  return act ? { total: activatedTotal(readV2(), act), mark: act.activatedAt } : null;
}
/** Callers switch over first; before that (busy) there is nothing of this engine's to show. */
function currentTotal() { const t = currentTotalMarked(); return t ? t.total : rollup(new Map()); }

/**
 * Measure one transcript into the version-2 rows (post-activation). Returns the row, or null when
 * the session started before activation (never measured) or has nothing in it. The new row
 * carries its own previous credit as its floor.
 */
async function measureV2(rows, file, actMs, frozen = null) {
  const row = await measureFile(file, { mode: "v2" });
  if (!row || !(Date.parse(row.start) >= actMs)) return null;
  // A session already in the switch-over snapshot is never also measured here, whatever times its
  // records carry (a clock that ran ahead at the switch): one session, one credit (harness, 10/8/26).
  if (frozen && Object.prototype.hasOwnProperty.call(frozen, row.id)) return null;
  const prev = rows.get(row.id);
  if (prev) row.floorMin = Math.max(Number(prev.floorMin) || 0, v2Credit(prev));
  rows.set(row.id, row);
  return row;
}

// ---------- roll up (the ONLY place a total is computed) ----------

// ---------- this machine ----------
// A member can work on two machines. Each one reports its own ledger under its own id so the
// portal SUMS them instead of letting the last one to close overwrite the other.
function machineId() {
  const f = path.join(DATA, "machine.json");
  try { const j = JSON.parse(fs.readFileSync(f, "utf8")); if (j && j.id) return j.id; } catch { /* mint one */ }
  const id = crypto.randomUUID();
  try {
    fs.mkdirSync(DATA, { recursive: true });
    fs.writeFileSync(f, JSON.stringify({ id, host: os.hostname(), created: new Date().toISOString() }));
  } catch { /* an unwritable data dir still gets a stable-enough id below */ }
  return id;
}

/** Claude Code's config folder, the same two lines every sibling uses. */
function cfgDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

// EVERY STAGE A TOOLKIT CAN BE AT, READ FROM FILES, NEVER GUESSED (9/17/26). The fleet report used
// to get ONE number from this machine, and that number was the loaded version from a hook but the
// CATALOG version from the detached sweep, so "0.54.0" could mean loaded, fetched-but-not-
// installed, or installed-but-not-relaunched. Three numbers and the two switches end that:
//   installed         <config>/plugins/installed_plugins.json, what Claude Code has on disk
//   catalog           the marketplace clone's plugin.json, what the library currently offers
//   loaded            <config>/king-intelligence/loaded.json, written by the session hook
//   native_autoupdate Claude Code's own per-marketplace updater flag in settings.json
//   recorded_bin      how the claude address was found and written down (claude-bin.json)
//   repair            the last run of repair.mjs
//   updates_off       true when the member switched automatic updates off and the session hook
//                     stood down on purpose (10/2/26), false when it ran the update path, null when
//                     no hook carrying this change has run yet. Written by auto-update.mjs to
//                     <config>/king-intelligence/updates-off.json. An off machine's library copy
//                     falls behind by design, so the fleet report must read this before "stuck".
//   updates_off_source which layer decided it: user, project, local (the folder's own file),
//                     registry or default. updates_off_at: when the hook last read it (ISO).
// Every miss is null. An older toolkit sends nothing, and the portal treats absence as "unknown".
function toolkitState() {
  const cfg = cfgDir();
  const rj = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
  const isV = (v) => typeof v === "string" && /^\d+\.\d+\.\d+/.test(v);
  const reg = rj(path.join(cfg, "plugins", "known_marketplaces.json"));
  const set = rj(path.join(cfg, "settings.json"));
  const pick = (o, name) => {
    if (!o || typeof o !== "object") return null;
    if (o[name] && typeof o[name] === "object") return o[name];
    for (const k of ["extraKnownMarketplaces", "knownMarketplaces", "marketplaces"]) {
      const c = o[k];
      if (c && typeof c === "object" && c[name] && typeof c[name] === "object") return c[name];
    }
    return null;
  };
  const entry = pick(reg, "king-intelligence") || pick(set, "king-intelligence");
  const url = entry && entry.source && typeof entry.source === "object" ? String(entry.source.url || "") : "";
  const starter = !!(pick(reg, "king-intelligence-starter") || pick(set, "king-intelligence-starter"));
  const rail = entry
    ? (/^https:\/\/[^@/]+@members\.king-intelligence\.com\/marketplace\.git$/.test(url) ? "portal" : /github\.com/i.test(url) ? "github" : "none")
    : starter ? "starter" : "none";
  const cat = rj(path.join(cfg, "plugins", "marketplaces", "king-intelligence", "plugins", "king-intelligence", ".claude-plugin", "plugin.json"));
  const ip = rj(path.join(cfg, "plugins", "installed_plugins.json"));
  const m = ip && ip.plugins && typeof ip.plugins === "object" ? ip.plugins : ip;
  let e = m && typeof m === "object" ? m["king-intelligence@king-intelligence"] : null;
  if (Array.isArray(e)) e = e[0];
  const installed = e && typeof e === "object" && isV(e.version) && (!e.installPath || fs.existsSync(e.installPath)) ? e.version : null;
  const ld = rj(path.join(cfg, "king-intelligence", "loaded.json"));
  const sEntry = pick(set, "king-intelligence");
  const native = sEntry ? (sEntry.autoUpdate === true ? true : sEntry.autoUpdate === false ? false : null) : null;
  const bin = rj(path.join(cfg, "king-intelligence", "claude-bin.json"));
  const rep = rj(path.join(cfg, "king-intelligence", "repair.json"));
  const uo = rj(path.join(cfg, "king-intelligence", "updates-off.json"));
  // ask_buttons_* (9/24/26): the question-buttons gate keeps its own tiny state file, separate
  // from everything above, missing on any machine older than this release. Missing => null for
  // both, same rule as every other field here.
  const ab = rj(path.join(cfg, "king-intelligence", "ask-buttons.json"));
  const askButtonsOff = ab && typeof ab.off === "boolean" ? ab.off : null;
  const askButtonsCaught = ab && Number.isInteger(ab.caught) && ab.caught >= 0 ? ab.caught : null;
  return {
    at: new Date().toISOString(),
    rail,
    installed,
    catalog: cat && isV(cat.version) ? cat.version : null,
    loaded: ld && isV(ld.version) ? ld.version : null,
    loaded_at: ld && typeof ld.at === "string" ? ld.at : null,
    native_autoupdate: native,
    recorded_bin: bin && typeof bin.how === "string" ? bin.how : null,
    repair: rep && typeof rep.verdict === "string" ? { at: String(rep.at || ""), verdict: rep.verdict } : null,
    updates_off: uo && typeof uo.off === "boolean" ? uo.off : null,
    // Where the deciding switch lives (user, project, local, registry, default) and when the hook
    // last read it. Separate keys so updates_off stays a plain boolean (10/2/26 review fix).
    updates_off_source: uo && typeof uo.source === "string" && /^(user|project|local|registry|default)$/.test(uo.source) ? uo.source : null,
    updates_off_at: uo && typeof uo.checkedAt === "string" ? uo.checkedAt.slice(0, 32) : null,
    ask_buttons_off: askButtonsOff,
    ask_buttons_caught: askButtonsCaught,
  };
}

// The version this machine ACTUALLY has. The portal used to show its own stale pointer back to
// itself, so a member on v0.34.0 read as current. This is the first real version signal.
function installedVersion() {
  // CLAUDE_PLUGIN_ROOT is set when Claude Code runs this as a hook and UNSET when anything
  // else runs it, including the detached sweep that sends most snapshots. So this returned
  // null on live machines and the portal recorded no version at all: eleven members had
  // never reported one, and Jacob's own active machine was blank while a machine that
  // stopped a week earlier supplied his version instead (found 8/28/26).
  //
  // The fallback reads the marketplace clone, which is the copy `marketplace update` keeps
  // current. Scoped to marketplaces/ on purpose: old versions live on under plugins/cache/
  // and an unscoped search happily returns one of those, which is the pinned 8/21 trap.
  const candidates = [];
  if (process.env.CLAUDE_PLUGIN_ROOT) candidates.push(process.env.CLAUDE_PLUGIN_ROOT);
  // Config-dir aware since 9/17/26: a CLAUDE_CONFIG_DIR machine used to report no version at all.
  candidates.push(
    path.join(cfgDir(), "plugins", "marketplaces", "king-intelligence", "plugins", "king-intelligence"),
    path.join(cfgDir(), "plugins", "marketplaces", "king-intelligence-starter", "plugins", "king-intelligence")
  );
  for (const root of candidates) {
    try {
      const v = JSON.parse(fs.readFileSync(path.join(root, ".claude-plugin", "plugin.json"), "utf8")).version;
      if (v) return v;
    } catch { /* try the next one */ }
  }
  return null;
}

function lastUpdateError() {
  // Reads the current location first, then the one older plugin versions wrote to, so a
  // machine that has not updated yet still has its failure seen. That is exactly the
  // machine this note is about, so leaving it unreadable would hide the cases that matter
  // most (8/28/26).
  const legacy = process.env.CLAUDE_PLUGIN_DATA
    ? path.join(process.env.CLAUDE_PLUGIN_DATA, "time-saved", "update-error.json")
    : null;
  for (const p of [path.join(DATA, "update-error.json"), legacy]) {
    if (!p) continue;
    try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { /* try the next */ }
  }
  return null;
}

// token: --token | KI_MEMBER_TOKEN | the token baked into the marketplace URL this machine uses.
//
// THE FALLBACK IS OPT-OUT-ABLE ON PURPOSE (8/21/26, learned the hard way). Testing the send path
// with a deliberately blank token used to fall through to the credential the machine really
// holds and POST to the live portal for real, overwriting the owner's own figures with test
// data. The written warning about this already existed and was not enough, so the guard is now
// in the code: pass --token at all (even empty) or set KI_NO_SEND=1 and this NEVER reaches for
// the machine's real credential.
// THE MEMBER'S OWN FOLDER IS A KEY SOURCE TOO (9/26/26). A keyed download carries the key in
// `.claude/settings.local.json` and `.mcp.json`. On a computer where the toolkit switch never
// registered (a member's fresh Windows install, 9/25/26) the registry below was empty, so the
// sender found nothing and the member's hours never arrived, silently. These are read AFTER
// the registry and the environment, only when neither produced a key, and the key is used
// only with the members portal (project-key.mjs refuses any other address).
//
// Which folder: --project-dir (the hooks pass it), else CLAUDE_PROJECT_DIR, else the working
// folder, else the folder a previous run found a key in. Only the folder's PATH is remembered
// (key-source.json), never the key, so a session opened in some other folder still reports.
const KEY_SOURCE = path.join(DATA, "key-source.json");
let projectKeyModule = null;
try { projectKeyModule = await import("./project-key.mjs"); } catch { /* an older copy without it: registry only */ }

function projectKey() {
  if (!projectKeyModule) return null;
  const pi = argv.indexOf("--project-dir");
  const remembered = (() => {
    try { const j = JSON.parse(fs.readFileSync(KEY_SOURCE, "utf8")); return typeof j.dir === "string" ? j.dir : null; } catch { return null; }
  })();
  const dirs = [pi >= 0 ? argv[pi + 1] : null, process.env.CLAUDE_PROJECT_DIR, process.cwd(), remembered];
  let hit = null;
  try { hit = projectKeyModule.findProjectKey(dirs); } catch { hit = null; }
  if (hit && hit.dir && hit.dir !== remembered) {
    try {
      fs.mkdirSync(DATA, { recursive: true });
      fs.writeFileSync(KEY_SOURCE, JSON.stringify({ dir: hit.dir, via: hit.via, at: new Date().toISOString() }));
    } catch { /* remembering is a convenience, never a failure */ }
  }
  return hit;
}

function resolveTarget() {
  if (process.env.KI_NO_SEND === "1") return { token: null, portal: null, isGithub: false, blocked: "KI_NO_SEND=1" };
  let token = null;
  const ti = argv.indexOf("--token");
  const tokenWasNamed = ti >= 0;
  let via = null;
  if (tokenWasNamed) { token = argv[ti + 1] || null; via = "flag"; }
  if (!token && !tokenWasNamed) { token = process.env.KI_MEMBER_TOKEN || null; if (token) via = "environment"; }
  if (!token && tokenWasNamed) return { token: null, portal: null, isGithub: false, blocked: "--token was given but empty" };
  let host = null;
  if (!token) {
    try {
      const km = JSON.parse(fs.readFileSync(path.join(cfgDir(), "plugins", "known_marketplaces.json"), "utf8"));
      const findUrl = (obj) => {
        for (const v of Object.values(obj || {})) {
          if (v && typeof v === "object") {
            const u = v.source?.url || v.url;
            if (typeof u === "string" && /marketplace\.git/.test(u)) return u;
            const nested = findUrl(v);
            if (nested) return nested;
          }
        }
        return null;
      };
      const url = findUrl(km);
      if (url) {
        // parsed, never pattern-matched: the user part is the key, the hostname is where it lives
        try {
          const u = new URL(String(url).trim());
          if (u.username && !u.password) { token = decodeURIComponent(u.username); host = u.hostname.toLowerCase(); via = "marketplace"; }
        } catch { /* an address that does not parse carries no usable key */ }
      }
    } catch { /* no marketplace config -> nothing to send with */ }
  }
  // A registry that only knows the retired GitHub connection yields a key the portal cannot use,
  // so the folder's portal key wins over it.
  if (!token || (via === "marketplace" && /github\.com/i.test(host || ""))) {
    const hit = projectKey();
    if (hit) { token = hit.token; host = hit.host; via = hit.via; }
  }
  const pi = argv.indexOf("--portal");
  let portal = (pi >= 0 && argv[pi + 1]) || process.env.PORTAL_BASE || null;
  if (!portal) portal = host ? "https://" + host : PORTAL_ORIGIN;
  const isGithub = /github\.com/i.test(host || portal);
  // A DISCOVERED KEY ONLY EVER GOES TO THE MEMBERS SITE (9/26/26 review). A key this script found
  // on its own (Claude Code's registry, the member's folder) is the member's credential, and
  // --portal or PORTAL_BASE could otherwise point it at any server. Only a key the caller handed
  // over explicitly (--token, KI_MEMBER_TOKEN) may be sent somewhere else, which is what tests do.
  const discovered = via === "marketplace" || via === "project-settings" || via === "project-connection";
  if (token && discovered && !isGithub && !isPortalOrigin(portal)) {
    return { token: null, portal: null, isGithub: false, via, blocked: "the report address is not the members site, so this computer's key was not sent", offOrigin: true };
  }
  return { token, portal, isGithub, via };
}

const PORTAL_ORIGIN = "https://members.king-intelligence.com";
function isPortalOrigin(portal) {
  try {
    const u = new URL(String(portal));
    return u.origin === PORTAL_ORIGIN && u.username === "" && u.password === "";
  } catch { return false; }
}

function snapshotOf(r, mark = null, generation = null) {
  const toolkit = toolkitState();
  return {
    schema_version: 3, // v3 = measured, not estimated
    snapshot_at: new Date().toISOString(),
    machine_id: machineId(),
    machine_host: os.hostname(),
    // INSTALLED is the honest number (9/17/26). The older chain (loaded in a hook, else the
    // catalog clone) stays only as the fallback for a machine whose installed_plugins.json
    // cannot be read, because a blank is worse than the old ambiguity.
    plugin_version: toolkit.installed || installedVersion(),
    toolkit,
    update_error: lastUpdateError(),
    hours_saved: r.hours,
    machine_hours: r.machineHours,
    sessions: r.sessions,
    sessions_seen: r.sessionsSeen,
    active_days: r.activeDays,
    docs_created: r.docsCreated,
    docs_changed: r.docsChanged,
    drafts: r.drafts,
    skills: Object.entries(r.skills || {}).slice(0, 200).map(([slug, uses]) => ({ slug, uses })),
    first_session_at: r.firstSession,
    last_active_at: r.lastSession,
    // THE FENCE (10/7/26). Once this machine has activated the version-2 rules, every report says
    // so. The members portal remembers it per machine and from then on ignores any report for this
    // machine that does not carry it: an older toolkit window that wakes up and re-prices the
    // shared ledger the old way can no longer move the member's number. Before activation nothing
    // is added, so the portal treats this machine exactly as before.
    // The mark is passed in by the code that computed `r` from the activated storage, never
    // looked up at send time, so a compat total can never go out labelled ki2 (Codex round 9).
    ...(mark ? { hours_engine: ENGINE_MARK, activated_at: mark } : {}),
    // THE INSTALL NUMBER (10/8/26). Issued by the portal, never derived from this computer's clock,
    // so the portal always knows which install on this machine is the current one (see register).
    ...(mark && generation ? { hours_engine_generation: generation } : {}),
  };
}

// ---------- the install number (portal-issued, Codex round 6) ----------
// A client clock cannot prove which of two installs on one machine is the newer, so the portal
// issues the number. Before its first report an activated machine asks for one (register_install)
// and keeps it in install-generation.json; every report carries it. The portal refuses a report
// without a number it knows (reason_code "stale_generation"); this machine then forgets its number
// and asks again on the next report. Registration is keyed to this install's fixed identity, so
// asking again returns the SAME number; an install the portal knows has been replaced is told
// "retired_install" and stops reporting for good. A portal that does not issue numbers yet
// (any answer without one), and reports go out without one, exactly as before.
const GEN = path.join(DATA, "install-generation.json");
function readGeneration() {
  try { const g = Number(JSON.parse(fs.readFileSync(GEN, "utf8")).generation); return Number.isInteger(g) && g > 0 ? g : null; } catch { return null; }
}
/** This install's fixed identity: its machine and the moment it switched over (Codex round 7). */
const installId = (mark) => crypto.createHash("sha256").update(machineId() + "|" + String(mark)).digest("hex").slice(0, 32);
/** The portal said a newer install now reports for this machine: this one stops reporting for good. */
function retiredInstall() { try { return JSON.parse(fs.readFileSync(GEN, "utf8")).retired === true; } catch { return false; } }
/** A portal that answered a registration without a number is not asked again for a day. */
const NO_NUMBERS_MS = 24 * 3600000;
function numbersUnsupportedRecently() {
  try { const t = Date.parse(JSON.parse(fs.readFileSync(GEN, "utf8")).unsupportedAt); return Number.isFinite(t) && Date.now() - t < NO_NUMBERS_MS; } catch { return false; }
}
async function readReply(res) { try { return typeof res.json === "function" ? await res.json() : {}; } catch { return {}; } }

async function send(r, mark = null) {
  if (has("--dry-run")) return { sent: false, reason: "dry run", wouldSend: snapshotOf(r, mark, readGeneration()) };
  const result = await sendOnce(r, mark);
  noteReport(result);
  return result;
}

async function sendOnce(r, mark = null) {
  const { token, portal, isGithub, blocked, via, offOrigin } = resolveTarget();
  if (blocked) return offOrigin ? { sent: false, reason: blocked, via } : { sent: false, reason: blocked, quiet: true };
  if (!token) return { sent: false, reason: "no member token on this machine", noKey: true };
  if (isGithub) return { sent: false, reason: "legacy host, kept local", via };
  const ti = argv.indexOf("--send-timeout-ms");
  const timeoutMs = (ti >= 0 && parseInt(argv[ti + 1], 10)) || 0;
  const url = portal.replace(/\/$/, "") + "/api/time-saved/ingest";
  const post = (payload) => transport(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + token },
    body: JSON.stringify(payload),
    // A redirect is never followed with the key attached (9/26/26 review): the answer is read
    // as a refusal and the key stays on this computer.
    redirect: "manual",
    ...(timeoutMs > 0 ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
  });
  const refused = (res) => (res.status >= 300 && res.status < 400)
    ? { sent: false, reason: "HTTP " + res.status + " (a redirect was refused, so the key stayed on this computer)", status: res.status, via }
    : (!res.ok ? { sent: false, reason: "HTTP " + res.status, status: res.status, via } : null);
  try {
    if (mark && retiredInstall()) return { sent: false, reason: "a newer install of the toolkit now reports this computer's hours", quiet: true, via };
    let generation = mark ? readGeneration() : null;
    if (mark && !generation && !numbersUnsupportedRecently()) {
      // one registration at a time on this machine, and only if no other run got a number first
      const reg = await engineState.withLockAsync(DATA, async () => {
        const have = readGeneration();
        if (have) return { generation: have };
        const res = await post({ schema_version: 3, register_install: true, machine_id: machineId(), install_id: installId(mark), activated_at: mark });
        // a redirect is refused outright (the key never follows one); any other answer without a
        // number means a portal that does not issue numbers yet (today's portal answers 400 to this
        // request): the report goes out without one, exactly as before
        if (res.status >= 300 && res.status < 400) return { error: refused(res) };
        const j = res.ok ? await readReply(res) : {};
        if (j && j.reason_code === "retired_install") { writeAtomic(GEN, JSON.stringify({ generation: null, retired: true, at: new Date().toISOString() })); return { error: { sent: false, reason: "a newer install of the toolkit now reports this computer's hours", quiet: true, via } }; }
        const g = Number(j && j.hours_engine_generation);
        if (Number.isInteger(g) && g > 0) { writeAtomic(GEN, JSON.stringify({ generation: g, activatedAt: mark })); return { generation: g }; }
        try { writeAtomic(GEN, JSON.stringify({ generation: null, unsupportedAt: new Date().toISOString() })); } catch { /* ask again next time */ }
        return { generation: null };
      });
      if (reg === engineState.BUSY) return { sent: false, reason: "another run is registering this computer; the next run reports", via };
      if (reg.error) return reg.error;
      generation = reg.generation;
    }
    const res = await post(snapshotOf(r, mark, generation));
    const no = refused(res);
    if (no) return no;
    const j = await readReply(res);
    if (j && j.reason_code === "retired_install") {
      try { writeAtomic(GEN, JSON.stringify({ generation: null, retired: true, at: new Date().toISOString() })); } catch { /* told again next time */ }
      return { sent: false, reason: "a newer install of the toolkit now reports this computer's hours", quiet: true, via };
    }
    if (j && j.reason_code === "stale_generation") {
      try { fs.rmSync(GEN, { force: true }); } catch { /* ignore */ }
      return { sent: false, reason: "this computer's install number was out of date; it asks for a new one on the next report", via };
    }
    return { sent: true, via };
  } catch (e) {
    // an error message can echo a URL; strip any credential before it goes anywhere
    const msg = String((e && e.message) || e).replace(/https?:\/\/[^@\s/]+@/gi, "https://TOKEN@").replace(/Bearer\s+\S+/gi, "Bearer TOKEN");
    return { sent: false, reason: msg.slice(0, 200), via };
  }
}

/**
 * The network call, swappable for tests only. With KI_SEND_TRANSPORT set to a file path nothing
 * leaves the computer: the request is appended to that file as one JSON line carrying the address
 * and a SHA-256 of the Authorization header (never the key itself), and the answer's status comes
 * from KI_SEND_TRANSPORT_STATUS (default 200). The address rule above runs before this, so a test
 * sees exactly what a member's machine would have sent, and where.
 */
async function transport(url, init) {
  const file = process.env.KI_SEND_TRANSPORT;
  if (!file) return fetch(url, init);
  const auth = String((init.headers && init.headers.authorization) || "");
  fs.appendFileSync(file, JSON.stringify({
    url,
    redirect: init.redirect || null,
    auth_sha256: crypto.createHash("sha256").update(auth).digest("hex"),
    body_bytes: Buffer.byteLength(String(init.body || "")),
  }) + "\n");
  const status = parseInt(process.env.KI_SEND_TRANSPORT_STATUS || "200", 10) || 200;
  // KI_SEND_TRANSPORT_REPLY: the JSON answer (registrations read KI_SEND_TRANSPORT_REGISTER_REPLY first)
  const isReg = /"register_install":true/.test(String(init.body || ""));
  const reply = (isReg && process.env.KI_SEND_TRANSPORT_REGISTER_REPLY) || process.env.KI_SEND_TRANSPORT_REPLY || "{}";
  return { status, ok: status >= 200 && status < 300, json: async () => JSON.parse(reply) };
}

/**
 * THE ONE-LINE REPORT STATUS (9/26/26). Every send attempt, including the SessionEnd one whose
 * output nobody sees, leaves one plain line on disk: reported, or not reported and why. The
 * next session's start hook (session-sweep.mjs) reads it and says so when a report failed, so
 * a machine whose hours never arrive is no longer silent. The key is never written here.
 */
const REPORT_STATUS = path.join(DATA, "last-report.json");
function describeReport(result) {
  if (result.sent) return "reported to your member page";
  const why = result.noKey
    ? "no member key was found on this computer"
    : /not the members site/.test(result.reason || "")
      ? result.reason
    : result.quiet
      ? "sending is switched off on this computer"
      : /^HTTP 401|^HTTP 403/.test(result.reason || "")
        ? "the members site did not accept this computer's key (" + result.reason + "); a fresh copy from members.king-intelligence.com/system fixes it"
        : /^HTTP 5/.test(result.reason || "")
          ? "the members site had a problem (" + result.reason + "); it retries by itself next session"
          : "the members site could not be reached (" + String(result.reason || "unknown").slice(0, 120) + ")";
  return "not reported: " + why;
}
function noteReport(result) {
  try {
    fs.mkdirSync(DATA, { recursive: true });
    const line = describeReport(result);
    fs.writeFileSync(
      REPORT_STATUS,
      JSON.stringify({
        at: new Date().toISOString(),
        cmd: cmd ?? null,
        sent: !!result.sent,
        noKey: !!result.noKey,
        quiet: !!result.quiet,
        reason: result.sent ? null : String(result.reason || "").slice(0, 200),
        via: result.via || null,
        line,
      }) + "\n"
    );
    fs.writeFileSync(path.join(DATA, "last-report.txt"), `${new Date().toISOString()} ${line}\n`);
  } catch { /* a status line is never worth an error of its own */ }
}

// ---------- commands ----------
function allTranscripts() {
  const out = [];
  let dirs = [];
  try { dirs = fs.readdirSync(PROJECTS); } catch { return out; }
  for (const d of dirs) {
    const dir = path.join(PROJECTS, d);
    let files = [];
    try { files = fs.readdirSync(dir); } catch { continue; }
    for (const f of files) if (f.endsWith(".jsonl")) out.push(path.join(dir, f));
  }
  return out;
}

// v0.66.0's sweep.lock is not taken or removed: it is that version's file. Two runs of THIS engine
// are kept apart by the engine-state lock.

// Test seam: KI_TEST_SEND_PAUSE_MS waits between measuring and building the report. Unset on members' machines.
const sendPause = () => new Promise((r) => setTimeout(r, Number(process.env.KI_TEST_SEND_PAUSE_MS) || 0));

async function doSweep() {
  if (!(await ensureActivated())) return { skippedLocked: true, switchingOver: true, ...currentTotal() };
  return doSweepV2();
}

async function doSweepV2() {
  const actMs = Date.parse(activatedAt());
  const frozenRows = (readActivation() || {}).rows || {};
  const r = await withV2Lock(async () => {
    const rows = readV2();
    const idx = has("--full") ? {} : readV2Index();
    let measured = 0, skipped = 0, unreadable = 0, empty = 0;
    const firstProblem = { file: null, why: null };
    for (const file of allTranscripts()) {
      let st;
      try { st = fs.statSync(file); } catch { continue; }
      const stamp = st.mtimeMs + ":" + st.size;
      const id = path.basename(file, ".jsonl");
      if (idx[file] === "pre:" + stamp || (idx[file] === stamp && rows.has(id))) { skipped += 1; continue; }
      try {
        const row = await measureV2(rows, file, actMs, frozenRows);
        if (row) { measured += 1; idx[file] = stamp; }
        else { skipped += 1; idx[file] = "pre:" + stamp; } // started before activation, or empty: never credited
      } catch (e) {
        unreadable += 1;
        if (!firstProblem.file) { firstProblem.file = id; firstProblem.why = String((e && e.message) || e).slice(0, 160); }
      }
    }
    writeV2(rows);
    writeV2Index(idx);
    return { measured, skipped, unreadable, empty, ...(firstProblem.file ? { firstProblem } : {}), rows };
  });
  if (r.busy) return { skippedLocked: true, ...currentTotal() };
  const { rows, ...counts } = r;
  const act = readActivation();
  const total = activatedTotal(rows, act);
  return { ...counts, ...total, ...(has("--send") ? { send: await send(total, act.activatedAt) } : {}) };
}

async function doSession(id) {
  if (!id) return { error: "no session id" };
  if (!(await ensureActivated())) return { measured: 0, deferredToSweep: true, ...currentTotal() };
  const actMs = Date.parse(activatedAt());
  const frozenRows = (readActivation() || {}).rows || {};
  const r = await withV2Lock(async () => {
    const rows = readV2();
    const idx = readV2Index();
    let row = null;
    for (const file of allTranscripts()) {
      if (path.basename(file, ".jsonl") !== id) continue;
      row = await measureV2(rows, file, actMs, frozenRows);
      try { const st = fs.statSync(file); idx[file] = (row ? "" : "pre:") + st.mtimeMs + ":" + st.size; } catch { /* ignore */ }
      writeV2(rows);
      writeV2Index(idx);
      break;
    }
    return { rows, row };
  });
  if (r.busy) return { measured: 0, deferredToSweep: true, ...currentTotal() };
  const act = readActivation();
  const total = activatedTotal(r.rows, act);
  return { measured: r.row ? 1 : 0, ...total, ...(has("--send") ? { send: await send(total, act.activatedAt) } : {}) };
}

async function main() {
  let result;
  if (cmd === "sweep") result = await doSweep();
  else if (cmd === "session") result = await doSession(arg(1));
  else if (cmd === "total") { await ensureActivated(); result = currentTotal(); }
  else if (cmd === "send") {
    await ensureActivated();
    const m = currentTotalMarked();
    result = m ? { ...m.total, send: await send(m.total, m.mark) } : { ...currentTotal(), send: { sent: false, reason: "switching over on this machine right now; the next run reports" } };
  }
  else if (cmd === "verify") {
    // Two separate claims, proven separately. A live session is still being written while this
    // runs, so comparing two whole sweeps would report a few seconds of real growth as a defect.
    // 1. The ROLL-UP is deterministic: same ledger in, same total out. This is the half the old
    //    system got wrong (model-written session ids collided and double-booked 1,455 minutes).
    // 2. The MEASUREMENT is stable: re-reading a transcript that has not changed on disk gives
    //    back the identical row, so a re-measure can only ever replace, never stack.
    await ensureActivated();
    const v2 = true;
    const ledger = readV2();
    const r1 = JSON.stringify(currentTotal());
    const r2 = JSON.stringify(currentTotal());

    const idx = readV2Index();
    let checked = 0, drifted = 0;
    const drift = [];
    for (const file of allTranscripts()) {
      const id = file.replace(/\\/g, "/").split("/").pop().replace(/\.jsonl$/, "");
      const old = ledger.get(id);
      if (!old) continue;
      let st;
      try { st = fs.statSync(file); } catch { continue; }
      if (idx[file] !== st.mtimeMs + ":" + st.size) continue; // grew since; not a fair comparison
      const fresh = await measureFile(file, { mode: isV2Row(old) ? "v2" : "legacy" });
      checked += 1;
      if (!fresh) { drifted += 1; drift.push(id); continue; }
      const sorted = (a) => JSON.stringify([...(a || [])].sort());
      const same =
        fresh.activeMin === old.activeMin &&
        fresh.drafts === old.drafts &&
        sorted(fresh.touched) === sorted(old.touched) &&
        (!isV2Row(old) || (sorted(fresh.created) === sorted(old.created) && sorted(fresh.changed) === sorted(old.changed)));
      if (!same) { drifted += 1; if (drift.length < 5) drift.push(id); }
      if (checked >= 200) break;
    }

    result = {
      rollupDeterministic: r1 === r2,
      transcriptsRechecked: checked,
      transcriptsThatDrifted: drifted,
      drift: drift.slice(0, 5),
      stable: r1 === r2 && drifted === 0,
      total: currentTotal(),
    };
    delete result.total.skills;
  } else {
    console.error("commands: sweep [--full] [--send] | session <id> [--send] | send | total | verify");
    process.exit(2);
  }
  lastResult = result;
  console.log(JSON.stringify(result, null, has("--json") ? 0 : 2));
}

/**
 * THE RECEIPT (8/27/26). This engine swallows every error and always exits 0, on purpose:
 * measuring must never block a member's session. The cost is that a machine where the sweep
 * fails EVERY time fails invisibly every hour forever, with nothing anywhere to separate
 * "this member does not work much" from "this member's work has never once reached us".
 * Three members have never reported an hour, and this is one of the ways that happens unseen.
 * So the outcome is written down. Nothing reads it in order to decide anything; it exists so
 * a silent machine can be asked what went wrong instead of guessed about.
 */
function writeReceipt(outcome) {
  try {
    fs.mkdirSync(DATA, { recursive: true });
    fs.writeFileSync(
      path.join(DATA, ".last-run"),
      JSON.stringify({ at: new Date().toISOString(), cmd: cmd ?? null, ...outcome })
    );
  } catch {
    /* a receipt is never worth an error of its own */
  }
}

let lastResult = null;
try {
  await main();
  // Carry the counts into the receipt, so the answer to "why is this member silent"
  // is on disk without anyone having to re-run anything.
  writeReceipt({
    ok: true,
    error: null,
    ...(lastResult && typeof lastResult === "object"
      ? {
          measured: lastResult.measured,
          skipped: lastResult.skipped,
          unreadable: lastResult.unreadable,
          empty: lastResult.empty,
          firstProblem: lastResult.firstProblem ?? null,
        }
      : {}),
  });
} catch (e) {
  writeReceipt({ ok: false, error: String((e && e.message) || e).slice(0, 300) });
} finally { /* nothing to release: every lock is released where it was taken */ }
// A natural exit, never a hard process.exit(): on Node 24 / Windows a hard exit right after the
// fetch() above aborts the process ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)")
// while undici is still closing the connection. The work is done by then; only the exit code was
// wrong, and the caller read it as "not measured" (9/11/26).
process.exitCode = 0;
