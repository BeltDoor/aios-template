#!/usr/bin/env node
// BRAND CHECK — refuses visual output that breaks the client's own brand rules.
//
// Ported from the King Intelligence house version, generalized so every rule comes from
// the client's config instead of being hardcoded to one brand.
//
// WHY THIS EXISTS
// A brand written down is a brand that gets skipped. The house version was built after a
// brand law that lived in THREE separate documents was still ignored on the very day it
// was locked, because the build started from a feature spec and never opened the law.
// The lesson, stated plainly in the guard it produced:
//
//     a note in a CLAUDE.md is not a control — a prose rule gets skipped,
//     a failing check does not.
//
// THE BAR FOR ADDING A CHECK (inherited; do not lower it):
// only add one you can state as "the user reported X, here is the literal source
// condition that makes X impossible." Vague style opinions belong in design review, not
// in the thing that can block work. Wide guards cry wolf and get switched off, which
// lands right back at a brand nobody follows.
//
// SILENT UNTIL CONFIGURED
// With no `skills.brand` block in the plugin config this module does NOTHING and exits 0.
// Every client who has never run /install-brand must never see it.
//
// MODES
//   node brand-check.mjs                 scan the workspace, exit 1 on any violation
//   node brand-check.mjs <file> [...]    scan named files
//   node brand-check.mjs --json          machine-readable output
//   node brand-check.mjs --all           include grandfathered violations
//   node brand-check.mjs --update-baseline   bank today's state as pre-existing
//   node brand-check.mjs --hook          PostToolUse hook (JSON on stdin, exit 2 to fix)
//
// ROLLBACK (any ONE of these fully disables it):
//   1. Remove the PostToolUse entry in hooks/hooks.json referencing this file
//   2. Or: set "enforce": false in the config's skills.brand block
//   3. Or: set DISABLE_BRAND_CHECK=1 to bypass without changing anything

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ══════════════════════════ WHERE THINGS ARE ═══════════════════════════════ */

// The client's workspace, NOT the plugin folder. Hooks get CLAUDE_PROJECT_DIR from
// Claude Code; the cwd fallback covers a direct command-line run.
export const WORKSPACE = path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());

const CONFIG_PATH = process.env.CLAUDE_PLUGIN_DATA
  ? path.join(process.env.CLAUDE_PLUGIN_DATA, "config.json")
  : null;

/* ══════════════════════════ CONFIG ═════════════════════════════════════════ */
//
// Shared with brand-gate.mjs so the gate and the checker can never disagree about what
// counts as a guarded surface or where the guide lives. One definition, two consumers.

let _cfg;
export function brandConfig() {
  if (_cfg !== undefined) return _cfg;
  _cfg = null;
  try {
    if (CONFIG_PATH && fs.existsSync(CONFIG_PATH)) {
      const brand = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"))?.skills?.brand;
      // A block that exists but is switched off is the same as no block at all.
      if (brand && brand.enforce !== false) _cfg = brand;
    }
  } catch {
    _cfg = null; // unreadable config must never block work
  }
  return _cfg;
}

const VISUAL_EXT = new Set([".html", ".htm", ".css", ".scss", ".svg", ".tsx", ".jsx", ".vue"]);

/* ── DOCUMENTS AND DECKS ─────────────────────────────────────────────────────
   Added 8/7/26. The scope above is web-shaped, because that is what the brand this
   was ported from actually builds. But most clients never touch a web file: they ask
   for a flyer, a proposal, a deck. Built as a Word file or a slide, that work sailed
   straight past the gate and Claude never opened their brand guide — the exact miss
   the gate exists to stop, just wearing a different file extension.

   A .docx and a .pptx are both ZIP archives, so the CHECKER cannot read their colours.
   The GATE can still stop the work before it starts, which is the half that matters
   most here. What the checker does get is the generator script, which is plain text and
   does carry the hex codes.

   Switch off per client with "gateDocuments": false. */
const DOC_EXT = new Set([".docx", ".dotx", ".pptx", ".potx", ".pdf", ".odt", ".odp", ".key", ".pages"]);

