#!/usr/bin/env node
// install.mjs — the background install step.
// Installs Playwright + a Chromium browser into this folder so the connection
// kit can drive a real, visible browser later. Runs in the parallel window
// during Module 1 while the user keeps working in their main window.
//
// This script assumes Node is already present (it's a Node script). The
// connect-kit SKILL.md checks for Node BEFORE running this — if Node is
// missing it never gets here.

import { fileURLToPath } from 'node:url';
import { ROOT, log, writeState, detectOS, runShell, tryLoadChromium, fs, path } from './lib.mjs';

const NODE_MAJOR = parseInt(process.versions.node.split('.')[0], 10);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELLO_HTML = path.join(SCRIPT_DIR, '..', 'hello.html');
const DEMO = process.argv.includes('--demo');

function run(parts) {
  log.info(`> ${parts.join(' ')}`);
  const r = runShell(parts, { cwd: ROOT });
  return r.status === 0;
}

function playwrightInstalled() {
  // playwright is installed locally if node_modules/playwright exists at root
  return fs.existsSync(path.join(ROOT, 'node_modules', 'playwright', 'package.json'));
}

async function chromiumReady() {
  try {
    const { chromium } = await import('playwright');
    // executablePath() throws if the browser binary isn't downloaded
    const p = chromium.executablePath();
    return !!p && fs.existsSync(p);
  } catch {
    return false;
  }
}

async function main() {
  log.step('Connection kit — install');
  writeState('install', { status: 'running', step: 'starting' });

  // 1. Node version check
  log.info(`Node version: ${process.versions.node}`);
  if (NODE_MAJOR < 18) {
    log.fail(
      'Your Node version is too old.',
      `This needs Node 18 or newer — you have ${process.versions.node}.`,
      'Tell your guide: "Node needs updating." They install the latest from nodejs.org. Then run this again.',
    );
    writeState('install', { status: 'error', step: 'node-version', detail: `node ${process.versions.node} < 18` });
    process.exit(1);
  }
  log.ok('Node is good.');

  // 2. Install the playwright package (if not already there)
  if (playwrightInstalled()) {
    log.ok('Playwright package already installed.');
  } else {
    log.info('Installing the Playwright package... (this takes a minute — you can ignore this window)');
    writeState('install', { status: 'running', step: 'npm-install-playwright' });
    const ok = run(['npm', 'install', 'playwright@latest', '--no-audit', '--no-fund', '--loglevel=error']);
    if (!ok || !playwrightInstalled()) {
      log.fail(
        'Could not install the Playwright package.',
        'The npm install step failed. This is usually a network issue or npm not being available.',
        'Tell your guide: "Playwright npm install failed." Check internet, then run this script again: node .claude/skills/connect-kit/scripts/install.mjs',
      );
      writeState('install', { status: 'error', step: 'npm-install-playwright' });
      process.exit(2);
    }
    log.ok('Playwright package installed.');
  }

  // 3. Download the Chromium browser binary
  if (await chromiumReady()) {
    log.ok('Chromium browser already downloaded.');
  } else {
    log.info('Downloading the Chromium browser... (largest step — a few minutes — ignore this window)');
    writeState('install', { status: 'running', step: 'playwright-install-chromium' });
    const ok = run(['npx', '--yes', 'playwright', 'install', 'chromium']);
    if (!ok || !(await chromiumReady())) {
      log.fail(
        'Could not download the Chromium browser.',
        'The browser download failed — usually a network interruption.',
        'Tell your guide: "Chromium download failed." Re-run: node .claude/skills/connect-kit/scripts/install.mjs',
      );
      writeState('install', { status: 'error', step: 'playwright-install-chromium' });
      process.exit(3);
    }
    log.ok('Chromium browser downloaded.');
  }

  // 4. Done
  writeState('install', {
    status: 'done',
    step: 'complete',
    os: detectOS(),
    node: process.versions.node,
  });
  log.step('Install complete');
  log.ok('The connection kit is ready.');

  // 5. Optional demo — opens the helper browser to a branded splash so the
  //    user can actually SEE the thing they just installed. Triggered by the
  //    --demo flag from Module 1's Step 3.
  if (DEMO) {
    await demo();
  }
}

async function demo() {
  log.step('Opening your helper browser now...');
  const chromium = await tryLoadChromium();
  if (!chromium) {
    log.warn('Could not load the browser tool for the demo — the install itself is still fine.');
    return;
  }
  // Use a persistent context with a named profile dir in the folder. This is
  // the helper's own permanent profile — totally separate from the user's real
  // Chrome (different files, different cookies, different everything), AND it
  // means future runs reuse the session (the user signs into Google or
  // Microsoft once, not every time). The dir is gitignored.
  const profileDir = path.join(ROOT, '.aios-browser-profile');
  fs.mkdirSync(profileDir, { recursive: true });

  let context;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: { width: 1100, height: 720 },
    });
  } catch (err) {
    log.warn(`Could not open the helper browser for the demo (${err.message}). The install itself is fine.`);
    return;
  }

  const page = (context.pages()[0]) || (await context.newPage());
  // Build a file:// URL the browser will accept on both Mac and Windows.
  const fileUrl = 'file://' + HELLO_HTML.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:');
  await page.goto(fileUrl).catch(() => {});

  log.info('The helper browser is open. Sign into Google or Microsoft from the page that just appeared — or just close the window if you want to do this later.');
  log.info('This script will exit when you close the helper window (or after 8 minutes, whichever comes first).');

  // Wait for the user to close the helper, OR an 8-minute timeout. 8 min gives
  // them plenty of time to sign in (Google's 2FA / Microsoft's MFA can take a
  // minute or two).
  await Promise.race([
    new Promise((r) => context.on('close', r)),
    new Promise((r) => setTimeout(r, 8 * 60 * 1000)),
  ]);
  await context.close().catch(() => {});
  log.ok('Demo done. Your helper is installed.');
  log.info('If you signed in just now, your helper will remember the session next time it opens.');
}

main().catch((err) => {
  log.fail('The install hit an unexpected error.', err.message, 'Show this to your guide and re-run the install script.');
  writeState('install', { status: 'error', step: 'exception', detail: err.message });
  process.exit(99);
});
