#!/usr/bin/env node
// import-chat-export.mjs — the deterministic half of /install-gpt-merge.
//
// Takes a ChatGPT or Claude data-export zip and converts every conversation into a
// markdown file staged under _archive/chat-imports/ in the user's second-brain repo,
// with an idempotency ledger, a manifest, and a human inventory. The JUDGMENT half —
// proposing buckets, asking the user, deciding where each conversation belongs —
// is done by the install-gpt-merge skill (Claude), which then calls `assign` with an
// approved plan and `map` to regenerate the conversation map.
//
// Zero dependencies. Memory-safe on multi-hundred-MB exports: conversations.json is
// read as a stream and split into top-level array elements by a brace/string tracker,
// so only one conversation is ever parsed at a time.
//
// Usage (run from the second-brain repo root, or pass --repo):
//   node import-chat-export.mjs inspect <zip>              # detect format + inventory, writes nothing to the repo
//   node import-chat-export.mjs convert <zip> [--repo <dir>]   # parse -> staging markdown + ledger (idempotent)
//   node import-chat-export.mjs assign <plan.json> [--repo <dir>]  # execute approved moves in a batch
//   node import-chat-export.mjs map [--repo <dir>]         # regenerate references/imported-chats-map.md from the ledger
//   node import-chat-export.mjs status [--repo <dir>]      # ledger summary (resume / receipts)
//
// assign plan.json shape: [{ "id": "<original_id>", "destination": "clients/acme/02-conversations",
//                            "summary": "one line" }, ...]
//   destination is a repo-relative FOLDER. Omit destination (or "archive") to keep a
//   conversation in the archive and just record its summary.
//
// Output: one JSON object on stdout. Big listings go to files (manifest.json, inventory.md).

import {
  createReadStream, mkdirSync, readFileSync, writeFileSync, existsSync,
  readdirSync, statSync, copyFileSync, renameSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

const ARCHIVE_REL = "_archive/chat-imports";
const MAP_REL = "references/imported-chats-map.md";

// ---------- small helpers ----------

function fail(msg) {
  console.log(JSON.stringify({ error: msg }, null, 2));
  process.exit(1);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repo") args.repo = argv[++i];
    else if (a === "--archive-dir") args.archiveDir = argv[++i];
    else if (a === "--map-file") args.mapFile = argv[++i];
    else if (a === "--to") args.to = argv[++i];
    else args._.push(a);
  }
  return args;
}

function repoRoot(args) {
  const r = path.resolve(args.repo || process.cwd());
  if (!existsSync(r)) fail(`repo folder not found: ${r}`);
  return r;
}

function slug(s, max = 50) {
  const out = String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, max)
    .replace(/^-|-$/g, "");
  return out || "untitled";
}

function ymd(x) {
  if (x == null) return "undated";
  const d = typeof x === "number" ? new Date(x * 1000) : new Date(x);
  return Number.isNaN(d.getTime()) ? "undated" : d.toISOString().slice(0, 10);
}

function hm(x) {
  if (x == null) return "";
  const d = typeof x === "number" ? new Date(x * 1000) : new Date(x);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16).replace("T", " ");
}

function sha1File(p) {
  // hash the first + last 1MB + size — enough to identify a zip without reading 300MB
  const h = createHash("sha1");
  const size = statSync(p).size;
  return new Promise((resolve, reject) => {
    const s = createReadStream(p, { start: 0, end: Math.min(size, 1024 * 1024) - 1 });
    s.on("data", (c) => h.update(c));
    s.on("error", reject);
    s.on("end", () => {
      h.update(String(size));
      const s2 = createReadStream(p, { start: Math.max(0, size - 1024 * 1024) });
      s2.on("data", (c) => h.update(c));
      s2.on("error", reject);
      s2.on("end", () => resolve(h.digest("hex").slice(0, 12)));
    });
  });
}

function loadJSON(p, fallback) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; }
}

function yamlEscape(s) {
  const v = String(s ?? "").replace(/\r?\n/g, " ").trim();
  return JSON.stringify(v); // JSON string is valid YAML
}

// ---------- unzip ----------

