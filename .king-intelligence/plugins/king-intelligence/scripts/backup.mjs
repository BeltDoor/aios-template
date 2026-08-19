#!/usr/bin/env node
// King Intelligence — always-on backup & teammate sync.
// One script, two modes (wired in hooks.json):
//   node backup.mjs sync            -> SessionStart: pull a teammate's latest if behind
//   node backup.mjs save [--final]  -> Stop / SessionEnd: commit + push (debounced unless --final)
//
// Self-gates HARD: only acts inside a managed Snowball (repo root has CLAUDE.md + SKILLS.md +
// CONNECTIONS.md), with a git remote, and no `.no-autobackup` kill file. Everywhere else it is an
// instant no-op. Refuses to auto-save when the brain sits inside a cloud-sync folder (OneDrive /
// Google Drive / Dropbox) and warns instead. ALWAYS exits 0 — a backup hook must never block a
// session or lose work. Runs identically on Windows/Mac (Node, no shell builtins).
//
// SAFETY RULES (added 08/17/26 after six "cloud backup didn't finish" strandings):
//   1. NEVER write to a repo that is mid-rebase/merge or on a detached head. Committing onto a
//      half-finished rebase is what stranded the work every single time.
//   2. NEVER stash. A stash-and-walk-away on a failed pull is what leaked 27 `ki-autosync` stashes.
//   3. NEVER `rebase --abort` — it hard-resets a working tree that a concurrent session may be
//      using. `rebase --quit` + a non-forced checkout instead.
//   4. Take the shared lock (`<gitdir>/ki-backup.lock`, atomic mkdir; `flock` does not exist on
//      macOS) so a dozen writers on one brain queue instead of racing. `scripts/repo-sync.sh`
//      takes the same lock.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const MODE = process.argv[2] || "";
const FINAL = process.argv.includes("--final");
const EVT = FINAL ? "SessionEnd" : MODE === "sync" ? "SessionStart" : "Stop";
const COOLDOWN_MS = 3 * 60 * 1000; // debounce the per-turn Stop save to once / 3 min
const DRIVE_WARN_MS = 20 * 60 * 60 * 1000; // warn about a cloud-drive brain at most once / 20h
const GIT_TIMEOUT = 20000;
const LOCK_STALE_MS = 5 * 60 * 1000; // reclaim a lock whose owner died, else one crash wedges all
const LOCK_TRIES = 3;
const LOCK_WAIT_MS = 1500;

try {
  run();
} catch {
  /* never block */
}
process.exit(0);

function run() {
  const cwd = readCwd();
  if (!cwd) return;

  const root = (git(["rev-parse", "--show-toplevel"], cwd).out || "").trim();
  if (!root) return; // not a git repo -> no-op

  const isSnowball = ["CLAUDE.md", "SKILLS.md", "CONNECTIONS.md"].every((f) =>
    existsSync(join(root, f))
  );
  if (!isSnowball) return; // not a managed brain -> no-op
  if (existsSync(join(root, ".no-autobackup"))) return; // explicit kill switch (e.g. HIPAA client)

  const remote = (git(["remote", "get-url", "origin"], root).out || "").trim();
  if (!remote) return; // nothing to sync to

  if (isCloudDrivePath(root)) {
    warnDriveOnce(); // never auto-save on top of a syncing cloud drive
    return;
  }

  // RULE 1 — a repo mid-merge or off its branch is NOT safe to commit to. Refuse and say so.
  if (midOperation(root)) {
    warnMidOperationOnce();
    return;
  }

  // RULE 4 — one writer at a time.
  const lock = takeLock(root);
  if (!lock) return; // someone else is mid-backup; the next turn catches up
  try {
    if (MODE === "sync") doSync(root);
    else if (MODE === "save") doSave(root);
  } finally {
    releaseLock(lock);
  }
}

function doSync(root) {
  git(["fetch", "--quiet"], root);
  const behind = behindCount(root);
  if (behind <= 0) return; // already current -> silent

  // RULE 2 — never stash to make room for a pull. A dirty tree just waits for the save path.
  if (porcelain(root).length > 0) return;

  const branch = currentBranch(root);
  const pull = git(["pull", "--rebase", "--quiet"], root);
  if (pull.ok) {
    emit(`You're current — pulled ${behind} update${behind === 1 ? "" : "s"} from your team.`);
    return;
  }
  recoverFromFailedRebase(root, branch);
  // stay quiet on failure; the next save / end-session handles a real conflict
}

