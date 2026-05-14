#!/usr/bin/env node
// verify.mjs — the safety net.
// Checks whether a connection is actually live before a slice depends on it.
// Never assumes — always tests. Run this before Beat 4 of any slice.
//
// Usage:
//   node verify.mjs --check install   # is Playwright + Chromium ready
//   node verify.mjs --check otter     # is the Otter key set + working
//   node verify.mjs --check google    # is gws installed + authed
//   node verify.mjs --check all       # everything
//
// Exit code 0 = the checked thing passed. Non-zero = it failed.


import { ROOT, log, getEnv, readState, runShellQuiet, fs, path } from './lib.mjs';

// Set the exit code without calling Node's process.exit(). Calling that while
// a fetch socket is still tearing down triggers a libuv assertion on Windows.
// Setting exitCode and returning lets Node exit cleanly on its own.
const exit = (code) => { process.exitCode = code; };

const arg = process.argv.indexOf('--check');
const target = arg !== -1 ? process.argv[arg + 1] : 'all';

// --- install --------------------------------------------------------------

async function checkInstall() {
  const state = readState('install');
  const pkg = fs.existsSync(path.join(ROOT, 'node_modules', 'playwright', 'package.json'));
  let chromium = false;
  try {
    const { chromium: c } = await import('playwright');
    const p = c.executablePath();
    chromium = !!p && fs.existsSync(p);
  } catch {
    chromium = false;
  }

  if (pkg && chromium) {
    log.ok('Install: Playwright + Chromium are ready.');
    return true;
  }
  if (state && state.status === 'running') {
    log.warn('Install: still running in the background — not finished yet.');
  } else if (state && state.status === 'error') {
    log.fail(
      'Install: the background install errored.',
      `It stopped at: ${state.step || 'unknown step'}.`,
      'Flip to the connection-kit window and re-run: node .claude/skills/connect-kit/scripts/install.mjs',
    );
  } else {
    log.fail(
      'Install: Playwright is not installed yet.',
      `Playwright package: ${pkg ? 'yes' : 'no'}. Chromium browser: ${chromium ? 'yes' : 'no'}.`,
      'Run the install in a window: node .claude/skills/connect-kit/scripts/install.mjs',
    );
  }
  return false;
}

// --- otter ----------------------------------------------------------------

async function checkOtter() {
  const key = getEnv('OTTER_API_KEY');
  if (!key) {
    log.fail(
      'Otter: no key found.',
      'OTTER_API_KEY is not in your .env file.',
      'Connect Otter first: node .claude/skills/connect-kit/scripts/connect-otter.mjs',
    );
    return false;
  }
  try {
    const res = await fetch('https://otter.ai/forward/api/public/me', {
      headers: { Authorization: `Bearer ${key}` },
    });
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      const me = await res.json();
      log.ok(`Otter: connected as ${me.email || me.first_name || 'your account'}.`);
      return true;
    }
    log.fail(
      'Otter: the key did not work.',
      `The Otter check returned ${res.status} (${ct || 'no content type'}).`,
      'Re-connect Otter: node .claude/skills/connect-kit/scripts/connect-otter.mjs',
    );
    return false;
  } catch (err) {
    log.fail('Otter: could not reach Otter.', err.message, 'Check your internet, then try again.');
    return false;
  }
}

// --- google (gws) ---------------------------------------------------------

function checkGoogle() {
  const v = runShellQuiet(['gws', '--version']);
  if (v.status !== 0) {
    log.fail(
      'Google: the gws tool is not installed.',
      'gws is the tool that connects Gmail, Calendar, and Drive.',
      'Connect Google first: node .claude/skills/connect-kit/scripts/connect-google.mjs',
    );
    return false;
  }
  const status = runShellQuiet(['gws', 'auth', 'status']);
  const out = `${status.stdout || ''}${status.stderr || ''}`.toLowerCase();
  if (status.status === 0 && (out.includes('authenticated') || out.includes('logged in') || out.includes('active'))) {
    log.ok('Google: gws is installed and signed in.');
    return true;
  }
  log.fail(
    'Google: gws is installed but not signed in.',
    'You have the tool, but no Google account is connected yet.',
    'Connect Google: node .claude/skills/connect-kit/scripts/connect-google.mjs',
  );
  return false;
}

// --- main -----------------------------------------------------------------

async function main() {
  log.step(`Verify: ${target}`);
  let pass = true;

  if (target === 'install' || target === 'all') pass = (await checkInstall()) && pass;
  if (target === 'otter' || target === 'all') pass = (await checkOtter()) && pass;
  if (target === 'google' || target === 'all') pass = checkGoogle() && pass;

  if (!['install', 'otter', 'google', 'all'].includes(target)) {
    log.fail('Unknown check.', `"${target}" is not a thing I can check.`, 'Use: --check install | otter | google | all');
    return exit(2);
  }

  console.log('');
  if (pass) {
    log.ok(`Verify ${target}: PASS`);
    return exit(0);
  }
  log.warn(`Verify ${target}: FAIL — see the message(s) above.`);
  return exit(1);
}

main().catch((err) => {
  log.fail('Verify hit an unexpected error.', err.message, 'Show this to your guide.');
  return exit(99);
});
