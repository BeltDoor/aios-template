#!/usr/bin/env node
// install.mjs — the background install step.
// Installs Playwright + a Chromium browser into this folder so the connection
// kit can drive a real, visible browser later. Runs in the parallel window
// during Module 1 while the user keeps working in their main window.
//
// This script assumes Node is already present (it's a Node script). The
// connect-kit SKILL.md checks for Node BEFORE running this — if Node is
// missing it never gets here.

import { ROOT, log, writeState, detectOS, runShell, fs, path } from './lib.mjs';

const NODE_MAJOR = parseInt(process.versions.node.split('.')[0], 10);

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
  log.info('You can leave this window alone now. Your main window will check on this when it needs it.');
}

main().catch((err) => {
  log.fail('The install hit an unexpected error.', err.message, 'Show this to your guide and re-run the install script.');
  writeState('install', { status: 'error', step: 'exception', detail: err.message });
  process.exit(99);
});
