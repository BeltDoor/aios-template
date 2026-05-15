#!/usr/bin/env node
// connect-google.mjs — sign the user into their Google account, in the helper.
// Opens the helper browser (persistent profile) to Google's sign-in page.
// The user signs in like they would anywhere else. Their session lives in the
// helper's profile dir, so future runs remember them.
//
// This script does the SIGN-IN step only. The deeper integration (reading
// Gmail, Calendar, Drive via the Microsoft Graph or Google APIs) is a later
// slice — not built here per the current scope. What this skill ships is:
// the helper is signed into Google.
//
// Usage:
//   node connect-google.mjs   # opens the helper, user signs in, exit on close

import { log, writeState, tryLoadChromium, ROOT, fs, path } from './lib.mjs';

const exit = (code) => { process.exitCode = code; };

const SIGN_IN_URL = 'https://accounts.google.com/';
const TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes — plenty of time for 2FA

async function main() {
  log.step('Google — sign in inside your helper');

  const chromium = await tryLoadChromium();
  if (!chromium) {
    log.fail(
      'The browser tool is not installed yet.',
      'Playwright + Chromium need to be installed before I can open the helper.',
      'Run the install first: node .claude/skills/connect-kit/scripts/install.mjs',
    );
    return exit(1);
  }

  // Same persistent profile the install demo set up — the helper's permanent
  // identity. The sign-in stays put across runs because of this.
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
  console.log('    Sign into your Google account like you would anywhere else.');
  console.log('');
  console.log('  When you are signed in and you see your normal Google page,');
  console.log('  close the helper window. That is how I know you are done.');
  console.log('  ----------------------------------------------------------------');
  console.log('');
  log.info('Waiting for you to sign in and close the helper... (up to 8 minutes)');

  // Wait for the user to close the helper OR an 8-min timeout.
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
      'Run this again when you have a couple of minutes: node .claude/skills/connect-kit/scripts/connect-google.mjs',
    );
    writeState('google', { status: 'timed-out', updated_at: new Date().toISOString() });
    return exit(3);
  }

  // We don't verify the sign-in went through programmatically — Google's
  // post-sign-in page varies, and over-verifying is brittle. We trust the
  // user closed the window because they were done. Deeper integration in a
  // later slice will exercise the session and confirm.
  writeState('google', { status: 'signed-in-via-helper', signed_in_at: new Date().toISOString() });
  log.ok('Google sign-in recorded. Your helper remembers your Google session for future slices.');
  log.info('Deeper Google integration (reading Gmail, Calendar, Drive) lands in a later slice.');
}

main().catch((err) => {
  log.fail('Connecting Google hit an unexpected error.', err.message, 'Show this to your guide.');
  return exit(99);
});
