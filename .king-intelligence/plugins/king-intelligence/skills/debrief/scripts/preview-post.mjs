#!/usr/bin/env node
// preview-post.mjs — render a mock LinkedIn post and (optionally) open it in
// the user's native browser so they SEE the post exactly as their audience will,
// BEFORE anything is published.
//
// Contract:
//   node preview-post.mjs --text-file <abs.txt> --image <abs.png> \
//     [--style <name>] [--queue "1 of 3"] [--open]
//   -> writes <image-dir>/preview.html (post text + the rendered card + LinkedIn
//      chrome), copies the avatar in, prints the html path. --open launches it.
//
// The post BODY text is read from a file (not argv) so multi-paragraph posts
// never get mangled by shell quoting. The image is the card PNG from render-card.mjs.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import { dirname, join, basename } from 'path';
import { pathToFileURL } from 'url';

// LAB_DIR / AVATAR_SRC point at your local branded-styles template library.
// Override with env vars if yours lives somewhere other than the plugin default.
const LAB_DIR = process.env.LAB_DIR || new URL('../assets/branded-styles', import.meta.url).pathname;
const AVATAR_SRC = process.env.AVATAR_SRC || (LAB_DIR + '/assets/avatar.png');
const CHROME = process.env.CHROME_PATH
  || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome');
// Preview chrome only — NOT published. LinkedIn uses the user's real profile headline at post time.
const NAME = process.env.PREVIEW_NAME || 'Your Name';
const HEADLINE = process.env.PREVIEW_HEADLINE || 'Your LinkedIn headline';

// --- args --------------------------------------------------------------------
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const k = argv[i].slice(2);
    if (k === 'open') { args.open = true; } else { args[k] = argv[i + 1]; i++; }
  }
}
const textFile = args['text-file'];
const image    = args.image;
const style    = args.style || 'quote';
const queue    = args.queue || '';

if (!textFile || !image || !existsSync(textFile) || !existsSync(image)) {
  console.error('usage: preview-post.mjs --text-file <abs.txt> --image <abs.png> [--style <name>] [--queue "1 of 3"] [--open]');
  process.exit(2);
}

const outDir = dirname(image);
const postText = readFileSync(textFile, 'utf8').trim();
const imgName = basename(image);

// copy avatar in so everything is same-dir relative (max browser compatibility)
if (existsSync(AVATAR_SRC)) copyFileSync(AVATAR_SRC, join(outDir, 'avatar.png'));

// escape + paragraph-split the post body
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const bodyHtml = postText.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

const banner = `Preview only — style: <b>${esc(style)}</b>${queue ? ` (${esc(queue)})` : ''}. Say <b>"post it"</b>, <b>"different style"</b>, or <b>"tweak the hook"</b>.`;

const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:#F4F2EE;font-family:'Inter',-apple-system,'Segoe UI',Roboto,sans-serif;color:#000;
    display:flex;flex-direction:column;align-items:center;padding:32px 16px 80px;}
  .note{max-width:555px;width:100%;background:#fff8e6;border:1px solid #DC990A;border-radius:8px;
    padding:12px 16px;font-size:14px;color:#3d2f00;margin-bottom:24px;}
  .post{max-width:555px;width:100%;background:#fff;border:1px solid #e6e6e6;border-radius:10px;
    box-shadow:0 1px 2px rgba(0,0,0,.08);overflow:hidden;}
  .top{display:flex;align-items:flex-start;gap:10px;padding:14px 16px 6px;}
  .av{width:48px;height:48px;border-radius:50%;overflow:hidden;background:#eee;flex:none;}
  .av img{width:100%;height:100%;object-fit:cover;object-position:50% 8%;}
  .who .nm{font-weight:600;font-size:15px;color:#000;line-height:1.2;}
  .who .hl{font-size:12px;color:#00000099;line-height:1.3;margin-top:1px;max-width:380px;}
  .who .mt{font-size:12px;color:#00000099;margin-top:1px;}
  .who .mt .globe{font-size:11px;}
  .more{margin-left:auto;color:#00000099;font-size:20px;font-weight:700;letter-spacing:1px;}
  .body{padding:4px 16px 12px;font-size:14px;line-height:1.45;color:#000000df;}
  .body p{margin:0 0 15px;}
  .body p:last-child{margin-bottom:0;}
  .media{width:100%;display:block;border-top:1px solid #eee;background:#000;}
  .media img{width:100%;height:auto;display:block;}
  .counts{display:flex;align-items:center;gap:6px;padding:8px 16px;font-size:12px;color:#00000099;
    border-bottom:1px solid #eee;}
  .counts .dot{margin:0 2px;}
  .bar{display:flex;justify-content:space-around;padding:4px 8px;}
  .bar .act{display:flex;align-items:center;gap:6px;padding:10px 8px;color:#00000099;font-size:14px;font-weight:600;}
  .ic{width:20px;height:20px;display:inline-block;}
</style></head><body>
  <div class="note">${banner}</div>
  <div class="post">
    <div class="top">
      <div class="av"><img src="avatar.png" alt=""></div>
      <div class="who">
        <div class="nm">${esc(NAME)}</div>
        <div class="hl">${esc(HEADLINE)}</div>
        <div class="mt">Now · <span class="globe">🌐</span></div>
      </div>
      <div class="more">···</div>
    </div>
    <div class="body">${bodyHtml}</div>
    <div class="media"><img src="${esc(imgName)}" alt="post image"></div>
    <div class="counts"><span>👍❤️💡</span><span>You and 47 others</span><span class="dot">·</span><span>6 comments</span></div>
    <div class="bar">
      <span class="act">👍 Like</span>
      <span class="act">💬 Comment</span>
      <span class="act">🔁 Repost</span>
      <span class="act">➤ Send</span>
    </div>
  </div>
</body></html>`;

const htmlPath = join(outDir, 'preview.html');
writeFileSync(htmlPath, html);

if (args.open) {
  const fileUrl = pathToFileURL(htmlPath).href;
  try {
    // detached + unref: a NEW window comes to the foreground (a background tab behind VS Code does not),
    // and the script returns immediately instead of blocking until the browser closes.
    const child = existsSync(CHROME)
      ? spawn(CHROME, ['--new-window', fileUrl], { detached: true, stdio: 'ignore' })
      : spawn('cmd', ['/c', 'start', '', htmlPath.replace(/\//g, '\\')], { detached: true, stdio: 'ignore' });
    child.unref();
  } catch (e) { console.error('could not auto-open browser: ' + e.message + ' (open manually: ' + htmlPath + ')'); }
}
console.log(htmlPath);
