#!/usr/bin/env node
// The second-brain door — a scoped MCP server that hands your second brain to
// claude.ai over the internet, so the Claude app and claude.ai can read and
// write it (and start real Claude Code jobs) while your main computer is shut.
// Installed onto an always-on machine by /install-always-on-server.
//
// Guardrails, all built in and not optional:
//   - every path is resolved and forced inside BRAIN_DOOR_ROOT
//   - a denylist blocks secrets, git internals, and the private folder
//   - every call (including rejected ones) is appended to audit.log
//   - a token is required on every request (bearer header OR secret path segment)
//
// Required environment: BRAIN_DOOR_ROOT (the second-brain folder) and
// BRAIN_DOOR_TOKEN (64 random hex characters). Optional: BRAIN_DOOR_PORT (8123),
// BRAIN_DOOR_HOST (127.0.0.1), BRAIN_DOOR_HOME (~/.second-brain-door, holds the
// audit log and job records), BRAIN_DOOR_ENV_FILE (a KEY=VALUE file loaded into
// job runs), BRAIN_DOOR_CLAUDE (path to the claude binary), BRAIN_DOOR_DENY
// (comma-separated extra folder names to refuse, on top of the built-in list),
// BRAIN_DOOR_JOB_LOCK (the machine-wide one-job lock file, ~/.claude-job.lock,
// shared with the scheduled morning job).
//
// What the door confines and what it does not: the file tools (list_dir,
// read_file, search, write_file, edit_file) are held inside BRAIN_DOOR_ROOT by
// the rules below. start_job is NOT confined: it runs ordinary Claude Code as
// this machine's user, which can read anything that user can read and run any
// program that user can run.
//
// Needs @modelcontextprotocol/sdk installed beside it (npm install in BRAIN_DOOR_HOME).

import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const HOME = os.homedir();
const DOOR_HOME = path.resolve(process.env.BRAIN_DOOR_HOME || path.join(HOME, '.second-brain-door'));
const ROOT = process.env.BRAIN_DOOR_ROOT ? path.resolve(process.env.BRAIN_DOOR_ROOT) : '';
const PORT = Number(process.env.BRAIN_DOOR_PORT || 8123);
const HOST = process.env.BRAIN_DOOR_HOST || '127.0.0.1';
const TOKEN = process.env.BRAIN_DOOR_TOKEN || '';
const AUDIT = path.join(DOOR_HOME, 'audit.log');
const JOBS = path.join(DOOR_HOME, 'jobs');
const ENV_FILE = process.env.BRAIN_DOOR_ENV_FILE || '';
const MAX_READ = 400_000; // bytes

if (!ROOT || !fsSync.existsSync(ROOT)) {
  console.error('BRAIN_DOOR_ROOT must point at the second-brain folder. Refusing to start.');
  process.exit(1);
}
if (!TOKEN || TOKEN.length < 32) {
  console.error('BRAIN_DOOR_TOKEN missing or shorter than 32 chars. Refusing to start.');
  process.exit(1);
}

function claudeBin() {
  if (process.env.BRAIN_DOOR_CLAUDE) return process.env.BRAIN_DOOR_CLAUDE;
  const local = path.join(HOME, '.local', 'bin', 'claude');
  return fsSync.existsSync(local) ? local : 'claude';
}

// ---------------------------------------------------------------- guardrails

const DENY = [
  /(^|\/)\.git(\/|$)/,
  /(^|\/)\.env($|\.)/,
  /(^|\/)\.claude\.json$/,
  /(^|\/)settings\.local\.json$/,
  /(^|\/)personal(\/|$)/,
  /(^|\/)node_modules(\/|$)/,
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)id_(rsa|ed25519)/,
  /(^|\/)\.ssh(\/|$)/,
];

// Extra folders the owner named as private (BRAIN_DOOR_DENY=folder1,folder2).
for (const name of String(process.env.BRAIN_DOOR_DENY || '').split(',')) {
  const folder = name.trim().replace(/^\/+|\/+$/g, '');
  if (!folder) continue;
  const esc = folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  DENY.push(new RegExp(`(^|\\/)${esc}(\\/|$)`));
}

