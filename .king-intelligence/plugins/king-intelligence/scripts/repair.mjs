#!/usr/bin/env node
// repair.mjs - the ONE deterministic repair of a member's King Intelligence toolkit connection.
// Created 09/17/26 - 18:50 EDT.
//
// WHY THIS FILE EXISTS. Until today the "bring me current" path was a 300-line prompt an LLM
// interpreted, and every machine failed a different way: one paste read a clean catalog refresh
// as proof of an update and called a copy fourteen releases old healthy; one hook could not
// find the `claude` program; one email client dropped half the prompt. Every route passed
// through a judgment call. This script has none. It runs the same eight steps in the same
// order on every machine, decides by reading FILES (never by parsing command output), always
// exits 0, and prints one receipt a person can read.
//
// WHERE IT LIVES AND WHY. In the marketplace catalog clone
// (<config>/plugins/marketplaces/king-intelligence/plugins/king-intelligence/scripts/), which
// exists on any machine that has ever run its personal line, and is refreshed by
// `claude plugin marketplace update king-intelligence`, which the paste runs first. So a
// machine stuck on a toolkit from August still runs THIS version of the repair.
//
// IT NEVER SEES THE MEMBER'S KEY. The personal marketplace line is a separate command in the
// paste; this script only asks Claude Code to refresh a marketplace that already exists.
//
// EVERY STEP IS ONE RECEIPT LINE. A failure is a named line, never a stack trace, and the
// steps that need no network still run after a network failure (the settings flag, the
// recorded address, the report), so a machine that cannot reach the library today is still
// left better than it was found.
//
//   node repair.mjs            run it (the paste and /health-check do this through the bootstrap line)
//   node repair.mjs --json     the same, plus one JSON line at the end for tests
//
// Always exits 0. First stdout line: KI_REPAIR=<verdict>, one of
//   current        installed == newest, nothing to install
//   updated        an older copy was replaced by the newest
//   installed      nothing was installed before, the newest is now
//   pending        the catalog is newer but the install did not land (reason on the receipt)
//   failed         the library could not be reached (reason on the receipt)
//   not-connected  this computer has no King Intelligence library at all
//   github         the older GitHub-key connection, which this script cannot move by itself

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MARKET = "king-intelligence";
const STARTER = "king-intelligence-starter";
const PLUGIN_ID = "king-intelligence@king-intelligence";
const JSON_OUT = process.argv.includes("--json");

const cap = (name, dflt) => {
  const v = parseInt(process.env[`KI_REPAIR_${name}_MS`] || "", 10);
  return Number.isFinite(v) && v > 0 ? v : dflt;
};
const CAP_REFRESH = cap("REFRESH", 60000);
const CAP_INSTALL = cap("INSTALL", 180000);
const CAP_KILL = cap("KILL", 30000);
const CAP_SEND = cap("SEND", 20000);

// ---------------------------------------------------------------------------------------------
// helpers that never throw
// ---------------------------------------------------------------------------------------------
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const exists = (p) => { try { return !!p && fs.existsSync(p); } catch { return false; } };
const semverGt = (a, b) => {
  const pa = String(a || "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
};
const isVersion = (v) => typeof v === "string" && /^\d+\.\d+\.\d+/.test(v);
const localMask = (s) => {
  try { return String(s == null ? "" : s).replace(/https?:\/\/[^@\s/]+@/gi, "https://TOKEN@").replace(/Bearer\s+\S+/gi, "Bearer TOKEN"); }
  catch { return ""; }
};
const writeAtomic = (file, obj, mode) => {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const t = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(t, JSON.stringify(obj, null, 2) + "\n", mode ? { mode } : undefined);
    fs.renameSync(t, file);
    return true;
  } catch { return false; }
};

