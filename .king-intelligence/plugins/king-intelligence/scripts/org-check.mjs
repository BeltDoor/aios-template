#!/usr/bin/env node
// org-check.mjs — the single source of truth for "is this repo organized."
//
// WHY THIS EXISTS: every folder you work in should have a CLAUDE.md to read, and
// references/operating/folder-layout.md should always match what's actually on disk.
// Both used to be model-driven (the model had to remember to create files + hand-edit
// the map), so they drifted silently between big structural changes. This script makes
// the check deterministic and the fix mechanical, exactly like memory-conveyor.mjs does
// for the memory index. /end-session calls it every close so the repo self-heals.
//
// THE COVERAGE RULE (project-level only):
//   A folder REQUIRES its own CLAUDE.md if it is:
//     - a top-level folder in the repo root, OR
//     - a direct child of a known container (clients/, king-intelligence/, personal/)
//   ...and it does not match an exemption pattern (below). Everything deeper is
//   documented INSIDE its parent's CLAUDE.md, not with its own file.
//
// EXEMPTIONS (never need a CLAUDE.md, never descended into for the map):
//   - any dotfolder (.git, .claude, .github, .vscode, .planning, .next, .vercel, …)
//   - dependency/build output (node_modules, dist, build, coverage, __pycache__, venv, …)
//   - standardized project data subfolders: NN-* numbered (01-research, 02-conversations,
//     03-deliverables …) and _archive
//   - code/asset/media folders (src, css, js, img, images, assets, public, videos,
//     photos, frames, samples, data, fonts, lib, bin, dist, out, tmp)
//   - version folders (v1, v2, v2.0, …)
//
// MODES:
//   (default)     report — print folders missing a required CLAUDE.md + whether the
//                 folder-layout map has drifted from disk. Exit 0 if clean, 1 if not
//                 (so it can gate a script / CI / the close-out). Also prints the fast
//                 ROT checks (broken relative links + expired dated rules) as
//                 INFORMATIONAL lines — they never affect the exit code.
//   --json        same checks, machine-readable JSON to stdout (for /end-session).
//   --fix         scaffold a starter CLAUDE.md for every missing required folder AND
//                 regenerate the AUTO-LAYOUT block in folder-layout.md from disk truth.
//   --print-tree  preview the generated folder tree to stdout, write nothing (debug).
//   --health      the deep rot report: everything above PLUS folder freshness (folders
//                 whose git activity is newer than the newest dated entry in their
//                 CLAUDE.md). Slower (one git call per folder); run monthly or on demand.
//
// ROT CHECKS (added 7/2/26 audit — rot should announce itself, not silently mislead):
//   links   — every relative markdown link in operating-layer .md files must resolve on
//             disk. Skips http(s)/mailto/#, template placeholders ({{…}}, ${…}, "url",
//             "path.md", "slug.md"), _archive folders, and vendored/mirrored trees.
//   expiry  — any `<!-- EXPIRES: YYYY-MM-DD note -->` marker whose date has passed is
//             reported (and markers coming due within 7 days get a heads-up). Put one
//             next to any rule with a shelf life.
//   fresh   — (--health only) compares each required folder's last git commit date to
//             the newest `## YYYY-MM-DD` heading in its CLAUDE.md; flags folders worked
//             on ≥14 days after their doc was last updated.
//   size    — (--health only) every CLAUDE.md over the 25KB budget, largest first. A
//             CLAUDE.md loads whole into any session that works in its folder, so bytes
//             there are context spent every time; reference material belongs in sibling
//             files behind a pointer. Report-only — the fix is editorial (see the
//             housekeeping skill's writing-for-agents lenses), never automatic.
//
// SAFE BY DESIGN: only ever CREATES a missing CLAUDE.md (never overwrites an existing
// one) and only ever rewrites the text BETWEEN the AUTO-LAYOUT markers in folder-layout.md
// (the human-curated prose above/below is never touched). Does no git — the caller commits.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// ---------- configuration (portable: --arg > config file > sensible default) ----------
// This script ships to client repos via the King Intelligence plugin, so NOTHING here is
// hardcoded to one person's repo. Everything that used to be install-specific now resolves at
// runtime, and the defaults reproduce the original repo's exact behavior:
//   - repo root      = the current working directory (the repo being checked); --root to override
//   - containers     = folders whose direct children are "projects" (from the config file, or
//                      --containers); empty by default so an unconfigured repo is handled safely
//   - the tree label = the repo's OWN folder name, with a trailing slash; --root-label to override
//   - the layout doc = references/operating/folder-layout.md by default; --layout-doc to override
// The container list / label live in the repo's own (never-shared) king-intelligence-config.md, so
// the shipped script carries no repo-specific names — each install supplies its own.

