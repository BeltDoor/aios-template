#!/usr/bin/env node
// keep-warm.mjs: keeps a long chat's short-term memory (the prompt cache) alive through a break.
// Created: 11/3/26 - 22:34 EST.
//
// The cache lasts one hour after its last use, no setting makes it longer, and every use restarts the
// hour. So when a long chat has sat idle for 50 minutes, this hook wakes it for a one-line reply. At most
// four check-ins per break. Only a message typed by a person starts a new count.
//
// Runs as a Stop hook with async and asyncRewake: exit 2 wakes the chat, any other exit does nothing.
// Off unless the personal settings file has env KING_KEEP_WARM "1", or the hook passes --on.
//
// It spends nothing when a check-in cannot help: a chat under 200,000 tokens, a chat on the five-minute
// cache (API key or usage credits), a computer that slept past the hour, or a check-in that just missed
// the cache. A chat waiting on an open question box never reaches Stop, so it gets no check-in.
//
// One state file per chat in ~/.claude/king-intelligence/keep-warm/. Each Stop claims that file, and an
// older waiting copy of this script sees the claim and exits, so a busy chat holds one waiter at most.
//
// Test knobs: KEEP_WARM_EVERY_SEC, KEEP_WARM_DEAD_SEC, KEEP_WARM_MIN_TOKENS, KEEP_WARM_ONLY_SESSION.
// Self-test: node scripts/keep-warm.test.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const seconds = (name, fallback) => {
  const n = Number(process.env[name]);
  return (Number.isFinite(n) && n > 0 ? n : fallback) * 1000;
};
const CHECK_IN_AFTER = seconds('KEEP_WARM_EVERY_SEC', 50 * 60);
const TOO_LATE_AFTER = seconds('KEEP_WARM_DEAD_SEC', 58 * 60);
const POLL = Math.min(60_000, Math.max(1_000, CHECK_IN_AFTER / 6));
const MIN_TOKENS = Number(process.env.KEEP_WARM_MIN_TOKENS ?? 200_000);
const MAX_CHECK_INS = 4;
const MIN_HIT_SHARE = 0.8;
const MARKER = 'keep-warm check-in';
const TAIL_BYTES = 4_000_000;
const KEEP_STATE_MS = 14 * 86_400_000;

const home = os.homedir();
const stateDir = path.join(home, '.claude', 'king-intelligence', 'keep-warm');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, file);
}

function isOn() {
  if (process.argv.includes('--on') || process.env.KING_KEEP_WARM === '1') return true;
  return readJson(path.join(home, '.claude', 'settings.json'))?.env?.KING_KEEP_WARM === '1';
}

function sweepOldState() {
  try {
    for (const name of fs.readdirSync(stateDir)) {
      const file = path.join(stateDir, name);
      if (Date.now() - fs.statSync(file).mtimeMs > KEEP_STATE_MS) fs.rmSync(file, { force: true });
    }
  } catch {
    // No folder yet.
  }
}

function readTail(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const { size } = fs.fstatSync(fd);
    const length = Math.min(size, TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, size - length);
    const lines = buffer.toString('utf8').split('\n');
    if (length < size) lines.shift();
    const records = [];
    for (const line of lines) {
      if (!line) continue;
      try {
        const record = JSON.parse(line);
        if (!record.isSidechain) records.push(record);
      } catch {
        // A line still being written.
      }
    }
    return records;
  } finally {
    fs.closeSync(fd);
  }
}

function usageOf(record) {
  const usage = record.message?.usage;
  if (record.type !== 'assistant' || !usage) return null;
  const read = usage.cache_read_input_tokens ?? 0;
  const wrote = usage.cache_creation_input_tokens ?? 0;
  return {
    at: Date.parse(record.timestamp),
    size: read + wrote + (usage.input_tokens ?? 0),
    read,
    wrote,
    oneHour: usage.cache_creation?.ephemeral_1h_input_tokens ?? 0,
  };
}

