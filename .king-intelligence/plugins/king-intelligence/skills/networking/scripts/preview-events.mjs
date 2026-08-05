#!/usr/bin/env node
// preview-events.mjs — render the branded /networking approval page and (optionally)
// open it in the native browser. NOTHING reaches the calendar until the user checks
// boxes here and pastes the reply back. King Intelligence black + gold.
//
// Contract:
//   node preview-events.mjs --data <abs.json> [--open]
//   -> writes <data-dir>/networking-approval.html, prints its path. --open launches it.
//
// Events are read from a JSON file (not argv) so multi-line "why it fits" text
// never gets mangled by shell quoting. Shape:
//   {
//     "window": "23 Jul - 21 Aug 2026",
//     "capacity": 5,
//     "events": [
//       { "n": 1, "title": "Riverside BNI chapter — visitor day", "when": "Wed 8/12 - 7:30-9:00 AM",
//         "cost": "Free for visitors", "drive": "20 min", "category": "referral",
//         "why": "Same mechanic that already works for you, aimed at a room you have not drained.",
//         "source": "https://...", "recommended": true }
//     ],
//     "chasing": [
//       { "title": "Riverside Chamber morning mixer (September)", "cadence": "monthly, not yet posted",
//         "contact": "Riley at the chamber (events desk)" }
//     ]
//   }
//
// `recommended: true` puts the event ABOVE the cut line (the realistic plan at
// the user's stated pace, e.g. ~2 events/week including BNI). Everything else
// still renders, below the line, so nothing is ever silently truncated.
//
// Self-contained page: no server, no external calls beyond a font CDN.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { platform } from 'os';

// --- args --------------------------------------------------------------------
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const k = argv[i].slice(2);
    if (k === 'open') { args.open = true; } else { args[k] = argv[i + 1]; i++; }
  }
}
const dataFile = args.data;
if (!dataFile || !existsSync(dataFile)) {
  console.error('usage: preview-events.mjs --data <abs.json> [--open]');
  process.exit(2);
}

let data;
try { data = JSON.parse(readFileSync(dataFile, 'utf8')); }
catch (e) { console.error('bad --data json: ' + e.message); process.exit(2); }

const windowLabel = String(data.window || 'the next 30 days');
const events = Array.isArray(data.events) ? data.events : [];
const chasing = Array.isArray(data.chasing) ? data.chasing : [];
// Radar = AI + annual/marquee events beyond the calendar horizon (radarDays, 120).
// Same shape as an event, plus an optional `deadline` string. These ARE addable —
// that is the whole point, since marquee events can sell out weeks ahead.
const radar = Array.isArray(data.radar) ? data.radar : [];
if (!events.length) { console.error('no events in --data'); process.exit(2); }

const capacity = Number(data.capacity) || events.filter((e) => e.recommended).length || 5;

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const CAT = {
  ai: 'AI room', referral: 'Referral network', chamber: 'Chamber',
  trade: 'Trade / industry', anchor: 'Your anchor', other: 'General',
};