async function extractZip(zipPath) {
  if (!existsSync(zipPath)) fail(`zip not found: ${zipPath}`);
  const id = await sha1File(zipPath);
  const dir = path.join(tmpdir(), "ki-chat-import", id);
  const marker = path.join(dir, ".extracted");
  if (existsSync(marker)) return { dir, id };
  mkdirSync(dir, { recursive: true });
  let ok = false, lastErr = "";
  for (const [cmd, cmdArgs] of [
    ["unzip", ["-o", "-q", zipPath, "-d", dir]],
    ["tar", ["-xf", zipPath, "-C", dir]],
  ]) {
    try {
      execFileSync(cmd, cmdArgs, { stdio: ["ignore", "ignore", "pipe"], maxBuffer: 1024 * 1024 });
      ok = true;
      break;
    } catch (e) {
      lastErr = String(e.stderr || e.message || e).slice(0, 300);
    }
  }
  if (!ok) fail(`could not open the zip (it may be damaged — re-download the export): ${lastErr}`);
  writeFileSync(marker, new Date().toISOString());
  return { dir, id };
}

function findFile(dir, name) {
  // exports sometimes nest everything one folder deep
  const direct = path.join(dir, name);
  if (existsSync(direct)) return direct;
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e, name);
    if (e !== "." && existsSync(p)) return p;
  }
  return null;
}

// ---------- streaming top-level-array splitter ----------

async function* topLevelElements(jsonPath) {
  const stream = createReadStream(jsonPath, { encoding: "utf8", highWaterMark: 1024 * 1024 });
  let depth = 0;        // depth INSIDE the top-level array (0 = between elements)
  let started = false;  // seen the opening [
  let inString = false;
  let escaped = false;
  let buf = "";
  let collecting = false;
  for await (const chunk of stream) {
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];
      if (!started) {
        if (ch === "[") started = true;
        else if (!/\s/.test(ch)) throw new Error("top level is not a JSON array");
        continue;
      }
      if (inString) {
        buf += ch;
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') { inString = true; if (!collecting) { collecting = true; buf = ""; } buf += ch; continue; }
      if (ch === "{" || ch === "[") {
        if (depth === 0) { collecting = true; buf = ""; }
        depth++;
        buf += ch;
        continue;
      }
      if (ch === "}" || ch === "]") {
        if (depth === 0 && ch === "]") { // end of the top-level array
          if (collecting && buf.trim()) yield JSON.parse(buf);
          return;
        }
        depth--;
        buf += ch;
        if (depth === 0 && collecting) {
          yield JSON.parse(buf);
          collecting = false;
          buf = "";
        }
        continue;
      }
      if (depth === 0) {
        // between elements: commas + whitespace only (scalars won't occur in these exports)
        continue;
      }
      buf += ch;
    }
  }
}

// ---------- manifest detection (Claude's newer export delivers a manifest + several one-time links) ----------

function maybeManifest(inputPath) {
  if (!/\.json$/i.test(inputPath)) return null;
  const m = loadJSON(path.resolve(inputPath), null);
  if (!m || !Array.isArray(m.data_files)) return null;
  return {
    manifest: true,
    note: "This is a Claude export MANIFEST, not the data itself. Each export_url works ONCE and only from the user's logged-in browser (open each URL in its own real browser tab and catch the download event — anchor clicks and plain fetches get the app shell instead). Download the zips, then run convert on conversations-*.zip (and projects-*.zip if present).",
    files: m.data_files.map((f) => ({ filename: f.filename, category: f.category, export_url: f.export_url })),
  };
}

// ---------- projects (Claude ships projects.json OR a projects/ dir of per-project files) ----------

function collectProjects(extractDir) {
  const out = [];
  const projFile = findFile(extractDir, "projects.json");
  if (projFile) for (const p of loadJSON(projFile, []) || []) out.push(p);
  for (const base of [extractDir, ...readdirSync(extractDir).map((e) => path.join(extractDir, e))]) {
    const dir = path.join(base, "projects");
    let st; try { st = statSync(dir); } catch { continue; }
    if (!st.isDirectory()) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const p = loadJSON(path.join(dir, f), null);
      if (p && (p.name || p.uuid)) out.push(p);
    }
  }
  const seen = new Set();
  return out.filter((p) => { const k = p.uuid || p.name; if (seen.has(k)) return false; seen.add(k); return true; });
}

