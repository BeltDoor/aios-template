#!/usr/bin/env node
/**
 * endless.mjs — arm, inspect, and release endless runs. Created 08/21/26 - 16:36 EDT.
 *
 *   node scripts/endless.mjs arm --folder <dir> [--label "..."] [--hours 12] [--max-cycles 400]
 *   node scripts/endless.mjs status [--all]
 *   node scripts/endless.mjs release [--all]
 *   node scripts/endless.mjs check <path/to/LOOP-PROMPT.md>
 *
 * `arm` is run BY the looping window itself as its first action — it needs that
 * window's own CLAUDE_CODE_SESSION_ID, which only exists inside that session.
 * Once armed, the endless-guard Stop hook refuses to let the window stop.
 *
 * `check` is the paste-guard: it refuses a loop file that hands the user a payload
 * instead of a path, and prints the exact one-line launch text.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const STATE_DIR = path.join(ROOT, '.claude', 'endless');
const MAX_LAUNCH_LINE = 220;  // Claude Code's input box is fine with this; a file is not.

const args = process.argv.slice(2);
const cmd = (args[0] || 'status').toLowerCase();

function flag(name, fallback = null) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
function die(msg) { console.error(msg); process.exit(1); }
function fmtLeft(ms) {
  if (ms == null) return 'no time limit';
  if (ms <= 0) return 'expired';
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h ${m}m left` : `${m}m left`;
}

// ---------------------------------------------------------------- arm
function arm() {
  const sid = process.env.CLAUDE_CODE_SESSION_ID;
  if (!sid) die('Cannot arm: no session id. Run this from inside the Claude Code window that will do the looping.');

  const folderArg = flag('folder');
  if (!folderArg || folderArg === true) die('Cannot arm: --folder <dir> is required.');
  const folder = path.resolve(ROOT, folderArg);
  if (!fs.existsSync(folder)) die(`Cannot arm: ${folder} does not exist.`);

  const loopPrompt = path.join(folder, 'LOOP-PROMPT.md');
  if (!fs.existsSync(loopPrompt)) die(`Cannot arm: no LOOP-PROMPT.md in ${folder}.`);

  const hours = Number(flag('hours', 12));
  if (!Number.isFinite(hours) || hours <= 0 || hours > 72) die('Cannot arm: --hours must be a number between 1 and 72.');
  const maxCycles = Number(flag('max-cycles', 400));

  fs.mkdirSync(STATE_DIR, { recursive: true });
  const state = {
    label: flag('label', path.basename(folder)),
    session_id: sid,
    folder,
    loop_prompt: loopPrompt,
    progress_file: path.join(folder, 'PROGRESS.md'),
    armed_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + hours * 3600000).toISOString(),
    hours,
    max_cycles: maxCycles,
    iterations: 0,
  };
  fs.writeFileSync(path.join(STATE_DIR, `${sid}.json`), JSON.stringify(state, null, 2));

  console.log(`ARMED: "${state.label}"`);
  console.log(`This window can no longer stop on its own. It will keep picking new work until you type "stop".`);
  console.log(`Safety limits: ${hours}h wall clock, ${maxCycles} work cycles.`);
  console.log(`Progress file: ${state.progress_file}`);
}

// ---------------------------------------------------------------- status
function status() {
  if (!fs.existsSync(STATE_DIR)) return console.log('No endless runs have ever been armed here.');
  const files = fs.readdirSync(STATE_DIR).filter((f) => f.endsWith('.json'));
  const active = files.filter((f) => !f.endsWith('.finished.json'));
  if (!active.length) { console.log('No endless run is currently armed.'); }
  for (const f of active) {
    const s = JSON.parse(fs.readFileSync(path.join(STATE_DIR, f), 'utf8'));
    const left = s.expires_at ? Date.parse(s.expires_at) - Date.now() : null;
    const mine = s.session_id === process.env.CLAUDE_CODE_SESSION_ID ? '  (this window)' : '';
    console.log(`ACTIVE  "${s.label}"${mine}`);
    console.log(`        ${s.iterations} work cycles so far, ${fmtLeft(left)}, cap ${s.max_cycles}`);
    console.log(`        last continued: ${s.last_continue_at || 'not yet'}`);
    console.log(`        progress: ${s.progress_file}`);
  }
  if (flag('all')) {
    for (const f of files.filter((x) => x.endsWith('.finished.json'))) {
      const s = JSON.parse(fs.readFileSync(path.join(STATE_DIR, f), 'utf8'));
      console.log(`DONE    "${s.label}" — ${s.iterations} cycles, armed ${s.armed_at}`);
    }
  }
}

// ---------------------------------------------------------------- release
function release() {
  if (!fs.existsSync(STATE_DIR)) return console.log('Nothing to release.');
  const sid = process.env.CLAUDE_CODE_SESSION_ID;
  const all = flag('all') === true;
  const files = fs.readdirSync(STATE_DIR)
    .filter((f) => f.endsWith('.json') && !f.endsWith('.finished.json'))
    .filter((f) => all || f === `${sid}.json`);
  if (!files.length) return console.log(all ? 'No endless run is armed.' : 'This window is not on an endless run.');
  for (const f of files) {
    const p = path.join(STATE_DIR, f);
    const s = JSON.parse(fs.readFileSync(p, 'utf8'));
    fs.renameSync(p, path.join(STATE_DIR, `${s.session_id}.finished.json`));
    console.log(`Released "${s.label}" after ${s.iterations} work cycles.`);
  }
}

// ---------------------------------------------------------------- check
function check() {
  const target = args[1];
  if (!target) die('Usage: node scripts/endless.mjs check <path/to/LOOP-PROMPT.md>');
  const file = path.resolve(ROOT, target);
  if (!fs.existsSync(file)) die(`No file at ${file}`);
  const text = fs.readFileSync(file, 'utf8');
  const head = text.split('\n').slice(0, 25).join('\n');
  const problems = [];

  // The rule that keeps a loop launchable: hand over a PATH, never a PAYLOAD.
  const pasteRe = /paste (this|the) (whole |entire |full )?(file|prompt|thing|block|document)|copy (this|the) (whole|entire|full)/i;
  if (pasteRe.test(text)) problems.push('It tells the user to paste the file. They cannot: the input box caps out. Hand over the path instead.');
  if (!/TO START THIS LOOP/i.test(head)) problems.push('The first 25 lines are missing the "TO START THIS LOOP" launch block. It must be the very first thing in the file.');
  if (!/endless\.mjs arm/.test(text)) problems.push('The file never arms the stop-guard (node scripts/endless.mjs arm --folder ...). Without it the window will quietly stop on its own.');
  if (!/\bstop\b/i.test(text)) problems.push('The file never states the stop word.');

  // The one line the user actually types.
  const folder = path.dirname(file);
  const rel = path.relative(ROOT, file);
  const launch = `Run the endless loop in ${rel}. Read it in full first, then work it. No finish condition, stop only when I type "stop".`;
  if (launch.length > MAX_LAUNCH_LINE) problems.push(`The launch line is ${launch.length} characters, over the ${MAX_LAUNCH_LINE} ceiling. Shorten the path.`);

  if (problems.length) {
    console.error('LOOP FILE REJECTED:');
    problems.forEach((p, i) => console.error(`  ${i + 1}. ${p}`));
    process.exit(1);
  }
  console.log('LOOP FILE OK.');
  console.log(`Folder: ${folder}`);
  console.log(`\nThe ONE line to type (${launch.length} chars):\n${launch}`);
}

switch (cmd) {
  case 'arm': arm(); break;
  case 'status': status(); break;
  case 'release': case 'stop': release(); break;
  case 'check': check(); break;
  default: die(`Unknown command "${cmd}". Use: arm | status | release | check`);
}
