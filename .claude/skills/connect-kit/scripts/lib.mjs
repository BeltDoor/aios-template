// lib.mjs — shared helpers for the connection kit.
// Everything the connect-kit scripts need in common: finding the folder root,
// reading/writing the .env file, reading/writing state, detecting the OS,
// and loud, clear logging. No external dependencies.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The folder root is the AI Operating System folder — the one with `.claude/`
// in it. scripts/ sits at .claude/skills/connect-kit/scripts/, so root is four
// levels up.
export const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
export const STATE_DIR = path.join(__dirname, '..', 'state');
export const ENV_FILE = path.join(ROOT, '.env');

// --- OS detection ----------------------------------------------------------

export function detectOS() {
  const p = process.platform;
  if (p === 'darwin') return 'mac';
  if (p === 'win32') return 'windows';
  return 'linux';
}

// --- .env handling ---------------------------------------------------------
// The client's secrets live in a gitignored .env at the folder root. Simple
// KEY=value lines. We also fall back to process.env so power users can use
// real environment variables if they prefer.

export function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = fs.readFileSync(ENV_FILE, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      // strip surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key) env[key] = val;
    }
  } catch {
    // no .env yet — that's fine, process.env still applies
  }
  return env;
}

export function getEnv(key) {
  return loadEnv()[key] || null;
}

// Write or update a single KEY=value in the .env file. Preserves other lines.
export function setEnv(key, value) {
  let lines = [];
  try {
    lines = fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
  } catch {
    lines = [];
  }
  let found = false;
  const out = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) return line;
    const k = trimmed.slice(0, trimmed.indexOf('=')).trim();
    if (k === key) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) {
    // drop a trailing blank, append the new line, keep one trailing newline
    while (out.length && out[out.length - 1].trim() === '') out.pop();
    out.push(`${key}=${value}`);
  }
  fs.writeFileSync(ENV_FILE, out.join('\n').replace(/\n*$/, '\n'));
}

// --- state files -----------------------------------------------------------
// Small JSON files under connect-kit/state/ that record what's installed and
// connected, so other skills can check status without re-running anything.

export function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

export function readState(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(STATE_DIR, `${name}.json`), 'utf8'));
  } catch {
    return null;
  }
}

export function writeState(name, obj) {
  ensureDir(STATE_DIR);
  fs.writeFileSync(
    path.join(STATE_DIR, `${name}.json`),
    JSON.stringify({ ...obj, updated_at: new Date().toISOString() }, null, 2),
  );
}

// --- logging ---------------------------------------------------------------
// Loud and clear. These scripts run in front of a non-technical user — every
// message should make sense to them, and failures should never be silent.

export const log = {
  step: (msg) => console.log(`\n=== ${msg} ===`),
  ok: (msg) => console.log(`  [ok] ${msg}`),
  info: (msg) => console.log(`  ${msg}`),
  warn: (msg) => console.log(`  [!] ${msg}`),
  // A failure block: clear headline, plain-English detail, what to do next.
  fail: (headline, detail, nextStep) => {
    console.error(`\n!!! ${headline}`);
    if (detail) console.error(`    ${detail}`);
    if (nextStep) console.error(`    What to do: ${nextStep}`);
    console.error('');
  },
};

// --- running commands ------------------------------------------------------
// npm / npx / gws are .cmd shims on Windows that need a shell. Node warns
// (DEP0190) if you pass an args array WITH shell:true — so we build a single
// quoted command string instead. Works the same on Mac/Linux. Keeps scary
// deprecation warnings off the user's screen.

function buildCommand(parts) {
  return parts.map((p) => (/\s/.test(String(p)) ? `"${p}"` : String(p))).join(' ');
}

// Run a command, streaming its output to the screen.
export function runShell(parts, opts = {}) {
  return spawnSync(buildCommand(parts), { stdio: 'inherit', shell: true, ...opts });
}

// Run a command quietly, capturing its output as a string.
export function runShellQuiet(parts, opts = {}) {
  return spawnSync(buildCommand(parts), { encoding: 'utf8', shell: true, ...opts });
}

// Resolve playwright's chromium without crashing if playwright isn't installed
// yet. Returns the chromium object or null.
export async function tryLoadChromium() {
  try {
    const pw = await import('playwright');
    return pw.chromium;
  } catch {
    return null;
  }
}

export { os, fs, path };
