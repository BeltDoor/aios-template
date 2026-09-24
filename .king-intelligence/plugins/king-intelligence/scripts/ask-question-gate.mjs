#!/usr/bin/env node
// ask-question-gate.mjs - Stop hook: a turn may not end on a question asked in prose.
//
// Ported 09/24/26 from the owner's own personal copy of this hook (15/15 self-check passing)
// per PLAN-ask-with-buttons.md. Same catch as the personal copy: a trailing question mark, or a
// closing line that waits for a typed answer instead of asking ("say go and I'll build it"). The
// correction here is widened for every member: ask it with buttons, OR drop the question if it
// was not really needed. Member-facing text carries no name, no repo path, no dates, no em dashes.
//
// FAILS OPEN. Quiet (exit 0, nothing printed) on any of: a repeat block (stop_hook_active); the
// member's own off flag; the open folder carrying its OWN copy of this hook at
// .claude/hooks/ask-question-gate.mjs (never correct the same machine twice); an armed /endless
// run for this session (it owns the Stop hook while it runs); a headless/scheduled run (the
// transcript's newest "entrypoint" field reads "sdk-cli", so nobody is there to click a button);
// an unreadable transcript; or any error at all. A gate that can wedge a window is worse than one
// missed question.
//
// Off switch: node ask-question-gate.mjs off | on | status
// Health check: node ask-question-gate.mjs --verify

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HOOK_FILE = fileURLToPath(import.meta.url);

/** Claude Code's config folder. Same two lines every sibling script in this plugin uses. */
function cfgDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function stateFile() {
  return path.join(cfgDir(), 'king-intelligence', 'ask-buttons.json');
}

/** Missing or unreadable file reads as on, caught 0. Never throws. */
function readState() {
  try {
    const j = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    return {
      off: j && j.off === true,
      caught: Number.isInteger(j && j.caught) && j.caught >= 0 ? j.caught : 0,
      changed_at: j && typeof j.changed_at === 'string' ? j.changed_at : null,
    };
  } catch { return { off: false, caught: 0, changed_at: null }; }
}

/** Writes must never throw out of this script. Creates the folder if it is missing. */
function writeState(state) {
  try {
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify(state, null, 2));
  } catch { /* a write that fails silently is still better than a wedged hook */ }
}

function setFlag(off) {
  const state = readState();
  state.off = off;
  state.changed_at = new Date().toISOString();
  writeState(state);
}

/** Best effort: a miscount here is never a reason to fail the hook. */
function bumpCaught() {
  try {
    const state = readState();
    state.caught = (state.caught || 0) + 1;
    writeState(state);
  } catch { /* counting is a courtesy, not a requirement */ }
}

/** The last text the assistant wrote this turn, and whether AskUserQuestion was called. */
export function readTurn(lines) {
  const entries = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try { entries.push(JSON.parse(line)); } catch { /* skip a torn line */ }
  }
  // The turn starts after the last message the person typed (a user entry that is not only tool results).
  let start = 0;
  entries.forEach((e, i) => {
    if (e.type !== 'user' || e.isMeta) return;
    const c = e.message?.content;
    const typed = typeof c === 'string' || (Array.isArray(c) && c.some((b) => b.type === 'text'));
    if (typed) start = i + 1;
  });
  let asked = false;
  let lastText = '';
  for (const e of entries.slice(start)) {
    if (e.type !== 'assistant') continue;
    for (const b of e.message?.content || []) {
      if (b.type === 'tool_use' && b.name === 'AskUserQuestion') asked = true;
      if (b.type === 'text' && b.text.trim()) lastText = b.text;
    }
  }
  return { asked, lastText };
}

