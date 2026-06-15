#!/usr/bin/env node
// Seed the persistent per-client config on first run, so no skill ever cats a missing file.
// DATA survives updates, so this only ever fires once per client (unless they delete the file).
// Always exits 0 so it can never block session startup.
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

try {
  const data = process.env.CLAUDE_PLUGIN_DATA;
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  if (data && root) {
    const cfg = join(data, "config.json");
    if (!existsSync(cfg)) {
      mkdirSync(data, { recursive: true });
      copyFileSync(join(root, "defaults", "config.json"), cfg);
    }
  }
} catch {
  // never block startup
}
process.exit(0);
