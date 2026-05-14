#!/usr/bin/env node
// extract-gpts.mjs — bring the user's ChatGPT custom GPTs over.
// Opens a real, visible browser to ChatGPT. The user logs in THEMSELVES — past
// any Cloudflare check, past 2FA. A human passes those fine; a script does not.
// That is the whole lesson from the failed run: do NOT automate the login.
//
// Once the user is logged in, this walks their custom GPT list and saves each
// one's name, description, and instructions into a `custom-gpts/` folder so
// they can become real skills later.
//
// This is NOT on the Slice 1 path. It runs in a later slice (or on request).
// It degrades gracefully — if the crawl can't read everything, it saves what
// it could and tells the user the manual fallback.

import { log, writeState, tryLoadChromium, ROOT, fs, path } from './lib.mjs';

const TIMEOUT_MS = 8 * 60 * 1000;
const OUT_DIR = path.join(ROOT, 'custom-gpts');

// Heuristic: are we logged into ChatGPT? Logged-out pages show a login/sign-up
// form; the app shows a prompt composer. Check for the composer-ish element.
async function isLoggedIn(page) {
  try {
    const url = page.url();
    if (/auth0|login|\/auth\//i.test(url)) return false;
    // the main composer textarea / contenteditable is present once logged in
    const hasComposer = await page.locator('textarea, [contenteditable="true"]').first().isVisible().catch(() => false);
    return hasComposer;
  } catch {
    return false;
  }
}

async function main() {
  log.step('Custom GPTs — bringing them over');

  const chromium = await tryLoadChromium();
  if (!chromium) {
    log.fail('The browser tool is not installed yet.', 'Playwright + Chromium need to be installed first.',
      'Run: node .claude/skills/connect-kit/scripts/install.mjs');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let browser;
  try {
    browser = await chromium.launch({ headless: false });
  } catch (err) {
    log.fail('Could not open the browser.', err.message, 'Re-run the install, then try again.');
    process.exit(2);
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  let browserClosed = false;
  browser.on('disconnected', () => { browserClosed = true; });

  await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});

  console.log('');
  console.log('  ----------------------------------------------------------------');
  console.log('  In the browser window that just opened:');
  console.log('');
  console.log('    1. Sign into your ChatGPT account.');
  console.log('    2. Get all the way in — past any "verify you are human" check,');
  console.log('       past any code on your phone. Land on the normal ChatGPT page.');
  console.log('');
  console.log('  Then just leave the window alone. I will take it from there.');
  console.log('  ----------------------------------------------------------------');
  console.log('');
  log.info('Waiting for you to finish signing in... (up to 8 minutes)');

  // Wait for login.
  const start = Date.now();
  let loggedIn = false;
  while (!loggedIn && !browserClosed && Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 2000));
    loggedIn = await isLoggedIn(page);
  }

  if (browserClosed) {
    log.fail('The browser was closed before sign-in finished.', 'Nothing was captured.',
      'Run this again and complete the sign-in: node .claude/skills/connect-kit/scripts/extract-gpts.mjs');
    process.exit(3);
  }
  if (!loggedIn) {
    log.fail('I could not confirm you were signed in.', 'The sign-in did not complete in time, or ChatGPT changed its page.',
      'Run it again — or, manual fallback: in ChatGPT, open each custom GPT, click Edit, copy its instructions, '
        + 'and tell Claude — Claude will save each one into the custom-gpts/ folder by hand.');
    await browser.close().catch(() => {});
    process.exit(4);
  }
  log.ok('Signed in. Looking for your custom GPTs...');

  // Navigate to the user's GPTs list.
  await page.goto('https://chatgpt.com/gpts/mine', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(3000);

  // Collect GPT links. ChatGPT's DOM changes often — be generous and dedupe.
  let gptLinks = [];
  try {
    gptLinks = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('a[href*="/g/g-"]').forEach((a) => {
        const href = a.getAttribute('href');
        const name = (a.textContent || '').trim();
        if (href) out.push({ href: href.startsWith('http') ? href : `https://chatgpt.com${href}`, name });
      });
      return out;
    });
  } catch {
    gptLinks = [];
  }
  // dedupe by href
  const seen = new Set();
  gptLinks = gptLinks.filter((g) => {
    const base = g.href.split('?')[0];
    if (seen.has(base)) return false;
    seen.add(base);
    return true;
  });

  if (gptLinks.length === 0) {
    log.warn('I could not find any custom GPTs on that page.');
    log.info('Either there are none, or ChatGPT changed its layout.');
    log.info('Manual fallback: open each GPT in ChatGPT, click Edit, copy its instructions, and tell Claude to save them.');
    writeState('gpts', { status: 'no-gpts-found', count: 0 });
    await browser.close().catch(() => {});
    return;
  }

  log.ok(`Found ${gptLinks.length} custom GPT(s). Saving each one...`);
  const saved = [];

  for (const gpt of gptLinks) {
    try {
      // The edit page exposes the name + description + instructions.
      const editUrl = `${gpt.href.split('?')[0]}/edit`;
      await page.goto(editUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(2500);

      const data = await page.evaluate(() => {
        const grab = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return '';
          return (el.value || el.textContent || '').trim();
        };
        // best-effort selectors — ChatGPT's edit form fields
        const all = [...document.querySelectorAll('input, textarea')];
        const byPlaceholder = (re) => {
          const el = all.find((e) => re.test(e.getAttribute('placeholder') || '') || re.test(e.getAttribute('name') || ''));
          return el ? (el.value || el.textContent || '').trim() : '';
        };
        return {
          name: byPlaceholder(/name/i) || document.title || '',
          description: byPlaceholder(/description/i),
          instructions: byPlaceholder(/instruction/i) || grab('textarea'),
        };
      });

      const name = (data.name || gpt.name || 'untitled-gpt').trim();
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled-gpt';
      const file = path.join(OUT_DIR, `${slug}.md`);
      const body = [
        `# ${name}`,
        '',
        `**Source:** ${gpt.href.split('?')[0]}`,
        '',
        '## Description',
        '',
        data.description || '(none captured — add by hand if needed)',
        '',
        '## Instructions',
        '',
        data.instructions || '(could not capture automatically — open this GPT in ChatGPT, click Edit, and paste its instructions here)',
        '',
      ].join('\n');
      fs.writeFileSync(file, body);
      saved.push({ name, file: path.relative(ROOT, file), gotInstructions: !!data.instructions });
      log.info(`  saved: ${name}`);
    } catch (err) {
      log.warn(`  couldn't fully read one GPT (${gpt.name || gpt.href}) — ${err.message}`);
    }
  }

  await browser.close().catch(() => {});

  const incomplete = saved.filter((s) => !s.gotInstructions);
  writeState('gpts', { status: 'done', count: saved.length, incomplete: incomplete.length });
  log.step('Custom GPTs — done');
  log.ok(`Saved ${saved.length} GPT(s) into the custom-gpts/ folder.`);
  if (incomplete.length) {
    log.warn(`${incomplete.length} of them — I got the name but not the full instructions.`);
    log.info('For those: open the GPT in ChatGPT, click Edit, copy the instructions, and tell Claude to fill them in.');
  }
}

main().catch((err) => {
  log.fail('Bringing over the custom GPTs hit an unexpected error.', err.message, 'Show this to your guide.');
  process.exit(99);
});