/** True when the closing lines of the message put a question to the reader. */
export function endsOnQuestion(text) {
  const prose = text
    .replace(/```[\s\S]*?```/g, '')              // code blocks
    .split('\n')
    .filter((l) => !/^\s*>/.test(l))              // quoted drafts
    .join('\n')
    .replace(/`[^`]*`/g, '')                      // inline code
    .replace(/\]\([^)]*\)/g, ']')                 // link targets (URLs can hold '?')
    .trim();
  const tail = prose.split('\n').filter((l) => l.trim()).slice(-3).join(' ');
  return /\?["')*_\s]*$/.test(tail) || /\?\s*\*{0,2}\s*$/.test(tail) || /\?\s+[A-Z(]/.test(tail.slice(-160))
    || endsOnDisguisedAsk(tail);
}

/**
 * A yes/no written as a statement, no question mark. "The fix is on hold: it builds when you
 * say go" and "say go and I'll build it" both wait for a TYPED answer, which is the whole thing
 * the buttons exist to spare. Only the closing lines are read, so an instruction mid-report does
 * not trip it.
 */
export function endsOnDisguisedAsk(tail) {
  const t = tail.replace(/[*_"'‘’]/g, '');
  return [
    /\bwhen(ever)? you (say|give|confirm|tell me|pick|decide|approve)\b/i,
    /\b(say|reply|type|tell me)\s+(go|yes|ok|okay|the word|which)\b/i,
    /\bjust say the word\b/i,
    /\b(on|waiting (on|for)) your (go|word|yes|ok|okay|call|say-so|approval)\b/i,
    /\bif you('d)? (want|like) me to\b/i,
    /\blet me know (if|whether|which|when) you\b/i,
    /\b(once|if) you (give the|say) (go|ok|okay|yes|word)\b/i,
  ].some((re) => re.test(t));
}

/** The newest entrypoint named anywhere in the transcript, or null if none carries one. */
function newestEntrypoint(lines) {
  let entrypoint = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    if (typeof rec.entrypoint === 'string') entrypoint = rec.entrypoint;
  }
  return entrypoint;
}

function buildReason() {
  return 'Your reply ends on a question to the person, or on a line that waits for their answer '
    + '(like "say go and I\'ll do it"), written as plain text. They prefer clicking to typing. Do '
    + 'one of these now: ask it with the AskUserQuestion tool, your recommended option first and '
    + 'labeled "(Recommended)"; or, if the question was not really needed, end on a plain statement '
    + 'instead. If they have asked to stop the question buttons, run: node "' + HOOK_FILE + '" off , '
    + 'tell them in one plain sentence that it is off and that saying "turn the question buttons '
    + 'back on" restores it, then end your reply.';
}

function main(raw) {
  let input;
  try { input = JSON.parse(raw || '{}'); } catch { return; }
  if (input.stop_hook_active) return;

  const state = readState();
  if (state.off) return;

  const projectDir = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();

  // Never correct the owner's own machine twice: stand down where this folder carries its own
  // personal copy of this hook.
  if (fs.existsSync(path.join(projectDir, '.claude', 'hooks', 'ask-question-gate.mjs'))) return;

  // An armed /endless run owns the Stop hook for this session; never fight it for the turn.
  if (input.session_id && fs.existsSync(path.join(projectDir, '.claude', 'endless', `${input.session_id}.json`))) return;

  let lines;
  try { lines = fs.readFileSync(input.transcript_path, 'utf8').split('\n'); } catch { return; }

  // Headless or scheduled: nobody is there to click a button.
  if (newestEntrypoint(lines) === 'sdk-cli') return;

  // The closing message comes from the hook input, not the transcript. Claude Code has not
  // finished writing the turn's last message to the transcript when Stop fires, so a transcript-
  // only read saw an empty reply in a live session and let every question through, while the
  // same check passed on saved copies. The transcript still answers "was AskUserQuestion called",
  // because a tool call is written before the tool runs.
  const turn = readTurn(lines);
  const lastText = typeof input.last_assistant_message === 'string' && input.last_assistant_message.trim()
    ? input.last_assistant_message : turn.lastText;
  if (turn.asked || !lastText || !endsOnQuestion(lastText)) return;

  bumpCaught();
  process.stdout.write(JSON.stringify({ decision: 'block', reason: buildReason() }));
}

function selfCheck() {
  let fails = 0;
  const say = (ok, line) => { console.log(`  ${ok ? '✓' : '✗'} ${line}`); if (!ok) fails++; };
  console.log('ASK-QUESTION GATE (plugin) - self-check');

  // Wired into the plugin's own hooks.json Stop block, not a project's settings.json.
  try {
    const hooksPath = path.resolve(path.dirname(HOOK_FILE), '..', 'hooks', 'hooks.json');
    const h = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
    say(JSON.stringify(h?.hooks?.Stop || []).includes('ask-question-gate.mjs'), 'wired into hooks/hooks.json Stop hooks');
  } catch { say(false, 'hooks/hooks.json readable'); }

  // Every stateful check below runs behind a scratch config dir and scratch project folders,
  // never the real ~/.claude.
  const savedCfg = process.env.CLAUDE_CONFIG_DIR;
  const scratchCfg = fs.mkdtempSync(path.join(os.tmpdir(), 'aqg-cfg-'));
  const cleanProject = fs.mkdtempSync(path.join(os.tmpdir(), 'aqg-clean-'));
  const ownCopyProject = fs.mkdtempSync(path.join(os.tmpdir(), 'aqg-owncopy-'));
  const endlessProject = fs.mkdtempSync(path.join(os.tmpdir(), 'aqg-endless-'));
  process.env.CLAUDE_CONFIG_DIR = scratchCfg;

  const u = (text) => JSON.stringify({ type: 'user', message: { content: text } });
  const uEntry = (text, entrypoint) => JSON.stringify({ type: 'user', entrypoint, message: { content: text } });
  const a = (blocks) => JSON.stringify({ type: 'assistant', message: { content: blocks } });
  const tr = (arr) => {
    const f = path.join(scratchCfg, `aqg-${process.pid}-${Math.random().toString(36).slice(2)}.jsonl`);
    fs.writeFileSync(f, arr.join('\n'));
    return f;
  };
  const run = (file, extra = {}) => spawnSync(process.execPath, [HOOK_FILE], {
    input: JSON.stringify({ transcript_path: file, stop_hook_active: false, session_id: 'aqg-selfcheck', cwd: cleanProject, ...extra }),
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, CLAUDE_CONFIG_DIR: scratchCfg },
  }).stdout || '';

  // Start every stateful case from a clean, on, zero-caught state.
  writeState({ off: false, caught: 0, changed_at: null });

  const cases = [
    ['prose "Want me to X?" ending blocks', [u('go'), a([{ type: 'text', text: 'Done.\n\nWant me to queue that?' }])], true],
    ['bold question ending blocks', [u('go'), a([{ type: 'text', text: 'All set. **Want me to check email?**' }])], true],
    ['question followed by a short line blocks', [u('go'), a([{ type: 'text', text: 'Found it. Want me to fix it now? Say the word.' }])], true],
    ['statement ending passes', [u('go'), a([{ type: 'text', text: 'Done. Nothing open.' }])], false],
    ['AskUserQuestion in the turn passes', [u('go'), a([{ type: 'tool_use', name: 'AskUserQuestion', input: {} }]), a([{ type: 'text', text: 'Picked?' }])], false],
    ['question inside a quoted draft passes', [u('go'), a([{ type: 'text', text: 'Draft below.\n\n> Are you free Friday?\n\nIt is in your mail.' }])], false],
    ['question mark in a link passes', [u('go'), a([{ type: 'text', text: 'Open [the page](https://example.com/a?b=1).' }])], false],
    ['disguised ask "builds when you say go" blocks', [u('go'), a([{ type: 'text', text: 'Both drafts are staged.\n\nThe other fix is also still on hold: it builds when you say "go".' }])], true],
    ['disguised ask "say go and I\'ll build it" blocks', [u('go'), a([{ type: 'text', text: 'Plan is written.\n\nIf that matches, say "go" and I\'ll build it.' }])], true],
    ['disguised ask "if you want me to" blocks', [u('go'), a([{ type: 'text', text: 'Done. If you want me to publish it, I can.' }])], true],
    ['plain report with "you said" passes', [u('go'), a([{ type: 'text', text: 'Moved the card, as you said.\n\nNothing open.' }])], false],
    ['older turn\'s AskUserQuestion does not count', [u('one'), a([{ type: 'tool_use', name: 'AskUserQuestion', input: {} }]), u('two'), a([{ type: 'text', text: 'Should I ship it?' }])], true],
  ];
  for (const [name, arr, expectBlock] of cases) {
    const f = tr(arr);
    const blocked = run(f).includes('"block"');
    fs.rmSync(f, { force: true });
    say(blocked === expectBlock, name);
  }

  {
    const f = tr([u('go'), a([{ type: 'text', text: 'Want me to?' }])]);
    say(!run(f, { stop_hook_active: true }).includes('"block"'), 'never blocks twice in a row (stop_hook_active)');
    fs.rmSync(f, { force: true });
  }
  say(!run(path.join(scratchCfg, 'nonexistent.jsonl')).includes('"block"'), 'unreadable transcript fails open');

  // The live race: at Stop time the transcript does not hold the closing message yet, only the
  // hook input does. A transcript-only read let this through in a real interactive session.
  {
    const f = tr([u('go')]);
    say(run(f, { last_assistant_message: 'All set. Want me to send it?' }).includes('"block"'), 'closing message read from hook input when the transcript lags');
    const g = tr([u('go'), a([{ type: 'tool_use', name: 'AskUserQuestion', input: {} }])]);
    say(!run(g, { last_assistant_message: 'Picked?' }).includes('"block"'), 'AskUserQuestion in the transcript still passes when the text comes from input');
    fs.rmSync(f, { force: true }); fs.rmSync(g, { force: true });
  }

  // Off flag: a case that would otherwise block passes quietly instead.
  {
    writeState({ off: true, caught: 0, changed_at: new Date().toISOString() });
    const f = tr([u('go'), a([{ type: 'text', text: 'Done.\n\nWant me to queue that?' }])]);
    say(!run(f).includes('"block"'), 'off flag makes an otherwise-blocking turn pass');
    fs.rmSync(f, { force: true });
    writeState({ off: false, caught: 0, changed_at: null });
  }

  // Headless / scheduled: an entrypoint of sdk-cli passes even a blocking-shaped ending.
  {
    const f = tr([uEntry('go', 'sdk-cli'), a([{ type: 'text', text: 'Done.\n\nWant me to queue that?' }])]);
    say(!run(f).includes('"block"'), 'sdk-cli entrypoint passes');
    fs.rmSync(f, { force: true });
  }

  // Stand-down: the open folder carries its own personal copy of this hook.
  {
    fs.mkdirSync(path.join(ownCopyProject, '.claude', 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(ownCopyProject, '.claude', 'hooks', 'ask-question-gate.mjs'), '// personal copy\n');
    const f = tr([u('go'), a([{ type: 'text', text: 'Done.\n\nWant me to queue that?' }])]);
    const out = spawnSync(process.execPath, [HOOK_FILE], {
      input: JSON.stringify({ transcript_path: f, stop_hook_active: false, session_id: 'aqg-selfcheck', cwd: ownCopyProject }),
      encoding: 'utf8', timeout: 10000,
      env: { ...process.env, CLAUDE_CONFIG_DIR: scratchCfg },
    }).stdout || '';
    say(!out.includes('"block"'), 'stands down where the folder has its own copy of this hook');
    fs.rmSync(f, { force: true });
  }

  // Stand-down: an armed /endless run for this exact session.
  {
    const sid = 'aqg-endless-armed';
    fs.mkdirSync(path.join(endlessProject, '.claude', 'endless'), { recursive: true });
    fs.writeFileSync(path.join(endlessProject, '.claude', 'endless', `${sid}.json`), '{}');
    const f = tr([u('go'), a([{ type: 'text', text: 'Done.\n\nWant me to queue that?' }])]);
    const out = spawnSync(process.execPath, [HOOK_FILE], {
      input: JSON.stringify({ transcript_path: f, stop_hook_active: false, session_id: sid, cwd: endlessProject }),
      encoding: 'utf8', timeout: 10000,
      env: { ...process.env, CLAUDE_CONFIG_DIR: scratchCfg },
    }).stdout || '';
    say(!out.includes('"block"'), 'stands down while an /endless run is armed for this session');
    fs.rmSync(f, { force: true });
  }

  // A block increments caught.
  {
    writeState({ off: false, caught: 0, changed_at: null });
    const f = tr([u('go'), a([{ type: 'text', text: 'Done.\n\nWant me to queue that?' }])]);
    run(f);
    fs.rmSync(f, { force: true });
    const after = readState();
    say(after.caught === 1, 'a block increments caught');
  }

  // off then on round-trips through the CLI.
  {
    const off = spawnSync(process.execPath, [HOOK_FILE, 'off'], { encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: scratchCfg } });
    const afterOff = readState();
    const on = spawnSync(process.execPath, [HOOK_FILE, 'on'], { encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: scratchCfg } });
    const afterOn = readState();
    say(afterOff.off === true && afterOn.off === false, 'off then on round-trips');
    say(!/[A-Z][a-z]+ [A-Z][a-z]+/.test((off.stdout || '') + (on.stdout || '')) , 'off/on CLI text carries no name-shaped words');
  }

  if (savedCfg === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = savedCfg;
  for (const d of [scratchCfg, cleanProject, ownCopyProject, endlessProject]) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort cleanup */ }
  }

  process.exit(fails ? 1 : 0);
}

const argv = process.argv.slice(2);
if (argv.includes('--verify')) selfCheck();
else if (argv[0] === 'off') {
  setFlag(true);
  console.log('Question buttons are off. Say "turn the question buttons back on" any time to turn them on again.');
  process.exit(0);
} else if (argv[0] === 'on') {
  setFlag(false);
  console.log('Question buttons are on.');
  process.exit(0);
} else if (argv[0] === 'status') {
  const s = readState();
  console.log(`Question buttons are ${s.off ? 'off' : 'on'}.`);
  process.exit(0);
} else {
  let raw = '';
  process.stdin.on('data', (d) => (raw += d));
  process.stdin.on('end', () => { try { main(raw); } catch { /* fail open */ } process.exit(0); });
}