async function main() {
  const receipt = [];           // plain lines, in order
  const line = (label, text) => receipt.push(`${label}: ${text}`);
  const out = { verdict: "failed", installed: null, catalog: null, loaded: null, before: null, calls: [] };

  // ---- 1. where Claude Code keeps its things, and the helpers this file leans on ------------
  let cli = null, nat = null, ls = null;
  try { ls = await import("./local-scripts.mjs"); } catch { /* own two lines below */ }
  try { cli = await import("./claude-cli.mjs"); } catch { /* the CLI cannot be run; every step says so */ }
  try { nat = await import("./native-autoupdate.mjs"); } catch { /* the flag step says so */ }
  const cfg = (() => {
    try { if (ls && ls.configDir) return ls.configDir(); } catch { /* fall through */ }
    return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  })();
  const mask = (s) => { try { if (cli && cli.maskSecrets) return cli.maskSecrets(s); } catch {} return localMask(s); };
  const plugins = path.join(cfg, "plugins");
  const kiDir = path.join(cfg, "king-intelligence");
  const errDir = process.env.KI_TIME_SAVED_DIR || path.join(os.homedir(), ".claude", "king-intelligence", "time-saved");
  const errPath = path.join(errDir, "update-error.json");

  const run = (args, ms) => {
    out.calls.push(args.join(" "));
    if (!cli || !cli.runClaude) return { ok: false, status: null, signal: null, code: "KI_NO_RUNNER", tail: "the command-line helper could not be loaded", how: null };
    try { return cli.runClaude(args, ms); }
    catch (e) { return { ok: false, status: null, signal: null, code: String((e && e.code) || (e && e.message) || "throw"), tail: "", how: null }; }
  };
  const nativeFlag = () => {
    const s = readJson(path.join(cfg, "settings.json"));
    const k = s && s.extraKnownMarketplaces ? "extraKnownMarketplaces" : s && s.knownMarketplaces ? "knownMarketplaces" : null;
    const e = k && s[k] ? s[k][MARKET] : null;
    if (!e) return null;
    return e.autoUpdate === true ? true : e.autoUpdate === false ? false : null;
  };
  const noteFailure = (stage, r) => {
    const prev = (() => { const j = readJson(errPath); return j && Array.isArray(j.recent) ? j.recent : []; })();
    const at = new Date().toISOString();
    const exit = r && r.status !== undefined ? r.status : null;
    writeAtomic(errPath, {
      stage, at,
      detail: mask((r && (r.tail || r.code)) || "").slice(0, 200),
      exit, signal: (r && r.signal) || null,
      bin: "repair", how: (r && r.how) || null,
      native: nativeFlag(),
      recent: [{ stage, at, exit }, ...prev].slice(0, 3),
    });
  };
  const clearFailure = () => { try { if (exists(errPath)) fs.rmSync(errPath, { force: true }); } catch {} };
  const reason = (r) => {
    if (!r) return "no answer";
    if (r.code === "KI_NO_RUNNER") return r.tail;
    if (r.code === "ENOENT" || r.status === 127) return "the claude program was not found from here";
    if (r.signal) return `it ran out of time (${r.signal})`;
    const t = mask(r.tail || "").split(/\r?\n/).filter(Boolean).slice(-2).join(" | ").slice(0, 160);
    return t ? `${t}${r.status != null ? ` (exit ${r.status})` : ""}` : `exit ${r.status == null ? r.code || "?" : r.status}`;
  };

  // ---- 2. which library is this computer connected to ----------------------------------------
  const readEntry = () => {
    const reg = readJson(path.join(plugins, "known_marketplaces.json"));
    const set = readJson(path.join(cfg, "settings.json"));
    const pick = (o, name) => {
      if (!o || typeof o !== "object") return null;
      const direct = o[name];
      if (direct && typeof direct === "object") return direct;
      for (const k of ["extraKnownMarketplaces", "knownMarketplaces", "marketplaces"]) {
        const c = o[k];
        if (c && typeof c === "object" && c[name] && typeof c[name] === "object") return c[name];
      }
      return null;
    };
    const entry = pick(reg, MARKET) || pick(set, MARKET);
    // The starter is "present" when Claude Code's own registry or its folders say so. The settings
    // entry is deliberately not counted: Claude Code may keep it after a remove, and a member may
    // have typed it, and neither means a starter toolkit is installed.
    const starter = !!(pick(reg, STARTER) || exists(path.join(plugins, "marketplaces", STARTER)) || exists(path.join(plugins, "cache", STARTER)));
    const url = entry && entry.source && typeof entry.source === "object" ? String(entry.source.url || "") : "";
    const portalRe = nat && nat.PORTAL_URL_RE ? nat.PORTAL_URL_RE : /^https:\/\/[^@/]+@members\.king-intelligence\.com\/marketplace\.git$/;
    const rail = !entry ? "none" : portalRe.test(url) ? "portal" : /github\.com/i.test(url) ? "github" : "other";
    return { entry, rail, starter };
  };
  const first = readEntry();
  out.rail = first.rail;

  if (first.rail === "none" || first.rail === "other") {
    out.verdict = "not-connected";
    line("Library", "this computer is not connected to the King Intelligence library yet");
    line("What to do", "paste your personal line from members.king-intelligence.com/system, then run this again");
    return finish();
  }
  if (first.rail === "github") {
    out.verdict = "github";
    line("Library", "this computer is on the older GitHub connection, which this repair cannot move by itself");
    line("What to do", "run: claude plugin marketplace remove king-intelligence, then paste your personal line from members.king-intelligence.com/system, then run this again");
    return finish();
  }

  // ---- 3. refresh the catalog ---------------------------------------------------------------
  const versions = () => {
    const catalog = (() => {
      const j = readJson(path.join(plugins, "marketplaces", MARKET, "plugins", MARKET, ".claude-plugin", "plugin.json"));
      return j && isVersion(j.version) ? j.version : null;
    })();
    const installed = (() => {
      const j = readJson(path.join(plugins, "installed_plugins.json"));
      const m = j && j.plugins && typeof j.plugins === "object" ? j.plugins : j;
      let e = m && typeof m === "object" ? m[PLUGIN_ID] : null;
      if (Array.isArray(e)) e = e[0];
      if (!e || typeof e !== "object") return null;
      if (e.installPath && !exists(e.installPath)) return null;
      return isVersion(e.version) ? e.version : null;
    })();
    const l = readJson(path.join(kiDir, "loaded.json"));
    const loaded = l && isVersion(l.version) ? l.version : null;
    return { catalog, installed, loaded };
  };
  const v0 = versions();
  out.before = v0.installed;

  let refreshed = false;
  const rr = run(["plugin", "marketplace", "update", MARKET], CAP_REFRESH);
  if (rr.ok) { refreshed = true; line("Library", "reached, catalog refreshed"); }
  else {
    noteFailure("marketplace-refresh", rr);
    const why = reason(rr);
    const keyish = /401|403|unauthorized|authentication|could not read from/i.test(String(rr.tail || "")) || rr.status === 128;
    line("Library", `could not be reached: ${why}${keyish ? ". Your personal line may need a fresh copy from members.king-intelligence.com/system" : ""}`);
  }

  // ---- 4 + 5. install or update, decided by files ------------------------------------------
  let v = versions();
  let applied = null;   // "installed" | "updated" | null
  let applyFailed = null;
  if (refreshed && v.catalog) {
    if (!v.installed) {
      const ir = run(["plugin", "install", PLUGIN_ID], CAP_INSTALL);
      v = versions();
      if (ir.ok && v.installed === v.catalog) applied = "installed";
      else applyFailed = ir;
    } else if (semverGt(v.catalog, v.installed)) {
      const ur = run(["plugin", "update", PLUGIN_ID], CAP_INSTALL);
      v = versions();
      if (ur.ok && v.installed === v.catalog) applied = "updated";
      else if (v.installed === v.catalog) applied = "updated"; // the CLI grumbled but the file says it landed
      else applyFailed = ur;
    }
  }
  out.installed = v.installed; out.catalog = v.catalog; out.loaded = v.loaded;

  if (applyFailed) {
    noteFailure("apply-update", applyFailed);
    line("Toolkit", `on ${v.installed || "nothing"}, the newest is ${v.catalog}, and the install did not land: ${reason(applyFailed)}`);
  } else if (applied) {
    clearFailure();
    line("Toolkit", `${v0.installed ? `${v0.installed} to ${v.installed}` : `${v.installed}, installed just now`}, which is the newest`);
  } else if (refreshed && v.installed && v.catalog && v.installed === v.catalog) {
    clearFailure();
    line("Toolkit", `${v.installed}, which is the newest`);
  } else if (v.installed) {
    line("Toolkit", `${v.installed} on this computer${v.catalog ? `, the catalog copy here says ${v.catalog}` : ""} (could not check for newer today)`);
  } else {
    line("Toolkit", "not installed on this computer, and it could not be installed today");
  }
  if (v.loaded && v.installed && semverGt(v.installed, v.loaded)) line("Running now", `${v.loaded}, the newest loads when Claude Code reopens`);
  else if (v.loaded) line("Running now", v.loaded);
  else line("Running now", "could not tell (it shows after Claude Code reopens once)");

  // ---- 6. old copies, only once the real one is confirmed installed --------------------------
  if (first.starter && v.installed && v.installed === v.catalog && (applied || refreshed)) {
    run(["plugin", "uninstall", `king-intelligence@${STARTER}`], CAP_KILL);
    run(["plugin", "marketplace", "remove", STARTER], CAP_KILL);
    for (const d of [path.join(plugins, "cache", STARTER), path.join(plugins, "marketplaces", STARTER)]) {
      try { if (exists(d)) fs.rmSync(d, { recursive: true, force: true }); } catch {}
    }
    const gone = !readEntry().starter;
    line("Old copies", gone ? "the free starter copy was removed" : "the free starter copy could not be fully removed (harmless, it is never used)");
  } else if (first.starter) {
    line("Old copies", "a free starter copy is still here; it is removed once the real toolkit is confirmed current");
  }

  // ---- 7. Claude Code's own updater ----------------------------------------------------------
  try {
    if (nat && nat.ensureNativeAutoUpdate) {
      const r = nat.ensureNativeAutoUpdate({ configDir: cfg });
      const f = nativeFlag();
      line("Automatic updates", r.changed ? "switched on, Claude Code now updates this toolkit by itself" :
        f === true ? "already on" :
        f === false ? "left off, as you set it" :
        r.reason || "could not be switched on");
    } else line("Automatic updates", "could not be checked (helper missing)");
  } catch (e) { line("Automatic updates", `could not be switched on: ${String((e && e.message) || e).slice(0, 80)}`); }

  // ---- 8. where Claude Code lives, written down for the background updater ------------------
  try {
    if (cli && cli.discoverClaudeBin) {
      const hit = cli.discoverClaudeBin();
      if (!hit) line("Claude Code address", "could not be found from here");
      else if (hit.how === "remembered") line("Claude Code address", "already written down");
      else if (cli.rememberClaudeBin(hit.path, hit.how)) line("Claude Code address", "written down for the background updater");
      else line("Claude Code address", "found, but the note could not be written");
    } else line("Claude Code address", "could not be checked (helper missing)");
  } catch { line("Claude Code address", "could not be checked"); }

  // ---- 9. the folder's own script copies -----------------------------------------------------
  try {
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    if (ls && ls.isBrain && ls.refreshLocalScripts && ls.isBrain(projectDir)) {
      const r = ls.refreshLocalScripts(projectDir);
      if (r && r.refreshed) line("Scripts in your folder", `now from ${r.version}`);
    }
  } catch {}

  // ---- verdict ---------------------------------------------------------------------------------
  out.verdict = applyFailed ? "pending" : applied || (refreshed && v.installed === v.catalog ? "current" : "failed");

  // ---- 10. tell Jacob's side now, not next session ----------------------------------------------
  writeAtomic(path.join(kiDir, "repair.json"), { at: new Date().toISOString(), verdict: out.verdict, installed: v.installed, catalog: v.catalog, loaded: v.loaded }, 0o600);
  try {
    const engine = path.join(HERE, "measure-sessions.mjs");
    if (exists(engine)) {
      const r = spawnSync(process.execPath, [engine, "send", "--json"], { encoding: "utf8", timeout: CAP_SEND, windowsHide: true, stdio: ["ignore", "pipe", "ignore"], env: process.env });
      let j = null; try { j = JSON.parse(String(r.stdout || "").trim().split("\n").pop()); } catch {}
      const s = j && j.send;
      line("Report to Jacob", s && s.sent ? "sent" : `not sent${s && s.reason ? ` (${mask(String(s.reason)).slice(0, 80)})` : ""}`);
    } else line("Report to Jacob", "not sent (engine missing)");
  } catch { line("Report to Jacob", "not sent"); }

  if (applied || (v.loaded && v.installed && semverGt(v.installed, v.loaded))) line("One thing to do", "close Claude Code and open it again, so the newest tools load");
  return finish();

  function finish() {
    console.log(`KI_REPAIR=${out.verdict}`);
    for (const l of receipt) console.log(l);
    if (JSON_OUT) console.log(JSON.stringify({ ...out, receipt }));
  }
}

try { await main(); } catch (e) {
  // never a stack trace at a member
  console.log("KI_REPAIR=failed");
  console.log(`Repair: stopped early: ${localMask(String((e && e.message) || e)).slice(0, 160)}`);
}
process.exitCode = 0;
