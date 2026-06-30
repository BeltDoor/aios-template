#!/usr/bin/env node
// render-card.mjs — the image PLUG for /debrief's Phase 6 LinkedIn-post step.
//
// SWAPPABLE SEAM: today this renders an on-brand card via the branded-styles lab
// (local headless Chrome). When the parallel image work productionizes a renderer,
// repoint LAB_DIR (or the render call) and NOTHING else in /debrief changes.
//
// Contract:
//   node render-card.mjs --style <name> --quote "<short pull-quote>" \
//     [--highlight "<phrase>"] [--theme <name>] --out <abs .png path>
//   -> writes an on-brand PNG at --out, prints the path on stdout. Exit !=0 on failure.
//   --theme picks one of the on-brand color schemes in state/image-queue.json
//   (midnight / gold / bone). Omit it to use the brand default colors.
//
// Styles are <name>.tpl.html files in the lab's templates/ dir, filled with the
// King Intelligence brand (brands.json id "king"). Add a style by dropping a new
// template (same {{TOKENS}}) and appending its name to state/image-queue.json.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { dirname } from 'path';

// --- config (the seam) -------------------------------------------------------
// LAB_DIR: absolute path to your branded-styles lab folder (from the content app).
// Set the LAB_DIR env var or edit this constant to your local path before running.
const LAB_DIR  = process.env.LAB_DIR || '';
// CHROME: absolute path to your Chrome executable. Set CHROME_PATH env var or edit here.
// On Mac: typically '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
// On Windows: typically 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const CHROME   = process.env.CHROME_PATH || '';
const BRAND_ID = 'king';
const W = 1080, H = 1350; // 4:5 portrait, LinkedIn-friendly

// --- args --------------------------------------------------------------------
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) { args[argv[i].slice(2)] = argv[i + 1]; i++; }
}
const style     = args.style || 'quote';
const quote     = args.quote;
const highlight = args.highlight || '';
const out       = args.out;

if (!LAB_DIR) { console.error('LAB_DIR env var not set — set it to the absolute path of your branded-styles folder'); process.exit(3); }
if (!quote || !out) {
  console.error('usage: render-card.mjs --style <name> --quote "<text>" [--highlight "<phrase>"] --out <abs.png>');
  process.exit(2);
}
if (!CHROME) { console.error('CHROME_PATH env var not set and no default Chrome path configured'); process.exit(3); }
if (!existsSync(CHROME)) { console.error('Chrome not found at ' + CHROME); process.exit(3); }

// --- brand config ------------------------------------------------------------
const brands = JSON.parse(readFileSync(LAB_DIR + '/brands.json', 'utf8'));
const b = brands.find((x) => x.id === BRAND_ID);
if (!b) { console.error('brand "' + BRAND_ID + '" not in brands.json'); process.exit(4); }

// --- optional color theme override (rotating on-brand schemes) ----------------
// Keeps the layout identical but swaps the color scheme so consecutive cards
// don't look the same. Themes live in state/image-queue.json (all black+gold family).
if (args.theme) {
  try {
    const themeFile = new URL('../state/image-queue.json', import.meta.url);
    const themes = (JSON.parse(readFileSync(themeFile, 'utf8')).themes) || [];
    const t = themes.find((x) => x.name === args.theme);
    if (t) { b.bg = t.bg; b.text = t.text; b.accent = t.accent; if (t.logo) b.logo = t.logo; }
    else console.error('theme "' + args.theme + '" not found in image-queue.json, using brand default colors');
  } catch (e) { console.error('could not load themes (' + e.message + '), using brand default colors'); }
}

// --- style template (fallback to quote) --------------------------------------
let tplPath = LAB_DIR + '/templates/' + style + '.tpl.html';
if (!existsSync(tplPath)) {
  console.error('style "' + style + '" has no template, falling back to quote');
  tplPath = LAB_DIR + '/templates/quote.tpl.html';
}
const tpl = readFileSync(tplPath, 'utf8');

// --- fill tokens (mirrors the lab's render.mjs) ------------------------------
const assetUrl = (f) => 'file:///' + LAB_DIR + '/assets/' + f;
const logoHtml = b.logo
  ? `<img src="${assetUrl(b.logo)}" alt="${b.name}">`
  : `<div class="mono">${b.initials}</div>`;
// Break the pull-quote into sentences, each on its own line with a gap (airy look).
const sentences = quote.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [quote];
const quoteHtml = sentences.map((s) => {
  let h = s.trim();
  if (highlight && h.includes(highlight)) h = h.replace(highlight, `<span class="g">${highlight}</span>`);
  return `<span style="display:block;margin-bottom:0.40em">${h}</span>`;
}).join('');
const fontLink = `<link href="https://fonts.googleapis.com/css2?family=${b.fontLink}&family=Inter:wght@400;600&display=swap" rel="stylesheet">`;

const html = tpl
  .replaceAll('{{FONT_LINK}}', fontLink)
  .replaceAll('{{FONT}}', `'${b.font}'`)
  .replaceAll('{{BG}}', b.bg)
  .replaceAll('{{TEXT}}', b.text)
  .replaceAll('{{ACCENT}}', b.accent)
  .replaceAll('{{LOGO_HTML}}', logoHtml)
  .replaceAll('{{NAME}}', b.name)
  .replaceAll('{{QUOTE_HTML}}', quoteHtml)
  .replaceAll('{{BODY}}', quoteHtml)
  .replaceAll('{{HANDLE}}', b.handle)
  .replaceAll('{{SITE}}', b.site);

// --- write filled HTML + rasterize via headless Chrome -----------------------
mkdirSync(dirname(out), { recursive: true });
const htmlPath = out.replace(/\.png$/i, '') + '.card.html';
writeFileSync(htmlPath, html);
const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');

execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=2', `--window-size=${W},${H}`,
  '--virtual-time-budget=8000', `--screenshot=${out}`, fileUrl,
], { stdio: 'ignore' });

if (!existsSync(out)) { console.error('render produced no PNG at ' + out); process.exit(5); }
console.log(out);
