#!/usr/bin/env node
// BRAND SNAPSHOTS — renders the client's brand guide to images so it can actually be
// LOOKED AT before any visual work starts.
//
// WHY IMAGES AND NOT THE HTML FILE
// The gate demands that the guide be seen, not read. Reading 50KB of markup is not
// seeing it — upstream, the miss that caused all of this happened with the written
// rules already read. These images are the artifact the gate demands, and looking at
// one costs a moment instead of a minute of spinning up a server.
//
// brand-gate.mjs compares each image's timestamp against the guide file. Edit the guide
// and these go stale automatically, so the gate demands a re-render rather than
// accepting a picture of the old law.
//
//   node brand-snapshots.mjs           render every chapter
//   node brand-snapshots.mjs --check   exit 1 if stale/missing, render nothing
//
// Playwright is REQUIRED. /king-intelligence:install-brand installs it before it ever
// reaches this point; if it is missing here, say so plainly and point at
// /king-intelligence:install-playwright rather than silently shipping a weaker gate.
//
// A browser cannot be handed a file:// URL from an automated context, which is why this
// serves the guide's folder over localhost first. Animations are killed before capture:
// an infinite drift or pan never settles, and the screenshotter waits forever on a page
// that never stops moving.

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { brandConfig, WORKSPACE } from "./brand-check.mjs";

const cfg = brandConfig();

if (!cfg) {
  process.stderr.write(
    "No brand is configured yet. Run /king-intelligence:install-brand first — it builds the guide that this renders.\n"
  );
  process.exit(1);
}

const GUIDE_HTML = path.join(WORKSPACE, cfg.guidePath || "brand/BRAND-GUIDE.html");
const GUIDE_DIR = path.dirname(GUIDE_HTML);
const OUT_DIR = path.join(WORKSPACE, cfg.snapshotDir || "brand/guide-snapshots");

// The overview and the dead list are what the gate always demands; the rest are looked
// at according to what is being built. Chapters are per-client because a client's guide
// has only the chapters their brand actually earned.
const REQUIRED = cfg.requiredSnapshots?.length
  ? cfg.requiredSnapshots
  : ["00-overview.png", "99-dead-list.png"];

// { id, file, label }. id null means "capture the top of the page", used for the overview.
const CHAPTERS = cfg.chapters?.length
  ? [{ id: null, file: REQUIRED[0], label: "the system in one page" }, ...cfg.chapters]
  : [{ id: null, file: REQUIRED[0], label: "the system in one page" }];

export function snapshotsAreStale() {
  if (!fs.existsSync(OUT_DIR)) return { stale: true, why: `${path.relative(WORKSPACE, OUT_DIR)}/ does not exist` };
  let guideMtime;
  try {
    guideMtime = fs.statSync(GUIDE_HTML).mtimeMs;
  } catch {
    return { stale: true, why: `the guide is missing at ${cfg.guidePath}` };
  }
  for (const c of CHAPTERS) {
    const p = path.join(OUT_DIR, c.file);
    if (!fs.existsSync(p)) return { stale: true, why: `missing ${c.file}` };
    if (fs.statSync(p).mtimeMs < guideMtime) {
      return { stale: true, why: `${c.file} is older than the guide — the law changed after this picture was taken` };
    }
  }
  return { stale: false };
}

/* ── a tiny static server, so we never hand the browser a file:// URL ─────── */
const MIME = { ".html": "text/html", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2" };

function serve(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
      const full = path.join(dir, rel);
      if (!full.startsWith(dir) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(full).toLowerCase()] || "application/octet-stream",
        // Aggressive caching silently re-serves the OLD build after a guide edit, so
        // "fixes" look like no-ops. Never cache here.
        "Cache-Control": "no-store",
      });
      fs.createReadStream(full).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

async function main() {
  if (process.argv.includes("--check")) {
    const s = snapshotsAreStale();
    process.stdout.write(s.stale ? `STALE: ${s.why}\n` : "Snapshots are current.\n");
    process.exit(s.stale ? 1 : 0);
  }

  if (!fs.existsSync(GUIDE_HTML)) {
    process.stderr.write(`The brand guide is missing at ${cfg.guidePath}. Run /king-intelligence:install-brand to build it.\n`);
    process.exit(1);
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    process.stderr.write(
      "Playwright is not installed, so the guide cannot be turned into pictures.\n" +
        "Run /king-intelligence:install-playwright, then run this again.\n"
    );
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { server, port } = await serve(GUIDE_DIR);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });

  try {
    await page.goto(`http://127.0.0.1:${port}/${path.basename(GUIDE_HTML)}`, { waitUntil: "networkidle", timeout: 60000 });
    // Any infinite animation means the screenshotter never gets a stable frame.
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none !important;transition:none !important;}" });
    await page.waitForTimeout(600);

    for (const c of CHAPTERS) {
      const out = path.join(OUT_DIR, c.file);
      if (c.id === null || c.id === undefined) {
        await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1280, height: 1700 } });
      } else {
        const el = page.locator(`#${c.id}`);
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        await el.screenshot({ path: out });
      }
      const kb = (fs.statSync(out).size / 1024).toFixed(0);
      process.stdout.write(`  ${c.file.padEnd(22)} ${String(kb).padStart(5)} KB   ${c.label || ""}\n`);
    }
  } finally {
    await browser.close();
    server.close();
  }

  // Stamp every snapshot as newer than the guide, so a render immediately after an edit
  // is never judged stale by its own millisecond ordering.
  const now = new Date();
  for (const c of CHAPTERS) fs.utimesSync(path.join(OUT_DIR, c.file), now, now);
  process.stdout.write(`\nWrote ${CHAPTERS.length} snapshot(s) to ${path.relative(WORKSPACE, OUT_DIR)}/\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    process.stderr.write(`brand-snapshots failed: ${e.message}\n`);
    process.exit(1);
  });
}