const ARGV = process.argv.slice(2);
/** Value of a `--flag value` style arg, or null. (Boolean flags use ARGV.includes.) */
function argVal(name) {
  const i = ARGV.indexOf(name);
  return i !== -1 && i + 1 < ARGV.length ? ARGV[i + 1] : null;
}
/** Split a comma/newline list into trimmed, non-empty parts. */
function parseList(s) {
  return (s || '').split(/[,\n]/).map(x => x.trim()).filter(Boolean);
}
/** Read a `## <section>` block of `- key: value` lines from the config markdown. Returns {} if absent. */
function readConfigSection(file, section) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return {}; }
  const out = {};
  let inSection = false;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) { inSection = h[1].trim().toLowerCase() === section.toLowerCase(); continue; }
    if (!inSection) continue;
    // capture the raw value after the colon, then strip a trailing " # comment" (the client
    // starter config annotates every key) before trimming. No leading \s* in the capture so a
    // key whose only content is a comment resolves to blank, not to the comment text.
    const kv = line.match(/^\s*-\s*([A-Za-z0-9_.]+)\s*:(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/\s+#.*$/, '').trim();
  }
  return out;
}

const REPO_ROOT = path.resolve(argVal('--root') || process.cwd());
const CONFIG_PATH = path.resolve(REPO_ROOT, argVal('--config') || 'references/king-intelligence-config.md');
const CFG = readConfigSection(CONFIG_PATH, 'org-check');

const CONTAINERS = parseList(argVal('--containers') ?? CFG.containers ?? ''); // direct children are "projects"
const LAYOUT_DOC = path.resolve(REPO_ROOT, argVal('--layout-doc') ?? CFG.layoutDoc ?? 'references/operating/folder-layout.md');
const ROOT_LABEL = argVal('--root-label') ?? CFG.rootLabel ?? (path.basename(REPO_ROOT) + '/');

const MARK_START = '<!-- AUTO-LAYOUT:START (generated by scripts/org-check.mjs --fix, do not edit by hand) -->';
const MARK_END = '<!-- AUTO-LAYOUT:END -->';
const COMMENT_COL = 34; // column where the "# purpose" comment starts in the tree

// ---------- exemptions ----------

const EXEMPT_NAMES = new Set([
  'node_modules', 'dist', 'build', 'coverage', '__pycache__', 'venv', '.venv', '.cache',
  'src', 'css', 'js', 'img', 'images', 'assets', 'public', 'videos', 'photos', 'frames',
  'samples', 'data', 'fonts', 'lib', 'bin', 'out', 'tmp', 'mcp-server', 'target',
]);

/** Is this folder NAME exempt from needing a CLAUDE.md (and from the folder map)? */
function isExemptName(name) {
  if (name.startsWith('.')) return true;            // every dotfolder
  if (EXEMPT_NAMES.has(name)) return true;          // deps / build / code / asset / media
  if (/^\d{2}-/.test(name)) return true;            // 01-research, 02-conversations, …
  if (name === '_archive' || name.startsWith('_')) return true; // _archive, _snapshots, _drafts
  if (/^v\d+(\.\d+)*$/.test(name)) return true;     // v1, v2, v2.0 version folders
  return false;
}

// ---------- filesystem walk ----------

