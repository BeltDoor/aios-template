#!/usr/bin/env node
// King Intelligence - keep the memory index loading, without waiting for /end-session
// (SessionStart hook, every source).
//
// Claude Code loads only the first 25 KB of MEMORY.md. Past that, the oldest memories silently
// stop loading and nothing on screen says so. The memory conveyor fixes that by ageing the
// oldest notes into a dated archive (nothing is ever deleted), but until 9/14/26 it ran only
// inside /end-session, so a member who closed the window any other way never tidied, and one
// member's index sat at 26.1 KB with her oldest notes gone dark.
//
// This hook runs the conveyor's read-only report on every session start (throttled to once an
// hour) and, only when the index is at or past the tidy line, runs the same --enforce that
// /end-session runs, under a lock so two windows opening together cannot both do it. It
// resolves the conveyor from the NEWEST installed toolkit, never from a stale copy. It leaves a
// receipt beside the hours ledger so the members page can show it. Always exits 0, never blocks
// a session from opening, never touches anything but MEMORY.md and its archive.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { newestPluginRoot } from "./local-scripts.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const THROTTLE_MS = 60 * 60 * 1000;
const LOCK_STALE_MS = 2 * 60 * 1000;
// Tidy a little BEFORE the 25,600-byte cliff, so no note ever goes dark between two sessions.
// The conveyor then trims to its own 16,800-byte budget.
export const TIDY_AT = 24000;

// Same home-folder data dir as the hours engine and the update-failure note: one place the
// portal snapshot reads, never CLAUDE_PLUGIN_DATA (which forks between hook and hand runs).
const DATA = process.env.KI_TIME_SAVED_DIR || path.join(os.homedir(), ".claude", "king-intelligence", "time-saved");
const RECEIPT = path.join(DATA, "memory-tidy.json");

function findConveyor(projectDir) {
  const found = newestPluginRoot(projectDir);
  const candidates = [
    found ? path.join(found.root, "scripts", "memory-conveyor.mjs") : null,
    path.join(HERE, "memory-conveyor.mjs"),
    path.join(projectDir, ".claude", "scripts", "memory-conveyor.mjs"),
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return { script: c, version: found ? found.version : null };
  return null;
}

function runConveyor(script, mode, projectDir, memDir) {
  const args = [script, mode, "--json"];
  if (memDir) args.push("--mem-dir", memDir);
  const r = spawnSync(process.execPath, args, { cwd: projectDir, encoding: "utf8", timeout: 12000 });
  const out = String(r.stdout || "");
  // the report's last JSON line, if the conveyor is new enough to print one
  let json = null;
  for (const line of out.trim().split("\n").reverse()) {
    if (line.startsWith("{")) { try { json = JSON.parse(line); } catch { /* keep looking */ } break; }
  }
  if (!json) {
    const m = out.match(/MEMORY\.md:\s*(\d+)\s*entries,\s*(\d+)\s*bytes/);
    if (m) json = { entries: +m[1], bytes: +m[2] };
  }
  return { status: r.status, json, out, err: String(r.stderr || "") };
}

export function tidy({ projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd(), memDir = process.env.KI_MEM_DIR || null, force = false } = {}) {
  const receipt = { at: new Date().toISOString(), ok: true, ran: false, bytesBefore: null, bytesAfter: null, entries: null, version: null, note: null };
  try {
    fs.mkdirSync(DATA, { recursive: true });
    const marker = path.join(DATA, ".last-memory-tidy");
    let last = 0;
    try { last = parseInt(fs.readFileSync(marker, "utf8"), 10) || 0; } catch { /* first run */ }
    if (!force && Date.now() - last < THROTTLE_MS) return null; // quiet: checked within the hour
    try { fs.writeFileSync(marker, String(Date.now())); } catch { /* an unwritable dir just means no throttle */ }

    const c = findConveyor(projectDir);
    if (!c) { receipt.ok = false; receipt.note = "no memory conveyor on this computer"; return receipt; }
    receipt.version = c.version;

    const before = runConveyor(c.script, "--analyze", projectDir, memDir);
    if (!before.json) {
      // no memory index yet is the common case on a new machine, and it is fine
      const missing = /ENOENT|no such file/i.test(before.err + before.out);
      receipt.ok = missing;
      receipt.note = missing ? "no memory index yet" : (before.err.trim().split("\n").pop() || "could not read the index");
      return receipt;
    }
    receipt.bytesBefore = before.json.bytes;
    receipt.bytesAfter = before.json.bytes;
    receipt.entries = before.json.entries;
    if (before.json.bytes < TIDY_AT) { receipt.note = "under the tidy line"; return receipt; }

    // over the line: tidy under a lock so two windows cannot both append the archive
    const lockDir = before.json.memDir ? path.join(before.json.memDir, ".conveyor.lock") : null;
    if (lockDir) {
      try {
        const st = fs.statSync(lockDir);
        if (Date.now() - st.mtimeMs < LOCK_STALE_MS) { receipt.note = "another window is tidying"; return receipt; }
        fs.rmSync(lockDir, { recursive: true, force: true });
      } catch { /* no lock */ }
      try { fs.mkdirSync(lockDir); } catch { receipt.note = "another window is tidying"; return receipt; }
    }
    try {
      const r = runConveyor(c.script, "--enforce", projectDir, memDir);
      receipt.ran = true;
      if (r.status !== 0) {
        receipt.ok = false;
        receipt.note = (r.err.trim().split("\n").pop() || "the conveyor stopped and wrote nothing");
      } else {
        const after = runConveyor(c.script, "--analyze", projectDir, memDir);
        if (after.json) { receipt.bytesAfter = after.json.bytes; receipt.entries = after.json.entries; }
        receipt.note = "tidied";
      }
    } finally {
      if (lockDir) { try { fs.rmSync(lockDir, { recursive: true, force: true }); } catch { /* fine */ } }
    }
    return receipt;
  } catch (e) {
    receipt.ok = false;
    receipt.note = String((e && e.message) || e).slice(0, 200);
    return receipt;
  } finally {
    if (receipt.note !== null || receipt.ran) {
      try { fs.writeFileSync(RECEIPT, JSON.stringify(receipt)); } catch { /* fine */ }
    }
  }
}

const isMain = (() => {
  // realpath both sides: a temp folder on a Mac is /var -> /private/var, and node resolves the
  // module's own path through the symlink while argv[1] keeps what was typed
  try { return !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (isMain) {
  const force = process.argv.includes("--force");
  const r = tidy({ force });
  if (process.argv.includes("--print") && r) console.log(JSON.stringify(r));
  process.exitCode = 0;
}