const REAL_ROOT = fsSync.realpathSync(ROOT);

class Blocked extends Error {}

function safe(rel) {
  const clean = String(rel ?? '').replace(/^\/+/, '');
  const abs = path.resolve(ROOT, clean);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) {
    throw new Blocked('Path is outside the second-brain folder.');
  }
  const inside = path.relative(ROOT, abs);
  if (DENY.some((re) => re.test('/' + inside.split(path.sep).join('/')))) {
    throw new Blocked(`Blocked path: ${inside || '.'} is on the never-share list.`);
  }
  // A symlink inside the brain must not lead outside it (or into a denied
  // folder): resolve the real location of the nearest existing ancestor and
  // re-check both rules against where it actually points.
  let probe = abs;
  while (probe !== ROOT && !fsSync.existsSync(probe)) probe = path.dirname(probe);
  const real = fsSync.realpathSync(probe);
  if (real !== REAL_ROOT && !real.startsWith(REAL_ROOT + path.sep)) {
    throw new Blocked('Path is outside the second-brain folder.');
  }
  const realInside = path.relative(REAL_ROOT, real);
  if (realInside && DENY.some((re) => re.test('/' + realInside.split(path.sep).join('/')))) {
    throw new Blocked(`Blocked path: ${inside || '.'} is on the never-share list.`);
  }
  return { abs, rel: inside || '.' };
}

// The log records who did what, where — never a second copy of file contents.
// Long values (file bodies, search text) are truncated to a preview.
function auditArgs(args) {
  const out = {};
  for (const [k, v] of Object.entries(args || {})) {
    const s = String(v);
    out[k] = s.length > 200 ? `${s.slice(0, 200)}… (${Buffer.byteLength(s)} bytes)` : v;
  }
  return out;
}

const MAX_AUDIT_BYTES = 5_000_000;

async function audit(entry) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n';
  try {
    const size = (await fs.stat(AUDIT).catch(() => ({ size: 0 }))).size;
    if (size > MAX_AUDIT_BYTES) await fs.rename(AUDIT, AUDIT + '.1').catch(() => {});
    await fs.appendFile(AUDIT, line, { mode: 0o600 });
  } catch {
    /* never let logging break the door */
  }
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd: ROOT, ...opts });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => {
      if (out.length < 200_000) out += d;
    });
    p.stderr.on('data', (d) => {
      if (err.length < 10_000) err += d;
    });
    p.on('close', (code) => resolve({ code, out, err }));
    p.on('error', (e) => resolve({ code: -1, out: '', err: String(e) }));
  });
}

// --------------------------------------------------------------- job runner
// Runs a real Claude Code job on this machine, inside the second brain, with
// this machine's own environment. Detached and non-blocking: MCP calls must
// answer in seconds, while a real job can run for minutes. Start it, then poll.

fsSync.mkdirSync(JOBS, { recursive: true });

function jobDir(id) {
  if (!/^[0-9A-Za-z-]{4,40}$/.test(String(id))) throw new Error('Bad job id.');
  const dir = path.join(JOBS, String(id));
  if (!dir.startsWith(JOBS + path.sep)) throw new Error('Bad job id.');
  return dir;
}

// KEY=VALUE lines from the machine's locked env file, loaded in-process so no
// shell ever touches the job. The door's own token never reaches a job.
function jobEnv() {
  const env = { ...process.env };
  delete env.BRAIN_DOOR_TOKEN;
  if (ENV_FILE && fsSync.existsSync(ENV_FILE)) {
    for (const raw of fsSync.readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.replace(/^export\s+/, '').match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      env[m[1]] = v;
    }
  }
  return env;
}