// ---------- format detection ----------

async function detectFormat(extractDir) {
  const convPath = findFile(extractDir, "conversations.json");
  if (!convPath) {
    // a projects-only zip (Claude's newer multi-zip export) is still importable
    if (collectProjects(extractDir).length) return { format: "claude", convPath: null };
    const listing = readdirSync(extractDir).filter((f) => f !== ".extracted").slice(0, 20);
    fail(`no conversations.json in this zip — found: ${listing.join(", ") || "(empty)"}. This doesn't look like a ChatGPT or Claude export.`);
  }
  for await (const first of topLevelElements(convPath)) {
    if (first && typeof first === "object") {
      if (first.mapping || first.current_node) return { format: "chatgpt", convPath };
      if (first.chat_messages) return { format: "claude", convPath };
    }
    break;
  }
  // empty array — fall back to sibling files
  if (findFile(extractDir, "chat.html") || findFile(extractDir, "user.json")) return { format: "chatgpt", convPath };
  if (findFile(extractDir, "users.json") || findFile(extractDir, "projects.json")) return { format: "claude", convPath };
  fail("could not recognize this export's format (conversations.json has an unfamiliar shape)");
}

// ---------- ChatGPT parsing ----------

function chatgptWalk(conv) {
  // Follow current_node -> parents -> root, then reverse: the current branch through regenerations.
  const mapping = conv.mapping || {};
  const chain = [];
  let cur = conv.current_node;
  const seen = new Set();
  while (cur && mapping[cur] && !seen.has(cur)) {
    seen.add(cur);
    chain.push(mapping[cur]);
    cur = mapping[cur].parent;
  }
  chain.reverse();
  const messages = [];
  for (const node of chain) {
    const m = node && node.message;
    if (!m || !m.author) continue; // empty placeholder node
    const role = m.author.role;
    if (role !== "user" && role !== "assistant") continue; // system/tool plumbing
    if (m.metadata && m.metadata.is_visually_hidden_from_conversation) continue;
    const { text, imageIds } = chatgptText(m.content);
    const attachIds = ((m.metadata && m.metadata.attachments) || []).map((a) => ({ id: a.id, name: a.name }));
    if (!text.trim() && !imageIds.length && !attachIds.length) continue;
    messages.push({ role, when: m.create_time ?? null, text, imageIds, attachIds });
  }
  return messages;
}

function chatgptText(content) {
  const imageIds = [];
  if (!content) return { text: "", imageIds };
  const parts = content.parts || [];
  const out = [];
  for (const p of parts) {
    if (typeof p === "string") out.push(p);
    else if (p && typeof p === "object") {
      const ptr = p.asset_pointer || (p.image_asset_pointer && p.image_asset_pointer.asset_pointer);
      if (ptr) {
        const id = String(ptr).replace(/^.*?(file[-_][A-Za-z0-9]+).*$/, "$1");
        imageIds.push(id);
        out.push(`[image: ${id}]`);
      } else if (p.text) out.push(p.text);
    }
  }
  if (!out.length && content.text) out.push(content.text);
  return { text: out.join("\n"), imageIds };
}

function normalizeChatgpt(conv) {
  const messages = chatgptWalk(conv);
  return {
    id: conv.conversation_id || conv.id || null,
    title: conv.title || "Untitled",
    started: conv.create_time ?? (messages[0] && messages[0].when) ?? null,
    last: conv.update_time ?? (messages.length ? messages[messages.length - 1].when : null),
    project: conv.gizmo_id || conv.conversation_template_id || "",
    assistantLabel: "ChatGPT",
    messages,
  };
}

// ---------- Claude parsing ----------

function claudeText(msg) {
  if (Array.isArray(msg.content) && msg.content.length) {
    const out = [];
    for (const c of msg.content) {
      if (c && c.type === "text" && c.text) out.push(c.text);
      else if (c && c.text) out.push(c.text);
    }
    if (out.length) return out.join("\n");
  }
  return msg.text || "";
}

