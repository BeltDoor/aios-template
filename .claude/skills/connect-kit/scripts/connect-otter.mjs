#!/usr/bin/env node
// connect-otter.mjs — connect the user's Otter account.
// Opens a real, visible browser. The user signs into THEIR Otter account and
// creates their API key in the Otter settings. This script watches the network
// quietly and catches the key the moment Otter hands it over — no clicking
// through Otter's menus for them, no guessing at Otter's buttons.
//
// All user interaction happens IN THE BROWSER, never in the terminal — this
// script is launched by Claude, not typed into by a human.
//
// Two modes:
//   node connect-otter.mjs            # open the browser, auto-catch the key
//   node connect-otter.mjs --key KEY  # manual fallback: save a key the user
//                                       copied themselves, then verify it
//
// Otter key facts (verified — references/otter-api.md):
//   - Pro plan only. The key is created under Settings -> Integrations -> Zapier.
//   - The plaintext key is shown ONCE, in the network response to
//     POST /forward/api/v1/api_key/create. Otter's UI never shows it again.
//   - If a key already exists, the user deletes it (trash icon) and the
//     "API Key" button reappears.

import { getEnv, setEnv, log, writeState, tryLoadChromium, ROOT, fs, path } from './lib.mjs';

// Set the exit code without calling Node's process.exit() — doing that while a
// fetch socket is tearing down triggers a libuv assertion on Windows.
const exit = (code) => { process.exitCode = code; };

const KEY_RE = /otterai_[A-Za-z0-9_-]{20,}/;
const CREATE_PATH = '/forward/api/v1/api_key/create';
const TIMEOUT_MS = 6 * 60 * 1000; // 6 minutes for the user to log in + create the key

// --- verify a key against the live API ------------------------------------

async function verifyKey(key) {
  try {
    const res = await fetch('https://otter.ai/forward/api/public/me', {
      headers: { Authorization: `Bearer ${key}` },
    });
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      const me = await res.json();
      return { ok: true, email: me.email || me.first_name || 'your account' };
    }
    return { ok: false, detail: `Otter check returned ${res.status}` };
  } catch (err) {
    return { ok: false, detail: err.message };
  }
}

function saveAndReport(key, email) {
  setEnv('OTTER_API_KEY', key);
  writeState('otter', { status: 'connected', connected_at: new Date().toISOString(), account: email });
  log.ok(`Otter connected as ${email}.`);
  log.info('Your key is saved in the folder\'s .env file (which is gitignored — it stays private).');
}

// --- manual fallback: --key MODE ------------------------------------------

async function manualMode() {
  const idx = process.argv.indexOf('--key');
  const key = (process.argv[idx + 1] || '').trim();
  log.step('Otter — saving the key you provided');
  if (!key || !KEY_RE.test(key)) {
    log.fail(
      'That does not look like an Otter key.',
      `An Otter key looks like "otterai_..." — I got: ${key ? key.slice(0, 12) + '...' : '(nothing)'}`,
      'Copy the full key from your Otter screen and try again.',
    );
    return exit(1);
  }
  const v = await verifyKey(key);
  if (!v.ok) {
    log.fail('That key did not work against Otter.', v.detail, 'Double-check you copied the whole key, or create a fresh one.');
    return exit(2);
  }
  saveAndReport(key, v.email);
}

// --- auto mode: open the browser, watch the network -----------------------

