// What ONE session really did, read from its own record (rules version 2, 10/7/26).
//
// measure-sessions.mjs used to decide "created" versus "changed" across the whole ledger: the
// first time the ledger had ever seen a file, it was billed as a new document. On a project that
// already existed, every file the member had written by hand before installing the toolkit read
// as brand new the first time Claude touched it. Windows paths slipped past the scratch filter
// too, because the filter only knew forward slashes. A failed write still earned its price, and a
// draft retried three times was billed three times.
//
// This module holds the per-session rules that fix that, as plain functions with no side effects,
// so every rule is tested on its own and the engine only wires them in:
//   - a path is normalized BEFORE it is filtered or hashed (Windows slashes, drive letter, case,
//     trailing separators, \\?\ long-path prefixes)
//   - a file is CREATED only on evidence from this session: the write tool said it made a new
//     file, or the session's own checkpoint shows there was nothing to back up. A file whose
//     first action was an edit already existed, so it is CHANGED. No evidence either way reads
//     as changed, the cheaper price.
//   - only successful actions count; one file price per file per session; a retried outward
//     draft counts once.
//   - everything else the session did (reading, research, planning, long tool runs, how much it
//     wrote back) is recorded as COUNTS AND BUCKETS ONLY. Never a path, a query or a word of
//     content. None of it adds a minute: see EXTRA_CREDIT_MULTIPLIER in rollup-rules.mjs.
//
// GOING FORWARD ONLY. Rows measured before this rules version keep the old rules for ever (see
// the `legacy` switch in measure-sessions.mjs and the `v` branch in rollup-rules.mjs), so no
// member's existing hours move by a single minute.
//
// Created 10/07/26 - 16:05 EDT.

import crypto from "node:crypto";

export const RULES_VERSION = 2;

export const shortHash = (p) => crypto.createHash("sha1").update(String(p)).digest("hex").slice(0, 12);
export const lastSegment = (name) => String(name).split("__").pop();

// ---------- paths ----------

/** True for a Windows-shaped path: a drive letter, a UNC share, or a long-path prefix. */
export function isWindowsPath(p) {
  const s = String(p || "");
  return /^[A-Za-z]:([\\/]|$)/.test(s) || /^\\\\/.test(s) || /^\/\/[?.]\//.test(s);
}

/**
 * One spelling per file, so the noise filter and the hash both see the same thing whichever way
 * the transcript wrote it. Windows paths are case-insensitive on disk, so they are lower-cased
 * for comparison; POSIX paths keep their case because on Linux two spellings are two files.
 * `.` and `..` are resolved lexically (never above the root), and a relative path is resolved
 * against the session's working folder first, so `plan.md`, `./plan.md` and `docs/../plan.md`
 * from /brain are all /brain/plan.md.
 */
export function normalizePath(p, cwd = null) {
  let s = String(p || "").trim();
  if (!s) return "";
  const rel = !(s.startsWith("/") || s.startsWith("\\") || isWindowsPath(s));
  if (rel && cwd && String(cwd).trim()) s = String(cwd).trim().replace(/[\\/]+$/, "") + "/" + s;
  const windows = isWindowsPath(s);
  // long-path and device prefixes: \\?\C:\x, \\?\UNC\server\share, \\.\C:\x, //?/C:/x
  s = s.replace(/^[\\/]{2}[?.][\\/]UNC[\\/]/i, "\\\\");
  s = s.replace(/^[\\/]{2}[?.][\\/]/, "");
  s = s.replace(/\\/g, "/");

  // split off the root the segments may not climb above
  let root = "", rest = s;
  let m;
  if ((m = /^([A-Za-z]:)(\/|$)/.exec(s))) { root = m[1][0].toLowerCase() + ":/"; rest = s.slice(m[0].length); }
  else if ((m = /^\/\/+([^/]+)\/+([^/]+)(\/|$)/.exec(s))) { root = "//" + m[1] + "/" + m[2] + "/"; rest = s.slice(m[0].length); }
  else if (s.startsWith("/")) { root = "/"; rest = s.replace(/^\/+/, ""); }
  const out = [];
  for (const seg of rest.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") { if (out.length && out[out.length - 1] !== "..") out.pop(); else if (!root) out.push(".."); continue; }
    out.push(seg);
  }
  s = root + out.join("/");
  if (s.length > 1 && s.endsWith("/") && !/^[a-z]:\/$/.test(s)) s = s.replace(/\/+$/, "");
  if (windows || /^[a-z]:/.test(s) || root.startsWith("//")) s = s.toLowerCase();
  return s;
}