function typedByPerson(record) {
  if (record.type !== 'user' || record.isMeta || record.isCompactSummary || record.toolUseResult) return false;
  if (record.promptSource === 'system') return false;
  const content = record.message?.content;
  const text = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.filter((part) => part.type === 'text').map((part) => part.text).join(' ')
      : '';
  if (!text.trim() || text.includes(MARKER)) return false;
  return !/^\s*<(task-notification|cross-session-message|local-command|system-reminder|bash-)/.test(text);
}

function lastPersonAt(records) {
  for (let i = records.length - 1; i >= 0; i--) {
    if (typedByPerson(records[i])) return Date.parse(records[i].timestamp);
  }
  return 0;
}

// True when another check-in could help: the chat is long enough and its last write went to the one-hour cache.
function worthKeeping(records) {
  const usages = records.map(usageOf).filter(Boolean);
  const last = usages.at(-1);
  if (!last || last.size < MIN_TOKENS) return false;
  const lastWrite = usages.findLast((usage) => usage.wrote > 0);
  return Boolean(lastWrite && lastWrite.oneHour > 0);
}

function noteResult(state, transcript) {
  const result = readTail(transcript).map(usageOf).find((usage) => usage && usage.at > state.lastCheckInAt);
  if (!result) return false;
  const hit = result.size > 0 && result.read / result.size >= MIN_HIT_SHARE;
  state.log = [...(state.log ?? []), { at: state.lastCheckInAt, n: state.count, size: result.size, read: result.read, wrote: result.wrote, hit }].slice(-200);
  state.awaiting = false;
  if (!hit) state.count = MAX_CHECK_INS;
  return true;
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  if (!isOn() || (process.env.CLAUDE_CODE_ENTRYPOINT ?? '').startsWith('sdk')) return 0;
  const { session_id: session, transcript_path: transcript } = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (!/^[\w-]+$/.test(session ?? '') || typeof transcript !== 'string' || !fs.existsSync(transcript)) return 0;
  if (process.env.KEEP_WARM_ONLY_SESSION && !session.startsWith(process.env.KEEP_WARM_ONLY_SESSION)) return 0;

  const file = path.join(stateDir, `${session}.json`);
  const known = readJson(file);
  if (!known) sweepOldState();
  const state = known ?? { count: 0, log: [] };
  const records = readTail(transcript);
  if (lastPersonAt(records) > (state.lastCheckInAt ?? 0)) state.count = 0;

  const worth = worthKeeping(records);
  if (!known && !worth) return 0;
  const me = crypto.randomUUID();
  state.waiter = me;
  state.armedAt = Date.now();
  writeJson(file, state);
  if (!worth || (state.count >= MAX_CHECK_INS && !state.awaiting)) return 0;

  for (;;) {
    await pause(POLL);
    const now = readJson(file);
    if (!now || now.waiter !== me) return 0;
    if (now.awaiting && noteResult(now, transcript)) writeJson(file, now);
    if (now.count >= MAX_CHECK_INS && !now.awaiting) return 0;
    const idle = Date.now() - now.armedAt;
    if (idle < CHECK_IN_AFTER) continue;
    if (idle >= TOO_LATE_AFTER || now.count >= MAX_CHECK_INS) return 0;
    const moved = readTail(transcript).some((record) =>
      (record.type === 'user' || record.type === 'assistant') && Date.parse(record.timestamp) > now.armedAt + 2_000);
    if (moved) return 0;
    now.count += 1;
    now.lastCheckInAt = Date.now();
    now.awaiting = true;
    writeJson(file, now);
    fs.writeSync(2, `Automatic ${MARKER} ${now.count} of ${MAX_CHECK_INS}. The user is away and asked for nothing. Reply with exactly these two words and nothing else: Still here. Use no tools. Do not resume any work.\n`);
    return 2;
  }
}

process.on('SIGTERM', () => process.exit(0));
main().then((code) => process.exit(code), () => process.exit(0));