function normalizeClaude(conv) {
  const msgs = [];
  const attachNames = [];
  for (const m of conv.chat_messages || []) {
    const role = m.sender === "human" ? "user" : "assistant";
    const text = claudeText(m);
    const files = [...(m.attachments || []), ...(m.files || [])]
      .map((f) => f.file_name || f.filename || f.name)
      .filter(Boolean);
    attachNames.push(...files);
    if (!text.trim() && !files.length) continue;
    msgs.push({ role, when: m.created_at ?? null, text, imageIds: [], attachIds: files.map((n) => ({ id: null, name: n })) });
  }
  return {
    id: conv.uuid || conv.id || null,
    title: conv.name || "Untitled",
    started: conv.created_at ?? null,
    last: conv.updated_at ?? null,
    project: (conv.project && (conv.project.name || conv.project.uuid)) || conv.project_uuid || "",
    assistantLabel: "Claude",
    messages: msgs,
  };
}

// ---------- attachment index (ChatGPT stores files beside the JSON) ----------

function buildFileIndex(extractDir) {
  const index = new Map(); // file id/name -> absolute path
  const walk = (dir, depth) => {
    if (depth > 3) return;
    for (const e of readdirSync(dir)) {
      if (e === ".extracted") continue;
      const p = path.join(dir, e);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) walk(p, depth + 1);
      else {
        if (/\.(json|html)$/i.test(e)) continue;
        const m = e.match(/^(file[-_][A-Za-z0-9]+)/);
        if (m) index.set(m[1].replace("_", "-"), p);
        index.set(e, p);
      }
    }
  };
  walk(extractDir, 0);
  return index;
}

// ---------- markdown writer ----------