// JOB-LOCK-START
// One Claude job at a time on this whole machine. The door's jobs and the
// scheduled morning job (~/bin/morning-job.sh) share ONE lock file, so a door
// job never starts on top of the morning job, or the other way round.
// Linux: the kernel holds the lock (flock) for exactly as long as the job runs
// and frees it the moment the job ends, even after a crash or a reboot.
// flock runs with -o, so the lock is NOT handed down to the job's own child
// processes: a helper the job leaves behind can never keep the lock after the
// job itself has ended.
// Mac and Windows (no flock): the file holds the running job's process id, and
// an id that is no longer alive is cleared. Age alone never clears it. Only a
// clean "yes, that process exists" counts as alive: after a reboot an old id
// can belong to someone else's process (EPERM), and that is not our job.
// A stale lock is removed by renaming it aside first and checking it is still
// the same dead holder, so a lock another job just took is never deleted.
const JOB_LOCK = process.env.BRAIN_DOOR_JOB_LOCK || path.join(HOME, '.claude-job.lock');
const LOCK_MODE = process.env.BRAIN_DOOR_LOCK_MODE || (process.platform === 'linux' ? 'flock' : 'pid');
const BUSY_EXIT = 75;
const BUSY_MESSAGE =
  'Another Claude job is still running on this machine (a door job or the scheduled morning job). ' +
  'One job at a time: check it with list_jobs, and start this one when it is done. No job was started.';

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false; // ESRCH (gone) and EPERM (someone else's process) both mean: not our job
  }
}

// Remove the lock only if it still names `holder` (the dead id we just read).
// Rename is atomic, so between reading and deleting nobody else's fresh lock
// can be swept away; if the renamed file turns out to be someone else's, it
// goes straight back.
function clearStaleLock(holder) {
  const aside = `${JOB_LOCK}.${process.pid}.stale`;
  try {
    fsSync.renameSync(JOB_LOCK, aside);
  } catch (e) {
    if (e.code === 'ENOENT') return; // already gone
    throw e;
  }
  let now = '';
  try { now = fsSync.readFileSync(aside, 'utf8').trim(); } catch {}
  if (now !== String(holder)) {
    try { fsSync.linkSync(aside, JOB_LOCK); } catch {} // put the live lock back
  }
  fsSync.rmSync(aside, { force: true });
}

// Start `bin args` only when no other Claude job holds the machine-wide lock.
// Throws BUSY_MESSAGE when one does. Returns the child process.
function spawnUnderJobLock(bin, args, opts) {
  if (LOCK_MODE === 'flock') {
    const probe = spawnSync('flock', ['-n', '-E', String(BUSY_EXIT), JOB_LOCK, 'true']);
    if (probe.status === BUSY_EXIT) throw new Error(BUSY_MESSAGE);
    if (probe.status !== 0) {
      throw new Error(`Could not check the one-job lock (${probe.error ? probe.error.message : `flock exit ${probe.status}`}). No job was started.`);
    }
    // flock holds the lock while the job runs; if another job won the race
    // since the probe, it exits BUSY_EXIT without running anything.
    // -o: the job and anything it starts do not inherit the lock; flock itself
    // holds it until the job exits.
    return spawn('flock', ['-n', '-o', '-E', String(BUSY_EXIT), JOB_LOCK, bin, ...args], opts);
  }
  // pid mode: the lock file is created already holding a process id (a hard
  // link of a finished file), so nobody ever reads it half-written.
  const claim = () => {
    const tmp = `${JOB_LOCK}.${process.pid}.claim`;
    fsSync.writeFileSync(tmp, String(process.pid));
    try {
      fsSync.linkSync(tmp, JOB_LOCK);
      return true;
    } catch (e) {
      if (e.code === 'EEXIST') return false;
      throw e;
    } finally {
      fsSync.rmSync(tmp, { force: true });
    }
  };
  if (!claim()) {
    let raw = '';
    try { raw = fsSync.readFileSync(JOB_LOCK, 'utf8').trim(); } catch {}
    if (pidAlive(Number(raw))) throw new Error(BUSY_MESSAGE);
    clearStaleLock(raw); // its holder is dead
    if (!claim()) throw new Error(BUSY_MESSAGE);
  }
  let child;
  try {
    child = spawn(bin, args, opts);
  } catch (e) {
    fsSync.rmSync(JOB_LOCK, { force: true });
    throw e;
  }
  const owner = String(child.pid || process.pid);
  if (child.pid) {
    const tmp = `${JOB_LOCK}.${process.pid}.handover`;
    fsSync.writeFileSync(tmp, owner);
    fsSync.renameSync(tmp, JOB_LOCK); // atomic: the lock now names the job itself
  }
  const release = () => {
    try {
      if (fsSync.readFileSync(JOB_LOCK, 'utf8').trim() === owner) fsSync.rmSync(JOB_LOCK, { force: true });
    } catch {}
  };
  child.once('exit', release);
  child.once('error', release);
  return child;
}
// JOB-LOCK-END

