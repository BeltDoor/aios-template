#!/usr/bin/env node
// storage.mjs: how much disk space Claude uses on this Mac, and a safe way to clear its leftovers.
// The terminal and VS Code twin of the Claude desktop app's /storage screen. Skill: /storage.
//
//   node storage.mjs                         report only (changes nothing)
//   node storage.mjs --json                  the report as JSON
//   node storage.mjs --clean <what>          dry run: lists what WOULD be removed, removes nothing
//   node storage.mjs --clean <what> --yes    removes exactly what the dry run listed
//
//   <what>: dead-worktrees   records of side copies whose folder is already gone (frees ~0, tidies)
//           idle-worktrees   side copies of this project with no unsaved changes and no ignored
//                            files (such as a .env settings file), untouched for 7+ days
//           old-chats        chat records older than --days (default 180), with their side folders
//           old-undo         undo snapshots older than --days (default 30)
//
// Safety, enforced here rather than left to whoever runs it:
//   - Mac only. On any other system it prints one line and touches nothing.
//   - --yes needs a dry run of the same target, --days and project from the last 30 minutes, and
//     removes only items that dry run listed and that still qualify. The receipt is used up.
//   - Nothing changed in the last 24 hours is ever selected.
//   - A side copy's branch and saved commits are kept; git itself refuses unsaved work.
//
// Side copies are read from the git project in the current folder; outside a project that part is
// skipped. Safe to run twice. Test: storage.test.mjs (scratch home folder and scratch repo only).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MAC_ONLY_LINE = 'This works on a Mac for now. Nothing was checked or deleted.';
const DAY = 86400000;
const RECEIPT_TTL_MS = 30 * 60 * 1000;
const TARGETS = ['dead-worktrees', 'idle-worktrees', 'old-chats', 'old-undo'];