/** Immediate subdirectories of `abs`, names only, non-exempt, sorted. */
function subdirs(abs) {
  let entries;
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter(e => e.isDirectory() && !isExemptName(e.name))
    .map(e => e.name)
    .sort((a, b) => a.localeCompare(b));
}

function hasClaudeMd(abs) {
  return fs.existsSync(path.join(abs, 'CLAUDE.md'));
}

/**
 * Build the list of REQUIRED folders (repo-relative paths), in display order:
 * containers first (in CONTAINERS order) with their direct children, then the
 * remaining top-level folders alphabetically. Each node carries whether it has a
 * CLAUDE.md and its one-line purpose (from that CLAUDE.md).
 */
function buildRequired() {
  const topLevel = subdirs(REPO_ROOT);
  const ordered = [
    ...CONTAINERS.filter(c => topLevel.includes(c)),
    ...topLevel.filter(d => !CONTAINERS.includes(d)).sort((a, b) => a.localeCompare(b)),
  ];

  const nodes = []; // { rel, depth, hasMd, purpose, isContainer }
  for (const top of ordered) {
    const topAbs = path.join(REPO_ROOT, top);
    const isContainer = CONTAINERS.includes(top);
    nodes.push(node(top, 1, topAbs, isContainer));
    if (isContainer) {
      for (const child of subdirs(topAbs)) {
        nodes.push(node(`${top}/${child}`, 2, path.join(topAbs, child), false));
      }
    }
  }
  return nodes;
}

function node(rel, depth, abs, isContainer) {
  const hasMd = hasClaudeMd(abs);
  return { rel, depth, abs, isContainer, hasMd, purpose: hasMd ? purposeOf(abs) : null };
}

// ---------- purpose extraction (the tree's descriptions come from each folder's own CLAUDE.md) ----------

/** Pull a one-line purpose from a folder's CLAUDE.md. Prefers an explicit
 *  "**Purpose:** …" line, then the first bold one-liner, then the first prose line
 *  after the H1 title. Returns a trimmed, single-line string (or null). */
function purposeOf(abs) {
  let text;
  try {
    text = fs.readFileSync(path.join(abs, 'CLAUDE.md'), 'utf8');
  } catch {
    return null;
  }
  const lines = text.split('\n');

  // a REAL line-start "**Purpose:** …" line wins (not a "| **Purpose** | … |" table cell)
  const explicit = text.match(/^[ \t]*\*\*Purpose:?\*\*[ \t]*(.+)$/im);
  if (explicit && !explicit[1].trim().startsWith('|')) return clean(explicit[1]);

  // first REAL descriptive prose line after the title — skipping the noise that these
  // files tend to lead with (timestamps, status/created lines, table rows, headings)
  let inFm = false;
  let seenTitle = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '---') { inFm = !inFm; continue; }
    if (inFm || !line) continue;
    if (line.startsWith('#')) { seenTitle = true; continue; }
    if (!seenTitle) continue;
    if (isNoise(line)) continue;
    const text = clean(line);
    if (text.length >= 12 && /[a-z]/i.test(text)) return text; // a real sentence, not a fragment
  }
  return null;
}

/** Lines these CLAUDE.md files commonly lead with that are NOT a description. */
function isNoise(line) {
  if (line.startsWith('_') || line.startsWith('>') || line.startsWith('<!--')) return true;
  if (line.includes('|') || /^[-=]{3,}/.test(line)) return true;           // table row / hr
  if (/^\d{1,2}\/\d{1,2}\/\d{2}\b/.test(line)) return true;                // 5/8/26 - 16:22 …
  // session-entry headers (these files often lead with a Recent-sessions block)
  if (/^\**\s*(done this session|next steps?|blockers?|status|created|updated|last updated|date)\b\s*:?/i.test(line)) return true;
  return false;
}

