#!/usr/bin/env node
// King Intelligence - measure this session as it closes (SessionEnd hook).
//
// REBUILT 8/21/26. The old version credited a session a flat 10 or 30 minutes for a whole day of
// work, and ZERO if any King Intelligence tool had run in it, which is why a member using the
// system every day read as four hours. It also leaned on a 45-minute guard that silently threw
// away every other window a busy owner had open.
//
// All of that is gone. This hands the session to measure-sessions.mjs, which reads what actually
// happened from Claude Code's own record of it: how long the machine really worked, which
// documents it created and changed, what it drafted. Nothing is estimated and nothing is capped.
//
// Discipline mirrors backup.mjs: swallow everything, never block a close, always exit 0.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const TIMEOUT = 15000;

function run() {
  const payload = readPayload();
  const sessionId = payload.session_id;
  if (!sessionId) return; // nothing to measure without an id

  // No Snowball gate here, on purpose. The old counter refused to run outside a folder holding
  // CLAUDE.md + SKILLS.md + CONNECTIONS.md, so a member working anywhere else reported nothing at
  // all and never found out. The owner's answer to "how much time did my system save me" is
  // all of their work, not one folder's worth.
  // The folder the session ran in rides along (9/26/26): a keyed member's second brain holds
  // their key, and on a computer where the toolkit switch never registered it is the ONLY
  // place the sender can find it. The outcome is written to disk by measure-sessions.mjs
  // (last-report.json), because nothing reads this hook's own output.
  const projectDir =
    (typeof payload.cwd === "string" && payload.cwd) || process.env.CLAUDE_PROJECT_DIR || "";
  execFileSync(
    process.execPath,
    [
      join(SCRIPT_DIR, "measure-sessions.mjs"),
      "session",
      String(sessionId),
      "--send",
      "--send-timeout-ms",
      "4000",
      ...(projectDir ? ["--project-dir", projectDir] : []),
    ],
    { timeout: TIMEOUT, stdio: ["ignore", "ignore", "ignore"], windowsHide: true }
  );
}

function readPayload() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

// Entry at the bottom so every const above is initialised before run() fires (TDZ gotcha, 8/5/26).
try {
  run();
} catch {
  /* never block a session close */
}
process.exit(0);
