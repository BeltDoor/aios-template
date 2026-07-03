#!/usr/bin/env node
// pick-style.mjs — return the next image variant in the rotation, advance the cursors.
// Prints "<style> <theme>" (space-separated): the layout template AND the on-brand
// color scheme to use. Two independent rotations so no two consecutive cards look
// identical (the user's variety rule).
//   node pick-style.mjs          -> prints "<style> <theme>" AND advances both cursors
//   node pick-style.mjs --peek   -> prints "<style> <theme>", does NOT advance (re-renders/overrides)
//   node pick-style.mjs --list   -> prints the whole queue config
// State lives in ../state/image-queue.json. Add a layout = append to "queue".
// Add a color scheme = append to "themes" (keep it on-brand: black + gold, no purple).

import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const QF = new URL('../state/image-queue.json', import.meta.url);
// The state file is runtime state and may be absent on a fresh install; seed a minimal default.
let q;
try { q = JSON.parse(readFileSync(QF, 'utf8')); }
catch { q = { queue: ['quote'], cursor: 0, themes: [], theme_cursor: 0 }; }
const arg = process.argv[2];

if (arg === '--list') { console.log(JSON.stringify(q, null, 2)); process.exit(0); }
if (!Array.isArray(q.queue) || q.queue.length === 0) { console.error('image-queue.json has no styles'); process.exit(2); }

const themes = Array.isArray(q.themes) ? q.themes : [];
const style = q.queue[(q.cursor || 0) % q.queue.length];
const theme = themes.length ? themes[(q.theme_cursor || 0) % themes.length].name : '';

if (arg !== '--peek') {
  q.cursor = ((q.cursor || 0) + 1) % q.queue.length;
  if (themes.length) q.theme_cursor = ((q.theme_cursor || 0) + 1) % themes.length;
  mkdirSync(new URL('../state/', import.meta.url), { recursive: true });
  writeFileSync(QF, JSON.stringify(q, null, 2) + '\n');
}

console.log(theme ? `${style} ${theme}` : style);
