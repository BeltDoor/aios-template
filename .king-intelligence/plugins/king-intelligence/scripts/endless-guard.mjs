#!/usr/bin/env node
/**
 * endless-guard.mjs — the Stop hook that makes /endless actually endless.
 * Created 08/21/26 - 16:36 EDT.
 *
 * Claude Code fires the Stop hook every time the window is about to hand control
 * back to the user. If this session has an armed endless run, we return
 * {"decision":"block","reason":...} which cancels the stop and feeds `reason`
 * back in as the next instruction. That is the ONLY reliable way to keep a run
 * going: prose in a prompt ("never stop") is a suggestion, this is enforcement.
 *
 * Reference implementation: Anthropic's official ralph-loop plugin stop hook.
 *
 * FAILS OPEN. Any error, any doubt, any missing state => exit 0 => the window is
 * allowed to stop. A loop that cannot be stopped is worse than one that stops early.
 *
 * State lives at .claude/endless/<session_id>.json (see scripts/endless.mjs).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Marker on every message we inject, so the stop-word scan can never match our
// own text and report the opposite of the truth.
const SENTINEL = '​[endless-run]';

// Typing one of these is the ONLY way out of an endless run, so the list being short is a
// real cost: the user types something reasonable, the run ignores it, and they are usually away
// when that matters. Measured over a real run — eleven ordinary phrasings were ignored, including
// "stop it", "stop now" and "ok stop".
//
// EXACT WHOLE-MESSAGE MATCHES ONLY, and never a prefix. `/stop-slop` is a skill people run
// constantly, so anything matching on "starts with stop" would end a run every time someone
// cleans up a caption. `endless-guard.test.mjs` holds both halves of that: what must end a run, and
// the ordinary messages that must not.
const STOP_WORDS = [
  'stop', 'stop.', 'stop!', 'stop the loop', 'stop loop', 'stop please',
  'please stop', 'halt', 'end the loop', 'end loop', 'kill the loop',
  "that's enough", 'stop endless', 'endless stop',
  // Each one measured as ignored before it went in.
  'stop it', 'stop now', 'stop this', 'stop everything', 'stop the run',
  'stop running', 'ok stop', 'okay stop', 'all stop', 'stop for now',
  'cancel the loop', 'cancel the run', 'end the run', 'enough',
  "we're done", "that's it", 'wrap it up',
];

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

/** Last thing the user actually TYPED. Ignores tool results, system reminders,
 *  slash-command wrappers, and anything we injected ourselves. */
function lastHumanMessage(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
  // Only the tail: a 12-hour run's transcript can reach tens of MB and this hook
  // runs on a timeout at the end of every single turn.
  const TAIL_BYTES = 2 * 1024 * 1024;
  let lines;
  try {
    const size = fs.statSync(transcriptPath).size;
    const start = Math.max(0, size - TAIL_BYTES);
    const fd = fs.openSync(transcriptPath, 'r');
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    lines = buf.toString('utf8').split('\n');
    if (start > 0) lines.shift(); // first line is a partial record
  } catch { return null; }

  for (let i = lines.length - 1; i >= 0 && i > lines.length - 4000; i--) {
    const line = lines[i];
    if (!line || !line.includes('"user"')) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    // A COMPACTION SUMMARY is a user-typed record that no user typed.
    //
    // When the context fills, Claude Code writes the summary back into the transcript as a
    // `user` record. It is not marked isMeta, so this loop accepted it as the newest thing
    // the user said — and it is around 16,000 characters of machine-written prose. It cannot
    // cause a false stop (isStopWord refuses anything over 60 characters), but it MASKS a
    // real one: if they type "stop" and the context compacts before the next turn ends, the
    // summary becomes the newest human record, this returns it, no stop word is found, and
    // the run he asked to end carries on. This session compacted twice in one morning, so
    // the window is not theoretical. Both markers are skipped: `isVisibleInTranscriptOnly`
    // covers the same class of record that is shown but was never spoken.
    if (rec.type !== 'user' || rec.isMeta) continue;
    if (rec.isCompactSummary || rec.isVisibleInTranscriptOnly) continue;
    const content = rec.message?.content;
    let text = null;
    if (typeof content === 'string') text = content;
    else if (Array.isArray(content)) {
      if (content.some((b) => b?.type === 'tool_result')) continue; // tool output, not a person
      text = content.filter((b) => b?.type === 'text').map((b) => b.text).join('\n');
    }
    if (!text) continue;
    if (text.includes(SENTINEL)) continue;          // our own injected turn
    const trimmed = text.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('<')) continue;          // system-reminder / command wrapper
    return trimmed;
  }
  return null;
}

