#!/usr/bin/env node
// Print this client's wiring config as JSON, or a NOT_CONFIGURED sentinel if absent.
// Runs identically on any OS/shell (skills call this instead of relying on bash builtins).
// Usage: node print-config.mjs [configPath]   (falls back to $CLAUDE_PLUGIN_DATA/config.json)
import { readFileSync } from "node:fs";
import { join } from "node:path";

const p =
  process.argv[2] ||
  join(process.env.CLAUDE_PLUGIN_DATA || ".", "config.json");

try {
  process.stdout.write(readFileSync(p, "utf8"));
} catch {
  process.stdout.write(
    JSON.stringify({
      _status: "NOT_CONFIGURED",
      hint: "Run /king-intelligence:adapt <skill> first to wire this client.",
    })
  );
}
