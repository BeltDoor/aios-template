#!/usr/bin/env node
// patterns-record.mjs — safely record which operating patterns a client adopted/declined and the
// last synced plugin version, in the per-client config.json, WITHOUT a free-model JSON rewrite that
// could accidentally drop the `skills` wiring / `client` / `autoUpdate` keys. Read the JSON, set ONLY
// the patterns fields, deep-preserve every other top-level key, atomic write.
//
// Usage:
//   node patterns-record.mjs <configJsonPath> [--adopt id1,id2] [--decline id3] [--version X.Y.Z]
// Prints the resulting patterns object as JSON. Always additive to adopted/declined sets.

import fs from "node:fs";
import path from "node:path";

const [configPath, ...rest] = process.argv.slice(2);
if (!configPath) {
  console.error("usage: patterns-record.mjs <configJsonPath> [--adopt a,b] [--decline c] [--version X.Y.Z]");
  process.exit(2);
}

function arg(name) { const i = rest.indexOf(name); return i !== -1 && i + 1 < rest.length ? rest[i + 1] : null; }
const list = (s) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);

let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(configPath, "utf8")); } catch { cfg = {}; }
if (typeof cfg !== "object" || cfg === null || Array.isArray(cfg)) cfg = {};

const p = cfg.patterns && typeof cfg.patterns === "object" && !Array.isArray(cfg.patterns) ? cfg.patterns : {};
const adopted = new Set(Array.isArray(p.adopted) ? p.adopted : []);
const declined = new Set(Array.isArray(p.declined) ? p.declined : []);

for (const id of list(arg("--adopt"))) { adopted.add(id); declined.delete(id); }
for (const id of list(arg("--decline"))) { declined.add(id); adopted.delete(id); }
const version = arg("--version");

// touch ONLY the patterns object; every other top-level key (skills, client, autoUpdate, ...) is preserved
cfg.patterns = {
  ...p,
  adopted: [...adopted],
  declined: [...declined],
  lastSyncedVersion: version || p.lastSyncedVersion || null,
};

const tmp = configPath + ".tmp-" + process.pid;
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + "\n");
try { fs.renameSync(tmp, configPath); } catch { if (fs.existsSync(configPath)) fs.rmSync(configPath); fs.renameSync(tmp, configPath); }

console.log(JSON.stringify(cfg.patterns, null, 2));
