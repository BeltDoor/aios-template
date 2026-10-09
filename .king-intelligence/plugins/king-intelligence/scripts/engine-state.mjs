// King Intelligence - the hours engine's locks, its mark, and its test seams (10/7/26, cut down 10/8/26).
//
// The week-long "dark activation" that used to live here (watching for an older toolkit window
// before switching on) is gone: the engine now switches over at its first run with one snapshot
// (measure-sessions.mjs, ONE SWITCH-OVER), so there is no overlap to watch. What remains:
//   - ENGINE_MARK, the "ki2" every report from a switched-over machine carries
//   - the process-identity locks every write of this engine's own files holds
//   - fencedRename, faultPoint (test seams)
//
// Created 10/07/26 - 21:10 EDT.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

export const ENGINE_MARK = "ki2";
/**
 * Test seam: KI_FAIL_AT=<point> throws at that named point, so a test can interrupt activation
 * between any two of its writes. Unset (always, on a member's machine) it does nothing.
 */
export function faultPoint(name) {
  if (process.env.KI_FAIL_AT && process.env.KI_FAIL_AT === name) throw new Error("injected failure at " + name);
}

/** The same lock, held across awaited work (a whole compat measure-write-report). */
export async function withLockAsync(dir, fn, waitMs = 20000) {
  const lock = path.join(dir, "engine-state.lock");
  const until = Date.now() + waitMs;
  fs.mkdirSync(dir, { recursive: true });
  let token = null;
  for (;;) {
    token = tryAcquire(lock);
    if (token === FAILED) return BUSY;
    if (token) break;
    if (Date.now() >= until) return BUSY;
    await new Promise((r) => setTimeout(r, 30));
  }
  try { return await fn(); } finally { release(lock, token); }
}

// ---------- owned locks, freed by IDENTITY, never by time (10/8/26, rebuilt in round 3) ----------
// Two review rounds found that any rule of the form "a lock this old is abandoned" can free a lock
// whose owner is merely slow or asleep (a laptop lid closed mid-sweep), and the woken owner then
// races its successor. So time plays no part any more. A lock is freed only when the exact process
// INSTANCE that took it is gone.
//
//   - The token is "<pid>:<start>:<random>", where <start> is the owner's own start time. A pid
//     the system has since handed to another process is told apart by its different start time.
//   - Taking a lock is ONE atomic step that can only succeed while no lock file exists: a fully
//     written temporary file is hard-linked into place. Where links are unsupported no lock is
//     ever taken (fail closed). The lock file is never empty or half written.
//   - Deleting a lock (the owner's release, or clearing a dead instance's lock) happens only while
//     holding <lock>.guard, taken the same way. Under the guard the lock is re-read and deleted only
//     if it still holds exactly the token judged. Every deletion holds the guard and a new lock can
//     only appear once the old file is gone, so nothing can change between that re-read and the
//     delete. The guard itself is cleared only when ITS owner instance is gone.
//   - A live owner, however long it runs or sleeps, is never displaced.
//   - Every rename into the hours files still goes through fencedRename, which refuses if a lock
//     this process holds no longer carries its token (cheap, and no longer the thing safety rests on).
// Stated residuals: a dead guard cleared by two processes in the same instant (needs a crash inside
// the guard's few-microsecond section first); start times are read to the second, so a pid reused by a new process within
// the same second as the old one died reads as the old owner alive (the lock then waits for that
// process to exit); where the start time cannot be read at all, liveness falls back to "a process
// with this pid exists"; fencedRename's check and rename are two system calls apart.
const FAILED = Symbol("lock-failed");
const held = new Map(); // lock path -> this process's token
const START_TOLERANCE_MS = 2000;
const OWN_START = Math.round(Date.now() - process.uptime() * 1000);

export class LockLost extends Error {}

const startCache = new Map(); // pid -> start ms (or null: could not be read)
/** The start time of a running process, in ms; undefined when it is not running; null when unknowable. */
function startOf(pid) {
  if (startCache.has(pid)) return startCache.get(pid);
  if (process.env.KI_TEST_START_OF) { // test seam: "<pid>=<ms>,..."
    for (const kv of process.env.KI_TEST_START_OF.split(",")) { const [k, v] = kv.split("="); if (Number(k) === pid) return Number(v); }
  }
  let out;
  try {
    if (process.platform === "win32") {
      const t = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        `$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($p) { $p.StartTime.ToUniversalTime().ToString('o') }`],
        { encoding: "utf8", timeout: 5000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }).trim();
      out = t ? Date.parse(t) : undefined;
    } else {
      const t = execFileSync("ps", ["-o", "lstart=", "-p", String(pid)],
        { encoding: "utf8", timeout: 5000, env: { ...process.env, LC_ALL: "C" }, stdio: ["ignore", "pipe", "ignore"] }).trim();
      out = t ? Date.parse(t) : undefined;
    }
    if (out !== undefined && !Number.isFinite(out)) out = null;
  } catch (e) {
    // ps exits 1 for "no such process"; anything else (no ps at all) means unknowable
    out = e && typeof e.status === "number" && e.status === 1 ? undefined : null;
  }
  if (out !== undefined) startCache.set(pid, out);
  return out;
}

function pidExists(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return !!e && e.code === "EPERM"; }
}

