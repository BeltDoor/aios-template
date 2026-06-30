#!/usr/bin/env node
// config-merge.mjs — additively reconcile a client's references/king-intelligence-config.md
// against the plugin's canonical config-defaults manifest.
//
// RULE (the whole point): ADD any canonical key that is ABSENT or BLANK, with its default value.
// NEVER change a key the client set to a real (non-empty) value. Create a missing section
// wholesale. Preserve every existing line, comment, and ordering byte-for-byte. Idempotent: a
// second run makes no change. The migration calls this AFTER the one plain-English heads-up; it
// is never run silently on auto-update.
//
// Usage:
//   node config-merge.mjs --check <manifest.json> <client-config.md>
//        -> prints JSON {wouldChange, added:[{section,key,value,how}]}; writes nothing
//   node config-merge.mjs --apply <manifest.json> <client-config.md>
//        -> writes the merged file additively (only if something changed); prints the same JSON
//
// `how`: "new-key" (absent key inserted), "filled-blank" (existing empty key populated),
//        "new-section" (whole section added).
// Always exits 0 on success (1 only on a usage/IO error) so the migration can read its JSON.

import fs from "node:fs";
import path from "node:path";

const [mode, manifestPath, configPath] = process.argv.slice(2);
if (!["--check", "--apply"].includes(mode) || !manifestPath || !configPath) {
  console.error("usage: node config-merge.mjs --check|--apply <manifest.json> <client-config.md>");
  process.exit(2);
}

const manifest = (() => {
  const j = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return j.sections || j; // tolerate {sections:{...}} or a bare {section:{key:val}} map
})();

// value after the colon, minus a trailing " # comment", trimmed. No leading \s* in the caller's
// capture, so a key whose only content is a comment resolves to blank (not to the comment text).
const cleanValue = (afterColon) => afterColon.replace(/\s+#.*$/, "").trim();

function parse(text) {
  const lines = text.split("\n");
  const sections = [];
  let cur = null, inFence = false;
  lines.forEach((line, idx) => {
    if (line.trimStart().startsWith("```")) { inFence = !inFence; return; } // fence-aware: ## inside ``` is not a section
    if (inFence) return;
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      if (cur) sections.push(cur);
      cur = { name: h[1].trim(), headerIdx: idx, lastKeyIdx: idx, keys: new Map() };
      return;
    }
    if (cur) {
      const kv = line.match(/^\s*-\s*([A-Za-z0-9_.]+)\s*:(.*)$/);
      if (kv) {
        cur.keys.set(kv[1], { idx, value: cleanValue(kv[2]), line });
        cur.lastKeyIdx = idx;
      }
    }
  });
  if (cur) sections.push(cur);
  return { lines, sections };
}

// "- key:   <blank>   # comment"  ->  "- key: value   # comment" (comment preserved)
function fillBlankLine(line, value) {
  const m = line.match(/^(\s*-\s*[A-Za-z0-9_.]+\s*:)\s*(#.*)?$/);
  if (!m) return `${line.replace(/\s+$/, "")} ${value}`; // defensive; shouldn't hit a real blank
  return `${m[1]} ${value}${m[2] ? "   " + m[2] : ""}`;
}

function run() {
  const raw = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
  const text = raw.replace(/\r\n?/g, "\n"); // normalize CRLF/CR -> LF so Windows clients don't get duplicate keys
  const { lines, sections } = parse(text);

  const added = [];
  const insertsByIdx = new Map(); // atIdx -> [lines]  (insert AFTER atIdx, manifest order)
  const newSections = []; // {section, keys:[{key,value}]}

  for (const [secName, keys] of Object.entries(manifest)) {
    // ALL sections with this name (dup or case-colliding headers); a key counts as present if it lives in ANY of them
    const matching = sections.filter((s) => s.name.toLowerCase() === secName.toLowerCase());
    if (matching.length === 0) {
      const ks = Object.entries(keys).map(([key, value]) => ({ key, value }));
      newSections.push({ section: secName, keys: ks });
      ks.forEach(({ key, value }) => added.push({ section: secName, key, value, how: "new-section" }));
      continue;
    }
    for (const [key, value] of Object.entries(keys)) {
      let found = null;
      for (const s of matching) { const e = s.keys.get(key); if (e) { found = e; break; } }
      if (found && found.value !== "") continue; // client set a real value (in some section) -> leave it
      if (found && found.value === "") {
        lines[found.idx] = fillBlankLine(found.line, value);
        added.push({ section: secName, key, value, how: "filled-blank" });
      } else {
        const target = matching[0].lastKeyIdx; // insert into the first matching section
        if (!insertsByIdx.has(target)) insertsByIdx.set(target, []);
        insertsByIdx.get(target).push(`- ${key}: ${value}`);
        added.push({ section: secName, key, value, how: "new-key" });
      }
    }
  }

  // rebuild in one pass: emit each line, then any new-key lines anchored after it
  const out = [];
  lines.forEach((line, idx) => {
    out.push(line);
    if (insertsByIdx.has(idx)) out.push(...insertsByIdx.get(idx));
  });
  // append wholly-new sections at EOF
  for (const ns of newSections) {
    if (out.length && out[out.length - 1].trim() !== "") out.push("");
    out.push(`## ${ns.section}`);
    for (const { key, value } of ns.keys) out.push(`- ${key}: ${value}`);
  }

  if (mode === "--apply" && added.length) {
    const result = out.join("\n").replace(/\n*$/, "\n"); // exactly one trailing newline
    fs.mkdirSync(path.dirname(configPath), { recursive: true }); // create references/ if the repo lacks it
    fs.writeFileSync(configPath, result);
  }
  console.log(JSON.stringify({ wouldChange: added.length > 0, added }, null, 2));
}

try {
  run();
} catch (e) {
  console.error("ERROR: " + (e.message || e));
  process.exit(1);
}
