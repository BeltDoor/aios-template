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

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const MODE = process.argv[2] || "";
const FINAL = process.argv.includes("--final");
const EVT = FINAL ? "SessionEnd" : MODE === "sync" ? "SessionStart" : "Stop";
const COOLDOWN_MS = 3 * 60 * 1000; // debounce the per-turn Stop save to once / 3 min
const DRIVE_WARN_MS = 20 * 60 * 60 * 1000; // warn about a cloud-drive brain at most once / 20h
const GIT_TIMEOUT = 20000;

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

  if (MODE === "sync") doSync(root);
  else if (MODE === "save") doSave(root);
}

function doSync(root) {
  git(["fetch", "--quiet"], root);
  const behind = behindCount(root);
  if (behind <= 0) return; // already current -> silent

  const dirty = porcelain(root).length > 0;
  if (dirty) git(["stash", "push", "-u", "-m", "ki-autosync"], root);
  const pull = git(["pull", "--rebase", "--quiet"], root);
  if (dirty) git(["stash", "pop"], root);

  if (pull.ok) {
    emit(`You're current — pulled ${behind} update${behind === 1 ? "" : "s"} from your team.`);
  }
  // if pull failed, stay quiet here; the next save / end-session handles a real conflict
}

function doSave(root) {
  const tsFile = join(root, ".git", ".ki-autosave-ts");
  if (!FINAL && withinCooldown(tsFile)) return; // debounce per-turn saves

  if (porcelain(root).length === 0) {
    touch(tsFile);
    return; // nothing to save
  }

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
      git(["rebase", "--abort"], root); // harmless no-op if no rebase is in progress
      if (conflict) {
        emit(
          "Your work is saved on this laptop. You and a teammate changed the same spot, so I'll sort the merge with you next time — nothing is lost."
        );
        return; // never force, never lose
      }
      // not a conflict (likely network): fall through, let the push attempt report it
    }
  }

  const push = pushNow(root);
  if (!push.ok) emit(pushFailMsg(push.err));
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

function pushNow(root) {
  let p = git(["push", "--quiet"], root);
  if (!p.ok) {
    const branch = (git(["rev-parse", "--abbrev-ref", "HEAD"], root).out || "").trim() || "HEAD";
    p = git(["push", "--quiet", "-u", "origin", branch], root);
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
  try {
    const data = process.env.CLAUDE_PLUGIN_DATA;
    if (!data) return;
    const marker = join(data, ".last-drive-warn");
    let last = 0;
    try {
      last = parseInt(readFileSync(marker, "utf8"), 10) || 0;
    } catch {}
    if (Date.now() - last < DRIVE_WARN_MS) return;
    try {
      mkdirSync(data, { recursive: true });
      writeFileSync(marker, String(Date.now()));
    } catch {}
    emit(
      "Heads up: your brain is saved inside a cloud drive (OneDrive / Google Drive / Dropbox). That can corrupt it and it fights with automatic backup. Ask me to move it to a safe local folder — your work is fine in the meantime."
    );
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