function conversationMarkdown(conv, source, attachRel) {
  const fm = [
    "---",
    "type: imported-chat",
    `source: ${source}`,
    `title: ${yamlEscape(conv.title)}`,
    `started: ${ymd(conv.started)}`,
    `last_message: ${ymd(conv.last)}`,
    `original_id: ${conv.id || ""}`,
    `project: ${yamlEscape(conv.project || "")}`,
    `messages: ${conv.messages.length}`,
  ];
  if (attachRel.length) {
    fm.push("attachments:");
    for (const a of attachRel) fm.push(`  - ${yamlEscape(a)}`);
  }
  fm.push("---", "", `# ${conv.title}`, "");
  const lines = fm;
  for (const m of conv.messages) {
    const who = m.role === "user" ? "You" : conv.assistantLabel;
    const when = hm(m.when);
    lines.push(`## ${who}${when ? ` (${when})` : ""}`, "");
    lines.push(m.text.trim() || "(no text)");
    if (m.attachIds && m.attachIds.length) {
      const names = m.attachIds.map((a) => a.name || a.id).filter(Boolean);
      if (names.length) lines.push("", `**Attached:** ${names.join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ---------- commands ----------

async function cmdInspect(zipPath) {
  const manifest = maybeManifest(zipPath);
  if (manifest) { console.log(JSON.stringify(manifest, null, 2)); return; }
  const { dir } = await extractZip(zipPath);
  const { format, convPath } = await detectFormat(dir);
  let count = 0, minDate = null, maxDate = null;
  const projects = new Set();
  for await (const raw of convPath ? topLevelElements(convPath) : []) {
    count++;
    const c = format === "chatgpt" ? normalizeChatgpt(raw) : normalizeClaude(raw);
    const d = ymd(c.started);
    if (d !== "undated") {
      if (!minDate || d < minDate) minDate = d;
      if (!maxDate || d > maxDate) maxDate = d;
    }
    if (c.project) projects.add(String(c.project));
  }
  const namedProjects = collectProjects(dir).map((p) => p.name).filter(Boolean);
  console.log(JSON.stringify({
    format,
    zip: path.resolve(zipPath),
    conversations: count,
    dateRange: minDate ? `${minDate} → ${maxDate}` : "unknown",
    projects: namedProjects.length ? namedProjects : [...projects].slice(0, 50),
    zipSizeMB: Math.round(statSync(zipPath).size / 1048576 * 10) / 10,
  }, null, 2));
}

async function cmdConvert(zipPath, args) {
  const manifest = maybeManifest(zipPath);
  if (manifest) { console.log(JSON.stringify(manifest, null, 2)); return; }
  const root = repoRoot(args);
  const { dir, id: exportId } = await extractZip(zipPath);
  const { format, convPath } = await detectFormat(dir);
  const archiveRel = args.archiveDir || ARCHIVE_REL;
  const exportDate = ymd(statSync(zipPath).mtime.toISOString());
  const stagingRel = `${archiveRel}/${format}-${exportDate}`;
  const staging = path.join(root, stagingRel);
  mkdirSync(staging, { recursive: true });
  const ledgerPath = path.join(root, archiveRel, ".import-ledger.json");
  const ledger = loadJSON(ledgerPath, {});
  const fileIndex = format === "chatgpt" ? buildFileIndex(dir) : new Map();

  const converted = [], skipped = [], failed = [];
  const inventory = [];
  const usedNames = new Set(Object.values(ledger).map((e) => e.file));
  const matchedFiles = new Set();
  let unmatchedAttachments = 0;

  for await (const raw of convPath ? topLevelElements(convPath) : []) {
    let conv;
    try {
      conv = format === "chatgpt" ? normalizeChatgpt(raw) : normalizeClaude(raw);
    } catch (e) {
      failed.push({ id: raw && (raw.id || raw.uuid || raw.conversation_id) || "?", error: String(e.message || e).slice(0, 200) });
      continue;
    }
    const cid = conv.id || `noid-${createHash("sha1").update(JSON.stringify(raw).slice(0, 2000)).digest("hex").slice(0, 12)}`;
    if (ledger[cid]) { skipped.push(cid); continue; }
    const id8 = cid.replace(/[^A-Za-z0-9]/g, "").slice(-8) || "00000000";
    let fname = `${ymd(conv.started)}-${slug(conv.title)}--${id8}.md`;
    while (usedNames.has(`${stagingRel}/${fname}`)) fname = fname.replace(/\.md$/, "x.md");

    // copy matched attachments (ChatGPT: by file id; Claude ships no binaries)
    const attachRel = [];
    if (format === "chatgpt") {
      const stem = fname.replace(/\.md$/, "");
      for (const m of conv.messages) {
        for (const a of [...m.attachIds, ...m.imageIds.map((i) => ({ id: i, name: null }))]) {
          const src = (a.id && fileIndex.get(a.id)) || (a.name && fileIndex.get(a.name));
          if (!src) { if (a.id || a.name) unmatchedAttachments++; continue; }
          const destDir = path.join(staging, "attachments", stem);
          mkdirSync(destDir, { recursive: true });
          const dest = path.join(destDir, path.basename(src));
          if (!existsSync(dest)) copyFileSync(src, dest);
          matchedFiles.add(src);
          const rel = `${stagingRel}/attachments/${stem}/${path.basename(src)}`;
          if (!attachRel.includes(rel)) attachRel.push(rel);
        }
      }
    }

    try {
      writeFileSync(path.join(staging, fname), conversationMarkdown(conv, format, attachRel));
    } catch (e) {
      failed.push({ id: cid, error: String(e.message || e).slice(0, 200) });
      continue;
    }
    const fileRel = `${stagingRel}/${fname}`;
    usedNames.add(fileRel);
    ledger[cid] = {
      file: fileRel,
      title: conv.title,
      date: ymd(conv.started),
      messages: conv.messages.length,
      project: conv.project || "",
      source: format,
      exportId,
      convertedAt: new Date().toISOString(),
      summary: null,
      destination: null,
      movedAt: null,
    };
    converted.push(cid);
    inventory.push({ id8, date: ymd(conv.started), title: conv.title, messages: conv.messages.length, project: conv.project || "", file: fileRel, id: cid });
    if (converted.length % 200 === 0) writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2)); // checkpoint
  }

  // leftover ChatGPT files nobody referenced — check prior runs' matches too,
  // or a re-run (everything skipped) would dump every matched file in _unmatched
  if (format === "chatgpt") {
    const alreadyPlaced = new Set();
    const attachRoot = path.join(staging, "attachments");
    if (existsSync(attachRoot)) {
      for (const d of readdirSync(attachRoot)) {
        if (d === "_unmatched") continue;
        for (const f of readdirSync(path.join(attachRoot, d))) alreadyPlaced.add(f);
      }
    }
    const leftovers = [...new Set([...fileIndex.values()])].filter(
      (p) => !matchedFiles.has(p) && !alreadyPlaced.has(path.basename(p)) && /file[-_]/.test(path.basename(p))
    );
    if (leftovers.length) {
      const dest = path.join(staging, "attachments", "_unmatched");
      mkdirSync(dest, { recursive: true });
      for (const p of leftovers) {
        const d = path.join(dest, path.basename(p));
        if (!existsSync(d)) copyFileSync(p, d);
      }
    }
  }

  // Claude projects: write instructions + docs into staging/projects/
  // (arrives as projects.json OR a projects/ folder of per-project files, possibly in its own zip)
  let projectsOut = [];
  if (format === "claude") {
    for (const p of collectProjects(dir)) {
      if (!p) continue;
      // starter projects can ship with an empty name — keep them, don't silently drop
      const pname = p.name || `untitled-project-${String(p.uuid || "x").replace(/-/g, "").slice(0, 8)}`;
      const pdir = path.join(staging, "projects", slug(pname));
      mkdirSync(pdir, { recursive: true });
      const info = ["---", `type: imported-project`, `source: claude`, `title: ${yamlEscape(pname)}`, `created: ${ymd(p.created_at)}`, "---", "", `# ${pname}`, "", p.description || ""];
      if (p.prompt_template) info.push("", "## Project instructions", "", p.prompt_template);
      writeFileSync(path.join(pdir, "project-instructions.md"), info.join("\n"));
      let docCount = 0;
      for (const d of p.docs || []) {
        if (!d || !d.filename) continue;
        writeFileSync(path.join(pdir, slug(d.filename, 80) + ".md"), `# ${d.filename}\n\n${d.content || ""}`);
        docCount++;
      }
      projectsOut.push({ name: pname, docs: docCount, folder: `${stagingRel}/projects/${slug(pname)}` });
    }
  }

  mkdirSync(path.dirname(ledgerPath), { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));

  // inventory.md (human) + manifest.json (machine) into staging
  const inv = ["# Imported conversations — inventory", "", `Converted ${converted.length} (skipped ${skipped.length} already done, ${failed.length} failed) from ${path.basename(zipPath)} on ${new Date().toISOString().slice(0, 10)}.`, "", "| id | date | msgs | project | title |", "|---|---|---|---|---|"];
  for (const r of inventory.sort((a, b) => (a.date < b.date ? -1 : 1))) {
    inv.push(`| ${r.id8} | ${r.date} | ${r.messages} | ${String(r.project).slice(0, 24)} | ${r.title.replace(/\|/g, "/").slice(0, 80)} |`);
  }
  writeFileSync(path.join(staging, "inventory.md"), inv.join("\n") + "\n");
  writeFileSync(path.join(staging, "manifest.json"), JSON.stringify({ format, exportId, converted, skipped, failed, projects: projectsOut, unmatchedAttachments, inventory }, null, 2));

  console.log(JSON.stringify({
    format,
    staging: stagingRel,
    converted: converted.length,
    skipped: skipped.length,
    failed,
    projects: projectsOut,
    unmatchedAttachments,
    inventoryFile: `${stagingRel}/inventory.md`,
    manifestFile: `${stagingRel}/manifest.json`,
    ledger: `${archiveRel}/.import-ledger.json`,
  }, null, 2));
}

function cmdAssign(planPath, args) {
  const root = repoRoot(args);
  const archiveRel = args.archiveDir || ARCHIVE_REL;
  const ledgerPath = path.join(root, archiveRel, ".import-ledger.json");
  const ledger = loadJSON(ledgerPath, null);
  if (!ledger) fail(`no ledger at ${archiveRel}/.import-ledger.json — run convert first`);
  const plan = loadJSON(path.resolve(planPath), null);
  if (!Array.isArray(plan)) fail(`plan file must be a JSON array: ${planPath}`);
  const moved = [], kept = [], missing = [], alreadyMoved = [];
  for (const item of plan) {
    const entry = ledger[item.id];
    if (!entry) { missing.push(item.id); continue; }
    if (item.summary) entry.summary = item.summary;
    const dest = item.destination && item.destination !== "archive" ? item.destination.replace(/^\/+|\/+$/g, "") : null;
    if (!dest) { kept.push(item.id); continue; }
    if (entry.destination && entry.movedAt) { alreadyMoved.push(item.id); continue; }
    const srcAbs = path.join(root, entry.file);
    if (!existsSync(srcAbs)) { missing.push(item.id); continue; }
    const destDir = path.join(root, dest);
    mkdirSync(destDir, { recursive: true });
    let destAbs = path.join(destDir, path.basename(entry.file));
    while (existsSync(destAbs)) destAbs = destAbs.replace(/\.md$/, "x.md");
    renameSync(srcAbs, destAbs);
    entry.destination = path.relative(root, destAbs).split(path.sep).join("/");
    entry.movedAt = new Date().toISOString();
    moved.push({ id: item.id, to: entry.destination });
    writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2)); // per-move: interruption-safe
  }
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
  console.log(JSON.stringify({ moved: moved.length, keptInArchive: kept.length, alreadyMoved, missing, moves: moved }, null, 2));
}