// A hung job would hold the one-job lock forever. On Linux every job runs
// under `timeout`, which stops it after 3 hours (and force-stops it 5 minutes
// later if it ignores that). Everywhere, list_jobs and check_job flag a job
// still "running" past 3 hours, from the start time the door writes down.
const JOB_LIMIT_HOURS = 3;
const TIMEOUT_EXIT = 124;
const useTimeout = LOCK_MODE === 'flock';

function overLimitNote(dir, status) {
  if (status !== 'running') return '';
  let started = NaN;
  try { started = Date.parse(fsSync.readFileSync(path.join(dir, 'started'), 'utf8').trim()); } catch {}
  if (!Number.isFinite(started)) return '';
  const hours = (Date.now() - started) / 3.6e6;
  return hours > JOB_LIMIT_HOURS
    ? ` (WARNING: running for ${hours.toFixed(1)} hours, over the ${JOB_LIMIT_HOURS}-hour limit; it may be stuck and is holding the one-job lock)`
    : '';
}

function startJob(prompt, continueThread) {
  const id = `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${Math.floor(Math.random() * 1e4)}`;
  const dir = path.join(JOBS, id);

  // The prompt travels as a spawn argument, never through a shell, so nothing
  // inside it can be interpreted as a command.
  let args = ['-p', prompt];
  if (continueThread) args.push('--continue');
  let bin = claudeBin();
  if (useTimeout) {
    args = ['-k', '5m', `${JOB_LIMIT_HOURS}h`, bin, ...args];
    bin = 'timeout';
  }

  fsSync.mkdirSync(dir, { recursive: true });
  const out = fsSync.openSync(path.join(dir, 'out.txt'), 'a');
  let child;
  try {
    child = spawnUnderJobLock(bin, args, {
      cwd: ROOT,
      detached: process.platform !== 'win32',
      stdio: ['ignore', out, out],
      env: jobEnv(),
    });
  } catch (e) {
    fsSync.closeSync(out);
    fsSync.rmSync(dir, { recursive: true, force: true });
    throw e;
  }
  fsSync.writeFileSync(path.join(dir, 'prompt.txt'), prompt);
  fsSync.writeFileSync(path.join(dir, 'started'), new Date().toISOString());
  fsSync.writeFileSync(path.join(dir, 'status'), 'running');

  child.on('exit', (code) => {
    try {
      const status =
        code === 0
          ? 'done'
          : LOCK_MODE === 'flock' && code === BUSY_EXIT
            ? 'refused (another Claude job started first; nothing ran)'
            : useTimeout && (code === TIMEOUT_EXIT || code === 137)
              ? `stopped (it ran past the ${JOB_LIMIT_HOURS}-hour limit)`
              : `failed (exit ${code})`;
      fsSync.writeFileSync(path.join(dir, 'status'), status);
    } catch {}
  });
  child.on('error', (e) => {
    try {
      fsSync.writeFileSync(path.join(dir, 'status'), `failed (${e.message})`);
    } catch {}
  });
  child.unref();

  return id;
}

