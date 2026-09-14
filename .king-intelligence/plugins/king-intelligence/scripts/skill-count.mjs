#!/usr/bin/env node
// King Intelligence — deterministic skill counting.
// Wired as a PostToolUse hook on skill invocations in hooks.json. Every skill invocation bumps
// that skill's row in the repo's TIME-SAVED.md: uses+1, last used today.
//
// WHAT THIS FILE NO LONGER DOES (decided 9/14/26): it no longer turns uses into minutes.
// Until 8/21/26 the hours on a member's page were built from this ledger (uses x a baseline
// minutes figure, an ESTIMATE). Since then the hours are MEASURED by measure-sessions.mjs from
// the machine's own record of every session and sent to the members page, and this ledger fed
// nothing. But it kept writing an hours column, so a member's Claude saw two different hours
// numbers (195.96 on the page, 18.67 in the file) and called it a discrepancy. It was two
// counters that measure different things. There is one hours number now, the measured one.
// This ledger counts WHICH skills ran and how often, which the scoreboard shows as "tasks run".
//
// Honesty rules:
//   - A row's minutes cells are written as "see members page" the next time the row is
//     touched, so an old estimate ages out of the file on its own. Nothing here invents a minute.
//   - No network here. The measured hours ride up at session close (session-close.mjs) and at
//     /end-session (time-saved-sync.mjs).
//
// Known limitation, documented on purpose: only invocations that go through the Skill tool or
// the Skills Door are counted. Any bypass path undercounts, which errs on the honest side.
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

  bumpLedger(join(root, "TIME-SAVED.md"), skill);
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


const MEASURED = "see members page";

const LEDGER_HEADER = `# Tasks run

_created automatically by the King Intelligence plugin_

Which of your tools ran, and how often. Your HOURS are not in this file: they are measured from
your computer's own record of every session and shown on your members page, which is the one
number to quote.

| Skill | Manual time per use | Total uses | Total saved (cumulative) | Last used |
|-------|--------------------|-----------|--------------------------|-----------|
`;

function bumpLedger(ledgerPath, skill) {
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

    // Found the row. Keep cell 0, bump uses, and retire any minutes estimate the row still
    // carries: the hours live on the members page now (9/14/26).
    found = true;
    const uses = (parseInt((cells[2].match(/-?\d+/) || [])[0], 10) || 0) + 1;
    lines[i] = `| ${cells[0]} | ${MEASURED} | ${uses} | ${MEASURED} | ${today} |`;
    break;
  }

  if (!found) {
    const newRow = `| \`/${skill}\` | ${MEASURED} | 1 | ${MEASURED} | ${today} |`;
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