// An unpacked Office package: editing word/document.xml or ppt/slides/slide3.xml IS
// authoring the document, and it is how the docx/pptx skills edit an existing file.
// Must match NESTED parts, not just the top level — slides live at ppt/slides/slideN.xml,
// which is the single most common deck edit. A `[^/]*` here silently misses every one.
const OOXML_PART = /(^|\/)(word|ppt)\/.*\.xml$/i;

// Plain-text scripts are only document work when they actually pull in a document
// generator. Gating every .js file would fire on ordinary code and get switched off.
const SCRIPT_EXT = new Set([".js", ".mjs", ".cjs", ".ts", ".py"]);

// pptxgenjs and python-pptx take colours as BARE hex — `color: "7A2FF2"`, no `#`. Every
// colour check keys off `#`, so a killed colour in a deck generator passed straight
// through while the same colour in a stylesheet was caught. Normalise the bare form
// back to `#RRGGBB` before checking, but ONLY where it sits in a colour-shaped key, so
// a git SHA or an id never gets mistaken for a colour.
// Adding one character does not move any newline, so reported line numbers stay right.
// The opening quote is REPLACED by the `#` rather than one being inserted, so the text
// stays exactly the same length and every reported offset and line stays truthful.
const BARE_HEX_COLOR = /\b(color|fill|bkgd|background|line|solidFill|fontColor|barColor)(\s*[:=]\s*)(["'])([0-9a-fA-F]{6})\3/gi;
const normalizeBareHex = (src) =>
  src.replace(BARE_HEX_COLOR, (_m, key, sep, q, hex) => `${key}${sep}#${hex}${q}`);
const DOC_GENERATOR = /\b(pptxgenjs|python-pptx|python-docx|officegen|docxtemplater|html2pptx)\b|from\s+pptx\b|from\s+docx\b|import\s+pptx\b|import\s+docx\b|require\(['"]docx['"]\)|from\s+['"]docx['"]/i;

// Bash that PRODUCES a document. Deliberately excludes every read path the document
// skills use (markitdown, pandoc -t markdown, thumbnail.py, validate.py, bare unzip):
// reading a contract someone sent is not brand work, and stopping it would be noise.
const DOC_BASH = [
  /--convert-to\s+(pdf|docx|pptx|odt|odp)\b/i,           // soffice/libreoffice export
  /\bpandoc\b[^|;]*-o\s+\S+\.(docx|pptx|pdf|odt|odp)\b/i, // pandoc writing a document
  /\bzip\b[^|;]*\.(docx|pptx|potx|dotx)\b/i,              // re-packing an edited package
  /\badd_slide\.py\b/i,                                   // pptx skill: new slide
];

export function isDocumentBashCommand(cmd, cfg = brandConfig()) {
  if (!cfg || cfg.gateDocuments === false) return false;
  return DOC_BASH.some((re) => re.test(cmd || ""));
}

// `content` is what is about to be written (Write's content, Edit's new_string). It is
// optional: without it, only path-based detection runs.
export function isGuardedDocumentFile(absPath, content = "", cfg = brandConfig()) {
  if (!cfg || cfg.gateDocuments === false) return false;
  const rel = path.relative(WORKSPACE, absPath).split(path.sep).join("/");
  if (rel.startsWith("..")) return false;
  if (isSkipped(rel, cfg)) return false;
  const ext = path.extname(absPath).toLowerCase();
  if (DOC_EXT.has(ext)) return true;
  if (OOXML_PART.test(rel)) return true;
  if (SCRIPT_EXT.has(ext) && DOC_GENERATOR.test(content)) return true;
  return false;
}

// Always skipped, for every client. Build output and dependencies are not hand-authored
// brand work, and scanning them produces only noise.
const SKIP_ALWAYS = [
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)\.git(\/|$)/,
  /(^|\/)\.next(\/|$)/,
  /(^|\/)(dist|build|out|coverage|vendor)(\/|$)/,
  /(^|\/)\.claude\/plugins(\/|$)/,
];

const matchesAny = (rel, list) => list.some((re) => re.test(rel));

// Folders holding work for the client's OWN customers. Those deliverables carry the
// CUSTOMER's brand, so the client's brand law must not touch them. Named by the client
// during /install-brand rather than guessed, because a folder-name guess is silently
// wrong for anyone who named it something else and they never find out why.
function carveOutRegexes(cfg) {
  return (cfg?.carveOut || []).map((dir) => {
    const clean = String(dir).replace(/^[./]+|\/+$/g, "");
    if (!clean) return null;
    const esc = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\/)${esc}(\\/|$)`);
  }).filter(Boolean);
}

function isSkipped(rel, cfg) {
  if (matchesAny(rel, SKIP_ALWAYS)) return true;
  if (matchesAny(rel, carveOutRegexes(cfg))) return true;
  // Never check the brand guide or its own snapshots. That is circular and would make
  // the guide unmaintainable: the dead list has to NAME the banned things to document
  // them, and a checker reading its own dead list screams on every run.
  for (const p of [cfg?.guidePath, cfg?.snapshotDir, cfg?.ratingFilePath]) {
    if (!p) continue;
    const clean = String(p).replace(/^[./]+/, "");
    if (clean && (rel === clean || rel.startsWith(clean.replace(/\/$/, "") + "/"))) return true;
  }
  return false;
}

/* ══════════════════════════ COLOR MATH ═════════════════════════════════════ */

function hexToHsl(hex) {
  let h = hex.replace("#", "").toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6); // drop alpha
  if (h.length !== 6 || /[^0-9a-f]/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let s = 0;
  let hue = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) hue = 60 * (((g - b) / d) % 6);
    else if (max === g) hue = 60 * ((b - r) / d + 2);
    else hue = 60 * ((r - g) / d + 4);
  }
  if (hue < 0) hue += 360;
  return { h: hue, s, l };
}

function rgbOf(hex) {
  let h = hex.replace("#", "").toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6 || /[^0-9a-f]/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const normHex = (raw) => {
  const r = raw.toLowerCase();
  return r.length === 4 ? "#" + r.slice(1).split("").map((c) => c + c).join("") : r.slice(0, 7);
};

/* ══════════════════════════ MASK WHAT IS NOT CODE ══════════════════════════ */
//
// THE DEFECT CLASS: text that DESCRIBES the brand law must never be read AS the law
// being broken. Two separate false positives came out of this same root cause upstream:
//
//   1. Prose. A guide whose own copy said "there is especially no purple, ever" and
//      whose dead list had a row "Purple — Banned" was flagged as a purple violation.
//   2. Comments. Two live surfaces carried the comment "Fixed-position layer, NOT
//      background-attachment:fixed (Safari ignores that)". Both files were correct; the
//      warning ABOUT the bug was read as the bug.
//
// So blank everything that is not code — HTML text nodes, HTML comments, CSS block
// comments, and JS line comments — keeping tag attributes and <style>/<script> bodies.
// Blanking is character-by-character with newlines preserved, so line numbers hold.
function maskNonCode(src, ext) {
  const isHtml = ext === ".html" || ext === ".htm";
  const chars = src.split("");
  const blank = (start, end) => {
    for (let i = start; i < end && i < chars.length; i++) {
      if (chars[i] !== "\n") chars[i] = " ";
    }
  };

  if (isHtml) {
    for (const m of src.matchAll(/>([^<]*)</g)) blank(m.index + 1, m.index + 1 + m[1].length);
    // Restore <style>/<script> bodies, which the pass above blanked as text nodes.
    for (const m of src.matchAll(/<(style|script)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const bodyStart = src.indexOf(">", m.index) + 1;
      const bodyEnd = m.index + m[0].length;
      for (let i = bodyStart; i < bodyEnd; i++) chars[i] = src[i];
    }
  }

  const masked = chars.join("");
  const out = masked.split("");
  const blankOut = (start, end) => {
    for (let i = start; i < end && i < out.length; i++) {
      if (out[i] !== "\n") out[i] = " ";
    }
  };
  // HTML comments, then CSS/JS block comments (valid in .css, .scss, .tsx, .svg).
  for (const m of masked.matchAll(/<!--[\s\S]*?-->/g)) blankOut(m.index, m.index + m[0].length);
  for (const m of masked.matchAll(/\/\*[\s\S]*?\*\//g)) blankOut(m.index, m.index + m[0].length);
  // JS line comments only where `//` is actually a comment — never in CSS, and never
  // when it follows a colon (that is a URL scheme, e.g. https://).
  if ([".tsx", ".jsx", ".vue", ".ts", ".js"].includes(ext)) {
    for (const m of masked.matchAll(/(^|[^:\w])\/\/[^\n]*/g)) {
      blankOut(m.index + m[1].length, m.index + m[0].length);
    }
  }
  return out.join("");
}

const lineOf = (src, index) => src.slice(0, index).split("\n").length;

// Crude non-nested CSS rule splitter. Rule scoping matters: without it, "does this file
// contain opacity:0.3 anywhere?" passes a broken layer whenever some unrelated element
// happens to use 0.3.
// The selector half is LENGTH-BOUNDED on purpose. An unbounded [^{}]+ backtracks
// position-by-position across any file with few braces (a big .svg, an .html with long
// text), which turned a 2-second scan into a 2-minute hang.
function* cssRules(src) {
  for (const m of src.matchAll(/([^{}]{1,300})\{([^{}]{0,4000})\}/g)) {
    yield { sel: m[1], body: m[2], index: m.index };
  }
}

/* ══════════════════════════ THE CHECKS ═════════════════════════════════════ */
//
// Each returns an array of { id, line, msg }. `src` is the prose-masked file text.
// Two families:
//   UNIVERSAL — the AI tells. True for every brand, always on.
//   EARNED    — built from what THIS client explicitly rejected in their rating round.

/* ── UNIVERSAL 1: GLOW BALLS ─────────────────────────────────────────────────
   A soft blurred bloom floated behind a subject is textbook AI slop and reads as
   generated on any brand.
   HONESTY NOTE: this is a HEURISTIC, not an exact condition. It ships blocking because
   a >=80px blur is genuinely rare in real hand-built work. If it ever false-positives,
   TIGHTEN THIS FUNCTION — do not widen the escape hatch and do not delete the check. */
function checkGlowBall(src) {
  const out = [];
  for (const m of src.matchAll(/(?<!backdrop-)filter:\s*[^;"'}]*\bblur\(\s*(\d+(?:\.\d+)?)(px|rem)?\s*\)/gi)) {
    const px = m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1]);
    if (px >= 80) {
      out.push({ id: "NO-GLOW-BALL", line: lineOf(src, m.index), msg: `filter: blur(${m[1]}${m[2] || "px"}) — a soft blurred bloom behind a subject is the "glow ball", banned as textbook AI slop. Light should be a real material, not a blur.` });
    }
  }
  for (const m of src.matchAll(/[.#][\w-]*glow[\w-]*\s*\{[^}]*\}/gi)) {
    if (/radial-gradient|border-radius:\s*(50%|9999px)/i.test(m[0]) && /blur\(|box-shadow/i.test(m[0])) {
      out.push({ id: "NO-GLOW-BALL", line: lineOf(src, m.index), msg: `a "glow" rule combining a radial/round shape with a blur or soft shadow — that is the glow ball. Banned.` });
    }
  }
  return out;
}

/* ── UNIVERSAL 2: PROCEDURAL TEXTURE ─────────────────────────────────────────
   Fake noise reads as "too AI" on every brand it has been rated against. Real texture
   is a photograph or nothing. Film grain, paper tooth, brushed metal and rule grids all
   fall in here — one upstream case had a 96px rule grid sitting on a textured room and
   the owner reported it as "a weird gradient with stripes". */
function checkProceduralTexture(src) {
  const out = [];
  const PATTERNS = [
    [/\bfeTurbulence\b/g, "feTurbulence (SVG procedural noise)"],
    [/\brepeating-(?:linear|radial)-gradient\s*\(/g, "repeating-gradient (stripes / rule grid)"],
    [/(--|[.#])(film-?grain|grain-overlay|paper-tooth|brushed-metal|noise-overlay)\b/gi, "a procedural texture layer"],
    [/\b(?:class|className)\s*=\s*["'][^"']*\b(grain|noise|scanlines)\b/gi, "a procedural texture class"],
  ];
  for (const [re, label] of PATTERNS) {
    for (const m of src.matchAll(re)) {
      out.push({ id: "NO-PROCEDURAL-TEXTURE", line: lineOf(src, m.index), msg: `${label} — procedural texture reads as machine-generated. Use a real photographed material, or no texture at all.` });
    }
  }
  return out;
}

/* ── EARNED 1: COLOURS THEY KILLED ───────────────────────────────────────────
   Every entry here traces to a direction the client explicitly rejected during their
   rating round, or a family they named in the interview. Nothing invented. */
function checkKilledColors(src, cfg) {
  const out = [];
  const killedHexes = new Map(
    (cfg.bannedHexes || []).map((b) =>
      typeof b === "string" ? [normHex(b), ""] : [normHex(b.hex), b.why || ""]
    )
  );
  const families = cfg.bannedColorFamilies || []; // e.g. [{name:"purple", hueMin:238, hueMax:312, why:"…"}]
  const namedWords = (cfg.bannedNamedColors || []).filter(Boolean);

  for (const m of src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const norm = normHex(m[0]);
    if (killedHexes.has(norm)) {
      const why = killedHexes.get(norm);
      out.push({ id: "KILLED-COLOUR", line: lineOf(src, m.index), msg: `${m[0]} is a colour you rejected${why ? ` — ${why}` : ""}. It is on your dead list.` });
      continue;
    }
    const hsl = hexToHsl(m[0]);
    if (!hsl) continue;
    for (const f of families) {
      // Saturation and lightness floors keep near-grey and near-black out of a hue band.
      if (hsl.h >= f.hueMin && hsl.h <= f.hueMax && hsl.s > 0.2 && hsl.l > 0.12 && hsl.l < 0.92) {
        out.push({ id: "KILLED-COLOUR", line: lineOf(src, m.index), msg: `${m[0]} is ${f.name} (hue ${Math.round(hsl.h)})${f.why ? ` — ${f.why}` : ""}. That family is on your dead list.` });
        break;
      }
    }
  }

  if (namedWords.length) {
    const esc = namedWords.map((w) => String(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const named = new RegExp(`\\b(${esc.join("|")})\\b`, "gi");
    for (const m of src.matchAll(named)) {
      out.push({ id: "KILLED-COLOUR", line: lineOf(src, m.index), msg: `named colour "${m[0]}" is on your dead list.` });
    }
    const tw = new RegExp(
      `\\b(?:bg|text|border|from|via|to|ring|shadow|fill|stroke|decoration|outline|accent|caret|divide)-(${esc.join("|")})-\\d{2,3}\\b`,
      "gi"
    );
    for (const m of src.matchAll(tw)) {
      out.push({ id: "KILLED-COLOUR", line: lineOf(src, m.index), msg: `Tailwind "${m[0]}" — that family is on your dead list.` });
    }
  }
  return out;
}

/* ── EARNED 2: BRAND-COLOUR DRIFT ────────────────────────────────────────────
   A near-miss of the brand colour is not a shade, it is a brand that looks slightly
   wrong everywhere. Upstream this caught a drifted accent that had crept onto a live
   profile banner and sat there for weeks.
   The radius is tuned so a genuine gradient stop survives: at 22, a variant ~17 away is
   caught while legitimate stops at 26 and 59 are not. Widening past ~25 starts eating
   real bevel and gradient stops, so raise it only with a case in hand. */
function checkColorDrift(src, cfg) {
  const out = [];
  const primary = cfg.palette?.primary;
  if (!primary) return out;
  const target = rgbOf(primary);
  if (!target) return out;
  const radius = Number(cfg.palette?.driftRadius ?? 22);
  const sanctioned = new Set((cfg.palette?.sanctioned || [primary]).map(normHex));

  for (const m of src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const norm = normHex(m[0]);
    if (sanctioned.has(norm)) continue;
    const rgb = rgbOf(m[0]);
    if (!rgb) continue;
    const d = Math.hypot(rgb[0] - target[0], rgb[1] - target[1], rgb[2] - target[2]);
    if (d > 0 && d <= radius) {
      out.push({ id: "ONE-BRAND-COLOUR", line: lineOf(src, m.index), msg: `${m[0]} is a near-miss of your brand colour ${primary} (distance ${d.toFixed(1)}). This is drift, not a shade — it reads as slightly-wrong everywhere. Use ${primary}, or one of your sanctioned companions: ${[...sanctioned].join(", ")}.` });
    }
  }
  return out;
}

/* ── EARNED 3: THE SAFARI TEXTURE TRAP ───────────────────────────────────────
   Only runs for a client whose brand actually has a full-page texture layer
   (config: skills.brand.textureToken). Safari silently ignores the "fixed" background
   attachment inside the `background` shorthand, so the layer renders FLAT — correct in
   Chrome, invisible in Safari. Upstream this shipped twice before a screenshot caught
   it, in the browser the owner actually reviews in. */
function checkTextureTrap(src, cfg) {
  const out = [];
  const token = cfg.textureToken;
  if (!token) return out;
  const tokenRe = new RegExp(String(token).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (!tokenRe.test(src)) return out;
  for (const rule of cssRules(src)) {
    if (!tokenRe.test(rule.body)) continue;
    for (const d of rule.body.matchAll(/background(?:-image|-attachment)?\s*:\s*[^;}]*/gi)) {
      const decl = d[0];
      const hasToken = tokenRe.test(decl);
      const isAttachmentFixed = /background-attachment\s*:\s*fixed/i.test(decl) || (hasToken && /\bfixed\b/.test(decl));
      if (!isAttachmentFixed) continue;
      out.push({ id: "TEXTURE-SAFARI-TRAP", line: lineOf(src, rule.index), msg: `the texture layer on "${rule.sel.trim().slice(0, 60)}" uses the "fixed" background attachment. Safari silently drops it inside a background shorthand and the surface renders flat. Use a position:fixed ::before layer with its own opacity instead.` });
      break;
    }
  }
  return out;
}

/* ── EARNED 4: THEIR OWN PATTERNS ────────────────────────────────────────────
   Free-form rules written during /install-brand, each one traceable to something the
   client said. Compiled defensively: one bad regex must never take the checker down. */
function checkCustomPatterns(src, cfg) {
  const out = [];
  for (const p of cfg.bannedPatterns || []) {
    let re;
    try {
      re = new RegExp(p.regex, p.flags || "g");
    } catch {
      continue; // a malformed rule is skipped, never fatal
    }
    if (!re.global) re = new RegExp(p.regex, (p.flags || "") + "g");
    for (const m of src.matchAll(re)) {
      out.push({ id: p.id || "BRAND-RULE", line: lineOf(src, m.index), msg: p.msg || `"${m[0]}" is on your dead list.` });
    }
  }
  return out;
}

/* ══════════════════════════ RUNNER ═════════════════════════════════════════ */

// Shared with brand-gate.mjs so the gate and the checker can never disagree about what
// counts as a guarded visual surface. One definition, two consumers.
export function isGuardedVisualFile(absPath, cfg = brandConfig()) {
  if (!cfg) return false; // never configured -> nothing is guarded
  const rel = path.relative(WORKSPACE, absPath).split(path.sep).join("/");
  if (rel.startsWith("..")) return false; // outside the workspace entirely
  if (isSkipped(rel, cfg)) return false;
  return VISUAL_EXT.has(path.extname(absPath).toLowerCase());
}

export function checkFile(absPath, cfg = brandConfig()) {
  if (!cfg) return [];
  const rel = path.relative(WORKSPACE, absPath).split(path.sep).join("/");
  if (rel.startsWith("..")) return [];
  if (isSkipped(rel, cfg)) return [];

  const ext = path.extname(absPath).toLowerCase();
  const isVisual = VISUAL_EXT.has(ext);
  // A .docx or .pptx is a ZIP, so there is nothing here to read. Its generator script
  // is plain text though, and that is where the colours are actually written down —
  // so a deck built by pptxgenjs still gets its palette checked.
  const maybeGenerator = SCRIPT_EXT.has(ext) && cfg.gateDocuments !== false;
  if (!isVisual && !maybeGenerator) return [];

  let raw;
  try {
    raw = fs.readFileSync(absPath, "utf8");
  } catch {
    return [];
  }
  // A minified bundle is not hand-authored brand work and produces only noise.
  if (raw.length > 1_500_000) return [];
  // Only scan a script once it proves it builds documents. Checking every .js in the
  // workspace would flag ordinary code and get the whole thing switched off.
  if (!isVisual && !DOC_GENERATOR.test(raw)) return [];

  let src = maskNonCode(raw, ext);
  if (!isVisual) src = normalizeBareHex(src); // deck/doc generators write bare hex

  return [
    ...checkGlowBall(src),
    ...checkProceduralTexture(src),
    ...checkKilledColors(src, cfg),
    ...checkColorDrift(src, cfg),
    ...checkTextureTrap(src, cfg),
    ...checkCustomPatterns(src, cfg),
  ].map((f) => ({ ...f, file: rel }));
}

/* ══════════════════════════ BASELINE ═══════════════════════════════════════ */
//
// This guard arrives long after the client's files did. Failing on every pre-existing
// surface makes the guard noise, and noisy guards get switched off — the exact failure
// it is supposed to prevent. So today's state is grandfathered and the guard enforces
// the only thing that matters: NO NEW VIOLATIONS. Fix a legacy file whenever you happen
// to be in it, then re-run --update-baseline to bank the win.
//
// Fingerprints are file + check id + message (never line numbers, which shift on any
// edit). Counts are stored so a file gaining a SECOND identical violation still fails.

function baselinePath(cfg) {
  const rel = cfg?.baselinePath || "brand/brand-check-baseline.json";
  return path.join(WORKSPACE, rel);
}

const fingerprint = (v) => `${v.file} ${v.id} ${v.msg}`;

function loadBaseline(cfg) {
  try {
    return new Map(Object.entries(JSON.parse(fs.readFileSync(baselinePath(cfg), "utf8")).counts));
  } catch {
    return new Map();
  }
}

// Returns only the violations that exceed what the baseline already knows about.
function newOnly(violations, baseline) {
  const seen = new Map();
  const fresh = [];
  for (const v of violations) {
    const fp = fingerprint(v);
    const n = (seen.get(fp) ?? 0) + 1;
    seen.set(fp, n);
    if (n > (baseline.get(fp) ?? 0)) fresh.push(v);
  }
  return fresh;
}

function writeBaseline(violations, cfg) {
  const counts = {};
  for (const v of violations) {
    const fp = fingerprint(v);
    counts[fp] = (counts[fp] ?? 0) + 1;
  }
  const p = baselinePath(cfg);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(
    p,
    JSON.stringify(
      {
        _comment:
          "Brand violations that predate the brand check. The guard fails only on violations NOT listed here. Fix a legacy file, then re-run with --update-baseline.",
        total: violations.length,
        counts,
      },
      null,
      2
    ) + "\n"
  );
}

function walk(dir, cfg, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(WORKSPACE, full).split(path.sep).join("/");
    if (isSkipped(rel, cfg)) continue;
    if (e.isDirectory()) { walk(full, cfg, acc); continue; }
    const ext = path.extname(e.name).toLowerCase();
    // Scripts are collected too; checkFile drops the ones that turn out not to build
    // documents, so a full scan still covers deck generators without flagging code.
    if (VISUAL_EXT.has(ext) || (cfg.gateDocuments !== false && SCRIPT_EXT.has(ext))) acc.push(full);
  }
  return acc;
}

function report(violations, json, cfg) {
  if (json) {
    process.stdout.write(JSON.stringify(violations, null, 2) + "\n");
    return;
  }
  if (violations.length === 0) {
    process.stdout.write("BRAND CHECK: clean.\n");
    return;
  }
  const byFile = new Map();
  for (const v of violations) {
    if (!byFile.has(v.file)) byFile.set(v.file, []);
    byFile.get(v.file).push(v);
  }
  process.stdout.write(`BRAND CHECK: ${violations.length} violation(s) in ${byFile.size} file(s)\n\n`);
  for (const [file, list] of byFile) {
    process.stdout.write(`${file}\n`);
    for (const v of list) process.stdout.write(`  ${v.line}: [${v.id}] ${v.msg}\n`);
    process.stdout.write("\n");
  }
  if (cfg?.lawPath) process.stdout.write(`Your brand law: ${cfg.lawPath}\n`);
  if (cfg?.guidePath) process.stdout.write(`Your guide:     ${cfg.guidePath}\n`);
}

/* ── hook mode: JSON on stdin ─────────────────────────────────────────────── */
function hookMode(cfg) {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (input += c));
  process.stdin.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(input || "{}");
    } catch {
      process.exit(0); // never block on a malformed payload
    }
    const fp = payload?.tool_input?.file_path;
    if (!fp) process.exit(0);
    let violations = [];
    try {
      violations = newOnly(checkFile(path.resolve(fp), cfg), loadBaseline(cfg));
    } catch {
      process.exit(0); // never block on our own bug
    }
    if (violations.length === 0) process.exit(0);
    const lines = violations.map((v) => `  line ${v.line}: [${v.id}] ${v.msg}`).join("\n");
    process.stderr.write(
      `BRAND CHECK failed on ${violations[0].file} — fix these before continuing:\n${lines}\n\n` +
        (cfg?.lawPath ? `Your brand law: ${cfg.lawPath}\n` : "") +
        `If this is a genuine false positive, tighten the rule in your brand config. Do not disable the check.\n`
    );
    process.exit(2);
  });
}

/* ── entry ───────────────────────────────────────────────────────────────── */
//
// GUARDED so importing this module has NO side effects. Without this, the gate's
// `await import(...)` of isGuardedVisualFile ran the whole entry block — a full scan
// followed by process.exit(0) — so the gate silently allowed everything through.
// An ESM module that scans and exits on import is a trap; keep the guard.
const RUN_DIRECTLY = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (RUN_DIRECTLY) main();

function main() {
  if (process.env.DISABLE_BRAND_CHECK === "1") process.exit(0);

  const cfg = brandConfig();
  const argv = process.argv.slice(2);

  // NOT CONFIGURED -> completely silent. Every client who has never run /install-brand
  // must never see this script exist. This is the first thing to verify after any edit.
  if (!cfg) {
    if (argv.includes("--hook")) process.exit(0);
    if (argv.includes("--json")) process.stdout.write("[]\n");
    else process.stdout.write("BRAND CHECK: no brand configured — run /king-intelligence:install-brand first.\n");
    process.exit(0);
  }

  // Hook mode is an EXPLICIT flag on purpose. Sniffing stdin (`!isTTY`) makes the script
  // hang forever whenever it is run from another script or a CI step, because those also
  // have a non-TTY stdin and never send a payload.
  if (argv.includes("--hook")) {
    hookMode(cfg);
    return;
  }

  const json = argv.includes("--json");
  const files = argv.filter((a) => !a.startsWith("--"));
  const targets = files.length ? files.map((f) => path.resolve(f)) : walk(WORKSPACE, cfg);
  const all = targets.flatMap((f) => checkFile(f, cfg));

  if (argv.includes("--update-baseline")) {
    writeBaseline(all, cfg);
    process.stdout.write(`BRAND CHECK: baseline updated — ${all.length} grandfathered violation(s) in ${new Set(all.map((v) => v.file)).size} file(s).\n`);
    process.exit(0);
  }

  const violations = argv.includes("--all") ? all : newOnly(all, loadBaseline(cfg));
  report(violations, json, cfg);
  if (!json && !argv.includes("--all") && all.length !== violations.length) {
    process.stdout.write(`(${all.length - violations.length} pre-existing violation(s) grandfathered — see them with --all)\n`);
  }
  process.exit(violations.length ? 1 : 0);
}