function isStopWord(msg) {
  if (!msg) return false;
  if (msg.length > 60) return false;               // a paragraph is not a stop word
  // APOSTROPHES ARE KEPT, not turned into spaces. The old line swept `'` into a space, which
  // made "that's enough" normalise to "that s enough" — so that entry had been in the list
  // since the day it was written and could never once have matched. A curly apostrophe is
  // folded to a straight one first, because that is what a phone types.
  const norm = msg
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/["*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return STOP_WORDS.includes(norm) || STOP_WORDS.includes(norm.replace(/[.!]+$/, ''));
}

function allowStop(message) {
  if (message) process.stdout.write(JSON.stringify({ systemMessage: message }));
  process.exit(0);
}

function log(dir, sid, line) {
  try {
    fs.appendFileSync(path.join(dir, `${sid}.log`), `${new Date().toISOString()}  ${line}\n`);
  } catch { /* logging must never break the guard */ }
}

function main() {
  const raw = readStdin();
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch { allowStop(); }

  const sid = input.session_id;
  if (!sid) allowStop();

  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

  // ONE GUARD PER STOP. A repo can hold its own copy of this hook while the King Intelligence
  // plugin also ships one, and then both fire on the same stop: the cycle counter jumps by two,
  // so a 400-cycle safety cap silently becomes 200, and the run gets two "next task" instructions
  // for one turn. The repo's own copy wins and any other copy stands down.
  const own = path.join(projectDir, '.claude', 'hooks', 'endless-guard.mjs');
  let self = null;
  try { self = fs.realpathSync(fileURLToPath(import.meta.url)); } catch {}
  if (self && fs.existsSync(own)) {
    let ownReal = null;
    try { ownReal = fs.realpathSync(own); } catch {}
    if (ownReal && ownReal !== self) allowStop();
  }

  const stateDir = path.join(projectDir, '.claude', 'endless');
  const stateFile = path.join(stateDir, `${sid}.json`);
  if (!fs.existsSync(stateFile)) allowStop();       // no armed run in THIS window

  let state;
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {
    try { fs.unlinkSync(stateFile); } catch {}
    allowStop('Endless run: its own tracking file was unreadable, so the run was released. Nothing was lost.');
  }

  const finish = (reasonForStopping, note) => {
    log(stateDir, sid, `RELEASED (${reasonForStopping}) after ${state.iterations || 0} continues`);
    try { fs.renameSync(stateFile, path.join(stateDir, `${sid}.finished.json`)); } catch {
      try { fs.unlinkSync(stateFile); } catch {}
    }
    allowStop(note);
  };

  // 1. The user's stop word. Deterministic exit that does not depend on the model
  //    noticing or obeying.
  const lastMsg = lastHumanMessage(input.transcript_path);
  if (isStopWord(lastMsg)) {
    finish('stop word', `Endless run "${state.label || 'run'}" stopped on your word after ${state.iterations || 0} work cycles.`);
  }

  // 2. Wall-clock ceiling. An endless run still ends when the night does.
  if (state.expires_at && Date.now() > Date.parse(state.expires_at)) {
    finish('time limit', `Endless run "${state.label || 'run'}" hit its ${state.hours}-hour limit and released the window after ${state.iterations || 0} work cycles. Progress is in ${state.progress_file}.`);
  }

  // 3. Runaway backstop.
  const iterations = Number(state.iterations || 0);
  if (state.max_cycles && iterations >= Number(state.max_cycles)) {
    finish('cycle cap', `Endless run "${state.label || 'run'}" reached its ${state.max_cycles}-cycle safety cap and released the window. Progress is in ${state.progress_file}.`);
  }

  // Otherwise: refuse the stop and push the run into its next task.
  const next = iterations + 1;
  state.iterations = next;
  state.last_continue_at = new Date().toISOString();
  try { fs.writeFileSync(stateFile, JSON.stringify(state, null, 2)); } catch { allowStop(); }
  log(stateDir, sid, `continue -> cycle ${next}`);

  const msLeft = state.expires_at ? Date.parse(state.expires_at) - Date.now() : null;
  const hoursLeft = msLeft != null ? Math.max(0, msLeft / 3600000).toFixed(1) : '?';

  // Every 5th cycle, force a fresh idea sweep so the run cannot rut.
  const ritual = next % 5 === 0
    ? '\nThis cycle is an IDEA SWEEP: write ten fresh, ranked improvement ideas into PROGRESS.md, then start number one.'
    : '';

  const reason = [
    `${SENTINEL} Cycle ${next}. This window is on an endless run and is not finished.`,
    ``,
    `Do this now, in this turn:`,
    `1. If you do not have them in context (a context reset or compaction may have wiped them), read these two files in full first:`,
    `   - ${state.loop_prompt}`,
    `   - ${state.progress_file}`,
    `2. Update ${state.progress_file} with what you just did.`,
    `3. Pick the single highest-value next task yourself and START it in this same turn.`,
    ``,
    `Rules that still hold: do not declare the job done, do not post a wrap-up, do not go idle, do not ask whether to continue. Proceed on reasonable assumptions and log them under "Assumptions" in PROGRESS.md. Guardrails in ${state.loop_prompt} still apply.${ritual}`,
    ``,
    `Only you typing "stop" ends this run${state.expires_at ? `, or the ${hoursLeft}h left on the clock` : ''}.`,
  ].join('\n');

  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason,
    systemMessage: `Endless run "${state.label || 'run'}" — cycle ${next}${state.expires_at ? `, ${hoursLeft}h left` : ''}. Type "stop" to end it.`,
  }));
  process.exit(0);
}

try { main(); } catch { allowStop(); }
