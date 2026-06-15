#!/usr/bin/env node
// Print everything /king-intelligence:adapt needs in one shot: the config path to write to,
// the client's current config, and every shipped skill's swap-point manifest.
// Runs identically on any OS/shell. Usage: node adapt-context.mjs [rootDir] [dataDir]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || process.env.CLAUDE_PLUGIN_ROOT || ".";
const data = process.argv[3] || process.env.CLAUDE_PLUGIN_DATA || ".";
const cfgPath = join(data, "config.json");

console.log("CONFIG_PATH=" + cfgPath);
console.log("--- CURRENT CONFIG ---");
try {
  console.log(readFileSync(cfgPath, "utf8"));
} catch {
  console.log(JSON.stringify({ _status: "NOT_CONFIGURED", client: null, skills: {} }));
}

console.log("--- AVAILABLE SKILLS + SWAP POINTS ---");
try {
  for (const name of readdirSync(join(root, "skills"))) {
    const sp = join(root, "skills", name, "swap-points.json");
    console.log("### " + name);
    console.log(existsSync(sp) ? readFileSync(sp, "utf8") : '{"swapPoints":[]}');
  }
} catch (e) {
  console.log("(could not list skills: " + e.message + ")");
}
