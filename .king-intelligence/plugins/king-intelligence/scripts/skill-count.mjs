#!/usr/bin/env node
// King Intelligence — deterministic skill counting (Rail B).
// Wired as a PostToolUse hook on the Skill tool in hooks.json. Every skill invocation bumps that
// skill's row in the repo's TIME-SAVED.md: uses+1, total = baseline minutes x uses, last used today.
//
// Honesty rules (from the 8/4/26 spec, non-negotiable):
//   - Baselines come ONLY from defaults/skill-minutes.json, shipped by King Intelligence at the
//     defensible floor (competent-peer estimate, x0.2 calibration, rounded DOWN to 5). A skill
//     with no baseline counts uses and adds 0 minutes. The model never invents a number.
//   - A row that already carries a real manual-minutes figure keeps it verbatim (it was set
//     deliberately); only uses / total / last-used move.
//   - No network here. The updated ledger rides the wire at session close (Rail A) and at
//     /end-session, via skillsFromLedger() in time-saved-sync.mjs.
//
// Known limitation, documented on purpose: only invocations that go through the Skill TOOL are
// counted (the current invocation path, including typed slash commands). Any bypass path
// undercounts — which errs on the honest side.
//
// Discipline mirrors backup.mjs: self-gates hard (git repo + Snowball markers + kill file),
// swallows every failure, ALWAYS exits 0. Never blocks or slows a turn.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const GIT_TIMEOUT = 10000;

function run() {
  const payload = readPayload();
  const skill = skillFromPayload(payload);
  if (!skill) return;

  const cwd = payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!cwd) return;
  const root = git(["rev-parse", "--show-toplevel"], cwd);
  if (!root) return; // not a git repo -> no-op
  const isSnowball = ["CLAUDE.md", "SKILLS.md", "CONNECTIONS.md"].every((f) =>
    existsSync(join(root, f))
  );
  if (!isSnowball) return; // not a managed brain -> no-op
  if (existsSync(join(root, ".no-autobackup"))) return; // same kill switch as backup

  bumpLedger(join(root, "TIME-SAVED.md"), skill, baselineFor(skill));
}

// Two invocation paths, one counter (Skills Door migration, 8/27/26):
//   1. The legacy local-skill path: tool "Skill", the name in tool_input.skill.
//   2. The Skills Door path: the door's MCP tool "mcp__king-intelligence__use_skill"
//      (what every synced stub calls), the name in tool_input.name. Matcher shape
//      confirmed against a REAL transcript payload from the 8/27 door E2E, not guessed.
// list_skills / get_skill_file are deliberately NOT counted: fetching a reference file
// or browsing the menu is not a use of a skill.
function skillFromPayload(payload) {
  const tool = payload.tool_name || "";
  const input = payload.tool_input || {};
  if (tool === "Skill") return normalizeSkill(input.skill);
  if (tool === "mcp__king-intelligence__use_skill") return normalizeSkill(input.name);
  return null;
}

// "king-intelligence:content-unit" -> "content-unit"; "/email" -> "email". Lowercased slug,
// [a-z0-9_-] only, so a row key can never carry free text onto the wire.
function normalizeSkill(raw) {
  if (typeof raw !== "string") return null;
  const last = raw.split(":").pop().replace(/^\//, "").trim().toLowerCase();
  const clean = last.replace(/[^a-z0-9_-]/g, "");
  return clean && clean.length <= 64 ? clean : null;
}

function baselineFor(skill) {
  try {
    const table = JSON.parse(
      readFileSync(join(SCRIPT_DIR, "..", "defaults", "skill-minutes.json"), "utf8")
    );
    const n = Number(table[skill]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

const LEDGER_HEADER = `# Time saved

_created automatically by the King Intelligence plugin_

Running tally of the time your tracked tools hand back. "Manual time per use" is a deliberately
low baseline set by King Intelligence: deterministic counting, never an estimate made up on the spot.

| Skill | Manual time per use | Total uses | Total saved (cumulative) | Last used |
|-------|--------------------|-----------|--------------------------|-----------|
`;

function bumpLedger(ledgerPath, skill, baseline) {
  const today = fmtToday();
  let text = existsSync(ledgerPath) ? readFileSync(ledgerPath, "utf8") : LEDGER_HEADER;

  const lines = text.split("\n");
  let headerIdx = -1; // the `| Skill | Manual time ... |` row
  let lastRowIdx = -1; // last data row of that table
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.startsWith("|")) {
      if (headerIdx >= 0 && lastRowIdx >= 0) break; // first table ended
      continue;
    }
    const cells = t.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 4) continue;
    const first = cells[0].replace(/`/g, "").trim();
    if (/^skill$/i.test(first)) {
      headerIdx = i;
      continue;
    }
    if (/^-+$/.test(first) || first === "") {
      if (headerIdx >= 0) lastRowIdx = i;
      continue;
    }
    if (headerIdx < 0) continue;
    lastRowIdx = i;
    const rowSkill = first.replace(/^\//, "").toLowerCase();
    if (rowSkill !== skill) continue;

    // Found the row. Keep cell 0 and a real manual-minutes cell verbatim; only fill the
    // manual cell from the shipped baseline when it is still pending/zero.
    found = true;
    const manualMin = parseInt((cells[1].match(/-?\d+/) || [])[0], 10);
    const pending = /pending/i.test(cells[1]) || !(manualMin > 0);
    let manualCell = cells[1];
    let effMin = pending ? 0 : manualMin;
    if (pending && baseline > 0) {
      manualCell = `${baseline} min`;
      effMin = baseline;
    }
    const uses = (parseInt((cells[2].match(/-?\d+/) || [])[0], 10) || 0) + 1;
    lines[i] = `| ${cells[0]} | ${manualCell} | ${uses} | ${effMin > 0 ? effMin * uses : 0} min | ${today} |`;
    break;
  }

  if (!found) {
    const manualCell = baseline > 0 ? `${baseline} min` : "(pending - baseline not set)";
    const newRow = `| \`/${skill}\` | ${manualCell} | 1 | ${baseline > 0 ? baseline : 0} min | ${today} |`;
    if (headerIdx >= 0 && lastRowIdx >= headerIdx) {
      lines.splice(lastRowIdx + 1, 0, newRow);
    } else {
      // no table anywhere in the file -> append a fresh one
      const tail = `\n| Skill | Manual time per use | Total uses | Total saved (cumulative) | Last used |\n|-------|--------------------|-----------|--------------------------|-----------|\n${newRow}\n`;
      lines.push(...tail.split("\n"));
    }
  }

  writeFileSync(ledgerPath, lines.join("\n"));
}

function fmtToday() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(
    2,
    "0"
  )}/${String(now.getFullYear()).slice(-2)}`;
}

function readPayload() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, timeout: GIT_TIMEOUT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

// Entry lives at the bottom so every const above is initialized before run() fires.
try {
  run();
} catch {
  /* never block */
}
process.exit(0);
