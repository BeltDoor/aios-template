#!/usr/bin/env node
// safety-net.mjs — the real undo behind the Safety-Net proof-skill.
//
// The brain is a git repo, so every saved state is a real restore point and any change can be
// rolled back. This wraps that in three plain commands so a non-technical owner never types git,
// and so the "watch me break something and put it back" proof is real, not a claim.
//
//   node safety-net.mjs snapshot [--label "..."]   -> save a labeled restore point (a real commit)
//   node safety-net.mjs restore <file> [--from REF] -> roll one file back to a saved point
//   node safety-net.mjs prove                       -> self-test: snapshot, damage a sentinel, restore it, verify byte-identical
//
// `prove` only ever touches its own sentinel file under .safety-net/, never the owner's work, so it
// is safe to run on a live business. It proves the SAME mechanism that protects everything else.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const a = process.argv.slice(2)
const cmd = a[0]
const opt = (f, d = null) => { const i = a.indexOf(f); return i >= 0 && a[i + 1] ? a[i + 1] : d }
// pipe stderr (don't inherit) so git's raw "error: pathspec ..." jargon never reaches the owner;
// we catch the throw and print a plain-English line instead.
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const gitOk = (...args) => { try { git(...args); return true } catch { return false } }
const stamp = opt('--date', new Date().toISOString().slice(0, 10))

function ensureRepo() {
  if (!gitOk('rev-parse', '--is-inside-work-tree')) { console.error('Not a git repo. The safety net needs your brain to be a saved (git-tracked) folder.'); process.exit(2) }
}

function snapshot() {
  ensureRepo()
  const label = opt('--label', 'manual snapshot')
  git('add', '-A')
  const dirty = git('status', '--porcelain')
  let point
  if (dirty) { git('-c', 'user.name=Safety Net', '-c', 'user.email=safety-net@local', 'commit', '-q', '-m', `Safety-Net snapshot: ${label} · ${stamp}`); point = git('rev-parse', '--short', 'HEAD') }
  else { point = git('rev-parse', '--short', 'HEAD') }
  console.log(JSON.stringify({ ok: true, action: 'snapshot', label, restorePoint: point, hadChanges: !!dirty,
    headline: dirty ? `Saved. Restore point ${point} — "${label}".` : `Nothing new to save; your latest restore point is ${point}.` }, null, 2))
}

function restore() {
  ensureRepo()
  const file = a[1]
  if (!file || file.startsWith('--')) { console.error('usage: restore <file> [--from REF]'); process.exit(2) }
  const from = opt('--from', 'HEAD')
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
  try { git('restore', '--source', from, '--worktree', '--', file) }
  catch { console.error(`Couldn't find "${file}" in your saved history. Check the name and try again.`); process.exit(1) }
  const after = fs.readFileSync(file, 'utf8')
  const changed = before !== after
  console.log(JSON.stringify({ ok: true, action: 'restore', file, from, changed,
    headline: changed ? `Rolled ${file} back to its saved state (${from}).` : `${file} was already at its saved state, nothing to undo.` }, null, 2))
}

// self-contained proof. Touches ONLY .safety-net/sentinel.md.
function prove() {
  ensureRepo()
  const dir = '.safety-net'
  const sentinel = path.join(dir, 'sentinel.md')
  const good = `# Safety-Net sentinel\n\nThis line stands in for your real work: a quote, a client note, a month of books.\nIf the system can lose THIS and get it back, it can do the same for anything.\n`
  const steps = []

  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(sentinel, good)
  git('add', sentinel)
  const madeCommit = !!git('status', '--porcelain', '--', sentinel)
  if (madeCommit) {
    git('-c', 'user.name=Safety Net', '-c', 'user.email=safety-net@local', 'commit', '-q', '-m', `Safety-Net self-test restore point · ${stamp}`)
  }
  const point = git('rev-parse', '--short', 'HEAD')
  steps.push({ step: 1, did: madeCommit ? 'Saved a new restore point' : 'Used your latest saved restore point', restorePoint: point })

  // 2. simulate a disaster on the working copy (NOT committed)
  fs.writeFileSync(sentinel, 'EVERYTHING IS GONE — file clobbered by an accident.\n')
  const damaged = fs.readFileSync(sentinel, 'utf8').trim()
  steps.push({ step: 2, did: 'Damaged the file on purpose', nowReads: damaged })

  // 3. restore from the saved point
  git('restore', '--source', 'HEAD', '--worktree', '--', sentinel)
  const restored = fs.readFileSync(sentinel, 'utf8')
  const pass = restored === good
  steps.push({ step: 3, did: 'Restored from the saved point', recovered: pass, bytesMatch: restored.length === good.length })

  console.log(JSON.stringify({
    ok: pass, action: 'prove', restorePoint: point, steps,
    headline: pass
      ? `Proven: damaged a file, rolled it back from restore point ${point}, recovered it byte-for-byte. Nothing was lost.`
      : `FAILED to recover the sentinel — investigate before trusting the safety net.`,
  }, null, 2))
  process.exit(pass ? 0 : 1)
}

switch (cmd) {
  case 'snapshot': snapshot(); break
  case 'restore': restore(); break
  case 'prove': prove(); break
  default: console.error('commands: snapshot [--label "..."] | restore <file> [--from REF] | prove'); process.exit(2)
}
