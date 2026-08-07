#!/usr/bin/env node
// King Intelligence — passive session-close tracking (Rail A).
// Wired on SessionEnd in hooks.json, AFTER the backup save. One job: when a session on a managed
// Snowball closes, run `time-saved-sync.mjs record --session-only --send` so the member's portal
// activity (streak / calendar / last-active) updates with zero skill involvement.
//
// HARD RULE carried from the spec: a session merely EXISTING displaces no human time. The one
// amendment (Jacob's tiered decision, 8/5/26): a session that did REAL WORK without touching a
// King Intelligence skill earns a deterministic floor, read from action-count.mjs's tally:
//   under 20 actions -> 0   ·   20+ actions -> 10 min   ·   100+ actions -> 30 min
//   any KI skill ran -> 0 floor (its minutes already flow through the TIME-SAVED.md ledger)
// The numbers are deliberately low and fixed here — never estimated by the client's Claude.
//
// Discipline mirrors backup.mjs: self-gates hard (Snowball markers, kill file), every failure is
// swallowed, ALWAYS exits 0, and the network send carries its own 4s timeout so a dead network
// can never hang a session close. No token on the machine => the sync script no-ops cleanly.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url)); // import.meta.dirname needs Node 20.11+; stay older-Node safe

const GIT_TIMEOUT = 10000;
const SYNC_TIMEOUT = 15000;
// Work-floor tiers (Jacob, 8/5/26): thresholds on the session's real-action count.
const FLOOR_SMALL_BAR = 20;
const FLOOR_HEAVY_BAR = 100;
const FLOOR_SMALL_MIN = 10;
const FLOOR_HEAVY_MIN = 30;

try {
  run();
} catch {
  /* never block a session close */
}
process.exit(0);

function run() {
  const payload = readPayload();
  const cwd = payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!cwd) return;

  const root = git(["rev-parse", "--show-toplevel"], cwd);
  if (!root) return; // not a git repo -> no-op

  const isSnowball = ["CLAUDE.md", "SKILLS.md", "CONNECTIONS.md"].every((f) =>
    existsSync(join(root, f))
  );
  if (!isSnowball) return; // not a managed brain -> no-op
  if (existsSync(join(root, ".no-autobackup"))) return; // same kill switch as backup

  // Local date drives the week / streak math; MM/DD/YY like every other caller.
  const now = new Date();
  const dateStr = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(
    now.getDate()
  ).padStart(2, "0")}/${String(now.getFullYear()).slice(-2)}`;

  const args = [
    join(SCRIPT_DIR, "time-saved-sync.mjs"),
    "record",
    "--session-only",
    "--repo",
    root,
    "--date",
    dateStr,
    "--send",
    "--send-timeout-ms",
    "4000",
  ];
  if (payload.session_id) {
    args.push("--session-id", String(payload.session_id));
    const floorMin = workFloorMinutes(root, String(payload.session_id));
    if (floorMin > 0) args.push("--work-floor-min", String(floorMin));
  }

  execFileSync(process.execPath, args, {
    timeout: SYNC_TIMEOUT,
    stdio: ["ignore", "ignore", "ignore"],
  });
}

// Tier decision from action-count.mjs's tally. Missing file / missing session / any
// KI skill in the session -> 0. Only ever reads; the counter file is written per tool call.
function workFloorMinutes(root, sessionId) {
  try {
    const all = JSON.parse(
      readFileSync(join(root, ".claude", "time-saved", "session-actions.json"), "utf8")
    );
    const e = all[sessionId];
    if (!e || (e.skills || 0) > 0) return 0;
    const actions = Number(e.actions) || 0;
    if (actions >= FLOOR_HEAVY_BAR) return FLOOR_HEAVY_MIN;
    if (actions >= FLOOR_SMALL_BAR) return FLOOR_SMALL_MIN;
    return 0;
  } catch {
    return 0;
  }
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
