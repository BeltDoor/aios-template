#!/usr/bin/env node
// King Intelligence — always-on backup & teammate sync.
// One script, two modes (wired in hooks.json):
//   node backup.mjs sync            -> SessionStart: merge a teammate's latest if behind
//   node backup.mjs save [--final]  -> Stop / SessionEnd: commit + push (debounced unless --final)
//
// Self-gates HARD: only acts inside a managed Snowball (repo root has CLAUDE.md + SKILLS.md +
// CONNECTIONS.md), with a git remote, and no `.no-autobackup` kill file. Everywhere else it is an
// instant no-op. Refuses to auto-save when the brain sits inside a cloud-sync folder (OneDrive /
// Google Drive / Dropbox) and warns instead. ALWAYS exits 0 — a backup hook must never block a
// session or lose work. Runs identically on Windows/Mac (Node, no shell builtins).
//
// SAFETY RULES (08/17/26 after six "cloud backup didn't finish" strandings; RULE 3 rewritten
// 08/19/26 after the working-tree REWIND defect fired 21x in one day):
//   1. NEVER write to a repo that is mid-rebase/merge or on a detached head. Committing onto a
//      half-finished operation is what stranded the work every single time.
//   2. NEVER stash. A stash-and-walk-away on a failed pull is what leaked 27 `ki-autosync` stashes.
//   3. NEVER `pull --rebase`. A rebase BEGINS by checking out the upstream commit, which rewrites
//      every locally-newer file in the LIVE working tree to the teammate's OLDER content for the
//      whole rebase (reflog-proven: silent deletions and reverted edits, 8/18-8/19/26). Integrate
//      with fetch + `merge @{u}` instead: merge writes ONLY paths the upstream side changed,
//      refuses up front (touching nothing) when uncommitted edits overlap those paths, and on
//      conflict `merge --abort` restores the exact pre-merge tree — safe here because we only
//      merge right after committing, so that tree is our own fresh save. (`rebase --abort` stays
//      banned: a failed rebase's tree is ALREADY rewound before you could abort; merge has no
//      such window.)
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

  // RULE 3 — merge, never `pull --rebase`. From a clean tree this fast-forwards when we have
  // nothing local (every touched file moves FORWARD to the teammate's newer content) or makes a
  // merge commit when we're also ahead; the next save pushes it. A file dirtied mid-flight that
  // overlaps the merge makes git refuse before touching anything.
  const merge = git(["merge", "--no-edit", "--no-verify", "--quiet", "@{u}"], root);
  if (merge.ok) {
    emit(`You're current — pulled ${behind} update${behind === 1 ? "" : "s"} from your team.`);
    return;
  }
  recoverFromFailedMerge(root);
  // stay quiet on failure; the next save / end-session handles a real conflict
}

