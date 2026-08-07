#!/usr/bin/env node
// King Intelligence — per-session real-work counter (the tool-less hours rail, 8/5/26).
// Wired as a PostToolUse hook on EVERY tool. One tiny job: count how many real actions
// Claude performed in this session, and whether any King Intelligence skill ran, into
// .claude/time-saved/session-actions.json. session-close.mjs reads it at SessionEnd to
// decide the work-floor credit (Jacob's 8/5/26 tiered decision):
//   under 20 actions -> 0 min (an open window or a trivial session displaces nothing)
//   20+ actions, no KI skills -> 10 min    100+ actions, no KI skills -> 30 min
//   any session that ran a skill -> 0 floor (its minutes already flow through the ledger)
// The thresholds live in session-close.mjs; this file only counts.
//
// Known limit, accepted: two sessions working the same repo at once share this file and
// a read-modify-write race can drop a count. That only ever UNDERCOUNTS, which errs honest.
// Discipline mirrors backup.mjs: hard gates, swallow everything, always exit 0, fast.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const GIT_TIMEOUT = 8000;
const KEEP_SESSIONS = 20;

function run() {
  const payload = readPayload();
  const sessionId = payload.session_id;
  if (!sessionId) return;

  const cwd = payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!cwd) return;
  const root = git(["rev-parse", "--show-toplevel"], cwd);
  if (!root) return;
  const isSnowball = ["CLAUDE.md", "SKILLS.md", "CONNECTIONS.md"].every((f) =>
    existsSync(join(root, f))
  );
  if (!isSnowball) return;
  if (existsSync(join(root, ".no-autobackup"))) return;

  const file = join(root, ".claude", "time-saved", "session-actions.json");
  let all = {};
  try {
    all = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    /* fresh file */
  }
  const entry = all[sessionId] || { actions: 0, skills: 0 };
  entry.actions += 1;
  if (payload.tool_name === "Skill") entry.skills += 1;
  entry.at = new Date().toISOString();
  all[sessionId] = entry;

  // keep only the newest sessions so the file never grows unbounded
  const ids = Object.keys(all);
  if (ids.length > KEEP_SESSIONS) {
    ids
      .sort((a, b) => String(all[a].at || "").localeCompare(String(all[b].at || "")))
      .slice(0, ids.length - KEEP_SESSIONS)
      .forEach((id) => delete all[id]);
  }

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(all));
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

// Entry at the bottom so every const above is initialized before run() fires (TDZ gotcha, 8/5/26).
try {
  run();
} catch {
  /* never block */
}
process.exit(0);