// --- cards -------------------------------------------------------------------
function card(s, i) {
  const n = s.n != null ? s.n : i + 1;
  const opts = [
    ['add', 'Add it'],
    ['skip', 'Skip this time'],
    ['never', 'Never again'],
  ].map(([val, label]) => `
        <label class="opt">
          <input type="radio" name="q${i}" value="${val}" onchange="tally()">
          <span class="dot ${val}"></span>${label}
        </label>`).join('');
  const cat = CAT[s.category] || CAT.other;
  const src = s.source
    ? `<a class="src" href="${esc(s.source)}" target="_blank" rel="noopener">source</a>` : '';
  return `
    <div class="card" data-i="${i}" data-title="${esc(s.title)}" data-when="${esc(s.when)}">
      <div class="chead">
        <span class="badge">${esc(n)}</span>
        <h3>${esc(s.title)}</h3>
      </div>
      <div class="meta">
        <span class="when">${esc(s.when)}</span>
        <span class="tag">${esc(cat)}</span>
        ${s.cost ? `<span class="tag">${esc(s.cost)}</span>` : ''}
        ${s.drive ? `<span class="tag">${esc(s.drive)} drive</span>` : ''}
        ${src}
      </div>
      <p class="rat">${esc(s.why)}</p>
      ${s.deadline ? `<p class="dead">Register by ${esc(s.deadline)}.</p>` : ''}
      ${s.softConflict ? `<p class="soft">Overlaps ${esc(s.softConflict)}. Not a hard clash, but you'd be moving something.</p>` : ''}
      <div class="opts">${opts}</div>
      <label class="notewrap reason" id="reason${i}">Why never again? (one line, so I stop suggesting rooms like it)
        <input class="note" type="text" placeholder="too far / wrong crowd / bad time of day">
      </label>
    </div>`;
}

const above = events.filter((e) => e.recommended);
const below = events.filter((e) => !e.recommended);
let idx = -1;
const aboveCards = above.map((s) => card(s, ++idx)).join('');
const belowCards = below.map((s) => card(s, ++idx)).join('');
// radar indices continue the same sequence so tally()/generate() need no special case
const radarCards = radar.map((s) => card(s, ++idx)).join('');

const radarBlock = radar.length ? `
  <h2 class="sect">On the radar</h2>
  <p class="sectnote">Past the ${esc(windowLabel)} window, but worth knowing about now because these
    are the rooms that fill up — marquee events like this can sell out weeks ahead. Add any of them
    and it goes straight on the calendar the same as anything above.</p>
  ${radarCards}` : '';

const cutLine = below.length ? `
  <div class="cut">
    <span>Below your pace</span>
  </div>
  <p class="cutnote">These are real and they cleared every filter. They just sit past the
    roughly ${esc(capacity)} events that fit ${esc(windowLabel)} at your stated pace of about
    two a week including BNI. Add any of them if the month looks lighter than usual.</p>
  ${belowCards}` : '';

const chaseRows = chasing.map((c) => `
    <div class="chase">
      <div class="ctitle">${esc(c.title)}</div>
      <div class="cmeta">${esc(c.cadence)}</div>
      <div class="ccontact">Call or email: <b>${esc(c.contact)}</b></div>
    </div>`).join('');

const chaseBlock = chasing.length ? `
  <h2 class="sect">Worth chasing</h2>
  <p class="sectnote">I could not verify a real date for these on a live page, so they are
    deliberately not going on your calendar. A hold you cannot trust is worse than no hold.
    Here is who to contact to pin them down for next month's run.</p>
  ${chaseRows}` : '';

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Networking events to approve</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root{--gold:#DC990A;--gold-dark:#b87d08;--ink:#0b0b0b;--muted:#00000099;
    --bg:#F4F2EE;--cream:#fff8e6;--line:#e7e2d8;--red:#8a2b2b;}
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:var(--bg);font-family:'Inter',-apple-system,'Segoe UI',Roboto,sans-serif;
    color:var(--ink);padding:40px 16px 140px;}
  .wrap{max-width:760px;margin:0 auto;}
  h1{font-size:34px;font-weight:800;letter-spacing:-.5px;}
  .sub{color:var(--muted);font-size:15px;margin-top:8px;line-height:1.5;}
  .win{display:inline-block;margin-top:14px;background:var(--ink);color:var(--gold);
    font-weight:700;font-size:13px;padding:5px 12px;border-radius:999px;}
  .legend{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0 8px;}
  .legend .pill{display:flex;align-items:center;gap:7px;background:#fff;border:1px solid var(--line);
    border-radius:999px;padding:6px 13px;font-size:13px;font-weight:600;color:#333;}
  .dot{width:11px;height:11px;border-radius:50%;display:inline-block;flex:none;}
  .dot.add{background:var(--gold);} .dot.skip{background:#9aa0a6;} .dot.never{background:var(--red);}
  .card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px 20px 16px;
    margin-top:16px;box-shadow:0 1px 2px rgba(0,0,0,.04);}
  .chead{display:flex;align-items:center;gap:11px;}
  .badge{background:var(--ink);color:var(--gold);font-weight:800;font-size:13px;min-width:26px;height:26px;
    border-radius:7px;display:flex;align-items:center;justify-content:center;flex:none;}
  .chead h3{font-size:18px;font-weight:700;line-height:1.25;}
  .meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:11px 0 0;}
  .when{font-weight:700;font-size:13.5px;color:var(--gold-dark);}
  .tag{background:#f6f4f0;border:1px solid var(--line);border-radius:999px;padding:3px 10px;
    font-size:12px;font-weight:600;color:#555;}
  .src{font-size:12px;font-weight:600;color:var(--gold-dark);}
  .rat{color:#2b2b2b;font-size:14.5px;line-height:1.5;margin:11px 0 15px;}
  .dead{background:var(--cream);border-left:3px solid var(--gold);border-radius:0 7px 7px 0;
    padding:8px 11px;font-size:13px;font-weight:600;color:#5a4300;margin:0 0 13px;}
  .soft{background:#fffaf0;border-left:3px solid var(--gold);border-radius:0 7px 7px 0;
    padding:9px 12px;font-size:13px;color:#5a4a2a;line-height:1.45;margin:0 0 14px;}
  .opts{display:flex;flex-wrap:wrap;gap:9px;}
  .opt{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:999px;
    padding:9px 15px;font-size:13.5px;font-weight:600;color:#333;cursor:pointer;user-select:none;
    transition:border-color .12s,background .12s;}
  .opt:hover{border-color:var(--gold);}
  .opt input{position:absolute;opacity:0;width:0;height:0;}
  .opt:has(input:checked){border-color:var(--gold);background:var(--cream);color:#000;}
  .opt:has(input[value=never]:checked){border-color:var(--red);background:#fdf3f3;}
  .notewrap{display:none;font-size:12px;color:var(--muted);font-weight:600;margin-top:14px;}
  .notewrap.show{display:block;}
  .note{display:block;width:100%;margin-top:6px;border:1px solid var(--line);
    border-radius:9px;padding:10px 12px;font:inherit;font-size:14px;background:#fdfcfa;}
  .note:focus,.opt:focus-within{outline:2px solid var(--gold);outline-offset:1px;}
  .cut{display:flex;align-items:center;gap:14px;margin:36px 0 4px;color:var(--muted);}
  .cut::before,.cut::after{content:'';flex:1;height:1px;background:var(--line);}
  .cut span{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;}
  .cutnote{color:var(--muted);font-size:13.5px;line-height:1.5;text-align:center;margin-bottom:4px;}
  .sect{font-size:20px;font-weight:800;margin:40px 0 6px;}
  .sectnote{color:var(--muted);font-size:13.5px;line-height:1.5;margin-bottom:6px;}
  .chase{background:#fffdf6;border:1px dashed var(--line);border-radius:12px;padding:14px 16px;margin-top:10px;}
  .ctitle{font-weight:700;font-size:15px;}
  .cmeta{color:var(--muted);font-size:13px;margin-top:3px;}
  .ccontact{font-size:13.5px;margin-top:7px;}
  .bar{position:fixed;left:0;right:0;bottom:0;background:#fffffff2;backdrop-filter:blur(6px);
    border-top:1px solid var(--line);padding:14px 16px;display:flex;align-items:center;gap:14px;
    justify-content:flex-end;}
  .bar .count{margin-right:auto;font-weight:700;font-size:14px;}
  .bar .count b{color:var(--gold-dark);}
  button{font:inherit;font-weight:700;font-size:14px;border-radius:9px;padding:11px 20px;cursor:pointer;
    border:1px solid var(--line);}
  .reset{background:#fff;color:#444;}
  .go{background:var(--gold);border-color:var(--gold);color:#000;}
  .go:hover{background:var(--gold-dark);color:#fff;}
  .out{max-width:760px;margin:22px auto 0;display:none;}
  .out.show{display:block;}
  .out h2{font-size:15px;margin-bottom:8px;}
  .out .hint{color:var(--muted);font-size:13px;margin-bottom:8px;}
  .out textarea{width:100%;min-height:220px;border:1px solid var(--gold);border-radius:11px;padding:14px;
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;background:#fffdf6;}
</style></head><body>
<div class="wrap">
  <h1>Networking events to approve</h1>
  <p class="sub">Nothing here is on your calendar yet. Pick what you want, generate the reply,
    paste it back into chat, and only those get added. Every date below was verified on a live page.</p>
  <span class="win">${esc(windowLabel)}</span>
  <div class="legend">
    <span class="pill"><span class="dot add"></span>Add it</span>
    <span class="pill"><span class="dot skip"></span>Skip this time</span>
    <span class="pill"><span class="dot never"></span>Never again</span>
  </div>
  ${aboveCards}
  ${cutLine}
  ${radarBlock}
  ${chaseBlock}
</div>
<div class="out" id="out">
  <div class="wrap">
    <h2>Copied — paste this into chat</h2>
    <p class="hint">If it didn't copy automatically, select all below and copy.</p>
    <textarea id="outtext" readonly onclick="this.select()"></textarea>
  </div>
</div>
<div class="bar">
  <span class="count"><b id="answered">0</b> / ${events.length + radar.length} decided &middot; <b id="adding">0</b> to add</span>
  <button class="reset" onclick="resetAll()">Reset</button>
  <button class="go" onclick="generate()">Generate reply &rarr;</button>
</div>
<script>
  var TOTAL = ${events.length + radar.length};
  var WINDOW = ${JSON.stringify(windowLabel)};
  var LABELS = {add:'ADD', skip:'SKIP', never:'NEVER AGAIN'};
  function picked(i){ var el=document.querySelector('input[name="q'+i+'"]:checked'); return el?el.value:null; }
  function tally(){
    var n=0, a=0;
    for(var i=0;i<TOTAL;i++){
      var v=picked(i);
      if(v) n++;
      if(v==='add') a++;
      var box=document.getElementById('reason'+i);
      if(box){ if(v==='never'){ box.classList.add('show'); } else { box.classList.remove('show'); } }
    }
    document.getElementById('answered').textContent=n;
    document.getElementById('adding').textContent=a;
  }
  function resetAll(){
    document.querySelectorAll('input[type=radio]').forEach(function(r){r.checked=false;});
    document.querySelectorAll('.note').forEach(function(t){t.value='';});
    document.getElementById('out').classList.remove('show'); tally();
  }
  function generate(){
    var cards=document.querySelectorAll('.card'); var lines=[]; var missed=[];
    lines.push('NETWORKING APPROVAL'); lines.push('window: '+WINDOW); lines.push('');
    cards.forEach(function(c){
      var i=c.getAttribute('data-i'); var title=c.getAttribute('data-title');
      var when=c.getAttribute('data-when');
      var v=picked(i); var note=(c.querySelector('.note').value||'').trim();
      var n=Number(i)+1;
      if(!v){ missed.push(n); return; }
      lines.push('['+n+'] '+LABELS[v]+' — '+title+' ('+when+')');
      if(v==='never'&&note) lines.push('    reason: '+note);
    });
    lines.push('');
    lines.push('(undecided, treat as skip: '+(missed.length?missed.join(', '):'none')+')');
    var text=lines.join('\\n');
    var box=document.getElementById('outtext'); box.value=text;
    document.getElementById('out').classList.add('show');
    document.getElementById('out').scrollIntoView({behavior:'smooth'});
    try{ navigator.clipboard.writeText(text); }catch(e){ box.select(); }
  }
</script>
</body></html>`;

const outDir = dirname(dataFile);
const htmlPath = join(outDir, 'networking-approval.html');
writeFileSync(htmlPath, html);

if (args.open) {
  const p = platform();
  try {
    let child;
    if (p === 'darwin') {
      child = spawn('open', [htmlPath], { detached: true, stdio: 'ignore' });
    } else if (p === 'win32') {
      child = spawn('cmd', ['/c', 'start', '', htmlPath.replace(/\//g, '\\')], { detached: true, stdio: 'ignore' });
    } else {
      child = spawn('xdg-open', [htmlPath], { detached: true, stdio: 'ignore' });
    }
    child.unref();
  } catch (e) {
    console.error('could not auto-open browser: ' + e.message + ' (open manually: ' + htmlPath + ')');
  }
}
console.log(htmlPath);