function main() {
  const platform = process.env.STORAGE_TEST_PLATFORM || process.platform;
  if (platform !== 'darwin') { console.log(MAC_ONLY_LINE); return; }

  const args = process.argv.slice(2);
  const flag = (n) => args.includes(n);
  const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
  const now = Date.now();
  const HOME = os.homedir();
  const uid = typeof process.getuid === 'function' ? process.getuid() : 'user';
  const P = {
    claudeDir: path.join(HOME, '.claude'),
    projects: path.join(HOME, '.claude/projects'),
    fileHistory: path.join(HOME, '.claude/file-history'),
    plugins: path.join(HOME, '.claude/plugins'),
    settings: path.join(HOME, '.claude/settings.json'),
    desktop: path.join(HOME, 'Library/Application Support/Claude'),
    versions: path.join(HOME, '.local/share/claude/versions'),
    tmp: `/private/tmp/claude-${uid}`,
    receipts: path.join(HOME, '.claude/storage-tool'),
  };

  const git = (cwd, gitArgs) => execFileSync('git', ['-C', cwd, ...gitArgs], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let REPO = null;
  try { REPO = fs.realpathSync(git(process.cwd(), ['rev-parse', '--show-toplevel'])); } catch { REPO = null; }

  const duBytes = (p) => {
    if (!fs.existsSync(p)) return 0;
    try { return Number(execFileSync('du', ['-sk', p], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\t')[0]) * 1024; }
    catch (e) { const out = String(e.stdout || ''); return out ? Number(out.split('\t')[0]) * 1024 : 0; }
  };
  const gb = (b) => b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`;
  const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };
  // Newest change anywhere inside p, links never followed. Anything unreadable counts as changed
  // just now, so a folder that cannot be fully read is never old enough to delete.
  const newest = (p) => {
    let st;
    try { st = fs.lstatSync(p); } catch { return now; }
    let best = st.mtimeMs;
    if (st.isDirectory()) {
      let entries;
      try { entries = fs.readdirSync(p); } catch { return now; }
      for (const e of entries) { best = Math.max(best, newest(path.join(p, e))); if (best >= now) break; }
    }
    return best;
  };
  const sum = (a) => a.reduce((s, x) => s + x.bytes, 0);

  function freeDisk() {
    const line = execFileSync('df', ['-k', HOME], { encoding: 'utf8' }).trim().split('\n').pop().split(/\s+/);
    return { totalBytes: Number(line[1]) * 1024, freeBytes: Number(line[3]) * 1024 };
  }

  function autoCleanDays() {
    try { const v = JSON.parse(fs.readFileSync(P.settings, 'utf8')).cleanupPeriodDays; return Number.isFinite(v) ? v : 30; }
    catch { return 30; }
  }

  // Every chat record: <project>/<id>.jsonl plus an optional <project>/<id>/ side folder.
  function chats() {
    const out = [];
    if (!fs.existsSync(P.projects)) return out;
    for (const proj of fs.readdirSync(P.projects)) {
      const pd = path.join(P.projects, proj);
      if (!fs.statSync(pd).isDirectory()) continue;
      for (const f of fs.readdirSync(pd)) {
        if (!f.endsWith('.jsonl')) continue;
        const file = path.join(pd, f);
        const side = path.join(pd, f.slice(0, -6));
        const hasSide = fs.existsSync(side);
        const last = Math.max(newest(file), hasSide ? newest(side) : 0);
        out.push({ id: file, file, side: hasSide ? side : null, ageDays: (now - last) / DAY, bytes: fs.statSync(file).size + (hasSide ? duBytes(side) : 0) });
      }
    }
    return out;
  }

  function undoSnapshots() {
    if (!fs.existsSync(P.fileHistory)) return [];
    return fs.readdirSync(P.fileHistory).map((d) => {
      const p = path.join(P.fileHistory, d);
      return { id: p, path: p, ageDays: (now - newest(p)) / DAY };
    });
  }

  function worktrees() {
    if (!REPO) return [];
    let raw = '';
    try { raw = git(REPO, ['worktree', 'list', '--porcelain']); } catch { return []; }
    return raw.split('\n\n').filter(Boolean).map((blk) => {
      const get = (k) => (blk.split('\n').find((l) => l.startsWith(k + ' ')) || '').slice(k.length + 1);
      const p = get('worktree');
      let real = p; try { real = fs.realpathSync(p); } catch { /* gone */ }
      const main = real === REPO;
      const dead = /(^|\n)prunable/.test(blk) || !fs.existsSync(p);
      const w = { id: p, path: p, main, dead, dirty: null, ignored: [], ageDays: null, bytes: 0, branch: get('branch').replace('refs/heads/', '') || 'no branch' };
      if (!dead && !main) {
        try { w.dirty = git(p, ['status', '--porcelain']).length > 0; } catch { w.dirty = true; }
        try {
          w.ignored = git(p, ['status', '--porcelain', '--ignored=matching']).split('\n')
            .filter((l) => l.startsWith('!! ')).map((l) => l.slice(3)).filter((f) => !/(^|\/)\.DS_Store$/.test(f));
        } catch { w.ignored = ['(could not read)']; }
        let lastCommit = 0; try { lastCommit = Number(git(p, ['log', '-1', '--format=%ct'])) * 1000; } catch { /* none */ }
        w.ageDays = (now - Math.max(mtime(p), lastCommit)) / DAY;
        w.bytes = duBytes(p);
      }
      return w;
    });
  }

  // What each target would select right now.
  function candidates(target, days) {
    if (target === 'dead-worktrees') return worktrees().filter((w) => !w.main && w.dead).map((w) => ({ ...w, label: w.path, bytes: 0 }));
    if (target === 'idle-worktrees') {
      return worktrees().filter((w) => !w.main && !w.dead && !w.dirty && w.ignored.length === 0 && w.ageDays >= 7)
        .map((w) => ({ ...w, label: `${w.path} (${w.branch})` }));
    }
    if (target === 'old-chats') return chats().filter((x) => x.ageDays >= days).map((x) => ({ ...x, label: x.file }));
    if (target === 'old-undo') return undoSnapshots().filter((x) => x.ageDays >= days).map((x) => ({ ...x, label: x.path, bytes: duBytes(x.path) }));
    return [];
  }

  function report() {
    const disk = freeDisk();
    const c = chats();
    const wts = worktrees().filter((w) => !w.main);
    const live = wts.filter((w) => !w.dead);
    const versionFiles = fs.existsSync(P.versions) ? fs.readdirSync(P.versions) : [];
    const kept = live.filter((w) => w.dirty || w.ignored.length);
    const r = {
      disk,
      claudeTotalBytes: duBytes(P.claudeDir) + duBytes(P.desktop) + duBytes(P.versions) + duBytes(P.tmp) + sum(live),
      autoCleanDays: autoCleanDays(),
      rows: [
        { name: 'Chat history', bytes: duBytes(P.projects), note: `${c.length} chats` },
        { name: '  newer than 30 days', bytes: sum(c.filter((x) => x.ageDays < 30)) },
        { name: '  30 to 180 days old', bytes: sum(c.filter((x) => x.ageDays >= 30 && x.ageDays < 180)) },
        { name: '  older than 180 days', bytes: sum(c.filter((x) => x.ageDays >= 180)) },
        { name: 'Undo snapshots', bytes: duBytes(P.fileHistory) },
        { name: 'Add-ons (plugins)', bytes: duBytes(P.plugins) },
        { name: 'Desktop app data', bytes: duBytes(P.desktop) },
        { name: 'Claude Code program copies', bytes: duBytes(P.versions), note: `${versionFiles.length} kept` },
        { name: 'Temporary job folders', bytes: duBytes(P.tmp) },
        { name: 'Side copies of this project', bytes: sum(live), note: REPO ? `${live.length} on disk` : 'not in a project folder' },
      ],
      worktrees: {
        dead: wts.filter((w) => w.dead).length,
        live: live.length,
        idleClean: live.filter((w) => !w.dirty && w.ignored.length === 0 && w.ageDays >= 7).length,
        keptUnsaved: kept.length,
      },
    };
    if (flag('--json')) { console.log(JSON.stringify(r, null, 2)); return; }
    console.log(`Free on this Mac: ${gb(disk.freeBytes)} of ${gb(disk.totalBytes)}`);
    console.log(`Claude uses:      ${gb(r.claudeTotalBytes)}\n`);
    for (const row of r.rows) console.log(`${row.name.padEnd(30)} ${gb(row.bytes).padStart(9)}${row.note ? '   ' + row.note : ''}`);
    const w = r.worktrees;
    console.log(`\nReady to clear: ${w.idleClean} idle side copies (--clean idle-worktrees); ${w.dead} dead records (--clean dead-worktrees).`);
    if (w.keptUnsaved) console.log(`Kept: ${w.keptUnsaved} side copies hold unsaved changes or ignored files, so they are never selected.`);
    console.log(`Claude Code deletes chats older than ${r.autoCleanDays} days by itself (setting: cleanupPeriodDays).`);
  }

  function receiptPath(target, days) {
    const key = `${target}-${days}-${(REPO || 'none').replace(/[^A-Za-z0-9]+/g, '_')}`.slice(0, 200);
    return path.join(P.receipts, `dry-run-${key}.json`);
  }

  function clean(target) {
    if (!TARGETS.includes(target)) {
      console.error(`Unknown --clean target. Use: ${TARGETS.join(' | ')}`);
      process.exitCode = 2; return;
    }
    const usesDays = target.startsWith('old-');
    const days = Math.max(Number(opt('--days', target === 'old-undo' ? 30 : 180)) || 0, 1); // 24-hour floor
    const rp = receiptPath(target, days);
    const scope = usesDays ? `, older than ${days} days` : '';
    const list = candidates(target, days);

    if (!flag('--yes')) {
      fs.mkdirSync(P.receipts, { recursive: true });
      fs.writeFileSync(rp, JSON.stringify({ target, days, repo: REPO, at: Date.now(), items: list.map((x) => x.id) }));
      console.log(`Would remove: ${list.length} item(s), ${gb(sum(list))}  [${target}${scope}]`);
      for (const x of list) console.log(`  ${x.label}`); // every item a yes would remove, never a sample
      console.log(list.length ? 'Dry run: nothing removed. Add --yes within 30 minutes to remove exactly this list.' : 'Nothing to remove.');
      return;
    }

    let receipt = null;
    try { receipt = JSON.parse(fs.readFileSync(rp, 'utf8')); } catch { receipt = null; }
    if (!receipt || Date.now() - receipt.at > RECEIPT_TTL_MS || receipt.repo !== REPO || receipt.days !== days) {
      console.log(`Nothing removed. Run the dry run first (the same command without --yes), check the list, then add --yes within 30 minutes.`);
      process.exitCode = 3; return;
    }
    fs.rmSync(rp, { force: true }); // a receipt is good for one removal
    const listed = new Set(receipt.items);
    const go = list.filter((x) => listed.has(x.id));
    const failed = [];
    if (target === 'dead-worktrees') {
      // git prunes every dead record at once, so it runs only when that set is exactly the approved one.
      const extra = list.filter((x) => !listed.has(x.id));
      if (extra.length) {
        console.log(`Nothing removed. ${extra.length} dead record(s) appeared since the dry run. Run the dry run again.`);
        process.exitCode = 3; return;
      }
      if (go.length) try { git(REPO, ['worktree', 'prune']); } catch { failed.push('prune'); }
    } else if (target === 'idle-worktrees') {
      for (const w of go) {
        try { git(REPO, ['worktree', 'remove', w.path]); } // no --force: git refuses unsaved work
        catch { failed.push(w.path); }
      }
    } else if (target === 'old-chats') {
      for (const x of go) { fs.rmSync(x.file, { force: true }); if (x.side) fs.rmSync(x.side, { recursive: true, force: true }); }
    } else if (target === 'old-undo') {
      for (const x of go) fs.rmSync(x.path, { recursive: true, force: true });
    }
    const done = go.filter((x) => !failed.includes(x.path));
    console.log(`Removed: ${done.length} item(s), ${gb(sum(done))}  [${target}${scope}]`);
    for (const x of done.slice(0, 5)) console.log(`  ${x.label}`);
    if (done.length > 5) console.log(`  ...and ${done.length - 5} more`);
    const skipped = receipt.items.length - go.length;
    if (skipped) console.log(`Kept ${skipped} item(s) from the dry run that changed since, or no longer qualify.`);
    if (failed.length) { console.log(`Could not remove ${failed.length}: ${failed.join(', ')}`); process.exitCode = 1; }
  }

  const target = opt('--clean', null);
  if (target) clean(target); else report();
}

main();
