#!/usr/bin/env node
// King Intelligence - catch up any session that was never measured (SessionStart hook).
//
// This is the belt to session-close.mjs's braces. A SessionEnd hook does not always fire: a
// closed terminal, a crash, a machine put to sleep. A machine can be pulling updates every
// morning while its last reported session is days old, which is exactly that failure, and
// nothing anywhere says so.
//
// So every time a session STARTS, we sweep for transcripts that have never been measured and
// fold them in. Work can be missed by one hook or the other, never by both.
//
// It runs DETACHED and returns immediately, because the very first sweep on a busy machine reads
// every transcript on disk and must never sit in front of the owner's session opening. Throttled,
// because a member can open several windows at once and one sweep an hour is plenty.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const THROTTLE_MS = 60 * 60 * 1000;

// Deliberately NOT keyed to CLAUDE_PLUGIN_DATA, which is set when Claude Code runs a
// script as a hook and unset when a person runs the same script by hand: anything stored
// there silently forks into two copies. That is what minted a second machine identity on
// 8/21/26 and made Jacob's own total read exactly double. measure-sessions.mjs was fixed
// then; this file kept the old shape and only governed a throttle marker, so it was a
// landmine rather than a live bug. Same fixed home-dir path as the engine, one truth.
const DATA =
  process.env.KI_TIME_SAVED_DIR ||
  join(homedir(), ".claude", "king-intelligence", "time-saved");

try {
  const marker = join(DATA, ".last-sweep");
  let last = 0;
  try {
    last = parseInt(readFileSync(marker, "utf8"), 10) || 0;
  } catch {
    /* never swept */
  }

  if (Date.now() - last >= THROTTLE_MS) {
    // Stamp BEFORE launching. If the sweep dies the throttle still holds, so a machine that
    // cannot sweep retries in an hour rather than relaunching on every window the owner opens.
    try {
      mkdirSync(DATA, { recursive: true });
      writeFileSync(marker, String(Date.now()));
    } catch {
      /* an unwritable data dir just means no throttle */
    }

    const engine = join(SCRIPT_DIR, "measure-sessions.mjs");
    if (existsSync(engine)) {
      const child = spawn(process.execPath, [engine, "sweep", "--send", "--send-timeout-ms", "8000"], {
        detached: true,
        stdio: "ignore",
      });
      child.unref(); // the session opens now; the sweep finishes on its own time
    }
  }
} catch {
  /* never block a session opening */
}
process.exit(0);