function cmdMap(args) {
  const root = repoRoot(args);
  const archiveRel = args.archiveDir || ARCHIVE_REL;
  const ledgerPath = path.join(root, archiveRel, ".import-ledger.json");
  const ledger = loadJSON(ledgerPath, null);
  if (!ledger) fail(`no ledger at ${archiveRel}/.import-ledger.json — run convert first`);
  const mapRel = args.mapFile || MAP_REL;
  const byDest = new Map();
  for (const [id, e] of Object.entries(ledger)) {
    const where = e.destination ? path.dirname(e.destination) : `${archiveRel} (archive)`;
    if (!byDest.has(where)) byDest.set(where, []);
    byDest.get(where).push(e);
  }
  const out = [
    "# Imported chat history — the map",
    "",
    `_Regenerated ${new Date().toISOString().slice(0, 10)} from ${archiveRel}/.import-ledger.json. Do not hand-edit; re-run the map command instead._`,
    "",
    `${Object.keys(ledger).length} conversations imported from ChatGPT/Claude exports. Sorted ones live in the folders below; everything else stays in the archive.`,
    "",
  ];
  const dests = [...byDest.keys()].sort((a, b) => (a.includes("(archive)") ? 1 : b.includes("(archive)") ? -1 : a.localeCompare(b)));
  for (const where of dests) {
    const rows = byDest.get(where).sort((a, b) => (a.date < b.date ? -1 : 1));
    out.push(`## ${where} (${rows.length})`, "");
    out.push("| date | title | summary | file |", "|---|---|---|---|");
    for (const e of rows) {
      const file = e.destination || e.file;
      out.push(`| ${e.date} | ${String(e.title).replace(/\|/g, "/").slice(0, 60)} | ${String(e.summary || "").replace(/\|/g, "/").slice(0, 100)} | ${file} |`);
    }
    out.push("");
  }
  const mapAbs = path.join(root, mapRel);
  mkdirSync(path.dirname(mapAbs), { recursive: true });
  writeFileSync(mapAbs, out.join("\n"));
  console.log(JSON.stringify({ map: mapRel, conversations: Object.keys(ledger).length, destinations: dests.length }, null, 2));
}