function doSave(root) {
  const tsFile = join(gitDir(root), ".ki-autosave-ts");
  if (!FINAL && withinCooldown(tsFile)) return; // debounce per-turn saves

  if (porcelain(root).length === 0) {
    touch(tsFile);
    // A clean tree can still hold unpushed commits (a conflict deferral a human then resolved,
    // or a push that failed offline). Push them so the cloud copy converges instead of waiting
    // for the next edit. Cheap when there is nothing to push (one local git call).
    if (aheadCount(root) > 0) {
      const p = pushNow(root, currentBranch(root));
      if (!p.ok) emit(pushFailMsg(p.err));
    }
    return; // nothing to save
  }

  const branch = currentBranch(root);
  if (!branch || branch === "HEAD") return; // detached: never commit (RULE 1)

  git(["add", "-A"], root); // .gitignore keeps .env + .playwright-profile out
  const commit = git(["commit", "-m", `auto-save ${nowStamp()}`, "--no-verify"], root);
  touch(tsFile);
  if (!commit.ok) return; // nothing committed / hook race

  // Fold a teammate's pushes in before pushing — by MERGE, never rebase (RULE 3). Self-gates
  // on an upstream existing, else the very first push has nothing to integrate.
  const integ = integrateUpstream(root);
  if (integ.conflict) {
    emit(
      "Your work is saved on this laptop. You and a teammate changed the same spot, so I'll sort the merge with you next time — nothing is lost."
    );
    return; // never force, never lose; the tree still shows OUR content, exactly as committed
  }
  // non-conflict failure (network, or a mid-flight write overlapping the merge — git refused
  // and touched nothing): fall through, let the push attempt report it

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

// Fold the teammate's pushes into ours without EVER rewinding the live working tree.
// fetch + merge, never `pull --rebase` (RULE 3): merge computes the result in memory and then
// writes ONLY paths the UPSTREAM side changed since the merge base; a path only WE changed is
// never written, so a rewind is structurally impossible. If an uncommitted edit overlaps a
// merge-touched path, git refuses up front and changes nothing. Returns { ok, conflict }.
function integrateUpstream(root) {
  if (!hasUpstream(root)) return { ok: true, conflict: false };
  git(["fetch", "--quiet"], root);
  if (behindCount(root) <= 0) return { ok: true, conflict: false }; // nothing to fold in
  const merge = git(["merge", "--no-edit", "--no-verify", "--quiet", "@{u}"], root);
  if (merge.ok) return { ok: true, conflict: false };
  // MERGE_HEAD present = the merge started and hit real conflicts. Absent = git refused before
  // touching anything (dirty overlap / network / odd state) and there is nothing to undo.
  const conflict = existsSync(join(gitDir(root), "MERGE_HEAD"));
  recoverFromFailedMerge(root);
  return { ok: false, conflict };
}

// A conflicted merge must never be left behind — midOperation() would (rightly) pause every
// future backup. `merge --abort` restores the EXACT pre-merge tree, which is safe here because
// we only merge right after committing: the pre-merge tree is our own fresh save. It also
// PRESERVES files a concurrent writer dirtied that the merge didn't touch. The one case it
// refuses ("entry not uptodate"): a path the merge staged clean that a concurrent writer then
// edited inside this sub-second window. For those: snapshot the writer's bytes in memory, sync
// the path to the index (merged content — FORWARD, never older), abort, then put the bytes
// back as ordinary unstaged edits for the next save to commit. Nothing lost, nothing mid-merge.
function recoverFromFailedMerge(root) {
  const g = gitDir(root);
  if (!existsSync(join(g, "MERGE_HEAD"))) return; // merge never touched the tree
  if (git(["merge", "--abort"], root).ok) return; // the common case: exact restore

  const saved = [];
  for (const f of dirtyNonConflictPaths(root)) {
    try {
      saved.push({ f, data: readFileSync(join(root, f)) });
    } catch {}
    git(["checkout", "-q", "--", f], root); // index = merged = forward content, never older
  }
  const aborted = git(["merge", "--abort"], root).ok;
  for (const s of saved) {
    try {
      writeFileSync(join(root, s.f), s.data);
    } catch {}
  }
  if (!aborted) warnMidOperationOnce(); // last resort: defer to a human; work untouched on disk
}

// Worktree-side edits (concurrent writers) on paths that are NOT merge-conflicted. Conflicted
// paths are excluded on purpose: --abort resets them cleanly, and resurrecting their contents
// would re-plant conflict-marker soup for the next auto-save to commit (the stranding disease).
function dirtyNonConflictPaths(root) {
  const raw = git(["status", "--porcelain", "-z"], root).out || "";
  const parts = raw.split("\0");
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (!e || e.length < 4) continue;
    const x = e[0], y = e[1], f = e.slice(3);
    if (x === "R" || x === "C") i++; // rename/copy entries carry a second, origin path
    if (x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D")) continue;
    if (y === "M" || y === "D" || y === "T") out.push(f);
  }
  return out;
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

function aheadCount(root) {
  if (!hasUpstream(root)) return 0;
  const r = git(["rev-list", "--count", "@{u}..HEAD"], root);
  return r.ok ? parseInt((r.out || "0").trim(), 10) || 0 : 0;
}

function pushNow(root, branch) {
  let p = git(["push", "--quiet"], root);
  if (!p.ok && /non-fast-forward|fetch first|rejected/i.test(p.err)) {
    // a teammate pushed between our merge and our push: fold theirs in once (merge, never
    // rebase — RULE 3) and try once more. A conflict here just defers to the next save.
    if (integrateUpstream(root).ok) p = git(["push", "--quiet"], root);
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