/**
 * Scratch, machinery, or someone else's dependency: never a deliverable. Run ONLY on a
 * normalized path. The first group is the original filter, unchanged; the rest are the temp
 * folders it missed (Windows AppData\Local\Temp and C:\Temp, the Mac's per-user temp folder).
 */
export const NOISE_V2 = new RegExp(
  [
    String.raw`(^|/)(node_modules|\.git|\.next|dist|build|coverage|__pycache__|\.venv)(/|$)`,
    String.raw`(^/tmp/|^/private/tmp/|/scratchpad/)`,
    String.raw`\.claude/time-saved/`,
    String.raw`\.claude/king-intelligence/time-saved/`,
    String.raw`/appdata/local/temp/`,
    String.raw`^[a-z]:/(windows/)?te?mp/`,
    String.raw`^(/private)?/var/folders/`,
    String.raw`^/var/tmp/`,
  ].join("|"),
  "i"
);
export const isNoisePath = (normalized) => !normalized || NOISE_V2.test(normalized);

/** A checkpoint key can be relative to the session's folder. */
export const resolveAgainst = (cwd, p) => normalizePath(p, cwd);

// ---------- what each tool is ----------

export const WRITE_TOOLS = new Set(["Write"]);
export const EDIT_TOOLS = new Set(["Edit", "NotebookEdit", "MultiEdit"]);

// Outward artifacts: a thing produced for a person outside this session. Same list the engine
// has always used, matched on the tool's last name segment.
export const OUTWARD = new Set([
  "create_draft", "reply", "forward", "send_message", "send_mail", "send_draft",
  "outlook_create_draft", "outlook_create_reply_draft", "outlook_create_reply_all_draft",
  "outlook_send_mail", "outlook_send_draft", "outlook_forward_mail", "outlook_create_event",
  "create_event", "blotato_create_post", "blotato_send_message", "blotato_post_comment",
  "notion-create-pages", "Artifact",
]);
export const isOutwardName = (name) => OUTWARD.has(name) || OUTWARD.has(lastSegment(name));

/**
 * The identity of one outward artifact, or null when this call is not one. The Artifact tool
 * also reads, lists and opens; only a publish makes something for someone, and publishing the
 * same page five times is one page. Anything else is keyed on its full input, so a retry of the
 * same draft is one draft and two different drafts are two.
 */
export function outwardKey(name, input) {
  if (!isOutwardName(name)) return null;
  const inp = input && typeof input === "object" ? input : {};
  if (lastSegment(name) === "Artifact") {
    const action = inp.action == null ? "publish" : String(inp.action);
    if (action !== "publish" || inp.asset === true) return null;
    const target = inp.url || inp.file_path || (inp.type_url ? `${inp.type_url}#${inp.title || ""}` : "");
    return "Artifact:" + shortHash(target ? normalizePath(target) : JSON.stringify(inp));
  }
  return lastSegment(name) + ":" + shortHash(stableJson(inp));
}

function stableJson(v) {
  if (Array.isArray(v)) return "[" + v.map(stableJson).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stableJson(v[k])).join(",") + "}";
  }
  return JSON.stringify(v === undefined ? null : v);
}

