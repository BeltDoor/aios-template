#!/usr/bin/env node
// BRAND GUIDE GATE — nothing visual gets built until the brand guide has been LOOKED AT.
//
// PreToolUse hook on Write | Edit | Bash.
// Ported from the King Intelligence house version, generalized to the client's own brand.
//
// WHY THIS EXISTS
// Upstream, the brand law was written down in THREE places — a root instruction file, a
// branding file, and persistent memory — and it was STILL skipped on the day the system
// was locked, because that build started from a feature spec and never opened the law.
// The owner's response was to ask for a stop, not a fourth written copy.
//
// It also deliberately demands LOOKING rather than reading. The written rules had
// already been read the day the surface shipped generic. Pictures are the artifact
// because a picture cannot be skimmed into a false sense of having complied.
//
// HOW IT BEHAVES
//   - Fires once per session, not once per file. Look at the guide, and it goes quiet.
//   - Silent for anyone who has never run /king-intelligence:install-brand.
//   - Silent inside the client's carve-out folders (work for THEIR customers, which
//     carries the customer's brand, not theirs).
//   - Snapshots that predate the guide are refused, so it can never be satisfied by a
//     picture of an older version of the law.
//
// ROLLBACK (any ONE of these fully disables it):
//   1. Remove the PreToolUse entry in hooks/hooks.json referencing this file
//   2. Or: set "enforce": false in the config's skills.brand block
//   3. Or: set DISABLE_BRAND_GATE=1 to bypass without changing anything

import fs from "node:fs";
import path from "node:path";

if (process.env.DISABLE_BRAND_GATE === "1") process.exit(0);

const HERE = path.dirname(new URL(import.meta.url).pathname);

/* ── TIGHT DETECTOR ──────────────────────────────────────────────────────────
   If this ever false-positives, TIGHTEN THIS FUNCTION. Do not widen the escape hatch
   and do not delete the gate. A gate that fires on unrelated work gets switched off,
   which lands us back at a brand nobody follows. */
async function isVisualWork(payload, mod, cfg) {
  const tool = payload.tool_name;

  if (tool === "Write" || tool === "Edit") {
    const fp = payload?.tool_input?.file_path;
    if (!fp) return false;
    // The shared scope logic already excludes the guide itself, its snapshots, the
    // rating file, build output and the carve-out folders. One definition, two consumers.
    return mod.isGuardedVisualFile(path.resolve(fp), cfg);
  }

  if (tool === "Bash") {
    // Image generation is visual work even though no visual file is being written.
    // The patterns are the client's own image-generation commands, named during
    // /install-brand. With none configured this branch simply never fires.
    const cmd = payload?.tool_input?.command || "";
    for (const p of cfg.imageGenPatterns || []) {
      try {
        if (new RegExp(p, "i").test(cmd)) return true;
      } catch {
        // a malformed pattern is skipped, never fatal
      }
    }
    return false;
  }

  return false;
}

function snapshotProblem(cfg, workspace, required) {
  const guide = path.join(workspace, cfg.guidePath || "");
  const dir = path.join(workspace, cfg.snapshotDir || "");
  if (!cfg.snapshotDir || !fs.existsSync(dir)) return "the guide snapshots have never been rendered";
  let guideMtime = 0;
  try {
    guideMtime = fs.statSync(guide).mtimeMs;
  } catch {
    return null; // no guide file to compare against; do not invent a problem
  }
  for (const f of required) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) return `${f} is missing`;
    if (fs.statSync(p).mtimeMs < guideMtime) {
      return `${f} is older than the guide, so the law changed after that picture was taken`;
    }
  }
  return null;
}

function hasLookedAtGuide(transcriptPath, cfg, required) {
  if (!transcriptPath) return null; // unknown -> caller decides (never deadlock)
  let text;
  try {
    text = fs.readFileSync(transcriptPath, "utf8");
  } catch {
    return null;
  }
  const dir = (cfg.snapshotDir || "").replace(/^[./]+|\/+$/g, "");
  return required.every((f) => text.includes(`${dir}/${f}`));
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", async () => {
  let payload;
  try {
    payload = JSON.parse(input || "{}");
  } catch {
    process.exit(0); // never block on a malformed payload
  }

  // Load the shared scope + config module. If it is unavailable for any reason, ALLOW —
  // guessing at scope is how a gate starts firing on unrelated work.
  let mod, cfg;
  try {
    mod = await import(path.join(HERE, "brand-check.mjs"));
    cfg = mod.brandConfig();
  } catch {
    process.exit(0);
  }

  // NOT CONFIGURED -> completely silent. Every client who has never run /install-brand
  // must never see this fire. This is the first thing to verify after any edit.
  if (!cfg) process.exit(0);

  const workspace = mod.WORKSPACE;
  // The two every visual job needs regardless of what is being built: the system in one
  // page, and the list of things that are banned.
  const required = cfg.requiredSnapshots?.length
    ? cfg.requiredSnapshots
    : ["00-overview.png", "99-dead-list.png"];

  let visual = false;
  try {
    visual = await isVisualWork(payload, mod, cfg);
  } catch {
    process.exit(0); // never block on our own bug
  }
  if (!visual) process.exit(0);

  const looked = hasLookedAtGuide(payload.transcript_path, cfg, required);
  // A missing or unreadable transcript must ALLOW. Blocking on it would be a deadlock:
  // there would be no way left to prove the guide had been looked at.
  if (looked === null || looked === true) process.exit(0);

  const stale = snapshotProblem(cfg, workspace, required);
  const dir = (cfg.snapshotDir || "brand/guide-snapshots").replace(/\/+$/, "");
  const lines = [];
  lines.push("BRAND GUIDE GATE — stop. This is visual work and the brand guide has not been looked at yet.");
  lines.push("");
  if (stale) {
    lines.push(`The snapshots are not usable: ${stale}.`);
    lines.push('Render them first:   node "${CLAUDE_PLUGIN_ROOT}/scripts/brand-snapshots.mjs"');
    lines.push("");
  }
  lines.push("Read these two images with the Read tool before writing anything visual:");
  for (const f of required) lines.push(`  ${dir}/${f}`);
  if (cfg.chapters?.length) {
    lines.push("");
    lines.push("Then read the ONE chapter that matches the surface you are building:");
    const width = Math.max(...cfg.chapters.map((c) => c.file.length));
    for (const c of cfg.chapters) {
      lines.push(`  ${dir}/${c.file.padEnd(width)}  ${c.label || ""}`.trimEnd());
    }
  }
  lines.push("");
  lines.push("This fires once per session. Once you have looked, it stays quiet.");
  if (cfg.guidePath) lines.push(`Full guide: ${cfg.guidePath}`);
  if (cfg.lawPath) lines.push(`Law in text: ${cfg.lawPath}`);

  process.stderr.write(lines.join("\n") + "\n");
  process.exit(2);
});