/** Is the process instance that wrote this token still running? */
function instanceAlive(token) {
  const parts = String(token || "").split(":");
  const pid = Number.parseInt(parts[0], 10), start = Number(parts[1]);
  if (!Number.isInteger(pid) || pid <= 0 || !Number.isFinite(start)) return false; // not a token this code wrote
  if (pid === process.pid) return Math.abs(start - OWN_START) <= START_TOLERANCE_MS;
  if (!pidExists(pid)) return false;
  const s = startOf(pid);
  if (s === undefined) return false;
  if (s === null) return true; // cannot tell: assume the owner is alive (it releases on exit)
  return Math.abs(s - start) <= START_TOLERANCE_MS;
}

const readOrNull = (f) => { try { return fs.readFileSync(f, "utf8"); } catch { return null; } };
const newToken = () => process.pid + ":" + OWN_START + ":" + crypto.randomBytes(8).toString("hex");
const testPause = (name) => {
  const n = Number(process.env[name]);
  if (!(n > 0)) return;
  if (process.env.KI_TEST_PAUSE_MARK) { try { fs.writeFileSync(process.env.KI_TEST_PAUSE_MARK, String(process.pid)); } catch { /* test only */ } }
  nap(n);
};

/** Atomically create `file` holding `token`. true = created, false = it exists, FAILED = other error. */
function createWith(file, token) {
  const tmp = file + "." + crypto.randomBytes(6).toString("hex") + ".new";
  try {
    fs.writeFileSync(tmp, token, { flag: "wx" });
    try { fs.linkSync(tmp, file); return true; }
    catch (e) {
      // FAIL CLOSED (Codex round 3): without hard links there is no way to publish the token in
      // one step, and a half-written lock could be judged dead. No lock means BUSY: the work waits
      // for the next run instead of risking two owners. APFS, HFS+, NTFS and ext4 all have links.
      return e && e.code === "EEXIST" ? false : FAILED;
    }
  } catch { return FAILED; }
  finally { try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ } }
}

/** Run fn while holding <lock>.guard. Returns fn's result, or undefined when the guard could not be had. */
function withGuard(lock, fn, waitMs = 3000) {
  const g = lock + ".guard";
  const until = Date.now() + waitMs;
  for (;;) {
    const tok = newToken();
    const c = createWith(g, tok);
    if (c === FAILED) return undefined;
    if (c === true) {
      try { return fn(); } finally { if (readOrNull(g) === tok) { try { fs.rmSync(g, { force: true }); } catch { /* ignore */ } } }
    }
    const seen = readOrNull(g);
    if (seen !== null && !instanceAlive(seen)) {
      // its owner instance is gone, so it can never release it (stated residual: two processes
      // clearing the same dead guard in the same instant could both end up holding it; that needs a
      // process to die inside the guard's few-microsecond section first)
      if (readOrNull(g) === seen) { try { fs.rmSync(g, { force: true }); } catch { /* ignore */ } }
      continue;
    }
    if (Date.now() >= until) return undefined;
    nap(5);
  }
}

/** One attempt. Returns the owner token on success, null when held (or just cleared: try again), FAILED on a filesystem error. */
export function tryAcquire(lock) {
  const token = newToken();
  const c = createWith(lock, token);
  if (c === true) { held.set(lock, token); return token; }
  if (c === FAILED) return FAILED;
  const seen = readOrNull(lock);
  if (seen === null || instanceAlive(seen)) return null;
  withGuard(lock, () => {
    if (readOrNull(lock) !== seen) return; // released, or already cleared and retaken
    testPause("KI_TEST_RECLAIM_PAUSE_MS");
    try { fs.rmSync(lock, { force: true }); } catch { /* ignore */ }
  });
  return null; // the next attempt creates it
}

/** Remove the lock only while it is still this owner's. */
export function release(lock, token) {
  if (held.get(lock) === token) held.delete(lock);
  if (!token) return;
  withGuard(lock, () => {
    if (readOrNull(lock) === token) { try { fs.rmSync(lock, { force: true }); } catch { /* ignore */ } }
  }, 30000);
}

/**
 * The fence: rename tmp onto dest only while every lock this process holds still carries its
 * token. Otherwise remove tmp and throw LockLost.
 */
export function fencedRename(tmp, dest) {
  assertHeld(tmp);
  fs.renameSync(tmp, dest);
}
/** Throw LockLost (removing `tmp`, if given) unless every lock this process holds still carries its token. */
export function assertHeld(tmp = null) {
  for (const [lock, token] of held) {
    if (readOrNull(lock) !== token) {
      if (tmp) { try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ } }
      throw new LockLost("lock " + path.basename(lock) + " is no longer this process's; this write was refused");
    }
  }
}

// ---------- the engine lock (engine-state.lock): the switch-over and the install number ----------
export const BUSY = Symbol("busy");
const nap = (n) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n); } catch { /* spin */ } };
export function withLock(dir, fn, waitMs = 5000) {
  const lock = path.join(dir, "engine-state.lock");
  const until = Date.now() + waitMs;
  let token = null;
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* reported below */ }
  for (;;) {
    token = tryAcquire(lock);
    if (token === FAILED) return BUSY;
    if (token) break;
    if (Date.now() >= until) return BUSY;
    nap(20);
  }
  try { return fn(); } finally { release(lock, token); }
}
