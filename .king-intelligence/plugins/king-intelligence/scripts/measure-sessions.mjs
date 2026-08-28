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
import { rollup, MIN_CREATED, MIN_CHANGED, MIN_OUTWARD } from "./rollup-rules.mjs";
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
async function measureFile(file) {
  const ts = [];
  const touched = new Set();
  const touchedViaTerminal = new Set();
  const skills = [];
  let drafts = 0;
  let cwd = null;

  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line) continue;
    const tm = line.match(/"timestamp":"([^"]+)"/);
    if (tm) {
      const t = Date.parse(tm[1]);
      if (t) ts.push(t);
    }
    if (!cwd) {
      const cm = line.match(/"cwd":"((?:[^"\\]|\\.)*)"/);
      if (cm) { try { cwd = JSON.parse('"' + cm[1] + '"'); } catch { /* leave null */ } }
    }
    if (line.indexOf('"tool_use"') === -1) continue;

    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
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

  return {
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
}

// ---------- ledger ----------
function readLedger() {
  const rows = new Map();
  try {
    for (const line of fs.readFileSync(LEDGER, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        if (r && r.id) rows.set(r.id, r);
      } catch { /* skip a torn line rather than lose the file */ }
    }
  } catch { /* no ledger yet */ }
  return rows;
}

function writeLedger(rows) {
  fs.mkdirSync(DATA, { recursive: true });
  const out = [...rows.values()]
    .sort((a, b) => String(a.start).localeCompare(String(b.start)))
    .map((r) => JSON.stringify(r))
    .join("\n");
  const tmp = LEDGER + ".tmp";
  fs.writeFileSync(tmp, out + "\n");
  fs.renameSync(tmp, LEDGER); // atomic, so a crash mid-write never truncates the ledger
}

function readIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX, "utf8")); } catch { return {}; }
}
function writeIndex(idx) {
  fs.mkdirSync(DATA, { recursive: true });
  const tmp = INDEX + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(idx));
  fs.renameSync(tmp, INDEX);
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
  candidates.push(
    path.join(os.homedir(), ".claude", "plugins", "marketplaces", "king-intelligence", "plugins", "king-intelligence"),
    path.join(os.homedir(), ".claude", "plugins", "marketplaces", "king-intelligence-starter", "plugins", "king-intelligence")
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
function resolveTarget() {
  if (process.env.KI_NO_SEND === "1") return { token: null, portal: null, isGithub: false, blocked: "KI_NO_SEND=1" };
  let token = null;
  const ti = argv.indexOf("--token");
  const tokenWasNamed = ti >= 0;
  if (tokenWasNamed) token = argv[ti + 1] || null;
  if (!token && !tokenWasNamed) token = process.env.KI_MEMBER_TOKEN || null;
  if (!token && tokenWasNamed) return { token: null, portal: null, isGithub: false, blocked: "--token was given but empty" };
  let host = null;
  if (!token) {
    try {
      const km = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude", "plugins", "known_marketplaces.json"), "utf8"));
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
      if (url) { const m = url.match(/^https?:\/\/([^@/]+)@([^/]+)\//); if (m) { token = m[1]; host = m[2]; } }
    } catch { /* no marketplace config -> nothing to send with */ }
  }
  const pi = argv.indexOf("--portal");
  let portal = (pi >= 0 && argv[pi + 1]) || process.env.PORTAL_BASE || null;
  if (!portal) portal = host ? "https://" + host : "https://members.king-intelligence.com";
  return { token, portal, isGithub: /github\.com/i.test(host || portal) };
}

function snapshotOf(r) {
  return {
    schema_version: 3, // v3 = measured, not estimated
    snapshot_at: new Date().toISOString(),
    machine_id: machineId(),
    machine_host: os.hostname(),
    plugin_version: installedVersion(),
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
  };
}

async function send(r) {
  if (has("--dry-run")) return { sent: false, reason: "dry run", wouldSend: snapshotOf(r) };
  const { token, portal, isGithub, blocked } = resolveTarget();
  if (blocked) return { sent: false, reason: blocked };
  if (!token || isGithub) return { sent: false, reason: token ? "legacy host, kept local" : "no member token on this machine" };
  const ti = argv.indexOf("--send-timeout-ms");
  const timeoutMs = (ti >= 0 && parseInt(argv[ti + 1], 10)) || 0;
  try {
    const res = await fetch(portal.replace(/\/$/, "") + "/api/time-saved/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify(snapshotOf(r)),
      ...(timeoutMs > 0 ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    });
    if (!res.ok) return { sent: false, reason: "HTTP " + res.status, status: res.status };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e && e.message) || String(e) };
  }
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

const LOCK = path.join(DATA, "sweep.lock");
const LOCK_STALE_MS = 15 * 60 * 1000;

function takeLock() {
  try {
    fs.mkdirSync(DATA, { recursive: true });
    try {
      const st = fs.statSync(LOCK);
      if (Date.now() - st.mtimeMs < LOCK_STALE_MS) return false; // someone else is sweeping
      fs.rmSync(LOCK, { force: true }); // a crashed sweep must not lock the owner out forever
    } catch { /* no lock held */ }
    fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" });
    return true;
  } catch { return false; }
}
function dropLock() { try { fs.rmSync(LOCK, { force: true }); } catch { /* ignore */ } }

async function doSweep() {
  if (!has("--no-lock") && !takeLock()) return { skippedLocked: true, ...rollup(readLedger()) };
  const rows = readLedger();
  const idx = has("--full") ? {} : readIndex();
  let measured = 0, skipped = 0;
  // Counted because "measured: 0" alone cannot be read (8/27/26). It means one of three
  // completely different things: nobody worked, every session was already counted, or
  // every transcript failed to read. A machine in the third state looks exactly like a
  // quiet member, forever, and three members currently report nothing at all. The index
  // is only stamped on success, so a permanently unreadable transcript is retried every
  // sweep and fails every time, which is precisely the case that needs a name.
  let unreadable = 0, empty = 0;
  const firstProblem = { file: null, why: null };

  for (const file of allTranscripts()) {
    let st;
    try { st = fs.statSync(file); } catch { continue; }
    const stamp = st.mtimeMs + ":" + st.size;
    if (idx[file] === stamp && rows.has(path.basename(file, ".jsonl"))) { skipped += 1; continue; }
    try {
      const row = await measureFile(file);
      if (row) { rows.set(row.id, row); measured += 1; }
      else {
        // A transcript with nothing measurable in it. Common and harmless on its own;
        // only interesting when it is ALL of them.
        empty += 1;
        if (!firstProblem.file) { firstProblem.file = path.basename(file); firstProblem.why = "nothing measurable in it"; }
      }
      idx[file] = stamp;
    } catch (e) {
      // One bad transcript never stops the sweep, but it is no longer invisible.
      unreadable += 1;
      if (!firstProblem.file) {
        firstProblem.file = path.basename(file);
        firstProblem.why = String((e && e.message) || e).slice(0, 160);
      }
    }
  }

  // A transcript Claude Code has deleted keeps its ledger line: the record outlives the source.
  writeLedger(rows);
  writeIndex(idx);
  dropLock();
  const total = rollup(rows);
  return {
    measured,
    skipped,
    unreadable,
    empty,
    ...(firstProblem.file ? { firstProblem } : {}),
    ...total,
    ...(has("--send") ? { send: await send(total) } : {}),
  };
}

async function doSession(id) {
  if (!id) return { error: "no session id" };
  const rows = readLedger();
  const idx = readIndex();
  for (const file of allTranscripts()) {
    if (path.basename(file, ".jsonl") !== id) continue;
    const row = await measureFile(file);
    if (row) rows.set(row.id, row);
    try { const st = fs.statSync(file); idx[file] = st.mtimeMs + ":" + st.size; } catch { /* ignore */ }
    writeLedger(rows);
    writeIndex(idx);
    const total = rollup(rows);
    return { measured: row ? 1 : 0, ...total, ...(has("--send") ? { send: await send(total) } : {}) };
  }
  const total = rollup(rows);
  return { measured: 0, ...total, ...(has("--send") ? { send: await send(total) } : {}) };
}

async function main() {
  let result;
  if (cmd === "sweep") result = await doSweep();
  else if (cmd === "session") result = await doSession(arg(1));
  else if (cmd === "total") result = rollup(readLedger());
  else if (cmd === "send") result = { ...rollup(readLedger()), send: await send(rollup(readLedger())) };
  else if (cmd === "verify") {
    // Two separate claims, proven separately. A live session is still being written while this
    // runs, so comparing two whole sweeps would report a few seconds of real growth as a defect.
    // 1. The ROLL-UP is deterministic: same ledger in, same total out. This is the half the old
    //    system got wrong (model-written session ids collided and double-booked 1,455 minutes).
    // 2. The MEASUREMENT is stable: re-reading a transcript that has not changed on disk gives
    //    back the identical row, so a re-measure can only ever replace, never stack.
    const ledger = readLedger();
    const r1 = JSON.stringify(rollup(ledger));
    const r2 = JSON.stringify(rollup(readLedger()));

    const idx = readIndex();
    let checked = 0, drifted = 0;
    const drift = [];
    for (const file of allTranscripts()) {
      const id = file.replace(/\\/g, "/").split("/").pop().replace(/\.jsonl$/, "");
      const old = ledger.get(id);
      if (!old) continue;
      let st;
      try { st = fs.statSync(file); } catch { continue; }
      if (idx[file] !== st.mtimeMs + ":" + st.size) continue; // grew since; not a fair comparison
      const fresh = await measureFile(file);
      checked += 1;
      if (!fresh) { drifted += 1; drift.push(id); continue; }
      const same =
        fresh.activeMin === old.activeMin &&
        fresh.drafts === old.drafts &&
        JSON.stringify([...fresh.touched].sort()) === JSON.stringify([...(old.touched || [])].sort());
      if (!same) { drifted += 1; if (drift.length < 5) drift.push(id); }
      if (checked >= 200) break;
    }

    result = {
      rollupDeterministic: r1 === r2,
      transcriptsRechecked: checked,
      transcriptsThatDrifted: drifted,
      drift: drift.slice(0, 5),
      stable: r1 === r2 && drifted === 0,
      total: rollup(ledger),
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
} finally {
  try { dropLock(); } catch { /* ignore */ }
}
process.exit(0);