function doSave(root) {
  const tsFile = join(gitDir(root), ".ki-autosave-ts");
  if (!FINAL && withinCooldown(tsFile)) return; // debounce per-turn saves

  if (porcelain(root).length === 0) {
    touch(tsFile);
    return; // nothing to save
  }

  const branch = currentBranch(root);
  if (!branch || branch === "HEAD") return; // detached: never commit (RULE 1)

  git(["add", "-A"], root); // .gitignore keeps .env + .playwright-profile out
  const commit = git(["commit", "-m", `auto-save ${nowStamp()}`, "--no-verify"], root);
  touch(tsFile);
  if (!commit.ok) return; // nothing committed / hook race

  // Integrate a teammate's work before pushing (pull --rebase fetches first).
  // Only when an upstream exists, else the very first push has nothing to rebase onto.
  if (hasUpstream(root)) {
    const reb = git(["pull", "--rebase", "--quiet"], root);
    if (!reb.ok) {
      const conflict = /conflict|could not apply|patch failed/i.test(reb.err + reb.out);
      recoverFromFailedRebase(root, branch); // RULE 3 — quit, never abort
      if (conflict) {
        emit(
          "Your work is saved on this laptop. You and a teammate changed the same spot, so I'll sort the merge with you next time — nothing is lost."
        );
        return; // never force, never lose
      }
      // not a conflict (likely network): fall through, let the push attempt report it
    }
  }

  const push = pushNow(root, branch);
  if (!push.ok) emit(pushFailMsg(push.err));
}

// ---- safety ------------------------------------------------------------

// True when git is mid-rebase / mid-merge / mid-cherry-pick, or HEAD is detached. Writing in any
// of those states is what strands work: the commit lands on a line no branch points at.
function midOperation(root) {
  const g = gitDir(root);
  const markers = [
    "rebase-merge",
    "rebase-apply",
    "MERGE_HEAD",
    "CHERRY_PICK_HEAD",
    "REVERT_HEAD",
    "BISECT_LOG",
  ];
  if (markers.some((f) => existsSync(join(g, f)))) return true;
  return !git(["symbolic-ref", "-q", "HEAD"], root).ok; // detached head
}

// A failed `pull --rebase` leaves the repo half-rebased and off its branch. Put it back EXACTLY
// as it was, without a global hard reset — `--abort` and `checkout --force` both blow away files a
// concurrent session may be writing this second. Instead: note which files the rebase mangled,
// quit, move the branch label back over HEAD, resync the index, and restore ONLY those files.
// Leaving the repo detached or with conflict markers in the tree is what the next auto-save then
// commits, which is the whole stranding disease.
function recoverFromFailedRebase(root, branch) {
  const g = gitDir(root);
  const rebasing =
    existsSync(join(g, "rebase-merge")) || existsSync(join(g, "rebase-apply"));
  const detached = !git(["symbolic-ref", "-q", "HEAD"], root).ok;
  if (!rebasing && !detached) return; // nothing to undo

  const mangled = (git(["diff", "--name-only", "--diff-filter=U"], root).out || "")
    .trim()
    .split("\n")
    .filter(Boolean);

  if (rebasing) git(["rebase", "--quit"], root);
  if (!branch || branch === "HEAD") return; // no branch to go home to; the guard blocks future saves

  git(["symbolic-ref", "HEAD", "refs/heads/" + branch], root); // label back on the branch
  git(["reset", "--mixed", "-q", "HEAD"], root); // index matches the branch; working tree untouched
  for (const f of mangled) git(["checkout", "-q", "HEAD", "--", f], root); // drop the marker soup
}

function takeLock(root) {
  const lock = join(gitDir(root), "ki-backup.lock");
  for (let i = 0; i < LOCK_TRIES; i++) {
    try {
      mkdirSync(lock);
      return lock;
    } catch {}
    try {
      if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) {
        rmSync(lock, { recursive: true, force: true });
        continue;
      }
    } catch {}
    sleepMs(LOCK_WAIT_MS);
  }
  return null;
}

function releaseLock(lock) {
  try {
    rmSync(lock, { recursive: true, force: true });
  } catch {}
}

function sleepMs(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {}
}

// ---- git plumbing -------------------------------------------------------

