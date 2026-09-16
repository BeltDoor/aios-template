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
//   node ki-run.mjs <script.mjs> [args...]
//   node ki-run.mjs paths
//
// Two literal arguments are replaced before the script runs:
//   ROOT        -> the toolkit folder that was chosen
//   DATA        -> this plugin's own data folder
// and the prefixes ROOT/ and DATA/ are joined onto those folders, so DATA/config.json becomes the
// real path to the member's config file.
//
// THE DATA SENTINEL (added 9/16/26). ${CLAUDE_PLUGIN_DATA} is only correct inside a hook. In a
// plain command the model runs it held ANOTHER plugin's folder on this machine, and three shipped
// lines WROTE into it: a write that lands in the wrong directory and says nothing is worse than a
// crash, because nobody ever finds out. So the folder is resolved on disk instead, by the copy of
// this rule in local-scripts.mjs, and the `paths` verb prints which folder was picked.
//
// THE ROOT CHOICE IS GATED ON THE SCRIPT ITSELF. It used to ask "which folder has the highest
// version and carries memory-conveyor.mjs", then check for the script afterwards. A folder can
// carry the proxy file and not the script, and the answer was then the wrong folder. Now the only
// question asked is "which is the highest version that actually has the file I am about to run".
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ownRoot = path.dirname(here);
const [name, ...rest] = process.argv.slice(2);
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

/** The one fallback if the sibling module cannot be loaded: trust a well-named variable, else the
 *  canonical folder name. Never creates anything. The real rule lives in local-scripts.mjs. */
const inlineData = () => {
  const env = process.env.CLAUDE_PLUGIN_DATA;
  if (env && path.basename(env).startsWith("king-intelligence-")) return { dir: env, via: "env" };
  const cfg = process.env.CLAUDE_CONFIG_DIR || path.join(process.env.HOME || process.env.USERPROFILE || "", ".claude");
  return { dir: path.join(cfg, "plugins", "data", "king-intelligence-king-intelligence"), via: "default" };
};

let root = ownRoot;
let data = inlineData();
try {
  const mod = await import("./local-scripts.mjs");
  data = mod.resolveDataDir();
  // the folder must carry the very thing this run needs: the named script, or a scripts folder
  // when all the caller wants is the path to one.
  const needs = name && name !== "paths" ? path.join("scripts", name) : "scripts";
  let best = null, bestV = null;
  for (const dir of mod.candidateRoots(projectDir)) {
    const v = mod.readVersion(dir);
    if (!v) continue;
    if (!existsSync(path.join(dir, needs))) continue;
    if (bestV === null || mod.semverGt(v, bestV)) { best = dir; bestV = v; }
  }
  if (best) root = best;

  // KEEP THE SECOND RUNG ALIVE, WITHOUT NEEDING THE HOOK. Every setup line and every hook command
  // looks in three places: this repo's copy, the plugin's own data folder, then the toolkit folder
  // the window opened on. The data folder is the only one of the three that is stable across
  // versions and never swept away, so it is the rung that matters most, and until 9/16/26 NOTHING
  // on a member's computer ever put a copy there: the function that does it shipped with no
  // caller, so the middle rung could never fire on any machine.
  //
  // It is done HERE, and not only at session start, on purpose. The computers that fall behind
  // are exactly the ones whose session-start hook never runs, and this runner is reached by a
  // command the member typed, which needs no hook at all. Running from the data copy itself is
  // skipped, so the file being executed is never rewritten underneath it. One stat per file, it
  // never throws, and it copies nothing when the copies are already current.
  try {
    if (data.via !== "default" && !here.startsWith(data.dir)) mod.refreshDataScripts(root, data.dir);
  } catch { /* parking a spare copy is a courtesy, never a reason to fail the command */ }
} catch { /* the finder is best-effort; this folder still works */ }

if (name === "paths") {
  console.log(`SCRIPTS_DIR=${path.join(root, "scripts")}`);
  console.log(`DATA_DIR=${data.dir}`);
  console.log(`DATA_VIA=${data.via}`);
  process.exit(0);
}

const script = name ? path.join(root, "scripts", name) : "";
if (!name || !existsSync(script)) {
  console.log(`KI_STEP_FAILED: ${name || "(no script named)"} is not in the toolkit folder this window can see (${root}).`);
  process.exit(0);
}
const swap = (a) => {
  if (a === "ROOT") return root;
  if (a === "DATA") return data.dir;
  if (a.startsWith("ROOT/")) return path.join(root, a.slice(5));
  if (a.startsWith("DATA/")) return path.join(data.dir, a.slice(5));
  return a;
};
const args = rest.map(swap);
const r = spawnSync(process.execPath, [script, ...args], { stdio: "inherit", env: process.env });
if (r.error) console.log(`KI_STEP_FAILED: ${name} could not start (${r.error.message}), ran from ${root}.`);
else if (r.status !== 0) console.log(`KI_STEP_FAILED: ${name} exited ${r.status ?? "on a signal"}, ran from ${root}.`);
process.exit(0);
