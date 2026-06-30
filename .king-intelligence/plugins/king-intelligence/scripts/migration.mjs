#!/usr/bin/env node
// migration.mjs — the ledger + status engine for one-time client repo migrations.
//
// The plugin ships a migrations/ folder of versioned, plain-language briefs. Each describes a
// one-time upgrade to a client's repo (new conventions their existing files predate). A ledger
// in the client repo (.claude/.ki-migrations.json) records which have run. The migration itself
// is applied by the client's own Claude (per the brief, in their voice/structure); this script
// does the deterministic bookkeeping so a crash or a re-run is always safe:
//   - status: list shipped migrations + the client's ledger state + the outstanding ones + briefs
//   - begin <id>: mark a migration "in-progress" in the ledger BEFORE any edits (atomic)
//   - done  <id>: mark it "done" AFTER the receipt (atomic)
//   - ensure-file <dest> <template>: copy template -> dest only if dest is absent (idempotent)
//
// The SessionStart auto-update hook NEVER calls begin/done — migrations run only from
// /king-intelligence:update, after the one plain-English heads-up.
//
// Usage:
//   node migration.mjs status <pluginRoot> <projectDir>
//   node migration.mjs begin  <projectDir> <id>
//   node migration.mjs done   <projectDir> <id>
//   node migration.mjs ensure-file <destPath> <templatePath>

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [cmd, ...rest] = process.argv.slice(2);

// run another plugin script by ABSOLUTE path (so nothing depends on ${CLAUDE_PLUGIN_ROOT}
// resolving in a model's shell call — the migration always passes a real resolved pluginRoot)
function runNode(scriptAbsPath, args) {
  return execFileSync("node", [scriptAbsPath, ...args], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

const ledgerPath = (projectDir) => path.join(projectDir, ".claude", ".ki-migrations.json");

function readLedger(projectDir) {
  try { return JSON.parse(fs.readFileSync(ledgerPath(projectDir), "utf8")); } catch { return {}; }
}
function writeLedger(projectDir, obj) {
  const p = ledgerPath(projectDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp-" + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n");
  try { fs.renameSync(tmp, p); } catch { if (fs.existsSync(p)) fs.rmSync(p); fs.renameSync(tmp, p); }
}

// read the YAML-ish frontmatter (id, title, since, breaking) from a migration brief
function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const fm = {};
  if (m) for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

// sort migrations by `since` version, then id, so a client jumping several versions runs each in order
function versionKey(fm, fallbackId) {
  const v = String(fm.since || "0.0.0").split(".").map((n) => parseInt(n, 10) || 0);
  return [v[0] || 0, v[1] || 0, v[2] || 0, fallbackId];
}

function listMigrations(pluginRoot) {
  const dir = path.join(pluginRoot, "migrations");
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")); } catch { return []; }
  const out = files.map((f) => {
    const text = fs.readFileSync(path.join(dir, f), "utf8").replace(/\r\n?/g, "\n"); // CRLF-safe frontmatter parse
    const fm = frontmatter(text);
    const id = fm.id || f.replace(/\.md$/, "");
    return { id, title: fm.title || id, since: fm.since || "0.0.0", breaking: /^true$/i.test(fm.breaking || ""), file: f, text };
  });
  out.sort((a, b) => {
    const ka = versionKey(a, a.id), kb = versionKey(b, b.id);
    for (let i = 0; i < ka.length; i++) { if (ka[i] < kb[i]) return -1; if (ka[i] > kb[i]) return 1; }
    return 0;
  });
  return out;
}

function status(pluginRoot, projectDir, pluginData) {
  const migs = listMigrations(pluginRoot);
  const ledger = readLedger(projectDir);
  // print the resolved absolute paths so the model uses REAL paths in every command below
  // (a skill's shell call does NOT expand ${CLAUDE_PLUGIN_ROOT}; these come pre-expanded from update.md's ! block)
  console.log("PLUGIN_ROOT=" + path.resolve(pluginRoot));
  console.log("PROJECT_DIR=" + path.resolve(projectDir));
  if (pluginData) console.log("PLUGIN_DATA=" + path.resolve(pluginData));
  console.log("LEDGER_PATH=" + ledgerPath(projectDir));
  console.log("LEDGER=" + JSON.stringify(ledger));
  const outstanding = migs.filter((m) => ledger[m.id] !== "done");
  console.log("--- MIGRATIONS (state\\tid\\tbreaking\\ttitle) ---");
  for (const m of migs) console.log(`${ledger[m.id] || "absent"}\t${m.id}\tbreaking=${m.breaking}\t${m.title}`);
  console.log("--- OUTSTANDING IDS (not done; apply in this order) ---");
  console.log(JSON.stringify(outstanding.map((m) => m.id)));
  for (const m of outstanding) {
    console.log("### BRIEF " + m.id + " (breaking=" + m.breaking + ", state=" + (ledger[m.id] || "absent") + ")");
    console.log(m.text);
    console.log("### END BRIEF " + m.id);
  }
}

// Run the DETERMINISTIC backfill for a migration in one shot (everything that isn't a judgment call):
// mark in-progress, merge config keys, copy the repo-maintenance scripts INTO the client repo (so a
// skill can later run them with a plain repo-relative path), scaffold folder notes + the map, and
// create the gotcha scratchpad. Leaves the ledger "in-progress"; the model finishes the judgment
// steps (real purpose lines, folding the two rules into CLAUDE.md, recording adopted) then calls `done`.
function apply(pluginRoot, projectDir, id) {
  pluginRoot = path.resolve(pluginRoot);
  projectDir = path.resolve(projectDir);
  const steps = [];

  // 0. in-progress BEFORE any edits (crash-safe)
  { const l = readLedger(projectDir); l[id] = "in-progress"; writeLedger(projectDir, l); }

  // 1. config keys (additive; never overwrites a set value)
  const manifest = path.join(pluginRoot, "defaults", "config-defaults.json");
  const clientCfg = path.join(projectDir, "references", "king-intelligence-config.md");
  let cfgRes = {};
  try { cfgRes = JSON.parse(runNode(path.join(pluginRoot, "scripts", "config-merge.mjs"), ["--apply", manifest, clientCfg])); } catch (e) { cfgRes = { error: String(e.message || e) }; }
  steps.push({ step: "config-merge", added: (cfgRes.added || []).length, error: cfgRes.error });

  // 2. copy the repo-maintenance scripts into the client repo (.claude/scripts/) so /end-session can
  //    run them with a plain repo-relative path (a skill's shell call can't resolve the plugin folder)
  const destScripts = path.join(projectDir, ".claude", "scripts");
  fs.mkdirSync(destScripts, { recursive: true });
  const copied = [];
  for (const name of ["org-check.mjs", "memory-conveyor.mjs"]) {
    const src = path.join(pluginRoot, "scripts", name);
    if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(destScripts, name)); copied.push(name); }
  }
  steps.push({ step: "copy-scripts", copied });

  // 3. folder coverage + the map (org-check reads layoutDoc/containers from the config we just merged)
  let orgOut = "";
  try { orgOut = runNode(path.join(pluginRoot, "scripts", "org-check.mjs"), ["--fix", "--root", projectDir]); }
  catch (e) { orgOut = "ERROR: " + (e.message || e); }
  steps.push({ step: "org-check-fix", output: orgOut.trim().split("\n") });

  // 4. the gotcha scratchpad (only if absent)
  const scratch = path.join(projectDir, ".claude", "session-scratch.md");
  const tmpl = path.join(pluginRoot, "defaults", "session-scratch.md");
  let scratchCreated = false;
  if (!fs.existsSync(scratch) && fs.existsSync(tmpl)) { fs.mkdirSync(path.dirname(scratch), { recursive: true }); fs.copyFileSync(tmpl, scratch); scratchCreated = true; }
  steps.push({ step: "scratchpad", created: scratchCreated });

  console.log(JSON.stringify({ ok: true, id, ledger: "in-progress", steps }, null, 2));
}