// Non-file signals. Counted, never priced.
const READ_TOOLS = new Set(["Read", "Glob", "Grep", "LS", "NotebookRead"]);
const WEB_TOOLS = new Set(["WebSearch", "WebFetch"]);
const AGENT_TOOLS = new Set(["Agent", "Task"]);
const PLAN_TOOLS = new Set(["TodoWrite", "TaskCreate", "TaskUpdate", "EnterPlanMode", "ExitPlanMode"]);
const CONNECTOR_LOOKUP = /(search|fetch|query|read|get|list)/i;
const WAITS_ON_PERSON = new Set(["AskUserQuestion"]);
const LONG_TOOL_MS = 60 * 1000;

export function replySizeBucket(chars) {
  const n = Number(chars) || 0;
  if (n < 1000) return "under-1k";
  if (n < 5000) return "1k-5k";
  if (n < 20000) return "5k-20k";
  if (n < 80000) return "20k-80k";
  return "80k-plus";
}

// ---------- the per-session evidence collector ----------

/**
 * Feed it every parsed transcript record in order, then call finish(). Pure: no file system,
 * no clock. Returns the version-2 fields the engine adds to a NEW ledger row.
 */
export function createCollector({ idleCapMs = 5 * 60 * 1000 } = {}) {
  let cwd = null;
  const uses = new Map(); // tool_use_id -> { name, input, t }
  const files = new Map(); // normalized path -> "create" | "existing" | "unknown"
  const checkpoint = new Map(); // normalized path -> true (nothing to back up) | false (had content)
  const outward = new Set();
  let failed = 0, failedFile = 0, failedOutward = 0, retriedOutward = 0;
  let reads = 0, web = 0, connectorLookups = 0, agents = 0, planning = 0, asks = 0;
  const targets = new Set();
  let longToolMs = 0;
  let replyChars = 0, typedTurns = 0;
  let headless = false;
  const events = []; // [t, isFileWork]

  const pathOf = (input) => {
    const p = input && (input.file_path || input.notebook_path);
    return typeof p === "string" && p ? normalizePath(p, cwd) : "";
  };

  function onUse(block, t) {
    const name = String(block.name || "");
    const input = block.input || {};
    if (block.id) uses.set(block.id, { name, input, t });
    const short = lastSegment(name);
    let isFile = WRITE_TOOLS.has(name) || EDIT_TOOLS.has(name) || isOutwardName(name);
    if (READ_TOOLS.has(name)) {
      reads += 1;
      const p = pathOf(input) || (typeof input.path === "string" ? normalizePath(input.path, cwd) : "");
      if (p) targets.add("r:" + shortHash(p));
    } else if (WEB_TOOLS.has(name)) {
      web += 1;
      const tgt = input.url || input.query;
      if (typeof tgt === "string" && tgt) targets.add("w:" + shortHash(tgt.trim().toLowerCase()));
    } else if (AGENT_TOOLS.has(name)) {
      agents += 1;
    } else if (PLAN_TOOLS.has(name)) {
      planning += 1;
    } else if (WAITS_ON_PERSON.has(name)) {
      asks += 1;
    } else if (name.startsWith("mcp__") && !isOutwardName(name) && CONNECTOR_LOOKUP.test(short)) {
      connectorLookups += 1;
      const tgt = input.query || input.q || input.url || input.id;
      if (typeof tgt === "string" && tgt) targets.add("c:" + shortHash(short + ":" + tgt.trim().toLowerCase()));
    }
    if (t) events.push([t, isFile]);
  }

  function onResult(block, rec, t, soleResult) {
    const use = uses.get(block.tool_use_id);
    if (!use) return;
    const { name, input } = use;
    const isFileTool = WRITE_TOOLS.has(name) || EDIT_TOOLS.has(name);
    const outKey = outwardKey(name, input);
    if (t && use.t && !WAITS_ON_PERSON.has(name)) {
      const ms = t - use.t;
      if (ms >= LONG_TOOL_MS) longToolMs += ms;
    }
    if (t) events.push([t, isFileTool || !!outKey]);
    if (block.is_error === true) {
      failed += 1;
      if (isFileTool) failedFile += 1;
      if (outKey) failedOutward += 1;
      return; // a failed action earns nothing
    }
    if (isFileTool) {
      const p = pathOf(input);
      if (!p || isNoisePath(p)) return;
      if (files.has(p)) return; // one price per file per session: the FIRST success decides
      let kind = "existing"; // an edit-first file was already there
      if (WRITE_TOOLS.has(name)) {
        const tur = soleResult && rec && rec.toolUseResult && typeof rec.toolUseResult === "object" ? rec.toolUseResult : null;
        const sameFile = tur && typeof tur.filePath === "string" ? normalizePath(tur.filePath, cwd) === p : !!tur;
        if (tur && sameFile && tur.type === "create") kind = "create";
        else if (tur && sameFile && tur.type === "update") kind = "existing";
        else kind = "unknown"; // settled by the checkpoint below, else the cheaper price
      }
      files.set(p, kind);
      return;
    }
    if (outKey) {
      if (outward.has(outKey)) retriedOutward += 1;
      else outward.add(outKey);
    }
  }

  function onSnapshot(rec) {
    const tfb = rec && rec.snapshot && rec.snapshot.trackedFileBackups;
    if (!tfb || typeof tfb !== "object") return;
    for (const [k, v] of Object.entries(tfb)) {
      if (!v || typeof v !== "object") continue;
      const p = resolveAgainst(cwd, k);
      if (!p || checkpoint.has(p)) continue; // the FIRST backup tells what was there before
      if (Number(v.version) === 1 || v.version == null) checkpoint.set(p, v.backupFileName === null);
    }
  }

  return {
    add(rec) {
      if (!rec || typeof rec !== "object") return;
      if (typeof rec.cwd === "string" && rec.cwd) cwd = rec.cwd; // the folder each action ran in
      if (rec.entrypoint === "sdk-cli") headless = true;
      const t = typeof rec.timestamp === "string" ? Date.parse(rec.timestamp) || 0 : 0;
      if (rec.type === "file-history-snapshot") { onSnapshot(rec); return; }
      const content = rec.message && rec.message.content;
      if (rec.type === "user" && !rec.isMeta) {
        if (typeof content === "string" ? content.trim() : Array.isArray(content) && content.some((b) => b && b.type === "text")) {
          typedTurns += 1;
          if (t) events.push([t, false]);
        }
      }
      if (!Array.isArray(content)) return;
      const results = content.filter((b) => b && b.type === "tool_result");
      for (const b of content) {
        if (!b) continue;
        if (b.type === "tool_use") onUse(b, t);
        else if (b.type === "tool_result") onResult(b, rec, t, results.length === 1);
        else if (b.type === "text" && rec.type === "assistant" && typeof b.text === "string") {
          replyChars += b.text.length;
          if (t) events.push([t, false]);
        }
      }
    },

    finish() {
      const created = [], changed = [];
      for (const [p, kind] of files) {
        let k = kind;
        if (k === "unknown") k = checkpoint.get(p) === true ? "create" : "existing";
        (k === "create" ? created : changed).push(shortHash(p));
      }
      // Active time on non-file work: each gap under the idle cap belongs to the event that ends it.
      events.sort((a, b) => a[0] - b[0]);
      let nonFileMs = 0;
      for (let i = 1; i < events.length; i++) {
        const gap = events[i][0] - events[i - 1][0];
        if (gap > 0 && gap <= idleCapMs && !events[i][1]) nonFileMs += gap;
      }
      const fileActions = created.length + changed.length;
      return {
        created,
        changed,
        drafts: outward.size,
        failed,
        signals: {
          nonFileActiveMin: Math.round((nonFileMs / 60000) * 100) / 100,
          readCount: reads,
          webResearchCount: web,
          connectorLookupCount: connectorLookups,
          helperAgentCount: agents,
          researchTargetCount: targets.size,
          planningCount: planning,
          questionCount: asks,
          reviewHeavy: reads >= 5 && fileActions <= 1,
          longToolRunMin: Math.round((longToolMs / 60000) * 100) / 100,
          replySize: replySizeBucket(replyChars),
          typedTurns,
          failedFileActions: failedFile,
          failedOutwardActions: failedOutward,
          retriedOutward,
          headless,
        },
      };
    },
  };
}