/** Reduce a markdown line to a short, plain one-liner suitable for a tree comment. */
function clean(s) {
  let out = s
    .replace(/^[-*+]\s+/, '')                 // leading list marker
    .replace(/\*\*/g, '')                    // bold
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // links → label
    .replace(/[`*_]/g, '')                    // stray md
    .replace(/\s+/g, ' ')
    .trim();
  out = out.replace(/[.:;]\s*$/, '');         // trailing punctuation
  if (out.length > 64) out = out.slice(0, 61).replace(/[\s,;:.\-]+$/, '') + '…';
  return out;
}

// ---------- folder-tree rendering ----------

/** Render the required-folder nodes as an ASCII tree, comments aligned at COMMENT_COL. */
function renderTree(nodes) {
  const lines = [ROOT_LABEL];

  // group depth-2 children under their depth-1 container so we can draw └ correctly
  const tops = nodes.filter(n => n.depth === 1);
  for (let ti = 0; ti < tops.length; ti++) {
    const top = tops[ti];
    const topLast = ti === tops.length - 1 && !top.isContainer
      ? true
      : ti === tops.length - 1; // last top-level entry overall
    const children = nodes.filter(n => n.depth === 2 && n.rel.startsWith(top.rel + '/'));

    lines.push(treeLine(top, topLast && children.length === 0 ? '└── ' : '├── ', top.rel.split('/').pop()));
    for (let ci = 0; ci < children.length; ci++) {
      const child = children[ci];
      const childLast = ci === children.length - 1;
      const branch = (topLast ? '    ' : '│   ') + (childLast ? '└── ' : '├── ');
      lines.push(treeLine(child, branch, child.rel.split('/').pop()));
    }
  }
  return lines.join('\n');
}

function treeLine(node, prefix, name) {
  const label = `${prefix}${name}/`;
  const comment = node.hasMd
    ? (node.purpose || '')
    : '⚠ no CLAUDE.md';
  if (!comment) return label;
  const pad = label.length >= COMMENT_COL ? '  ' : ' '.repeat(COMMENT_COL - label.length);
  return `${label}${pad}# ${comment}`;
}

// ---------- the generated AUTO-LAYOUT block ----------

function buildBlock(nodes) {
  const tree = renderTree(nodes);
  return [
    MARK_START,
    '',
    '```',
    tree,
    '```',
    '',
    '_Generated from disk + each folder\'s own CLAUDE.md purpose line. Run `node scripts/org-check.mjs --fix` to refresh (the `/end-session` skill does this every close)._',
    '',
    MARK_END,
  ].join('\n');
}

/** A fresh folder-layout doc (used by --fix when none exists yet — e.g. a client being set up). */
function newLayoutDoc(block) {
  return `# Folder Layout

What every project-level folder in this repo is for. The map below is generated from disk by \`org-check --fix\`; the prose around it is yours to edit.

${block}
`;
}

/** Return { before, between, after, hasMarkers } splitting the layout doc on the markers. */
function splitLayout(text) {
  const s = text.indexOf(MARK_START);
  const e = text.indexOf(MARK_END);
  if (s === -1 || e === -1 || e < s) return { hasMarkers: false };
  return {
    hasMarkers: true,
    before: text.slice(0, s),
    after: text.slice(e + MARK_END.length),
  };
}

// ---------- CLAUDE.md scaffolding ----------

function nowStamp() {
  // machine-local time (assumes the host clock is local); a stub stamp, the model fills real ones
  const d = new Date();
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const yy = String(d.getFullYear()).slice(2);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd}/${yy} - ${hh}:${mi} ET`;
}

/** Humanize a folder name for the title (kebab/snake → Title Case-ish). */
function titleOf(rel) {
  const base = rel.split('/').pop();
  return base.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function scaffoldClaudeMd(node) {
  const title = titleOf(node.rel);
  const body = `# ${title}

_created: ${nowStamp()} (scaffolded by org-check; fill in the real purpose)_

**Purpose:** TODO — one line on what this folder is for.

**What lives here:** TODO — the key files / subfolders and what they're for.

## Recent sessions
`;
  fs.writeFileSync(path.join(node.abs, 'CLAUDE.md'), body, 'utf8');
}

// ---------- checks ----------

/** Compute missing-CLAUDE.md list and whether the layout block is out of date. */
function check() {
  const nodes = buildRequired();
  const missing = nodes.filter(n => !n.hasMd).map(n => n.rel);

  let layoutDrift = false;
  let layoutReason = '';
  const expected = buildBlock(nodes);
  if (!fs.existsSync(LAYOUT_DOC)) {
    layoutDrift = true;
    layoutReason = 'folder-layout.md does not exist';
  } else {
    const text = fs.readFileSync(LAYOUT_DOC, 'utf8');
    const split = splitLayout(text);
    if (!split.hasMarkers) {
      layoutDrift = true;
      layoutReason = 'AUTO-LAYOUT markers not found — add them once, then --fix';
    } else {
      const current = text.slice(text.indexOf(MARK_START), text.indexOf(MARK_END) + MARK_END.length);
      if (current.trim() !== expected.trim()) {
        layoutDrift = true;
        layoutReason = 'folder map differs from disk (new/removed folder or changed purpose)';
      }
    }
  }
  return { nodes, missing, layoutDrift, layoutReason, expected };
}

// ---------- rot checks (links / expiry / freshness) ----------

const ROT_SKIP_DIRS = new Set(['node_modules', 'vendor', 'dist', 'build', 'coverage', '_archive', '_snapshots']);
const ROT_PLACEHOLDER = /^(url|path\.md|slug\.md)$|\{\{|\$\{|^<.*>$/;

/** All .md files worth rot-checking: every CLAUDE.md, root .md files, and the
 *  operating layer (references/, templates/, decisions/, prompts/, workflows/,
 *  security/, audits/, .claude/skills/). Vendored/mirrored/archived trees skipped. */
function rotTargets() {
  const out = [];
  const roots = ['', '.claude/skills'];
  const walk = (rel) => {
    const abs = path.join(REPO_ROOT, rel);
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (ROT_SKIP_DIRS.has(e.name) || e.name.startsWith('_')) continue; // _archive-*, _snapshots, …
        if (e.name.startsWith('.') && childRel !== '.claude/skills') continue;
        walk(childRel);
      } else if (e.name.endsWith('.md')) {
        const isOperating = e.name === 'CLAUDE.md'
          || !childRel.includes('/')
          || /^(references|templates|decisions|prompts|workflows|security|audits|\.claude\/skills)\//.test(childRel);
        if (isOperating) out.push(childRel);
      }
    }
  };
  for (const r of roots) walk(r);
  return out;
}

/** Broken relative links across the operating layer. Returns [{file, link}]. */
function checkLinks() {
  const broken = [];
  const homeClaude = path.join(process.env.HOME || '', '.claude');
  const linkRe = /\]\(([^)#\s]+)(?:#[^)]*)?\)/g;
  for (const rel of rotTargets()) {
    let text;
    try { text = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'); } catch { continue; }
    // strip fenced code blocks + inline code — links inside them are examples/templates
    text = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    let m;
    while ((m = linkRe.exec(text))) {
      const target = m[1].trim();
      if (/^(https?:|mailto:|tel:|#|<)/.test(target) || ROT_PLACEHOLDER.test(target)) continue;
      let dec; try { dec = decodeURIComponent(target); } catch { continue; }
      const abs = dec.startsWith('/') ? dec : path.resolve(path.dirname(path.join(REPO_ROOT, rel)), dec);
      if (fs.existsSync(abs)) continue;
      // a relative link that escapes both the repo and ~/.claude is template text
      // (a snippet meant to be pasted somewhere else) — not checkable from here
      if (!abs.startsWith(REPO_ROOT + path.sep) && !(homeClaude && abs.startsWith(homeClaude + path.sep))) continue;
      broken.push({ file: rel, link: target });
    }
  }
  return broken;
}

/** Expired / soon-to-expire `<!-- EXPIRES: YYYY-MM-DD note -->` markers. */
function checkExpiry() {
  const expired = [], upcoming = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const soon = new Date(today.getTime() + 7 * 86400000);
  const re = /<!--\s*EXPIRES:\s*(\d{4}-\d{2}-\d{2})\s*([^>]*?)-->/g;
  for (const rel of rotTargets()) {
    let text;
    try { text = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'); } catch { continue; }
    let m;
    while ((m = re.exec(text))) {
      const d = new Date(m[1] + 'T00:00:00');
      const item = { file: rel, date: m[1], note: m[2].trim() };
      if (d < today) expired.push(item);
      else if (d <= soon) upcoming.push(item);
    }
  }
  return { expired, upcoming };
}

/** (--health) Folders whose git activity is ≥14 days newer than the newest
 *  `## YYYY-MM-DD` heading in their CLAUDE.md. Skips silently if git is unavailable. */
function checkFreshness(nodes) {
  const stale = [];
  for (const n of nodes) {
    if (!n.hasMd) continue;
    let gitDate;
    try {
      gitDate = execSync(`git log -1 --format=%cs -- "${n.rel}"`, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch { continue; }
    if (!gitDate) continue;
    let text;
    try { text = fs.readFileSync(path.join(n.abs, 'CLAUDE.md'), 'utf8'); } catch { continue; }
    const dates = [...text.matchAll(/^##+\s*(\d{4})-(\d{2})-(\d{2})/gm)].map(m => `${m[1]}-${m[2]}-${m[3]}`).sort();
    const docDate = dates[dates.length - 1] || null;
    if (!docDate) continue; // no dated entries — nothing to compare
    const gap = (new Date(gitDate) - new Date(docDate)) / 86400000;
    if (gap >= 14) stale.push({ rel: n.rel, gitDate, docDate, gapDays: Math.round(gap) });
  }
  return stale.sort((a, b) => b.gapDays - a.gapDays);
}

/** (--health) Every CLAUDE.md past the size budget, largest first. Reuses the rot
 *  walk (which already skips vendored/mirrored/archived trees), so any CLAUDE.md at
 *  any depth is weighed — the worst offenders live below the required-folder level. */
const SIZE_BUDGET = 25 * 1024;
function checkSize() {
  const over = [];
  for (const rel of rotTargets()) {
    if (path.basename(rel) !== 'CLAUDE.md') continue;
    let bytes;
    try { bytes = fs.statSync(path.join(REPO_ROOT, rel)).size; } catch { continue; }
    if (bytes > SIZE_BUDGET) over.push({ rel, bytes });
  }
  return over.sort((a, b) => b.bytes - a.bytes);
}

function printRot({ deep, nodes }) {
  const broken = checkLinks();
  const { expired, upcoming } = checkExpiry();
  console.log(broken.length
    ? `  ✗ rot: ${broken.length} broken relative link(s) — worst first:`
    : '  ✓ rot: no broken relative links');
  for (const b of broken.slice(0, 15)) console.log(`      ${b.file} -> ${b.link}`);
  if (broken.length > 15) console.log(`      …and ${broken.length - 15} more (run --health for context)`);
  console.log(expired.length
    ? `  ✗ rot: ${expired.length} EXPIRED dated rule(s):`
    : '  ✓ rot: no expired dated rules');
  for (const e of expired) console.log(`      ${e.file} — expired ${e.date} (${e.note})`);
  for (const u of upcoming) console.log(`  ⏳ rot: ${u.file} — rule expires ${u.date} (${u.note})`);
  if (deep) {
    const stale = checkFreshness(nodes);
    console.log(stale.length
      ? `  ✗ rot: ${stale.length} folder(s) worked on ≥14 days after their CLAUDE.md was last updated:`
      : '  ✓ rot: folder docs keep pace with folder activity');
    for (const s of stale.slice(0, 20)) console.log(`      ${s.rel}/ — last commit ${s.gitDate}, doc last dated ${s.docDate} (${s.gapDays}d behind)`);
    const oversized = checkSize();
    const budgetKB = Math.round(SIZE_BUDGET / 1024);
    console.log(oversized.length
      ? `  ✗ rot: ${oversized.length} CLAUDE.md over the ${budgetKB}KB size budget — largest first:`
      : `  ✓ rot: every CLAUDE.md fits the ${budgetKB}KB size budget`);
    for (const o of oversized.slice(0, 15)) console.log(`      ${o.rel} — ${Math.round(o.bytes / 1024)}KB`);
    if (oversized.length > 15) console.log(`      …and ${oversized.length - 15} more`);
  }
  return { broken: broken.length, expired: expired.length };
}

// ---------- modes ----------

function report({ json, deep } = {}) {
  const r = check();
  if (json) {
    const broken = checkLinks();
    const { expired, upcoming } = checkExpiry();
    console.log(JSON.stringify({
      ok: r.missing.length === 0 && !r.layoutDrift,
      required: r.nodes.length,
      missingClaudeMd: r.missing,
      layoutDrift: r.layoutDrift,
      layoutReason: r.layoutReason,
      rot: { brokenLinks: broken.length, expiredRules: expired.length, expiringSoon: upcoming.length },
    }, null, 2));
  } else {
    console.log(`Org check: ${r.nodes.length} folders require a CLAUDE.md.`);
    if (r.missing.length === 0) {
      console.log('  ✓ every required folder has a CLAUDE.md');
    } else {
      console.log(`  ✗ ${r.missing.length} missing a CLAUDE.md:`);
      for (const m of r.missing) console.log(`      ${m}/`);
    }
    console.log(r.layoutDrift
      ? `  ✗ folder map out of date: ${r.layoutReason} — run: node scripts/org-check.mjs --fix`
      : '  ✓ folder map matches disk');
    printRot({ deep, nodes: r.nodes }); // informational — never affects the exit code
  }
  process.exit(r.missing.length === 0 && !r.layoutDrift ? 0 : 1);
}

function fix() {
  // 1) scaffold any missing required CLAUDE.md (never overwrites an existing one)
  const before = check();
  for (const node of before.nodes) {
    if (!node.hasMd) scaffoldClaudeMd(node);
  }

  // 2) regenerate the AUTO-LAYOUT block from fresh disk truth (after scaffolding). On a fresh
  //    repo the layout doc may be absent or carry no markers yet (a client being migrated) — set
  //    it up so the map can live there, then it self-maintains on every run after.
  const after = check();
  let layoutMsg;
  if (!fs.existsSync(LAYOUT_DOC)) {
    fs.mkdirSync(path.dirname(LAYOUT_DOC), { recursive: true });
    fs.writeFileSync(LAYOUT_DOC, newLayoutDoc(after.expected), 'utf8');
    layoutMsg = `folder-layout doc created at ${path.relative(REPO_ROOT, LAYOUT_DOC)}`;
  } else {
    const text = fs.readFileSync(LAYOUT_DOC, 'utf8');
    const split = splitLayout(text);
    if (!split.hasMarkers) {
      // existing prose doc with no markers yet: append a map section (installs the markers once)
      const next = text.replace(/\s+$/, '') + '\n\n## Folder map (auto-generated)\n\n' + after.expected + '\n';
      fs.writeFileSync(LAYOUT_DOC, next, 'utf8');
      layoutMsg = 'folder map section added (markers installed)';
    } else {
      const next = split.before + after.expected + split.after;
      if (next !== text) {
        fs.writeFileSync(LAYOUT_DOC, next, 'utf8');
        layoutMsg = 'folder map regenerated';
      } else {
        layoutMsg = 'folder map already current';
      }
    }
  }

  console.log(`Org fix: scaffolded ${before.missing.length} CLAUDE.md ${before.missing.length ? '(' + before.missing.join(', ') + ')' : ''}`);
  console.log(`         ${layoutMsg}`);
}

function printTree() {
  console.log(renderTree(buildRequired()));
}

// ---------- entry ----------

try {
  if (ARGV.includes('--fix')) fix();
  else if (ARGV.includes('--print-tree')) printTree();
  else if (ARGV.includes('--health')) report({ json: false, deep: true });
  else report({ json: ARGV.includes('--json') });
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(2);
}
