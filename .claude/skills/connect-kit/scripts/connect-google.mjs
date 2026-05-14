#!/usr/bin/env node
// connect-google.mjs — connect Gmail, Google Calendar, and Google Drive.
// Uses `gws` (the Google Workspace CLI). gws opens its own browser for sign-in,
// so the user's only job is signing into their own Google account.
//
// This is NOT on the Slice 1 (Meetings) path — Slice 1 connects Otter. This
// runs in a later slice that needs Gmail/Calendar/Drive.
//
// The OAuth client file (the app identity) is the GUIDE's — it must already be
// at ~/.config/gws/client_secret.json before this runs. If it's not there,
// this script STOPS and says so. It does not try to create one.

import os from 'node:os';
import path from 'node:path';
import { log, writeState, runShell, runShellQuiet, fs } from './lib.mjs';

const CLIENT_FILE = path.join(os.homedir(), '.config', 'gws', 'client_secret.json');

const sh = (parts) => runShell(parts);
const shQuiet = (parts) => runShellQuiet(parts);

async function main() {
  log.step('Google — connecting Gmail, Calendar, Drive');

  // 1. Is gws installed?
  let v = shQuiet(['gws', '--version']);
  if (v.status !== 0) {
    log.info('The gws tool is not installed yet — installing it now...');
    const inst = sh(['npm', 'install', '-g', '@googleworkspace/cli', '--no-audit', '--no-fund', '--loglevel=error']);
    v = shQuiet(['gws', '--version']);
    if (inst.status !== 0 || v.status !== 0) {
      log.fail(
        'Could not install the gws tool.',
        'gws is what connects Gmail, Calendar, and Drive. The install needs npm (comes with Node).',
        'Tell your guide: "gws install failed." They can install it from the Google Workspace CLI releases page.',
      );
      writeState('google', { status: 'error', step: 'install' });
      process.exit(1);
    }
  }
  log.ok(`gws is installed (${(v.stdout || '').trim() || 'version ok'}).`);

  // 2. Is the OAuth client file in place? (the guide's prep)
  if (!fs.existsSync(CLIENT_FILE)) {
    log.fail(
      'The Google sign-in file is not in place yet.',
      `gws needs the app identity file at: ${CLIENT_FILE}`,
      'Tell your guide: "the Google client file isn\'t in place yet." It is a quick thing for them to drop in. '
        + 'Then come back and run this again.',
    );
    writeState('google', { status: 'blocked', step: 'client-file-missing' });
    process.exit(2);
  }
  log.ok('Google sign-in file is in place.');

  // 3. Already signed in?
  const status = shQuiet(['gws', 'auth', 'status']);
  const statusOut = `${status.stdout || ''}${status.stderr || ''}`.toLowerCase();
  if (status.status === 0 && (statusOut.includes('authenticated') || statusOut.includes('active') || statusOut.includes('logged in'))) {
    log.ok('Google is already connected. Nothing to do.');
    writeState('google', { status: 'connected', note: 'already connected' });
    return;
  }

  // 4. Sign in. gws opens a browser; the user signs in there.
  console.log('');
  console.log('  ----------------------------------------------------------------');
  console.log('  A browser window is about to open.');
  console.log('  Sign into YOUR Google account and approve the access it asks for.');
  console.log('  That is the one and only thing you need to do.');
  console.log('  ----------------------------------------------------------------');
  console.log('');

  const login = sh(['gws', 'auth', 'login', '-s', 'gmail,calendar,drive']);
  if (login.status !== 0) {
    log.fail(
      'The Google sign-in did not go through.',
      'This is often because the Google account needs to be added as a test user on the app.',
      'Tell your guide: "the Google account may need to be added as a test user." That is a one-click thing on their end. '
        + 'Then run this again.',
    );
    writeState('google', { status: 'error', step: 'auth-login' });
    process.exit(3);
  }

  // 5. Confirm
  const confirm = shQuiet(['gws', 'auth', 'status']);
  const confirmOut = `${confirm.stdout || ''}${confirm.stderr || ''}`.toLowerCase();
  if (confirm.status === 0 && (confirmOut.includes('authenticated') || confirmOut.includes('active') || confirmOut.includes('logged in'))) {
    log.ok('Google is connected — Gmail, Calendar, and Drive are reachable now.');
    writeState('google', { status: 'connected', connected_at: new Date().toISOString() });
    return;
  }

  log.fail(
    'Sign-in finished but I could not confirm it.',
    'gws ran, but the status check did not come back as connected.',
    'Run the verify step: node .claude/skills/connect-kit/scripts/verify.mjs --check google',
  );
  writeState('google', { status: 'unconfirmed' });
  process.exit(4);
}

main().catch((err) => {
  log.fail('Connecting Google hit an unexpected error.', err.message, 'Show this to your guide.');
  process.exit(99);
});