async function readJob(id) {
  const dir = jobDir(id);
  const status = await fs.readFile(path.join(dir, 'status'), 'utf8').catch(() => 'unknown');
  const out = await fs.readFile(path.join(dir, 'out.txt'), 'utf8').catch(() => '');
  const body = out.length > MAX_READ ? out.slice(-MAX_READ) : out;
  return { status: status.trim() + overLimitNote(dir, status.trim()), out: body };
}

// -------------------------------------------------------------------- tools

const TOOLS = [
  {
    name: 'list_dir',
    description:
      "List the files and folders at a path inside the second brain. Use '.' for the top level.",
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: "Folder path relative to the second-brain root, e.g. 'clients' or '.'" } },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a text file from the second brain.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'File path relative to the second-brain root.' } },
      required: ['path'],
    },
  },
  {
    name: 'search',
    description:
      'Search the text of the second brain for a phrase. Returns matching files with line numbers. Use this before reading, to find where something lives.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text or regular expression to search for.' },
        path: { type: 'string', description: 'Optional folder to limit the search to. Defaults to the whole second brain.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'write_file',
    description:
      'Create or overwrite a file in the second brain. The change syncs to the cloud backup on the next sync cycle and reaches the main computer from there.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to the second-brain root.' },
        content: { type: 'string', description: 'Full file contents.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description:
      'Replace an exact block of text in an existing file. Safer than write_file for edits: it fails if the old text is missing or appears more than once.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        old_text: { type: 'string', description: 'Exact text to replace. Must appear exactly once.' },
        new_text: { type: 'string', description: 'Replacement text.' },
      },
      required: ['path', 'old_text', 'new_text'],
    },
  },
  {
    name: 'start_job',
    description:
      'Run a real Claude Code job on the always-on machine, inside the second brain, with every installed skill and tool available. Use this for anything that needs the terminal, a skill, or work too long for a chat reply. Only one Claude job runs on the machine at a time (door jobs and the scheduled morning job share one lock); if one is still running this refuses and nothing starts. Returns a job id straight away; the job keeps running after you answer. Poll it with check_job. Tell the user the job started and roughly what it will do.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description:
            "Exactly what to do, written as you would type it to Claude Code in the second brain. A slash command works, and so does a plain instruction.",
        },
        continue_thread: {
          type: 'boolean',
          description:
            "Continue the machine's most recent Claude conversation instead of starting fresh. Default false.",
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'check_job',
    description:
      'Check a job started with start_job: whether it is still running, and everything it has produced so far. Safe to call repeatedly.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The job id returned by start_job.' } },
      required: ['id'],
    },
  },
  {
    name: 'list_jobs',
    description: 'List the most recent jobs on the always-on machine, newest first, with their status. A job still running after 3 hours is marked with a warning: it may be stuck and is holding the one-job lock.',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function callTool(name, args) {
  switch (name) {
    case 'list_dir': {
      const { abs, rel } = safe(args.path);
      const entries = await fs.readdir(abs, { withFileTypes: true });
      const rows = entries
        .filter((e) => !DENY.some((re) => re.test('/' + [rel === '.' ? '' : rel, e.name].filter(Boolean).join('/'))))
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .sort();
      return `${rel} (${rows.length} entries)\n${rows.join('\n')}`;
    }
    case 'read_file': {
      const { abs, rel } = safe(args.path);
      const stat = await fs.stat(abs);
      if (stat.size > MAX_READ) {
        return `${rel} is ${Math.round(stat.size / 1024)} KB, too big to return whole. Use search to find the part you need.`;
      }
      return await fs.readFile(abs, 'utf8');
    }
    case 'search': {
      const scope = args.path ? safe(args.path).abs : ROOT;
      const { out, code } = await run('grep', [
        '-rInE',
        '--binary-files=without-match',
        '--exclude-dir=.git',
        '--exclude-dir=node_modules',
        '--exclude-dir=personal',
        '--exclude=.env*',
        '-m', '3',
        String(args.query),
        scope,
      ]);
      if (code !== 0 && !out) return `No matches for: ${args.query}`;
      const lines = out
        .split('\n')
        .filter(Boolean)
        .filter((l) => !DENY.some((re) => re.test('/' + path.relative(ROOT, l.split(':')[0]).split(path.sep).join('/'))))
        .slice(0, 60)
        .map((l) => l.replace(ROOT + path.sep, ''));
      return lines.length ? lines.join('\n') : `No matches for: ${args.query}`;
    }
    case 'write_file': {
      const { abs, rel } = safe(args.path);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, String(args.content), 'utf8');
      return `Wrote ${rel} (${Buffer.byteLength(String(args.content))} bytes). It reaches the cloud backup on the next sync cycle.`;
    }
    case 'edit_file': {
      const { abs, rel } = safe(args.path);
      const before = await fs.readFile(abs, 'utf8');
      const hits = before.split(args.old_text).length - 1;
      if (hits === 0) throw new Error(`That exact text is not in ${rel}.`);
      if (hits > 1) throw new Error(`That text appears ${hits} times in ${rel}. Make it unique.`);
      await fs.writeFile(abs, before.replace(args.old_text, args.new_text), 'utf8');
      return `Edited ${rel}. It reaches the cloud backup on the next sync cycle.`;
    }
    case 'start_job': {
      const prompt = String(args.prompt || '').trim();
      if (!prompt) throw new Error('A prompt is required.');
      const id = startJob(prompt, Boolean(args.continue_thread));
      return `Job ${id} started, running in ${ROOT}. It keeps going whether or not this chat stays open. Check it with check_job("${id}").`;
    }
    case 'check_job': {
      const { status, out } = await readJob(args.id);
      return `Job ${args.id} — ${status}\n\n${out || '(no output yet)'}`;
    }
    case 'list_jobs': {
      const ids = (await fs.readdir(JOBS).catch(() => [])).sort().reverse().slice(0, 10);
      if (!ids.length) return 'No jobs have been run yet.';
      const rows = await Promise.all(
        ids.map(async (id) => {
          const s = (await fs.readFile(path.join(JOBS, id, 'status'), 'utf8').catch(() => 'unknown')).trim();
          return `${id} — ${s}${overLimitNote(path.join(JOBS, id), s)}`;
        })
      );
      return rows.join('\n');
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function buildServer() {
  const server = new Server(
    { name: 'second-brain-door', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    try {
      const text = await callTool(name, args);
      await audit({ tool: name, args: auditArgs(args), ok: true });
      return { content: [{ type: 'text', text }] };
    } catch (e) {
      await audit({ tool: name, args: auditArgs(args), ok: false, error: e.message });
      return {
        content: [{ type: 'text', text: `${e instanceof Blocked ? 'Blocked' : 'Error'}: ${e.message}` }],
        isError: true,
      };
    }
  });

  return server;
}

// --------------------------------------------------------------------- http

function authorised(req, url) {
  const header = req.headers.authorization || '';
  if (header === `Bearer ${TOKEN}`) return true;
  if (req.headers['x-brain-door-token'] === TOKEN) return true;
  // secret-path form: /<TOKEN>/mcp
  if (url.pathname === `/${TOKEN}/mcp`) return true;
  return false;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 5_000_000) reject(new Error('body too large'));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : undefined);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok\n');
  }

  const isMcp = url.pathname === '/mcp' || url.pathname === `/${TOKEN}/mcp`;
  if (!isMcp) {
    res.writeHead(404).end();
    return;
  }

  if (!authorised(req, url)) {
    await audit({ tool: '(auth)', ok: false, error: 'unauthorised', ip: req.socket.remoteAddress });
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'unauthorised' }));
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST' }).end();
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    res.writeHead(400).end();
    return;
  }

  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: one server per request
    enableJsonResponse: true,
  });

  res.on('close', () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (e) {
    console.error('request failed', e);
    if (!res.headersSent) res.writeHead(500).end();
  }
});

httpServer.listen(PORT, HOST, () => {
  console.log(`second-brain door listening on http://${HOST}:${PORT}  root=${ROOT}`);
});
