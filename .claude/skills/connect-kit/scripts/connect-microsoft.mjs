#!/usr/bin/env node
// connect-microsoft.mjs — sign the user into their Microsoft 365 account, in
// the helper. Opens the helper browser (persistent profile) to Microsoft's
// sign-in page. The user signs in like they would anywhere else. Their session
// lives in the helper's profile dir, so future runs remember them.
//
// This script does the SIGN-IN step only. Deeper integration (reading Outlook
// mail, Calendar, OneDrive via Microsoft Graph) is a later slice — Microsoft's
// own `mgc` CLI is being retired in Aug 2026, so the framework path we'll
// take is raw Microsoft Graph over HTTP (same pattern as otter-pull.mjs uses
// for Otter). Not built here per current scope.
//
// Usage:
//   node connect-microsoft.mjs   # opens the helper, user signs in, exit on close

import { log, writeState, tryLoadChromium, ROOT, fs, path } from './lib.mjs';

const exit = (code) => { process.exitCode = code; };

const SIGN_IN_URL = 'https://login.microsoftonline.com/';
const TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes — plenty of time for MFA

async function main() {
  log.step('Microsoft — sign in inside your helper');

  const chromium = await tryLoadChromium();
  if (!chromium) {
    log.fail(
      'The browser tool is not installed yet.',
      'Playwright + Chromium need to be installed before I can open the helper.',
      'Run the install first: node .claude/skills/connect-kit/scripts/install.mjs',
    );
    return exit(1);
  }

  const profileDir = path.join(ROOT, '.aios-browser-profile');
  fs.mkdirSync(profileDir, { recursive: true });

  let context;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: { width: 1280, height: 900 },
    });
  } catch (err) {
    log.fail('Could not open the helper browser.', err.message, 'Re-run the install, then try again.');
    return exit(2);
  }

  const page = (context.pages()[0]) || (await context.newPage());
  await page.goto(SIGN_IN_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});

  console.log('');
  console.log('  ----------------------------------------------------------------');
  console.log('  In the helper window that just opened:');
  console.log('');
  console.log('    Sign into your Microsoft 365 / Outlook account like you would');
  console.log('    anywhere else. Personal Microsoft accounts also work.');
  console.log('');
  console.log('  When you are signed in and you see your normal Microsoft page,');
  console.log('  close the helper window. That is how I know you are done.');
  console.log('  ----------------------------------------------------------------');
  console.log('');
  log.info('Waiting for you to sign in and close the helper... (up to 8 minutes)');

  let closed = false;
  context.on('close', () => { closed = true; });
  const start = Date.now();
  while (!closed && Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 1000));
  }

  await context.close().catch(() => {});

  if (!closed) {
    log.fail(
      'Timed out waiting for sign-in.',
      'The helper was still open after 8 minutes.',
      'Run this again when you have a couple of minutes: node .claude/skills/connect-kit/scripts/connect-microsoft.mjs',
    );
    writeState('microsoft', { status: 'timed-out', updated_at: new Date().toISOString() });
    return exit(3);
  }

  writeState('microsoft', { status: 'signed-in-via-helper', signed_in_at: new Date().toISOString() });
  log.ok('Microsoft sign-in recorded. Your helper remembers your Microsoft session for future slices.');
  log.info('Deeper Microsoft integration (reading Outlook, Calendar, OneDrive) lands in a later slice.');
}

main().catch((err) => {
  log.fail('Connecting Microsoft hit an unexpected error.', err.message, 'Show this to your guide.');
  return exit(99);
});
