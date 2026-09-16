#!/usr/bin/env node
// ki-run.mjs: run one toolkit script from the NEWEST installed toolkit, and never abort the command.
//
// Why this exists (9/16/26): a /king-intelligence command's setup lines run before the model reads
// a word of it, and Claude Code aborts the whole command the moment one of them exits non-zero
// ("Shell command failed for pattern"). Those lines used to point at ${CLAUDE_PLUGIN_ROOT}, the
// toolkit folder this SESSION opened on. After the toolkit updates itself mid-session, that folder
// is the old version, and on one member's computer the file the command asked for was no longer
// there at all, so the command died on its first line and the member saw only the raw error.
//
// This runner does two things: it finds the newest installed toolkit on this computer and runs the
// named script from there, and it ALWAYS exits 0, printing a KI_STEP_FAILED line the command's own
// text knows how to read instead of letting the failure abort the command.
//
//   node ki-run.mjs <script.mjs> [args...]     the literal argument ROOT becomes the resolved folder
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ownRoot = path.dirname(here);
const [name, ...rest] = process.argv.slice(2);

let root = ownRoot;
try {
  const mod = await import("./local-scripts.mjs");
  const found = mod.newestPluginRoot(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  if (found && found.root && name && existsSync(path.join(found.root, "scripts", name))) root = found.root;
} catch { /* the finder is best-effort; this folder still works */ }

const script = name ? path.join(root, "scripts", name) : "";
if (!name || !existsSync(script)) {
  console.log(`KI_STEP_FAILED: ${name || "(no script named)"} is not in the toolkit folder this window can see (${root}).`);
  process.exit(0);
}
const args = rest.map((a) => (a === "ROOT" ? root : a));
const r = spawnSync(process.execPath, [script, ...args], { stdio: "inherit", env: process.env });
if (r.error) console.log(`KI_STEP_FAILED: ${name} could not start (${r.error.message}), ran from ${root}.`);
else if (r.status !== 0) console.log(`KI_STEP_FAILED: ${name} exited ${r.status ?? "on a signal"}, ran from ${root}.`);
process.exit(0);