try {
  if (cmd === "status") {
    const [pluginRoot, projectDir, pluginData] = rest;
    if (!pluginRoot || !projectDir) throw new Error("status needs <pluginRoot> <projectDir> [pluginData]");
    status(pluginRoot, projectDir, pluginData);
  } else if (cmd === "begin" || cmd === "done") {
    const [projectDir, id] = rest;
    if (!projectDir || !id) throw new Error(cmd + " needs <projectDir> <id>");
    const ledger = readLedger(projectDir);
    ledger[id] = cmd === "begin" ? "in-progress" : "done";
    writeLedger(projectDir, ledger);
    console.log(JSON.stringify({ ok: true, id, state: ledger[id] }));
  } else if (cmd === "apply") {
    const [pluginRoot, projectDir, id] = rest;
    if (!pluginRoot || !projectDir || !id) throw new Error("apply needs <pluginRoot> <projectDir> <id>");
    apply(pluginRoot, projectDir, id);
  } else if (cmd === "ensure-file") {
    const [dest, template] = rest;
    if (!dest || !template) throw new Error("ensure-file needs <destPath> <templatePath>");
    if (!fs.existsSync(template)) throw new Error("template not found: " + template);
    if (fs.existsSync(dest)) {
      console.log(JSON.stringify({ created: false, dest, reason: "already exists" }));
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(template, dest);
      console.log(JSON.stringify({ created: true, dest }));
    }
  } else {
    console.error("usage: migration.mjs status <pluginRoot> <projectDir> | apply <pluginRoot> <projectDir> <id> | begin <projectDir> <id> | done <projectDir> <id> | ensure-file <dest> <template>");
    process.exit(2);
  }
} catch (e) {
  console.error("ERROR: " + (e.message || e));
  process.exit(1);
}