function git(args, cwd) {
  try {
    const out = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      timeout: GIT_TIMEOUT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, out, err: "" };
  } catch (e) {
    return { ok: false, out: (e.stdout || "").toString(), err: (e.stderr || e.message || "").toString() };
  }
}

function gitDir(root) {
  const d = (git(["rev-parse", "--absolute-git-dir"], root).out || "").trim();
  return d || join(root, ".git");
}

function currentBranch(root) {
  return (git(["rev-parse", "--abbrev-ref", "HEAD"], root).out || "").trim();
}

function porcelain(root) {
  return (git(["status", "--porcelain"], root).out || "").trim();
}

function hasUpstream(root) {
  return git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], root).ok;
}

function behindCount(root) {
  if (!hasUpstream(root)) return 0;
  const r = git(["rev-list", "--count", "HEAD..@{u}"], root);
  return r.ok ? parseInt((r.out || "0").trim(), 10) || 0 : 0;
}

function pushNow(root, branch) {
  let p = git(["push", "--quiet"], root);
  if (!p.ok && /non-fast-forward|fetch first|rejected/i.test(p.err)) {
    // a teammate pushed between our rebase and our push: integrate once, try once more
    const reb = git(["pull", "--rebase", "--quiet"], root);
    if (reb.ok) p = git(["push", "--quiet"], root);
    else recoverFromFailedRebase(root, branch || currentBranch(root));
  }
  if (!p.ok) {
    const b = branch || currentBranch(root) || "HEAD";
    if (b !== "HEAD") p = git(["push", "--quiet", "-u", "origin", b], root);
  }
  return p;
}

function pushFailMsg(err = "") {
  const e = err.toLowerCase();
  if (e.includes("authentication") || e.includes("could not read username") || e.includes("permission denied"))
    return "Your work is saved on this laptop, but the cloud sign-in looks expired. Reconnect GitHub when you can — nothing is lost.";
  if (e.includes("could not resolve") || e.includes("unable to access") || e.includes("timed out") || e.includes("network"))
    return "Your work is saved on this laptop. The internet looks flaky, so the cloud copy will catch up later.";
  return "Your work is saved on this laptop; the cloud backup didn't finish this time and will retry next.";
}

// ---- helpers ------------------------------------------------------------

function readCwd() {
  let raw = "";
  try {
    raw = readFileSync(0, "utf8");
  } catch {}
  if (raw) {
    try {
      const j = JSON.parse(raw);
      if (j && j.cwd) return j.cwd;
    } catch {}
  }
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function isCloudDrivePath(root) {
  return /[\\/](OneDrive[^\\/]*|Google ?Drive|My Drive|GoogleDrive|Dropbox)([\\/]|$)/i.test(root);
}

function warnDriveOnce() {
  warnOnce(
    ".last-drive-warn",
    DRIVE_WARN_MS,
    "Heads up: your brain is saved inside a cloud drive (OneDrive / Google Drive / Dropbox). That can corrupt it and it fights with automatic backup. Ask me to move it to a safe local folder — your work is fine in the meantime."
  );
}

function warnMidOperationOnce() {
  warnOnce(
    ".last-midop-warn",
    30 * 60 * 1000,
    "Backup paused on purpose: your files are safe on this laptop, but the brain is part-way through combining changes from another window, and saving on top of that is how work goes missing. Ask me to finish the merge when you're ready."
  );
}

function warnOnce(markerName, everyMs, msg) {
  try {
    const data = process.env.CLAUDE_PLUGIN_DATA;
    if (!data) return emit(msg);
    const marker = join(data, markerName);
    let last = 0;
    try {
      last = parseInt(readFileSync(marker, "utf8"), 10) || 0;
    } catch {}
    if (Date.now() - last < everyMs) return;
    try {
      mkdirSync(data, { recursive: true });
      writeFileSync(marker, String(Date.now()));
    } catch {}
    emit(msg);
  } catch {}
}

function withinCooldown(tsFile) {
  try {
    const last = parseInt(readFileSync(tsFile, "utf8"), 10) || 0;
    return Date.now() - last < COOLDOWN_MS;
  } catch {
    return false;
  }
}

function touch(tsFile) {
  try {
    writeFileSync(tsFile, String(Date.now()));
  } catch {}
}

function nowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${String(d.getFullYear()).slice(2)} - ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function emit(msg) {
  try {
    process.stdout.write(
      JSON.stringify({ hookSpecificOutput: { hookEventName: EVT, additionalContext: "Backup: " + msg } })
    );
  } catch {}
}
