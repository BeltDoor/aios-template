#!/usr/bin/env node
// Print everything the /king-intelligence:update "sync your setup" phase needs in one shot:
// the config path to write to, this client's current patterns state (adopted / declined /
// lastSyncedVersion), every shipped operating pattern in full, and the resolved paths to the
// client's own files so Claude can read them and judge what's missing.
// Runs identically on any OS/shell, never throws. Usage: node patterns-context.mjs [rootDir] [dataDir] [projectDir]
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || process.env.CLAUDE_PLUGIN_ROOT || ".";
const data = process.argv[3] || process.env.CLAUDE_PLUGIN_DATA || ".";
const proj = process.argv[4] || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const cfgPath = join(data, "config.json");

console.log("CONFIG_PATH=" + cfgPath);

let pluginVersion = "unknown";
try {
  pluginVersion = JSON.parse(readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8")).version || "unknown";
} catch {}
console.log("PLUGIN_VERSION=" + pluginVersion);

console.log("--- CURRENT PATTERNS STATE ---");
let cfg = { _status: "NOT_CONFIGURED", client: null, skills: {}, patterns: { adopted: [], declined: [], lastSyncedVersion: null } };
try {
  cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
} catch {}
const patterns = cfg.patterns || { adopted: [], declined: [], lastSyncedVersion: null };
console.log(JSON.stringify(patterns));

console.log("--- SHIPPED OPERATING PATTERNS ---");
let shippedIds = [];
try {
  for (const f of readdirSync(join(root, "patterns"))) {
    if (!f.endsWith(".md")) continue;
    shippedIds.push(f.replace(/\.md$/, ""));
    console.log("### " + f);
    console.log(readFileSync(join(root, "patterns", f), "utf8"));
    console.log("### END " + f);
  }
} catch (e) {
  console.log("(could not list patterns: " + e.message + ")");
}

console.log("--- UNSEEN PATTERN IDS (not yet adopted or declined) ---");
const seen = new Set([...(patterns.adopted || []), ...(patterns.declined || [])]);
console.log(JSON.stringify(shippedIds.filter((id) => !seen.has(id))));

console.log("--- CLIENT REPO FILES (read these to judge what's missing) ---");
console.log("PROJECT_DIR=" + proj);
const probe = (rel) => {
  const p = join(proj, rel);
  let kind = "missing";
  try {
    kind = statSync(p).isDirectory() ? "dir" : "file";
  } catch {}
  console.log(`${kind}\t${rel}\t${p}`);
};
// The client's behavioral spine and the two structural homes (try the common names).
["CLAUDE.md", "memory", "MEMORY.md", "references"].forEach(probe);
