#!/usr/bin/env node
// Session-start nudge, throttled to at most once per ~20h so it never spams a daily user.
// If Jacob has shipped operating patterns this client hasn't seen yet, the nudge says so
// specifically; otherwise it's the generic "pull the latest" reminder.
// Always exits 0 so it can never block startup.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

try {
  const data = process.env.CLAUDE_PLUGIN_DATA;
  if (!data) process.exit(0);

  const marker = join(data, ".last-nudge");
  const now = Date.now();
  let last = 0;
  try {
    last = parseInt(readFileSync(marker, "utf8"), 10) || 0;
  } catch {}

  const TWENTY_H = 20 * 60 * 60 * 1000;
  if (now - last < TWENTY_H) process.exit(0); // stay quiet

  // Count operating patterns this client hasn't seen yet (best-effort; never throws).
  let unseen = 0;
  try {
    const root = process.env.CLAUDE_PLUGIN_ROOT;
    if (root) {
      const shipped = readdirSync(join(root, "patterns"))
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.replace(/\.md$/, ""));
      let cfg = {};
      try {
        cfg = JSON.parse(readFileSync(join(data, "config.json"), "utf8"));
      } catch {}
      const p = cfg.patterns || {};
      const seen = new Set([...(p.adopted || []), ...(p.declined || [])]);
      unseen = shipped.filter((id) => !seen.has(id)).length;
    }
  } catch {}

  const msg =
    unseen > 0
      ? `King Intelligence plugin: Jacob has ${unseen} new way${unseen === 1 ? "" : "s"} of working you haven't seen. Run /king-intelligence:update to review and (optionally) add ${unseen === 1 ? "it" : "them"}. Nothing changes without your yes.`
      : "King Intelligence plugin: if you haven't lately, run /king-intelligence:update to pull Jacob's latest skills. Your saved settings are never touched.";

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: msg },
    })
  );

  // Stamp the throttle marker only AFTER the nudge actually printed, so a failed
  // write above never silences the client for 20h.
  try {
    mkdirSync(data, { recursive: true });
    writeFileSync(marker, String(now));
  } catch {}
} catch {}
process.exit(0);