function resolveId(ledger, idOrId8) {
  if (ledger[idOrId8]) return idOrId8;
  const hits = Object.entries(ledger).filter(([, e]) => e.file && e.file.includes(`--${idOrId8}.md`));
  return hits.length === 1 ? hits[0][0] : null;
}

// remove: move conversations OUT of the repo (e.g. private ones to a personal vault)
// and DELIST them — they disappear from the ledger and therefore from the map.
// usage: remove <ids.json | id8,id8,...> --to </abs/outside/dir> [--repo <dir>]
function cmdRemove(target, args) {
  const root = repoRoot(args);
  const toDir = args.to;
  if (!toDir || !path.isAbsolute(toDir)) fail("remove needs --to <absolute folder OUTSIDE the repo> for the destination");
  if (path.resolve(toDir).startsWith(root + path.sep)) fail("remove's --to must be OUTSIDE the repo — use assign for moves within it");
  const archiveRel = args.archiveDir || ARCHIVE_REL;
  const ledgerPath = path.join(root, archiveRel, ".import-ledger.json");
  const ledger = loadJSON(ledgerPath, null);
  if (!ledger) fail("no ledger — run convert first");
  let ids;
  if (existsSync(path.resolve(target))) {
    const parsed = loadJSON(path.resolve(target), null);
    if (!Array.isArray(parsed)) fail("remove's ids file must be a JSON array of ids");
    ids = parsed.map((x) => (typeof x === "string" ? x : x.id));
  } else ids = target.split(",").map((s) => s.trim()).filter(Boolean);
  mkdirSync(toDir, { recursive: true });
  const moved = [], missing = [];
  for (const raw of ids) {
    const id = resolveId(ledger, raw);
    const entry = id && ledger[id];
    if (!entry) { missing.push(raw); continue; }
    const src = path.join(root, entry.destination || entry.file);
    if (!existsSync(src)) { missing.push(raw); continue; }
    let dest = path.join(toDir, path.basename(src));
    while (existsSync(dest)) dest = dest.replace(/\.md$/, "x.md");
    renameSync(src, dest);
    delete ledger[id]; // delisted: gone from the ledger, so gone from the map
    moved.push(path.basename(dest));
    writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
  }
  console.log(JSON.stringify({ movedOut: moved.length, to: toDir, delisted: moved.length, missing, note: "re-run the map command to drop them from the map file" }, null, 2));
}