async function autoMode() {
  log.step('Otter — connecting');

  // already connected?
  const existing = getEnv('OTTER_API_KEY');
  if (existing && KEY_RE.test(existing)) {
    const v = await verifyKey(existing);
    if (v.ok) {
      log.ok(`Otter is already connected as ${v.email}. Nothing to do.`);
      writeState('otter', { status: 'connected', account: v.email, note: 'already connected' });
      return;
    }
  }

  const chromium = await tryLoadChromium();
  if (!chromium) {
    log.fail(
      'The browser tool is not installed yet.',
      'Playwright + Chromium need to be installed before I can open Otter.',
      'Run the install first: node .claude/skills/connect-kit/scripts/install.mjs',
    );
    return exit(3);
  }

  log.info('Opening Otter in your helper browser now. Watch your screen.');
  // Use the helper's persistent profile dir — same one Module 1 set up. That
  // way the user's session here doesn't get treated as a brand-new device
  // every run (which can trigger logouts on other browsers).
  const profileDir = path.join(ROOT, '.aios-browser-profile');
  fs.mkdirSync(profileDir, { recursive: true });

  let context;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: { width: 1280, height: 900 },
    });
  } catch (err) {
    log.fail('Could not open the browser.', err.message, 'Re-run the install, then try again.');
    return exit(4);
  }

  const page = (context.pages()[0]) || (await context.newPage());

  let capturedKey = null;

  // Watch every network response. The key shows up exactly once, in the
  // response to the api_key/create call. We don't touch Otter's buttons —
  // the user clicks; we just listen.
  context.on('response', async (response) => {
    try {
      const url = response.url();
      if (!url.includes(CREATE_PATH)) return;
      const text = await response.text();
      // Try structured fields first, then a plain regex over the whole body.
      let key = null;
      try {
        const json = JSON.parse(text);
        key = json?.api_key?.secret || json?.secret || null;
      } catch {
        /* not json — fall through to regex */
      }
      if (!key) {
        const m = text.match(KEY_RE);
        if (m) key = m[0];
      }
      if (key) capturedKey = key;
    } catch {
      /* ignore — a body we couldn't read is not the one we want */
    }
  });

  await page.goto('https://otter.ai/login', { waitUntil: 'domcontentloaded' }).catch(() => {});

  // Print the instructions the USER follows IN THE BROWSER.
  console.log('');
  console.log('  ----------------------------------------------------------------');
  console.log('  In the browser window that just opened:');
  console.log('');
  console.log('    1. Sign into your Otter account.');
  console.log('    2. Click your profile, go to  Settings  ->  Integrations.');
  console.log('    3. Find the  Zapier  section.');
  console.log('       - If you already have a key shown there: click the trash');
  console.log('         icon next to it and confirm "Yes, delete".');
  console.log('    4. Click the  "API Key"  button.');
  console.log('');
  console.log('  That is it. I am watching automatically — the moment Otter');
  console.log('  creates the key, I catch it. You do not need to copy anything.');
  console.log('  ----------------------------------------------------------------');
  console.log('');
  log.info('Waiting for you to create the key... (up to 6 minutes)');

  // Wait for either: the key gets captured, the browser gets closed, or timeout.
  const start = Date.now();
  let browserClosed = false;
  context.on('close', () => {
    browserClosed = true;
  });

  while (!capturedKey && !browserClosed && Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (capturedKey) {
    log.ok('Caught the key.');
    const v = await verifyKey(capturedKey);
    await context.close().catch(() => {});
    if (!v.ok) {
      log.fail(
        'I caught a key but it did not verify against Otter.',
        v.detail,
        'Try again — or copy the key from your Otter screen and tell Claude; it can save it the manual way.',
      );
      return exit(5);
    }
    saveAndReport(capturedKey, v.email);
    return;
  }

  await context.close().catch(() => {});

  if (browserClosed) {
    log.fail(
      'The browser was closed before the key was created.',
      'No key was captured.',
      'Run this again and complete the steps in the browser: node .claude/skills/connect-kit/scripts/connect-otter.mjs',
    );
    return exit(6);
  }

  // Timed out. Hand to the manual fallback path.
  log.fail(
    'I did not catch the key automatically.',
    'Either the key was not created, or Otter changed how that page works.',
    'MANUAL FALLBACK: if you can see the key on your Otter screen (it starts with "otterai_"), '
      + 'copy the whole thing and tell Claude — Claude will save it by running this with --key.',
  );
  return exit(7);
}

// --- entry ----------------------------------------------------------------

(async () => {
  if (process.argv.includes('--key')) {
    await manualMode();
  } else {
    await autoMode();
  }
})().catch((err) => {
  log.fail('Connecting Otter hit an unexpected error.', err.message, 'Show this to your guide.');
  return exit(99);
});