// peek: the title + FIRST USER LINE of a conversation, without ever opening the
// whole file into a session (one huge message can be tens of thousands of characters).
// usage: peek <id8[,id8,...]> [--repo <dir>]
function cmdPeek(target, args) {
  const root = repoRoot(args);
  const archiveRel = args.archiveDir || ARCHIVE_REL;
  const ledger = loadJSON(path.join(root, archiveRel, ".import-ledger.json"), null);
  if (!ledger) fail("no ledger — run convert first");
  const out = [];
  for (const raw of target.split(",").map((s) => s.trim()).filter(Boolean)) {
    const id = resolveId(ledger, raw);
    const entry = id && ledger[id];
    if (!entry) { out.push({ id: raw, error: "not in ledger" }); continue; }
    const p = path.join(root, entry.destination || entry.file);
    let firstUserLine = "";
    try {
      const text = readFileSync(p, "utf8");
      const m = text.match(/^## You[^\n]*\n\n([^\n]*)/m);
      firstUserLine = (m ? m[1] : "").slice(0, 200);
    } catch { firstUserLine = "(file unreadable)"; }
    out.push({ id: raw, title: entry.title, date: entry.date, messages: entry.messages, firstUserLine });
  }
  console.log(JSON.stringify(out, null, 2));
}

function cmdStatus(args) {
  const root = repoRoot(args);
  const archiveRel = args.archiveDir || ARCHIVE_REL;
  const ledger = loadJSON(path.join(root, archiveRel, ".import-ledger.json"), null);
  if (!ledger) { console.log(JSON.stringify({ conversations: 0, note: "no ledger — nothing imported yet" })); return; }
  const entries = Object.values(ledger);
  const sorted = entries.filter((e) => e.destination).length;
  const summarized = entries.filter((e) => e.summary).length;
  console.log(JSON.stringify({
    conversations: entries.length,
    sortedIntoFolders: sorted,
    stillInArchive: entries.length - sorted,
    withSummary: summarized,
    sources: entries.reduce((m, e) => ((m[e.source] = (m[e.source] || 0) + 1), m), {}),
  }, null, 2));
}

// ---------- main ----------

const args = parseArgs(process.argv.slice(2));
const [cmd, target] = args._;
try {
  if (cmd === "inspect" && target) await cmdInspect(target);
  else if (cmd === "convert" && target) await cmdConvert(target, args);
  else if (cmd === "assign" && target) cmdAssign(target, args);
  else if (cmd === "remove" && target) cmdRemove(target, args);
  else if (cmd === "peek" && target) cmdPeek(target, args);
  else if (cmd === "map") cmdMap(args);
  else if (cmd === "status") cmdStatus(args);
  else {
    console.error("usage: node import-chat-export.mjs <inspect|convert> <zip-or-manifest.json> | assign <plan.json> | remove <ids> --to <abs-dir> | peek <id8,...> | map | status   [--repo <dir>] [--archive-dir <rel>] [--map-file <rel>]");
    process.exit(2);
  }
} catch (e) {
  fail(String(e && e.message || e).slice(0, 500));
}
