#!/usr/bin/env node
// connect-live.mjs - switch a freshly downloaded second brain onto the member's LIVE toolkit.
// Created 09/26/26 - 12:03 EDT. Design: the pilot 1 write-up, 9/25/26.
//
// WHY THIS FILE EXISTS. A keyed member's download carries `.claude/settings.local.json`, which
// is meant to register their personal King Intelligence library the moment they trust the
// folder. On a member's fresh Windows install (9/25/26) it never registered: only the frozen
// starter copy bundled in the folder was installed. Day One then checked `claude plugin list`
// for the NAME "king-intelligence", which the starter also carries, and told him the toolkit
// was "confirmed and ready". It was the frozen copy, and it would never have updated.
//
// WHAT IT DOES, in order, deciding by the program's own JSON and by files, never by guessing:
//   1. Reads the member's key from THIS folder (.claude/settings.local.json, else .mcp.json).
//      No key = a free download: confirm or install the starter, and say plainly it is frozen.
//   2. If Claude Code has no library called "king-intelligence", adds the member's own.
//   3. If the toolkit from that library is not installed, installs it.
//   4. VERIFIES by source, never by name: the installed id must be
//      king-intelligence@king-intelligence, switched on for this folder, loaded with no errors,
//      its files must exist, and the library of that name must be registered with THIS folder's
//      key (compared as hashes, never printed).
//   5. Only after that proof, removes the starter copy for this folder.
//
// ONE CLEAN PATH (round-4 review, 9/26/26). Nothing is ever removed, uninstalled or registered
// again except on the path where a fresh listing for this folder proves step 4. Every other
// outcome adds at most what was missing (a library, an install, a switch-on) and touches nothing
// that was already there. A library registered with a different key is never replaced: that is a
// move-over Jacob does with the member, so the script says so and stops.
//   6. Switches on Claude Code's own updater and writes down where Claude Code lives.
//
// IT NEVER PRINTS THE KEY. The address is read from the file into memory and handed to the
// command line as an argument; every line printed is masked, and the key itself is scrubbed
// from every line a second time before it goes out.
//
// Runs the same on Mac and Windows: every command is an argument array through
// claude-cli.mjs's runClaude (no shell quoting), every path goes through node:path.
//
//   node connect-live.mjs [--project <folder>] [--json]
//
// Always exits 0. First line: KI_CONNECT=<verdict>, one of
//   live            the live toolkit is installed from the member's own library, proven
//   live-failed     the folder has a key, but the live toolkit could not be switched on
//   starter         no key in this folder: the free starter copy is in use (frozen)
//   starter-failed  no key, and the starter copy could not be installed either
//   no-cli          the Claude Code program could not be found from here

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIVE = "king-intelligence";
const STARTER = "king-intelligence-starter";
const LIVE_ID = `${LIVE}@${LIVE}`;
const STARTER_ID = `${LIVE}@${STARTER}`;
const PORTAL_HOST = "members.king-intelligence.com";

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");
const argAfter = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] || null : null; };

const cap = (name, dflt) => {
  const v = parseInt(process.env[`KI_CONNECT_${name}_MS`] || "", 10);
  return Number.isFinite(v) && v > 0 ? v : dflt;
};
const CAP_LIST = cap("LIST", 30000);
const CAP_ADD = cap("ADD", 180000);
const CAP_INSTALL = cap("INSTALL", 180000);
const CAP_REMOVE = cap("REMOVE", 30000);

// Tests only: lets a sandbox point at a local git server instead of the members portal.
// Unset on every member machine, where only https://<key>@members.king-intelligence.com counts.
const TEST_HOST = process.env.KI_CONNECT_TEST_HOST || "";

const readText = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return null; } };
const readJson = (p) => {
  const t = readText(p);
  if (t == null) return null;
  try { return JSON.parse(t.replace(/^﻿/, "")); } catch { return null; }
};
const exists = (p) => { try { return !!p && fs.existsSync(p); } catch { return false; } };

/**
 * The member's personal library address, parsed, or null. Returns the CANONICAL string that is
 * safe to hand to git: rebuilt from its parts, so nothing in the original (a "?", a "#", a second
 * "@", a port, a path trick) can steer git or Claude Code to another host with the key attached.
 *
 * 9/26/26 review: a pattern match accepted https://other.example?x@members.king-intelligence.com/
 * marketplace.git, which git would have sent to other.example, key and all. Parsed now:
 * https only, the exact portal hostname, no port, path exactly /marketplace.git, no query or
 * fragment, a key-shaped user part and no password.
 */
export function parseLiveUrl(url) {
  if (typeof url !== "string") return null;
  const raw = url.trim();
  if (!raw || /\s/.test(raw)) return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  const testHost = TEST_HOST ? TEST_HOST.toLowerCase() : "";
  const isTest = !!testHost && u.host.toLowerCase() === testHost && (u.protocol === "http:" || u.protocol === "https:");
  if (!isTest) {
    if (u.protocol !== "https:") return null;
    if (u.hostname.toLowerCase() !== PORTAL_HOST || u.port !== "") return null;
  }
  if (u.pathname !== "/marketplace.git" || u.search !== "" || u.hash !== "") return null;
  if (u.password !== "" || !/^[A-Za-z0-9._~-]{6,}$/.test(u.username)) return null;
  // the parser must agree with a plain reading of the string: exactly one "@", before the host
  if ((raw.match(/@/g) || []).length !== 1 || /[?#]/.test(raw)) return null;
  return { token: u.username, url: `${isTest ? u.protocol : "https:"}//${u.username}@${isTest ? u.host : PORTAL_HOST}/marketplace.git` };
}

/** Is this the member's personal library address? */
export function isLiveUrl(url) {
  return parseLiveUrl(url) !== null;
}

/**
 * The member's library address from their folder, or null. Never printed.
 * settings.local.json first (it IS the address); .mcp.json second (same key, older downloads
 * and the /system "Connect this computer" message write it too).
 */
export function liveUrlFromFolder(projectDir, p = path, read = readText) {
  const sl = read(p.join(projectDir, ".claude", "settings.local.json"));
  if (sl != null) {
    let j = null;
    try { j = JSON.parse(String(sl).replace(/^﻿/, "")); } catch { j = null; }
    const tables = j && typeof j === "object" ? [j.extraKnownMarketplaces, j.knownMarketplaces] : [];
    for (const t of tables) {
      if (!t || typeof t !== "object") continue;
      const e = t[LIVE];
      const url = e && e.source && typeof e.source === "object" ? e.source.url : null;
      const parsed = parseLiveUrl(url);
      if (parsed) return { url: parsed.url, via: "settings.local.json" };
    }
  }
  const mcp = read(p.join(projectDir, ".mcp.json"));
  if (mcp != null) {
    let j = null;
    try { j = JSON.parse(String(mcp).replace(/^﻿/, "")); } catch { j = null; }
    const s = j && j.mcpServers && j.mcpServers[LIVE];
    const auth = s && s.headers && typeof s.headers === "object"
      ? Object.entries(s.headers).find(([k]) => k.toLowerCase() === "authorization")
      : null;
    let host = null;
    try { host = s && typeof s.url === "string" ? new URL(s.url).hostname.toLowerCase() : null; } catch { host = null; }
    const m = auth && typeof auth[1] === "string" ? auth[1].trim().match(/^Bearer\s+([A-Za-z0-9._~-]+)$/) : null;
    if (m && host === PORTAL_HOST) return { url: `https://${m[1]}@${PORTAL_HOST}/marketplace.git`, via: ".mcp.json" };
  }
  return null;
}

/** The starter bundle that ships inside the member's folder. */
export function starterBundle(projectDir, p = path) {
  return p.join(projectDir, ".king-intelligence");
}

async function main() {
  const receipt = [];
  const out = { verdict: "live-failed", via: null, calls: [], changed: false, version: null };
  let secret = null; // the key, only ever used to scrub output
  const scrub = (s) => {
    let t = String(s == null ? "" : s);
    t = t.replace(/https?:\/\/[^@\s/]+@/gi, "https://TOKEN@").replace(/Bearer\s+\S+/gi, "Bearer TOKEN");
    if (secret && secret.length >= 6) t = t.split(secret).join("TOKEN");
    return t;
  };
  const line = (label, text) => receipt.push(`${label}: ${text}`);

  let cli = null, nat = null, ls = null;
  try { cli = await import("./claude-cli.mjs"); } catch { /* no runner; said below */ }
  try { nat = await import("./native-autoupdate.mjs"); } catch { /* optional */ }
  try { ls = await import("./local-scripts.mjs"); } catch { /* optional */ }
  const cfg = (() => {
    try { if (ls && ls.configDir) return ls.configDir(); } catch { /* fall through */ }
    return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  })();
  const plugins = path.join(cfg, "plugins");

  // THE TARGET FOLDER, resolved before anything runs (9/26/26 review): every listing and every
  // change below runs IN this folder, because Claude Code answers "installed and switched on"
  // for the folder it is started in. Asked from the caller's folder, it would verify the wrong
  // project and could remove the target's starter on another project's say-so.
  const projectDir = path.resolve(argAfter("--project") || process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const run = (args, ms) => {
    out.calls.push(scrub(args.join(" ")));
    if (!cli || !cli.runClaude) return { ok: false, status: null, code: "KI_NO_RUNNER", tail: "the command-line helper could not be loaded" };
    try { return cli.runClaude(args, ms, { cwd: projectDir }); }
    catch (e) { return { ok: false, status: null, code: String((e && e.code) || "throw"), tail: "" }; }
  };
  const why = (r) => {
    if (!r) return "no answer";
    if (r.code === "KI_NO_RUNNER") return r.tail;
    if (r.code === "ENOENT" || r.status === 127) return "the Claude Code program was not found from here";
    if (r.signal) return "it ran out of time";
    const t = scrub(r.tail || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(-2).join(" | ").slice(0, 180);
    return t || `it stopped with code ${r.status == null ? r.code || "unknown" : r.status}`;
  };

  // ---- what Claude Code says is here, from its own JSON, with the files as the fallback ----
  const cp = await import("node:child_process");
  const cliJson = (args) => {
    // runClaude keeps only a masked tail, so the JSON listings are read with a direct spawn
    // through the same binary resolution and the same spawn plan.
    try {
      if (!cli || !cli.resolveClaudeBin || !cli.spawnPlan) return null;
      const bin = cli.resolveClaudeBin();
      out.calls.push(scrub(args.join(" ")));
      // the same shell-free plan runClaude uses, so a path with a space survives on every platform
      const plan = cli.spawnPlan(bin.path, bin.how, args);
      const r = cp.spawnSync(plan.file, plan.args, {
        timeout: CAP_LIST, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
        ...plan.options,
        cwd: projectDir,
        env: { ...process.env, PATH: cli.withBinDir(bin.path) },
        maxBuffer: 8 * 1024 * 1024,
      });
      if (r.error || r.status !== 0) return null;
      const text = String(r.stdout || "");
      const m = text.match(/^\[/m);
      return m ? JSON.parse(text.slice(m.index)) : null;
    } catch { return null; }
  };

  const readMarkets = () => {
    const list = cliJson(["plugin", "marketplace", "list", "--json"]);
    if (Array.isArray(list)) {
      const rows = list.map((m) => ({ name: m && m.name, source: m && m.source, url: m && (m.url || m.repo || null), path: m && m.path }));
      rows.fromCli = true;
      return rows;
    }
    const reg = readJson(path.join(plugins, "known_marketplaces.json")) || {};
    const rows = Object.entries(reg).map(([name, e]) => ({
      name,
      source: e && e.source && e.source.source,
      url: e && e.source && (e.source.url || e.source.repo || null),
      path: e && e.source && e.source.path,
    }));
    rows.fromCli = false;
    return rows;
  };
  const readInstalled = () => {
    const list = cliJson(["plugin", "list", "--json"]);
    if (Array.isArray(list)) {
      // every installation is its own row, with the scope it lives in and, for a project or
      // local install, the project it belongs to (round-3 review: cleanup must know whose it is)
      // errors / errorDetails: Claude Code's own report that the plugin failed to load (a hook, a
      // server, a manifest). Present only when something went wrong (round-4 review, 9/26/26).
      const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
      const rows = list.map((x) => ({ id: x && x.id, version: x && x.version, enabled: x && x.enabled, installPath: x && x.installPath, scope: (x && x.scope) || "user", projectPath: (x && x.projectPath) || null, errors: arr(x && x.errors), errorDetails: arr(x && x.errorDetails) }));
      rows.fromCli = true;
      return rows;
    }
    // The files say what is on disk, never whether it is switched on for this folder, so a row
    // read from them carries enabled: undefined, which verifyLive treats as UNPROVEN.
    const j = readJson(path.join(plugins, "installed_plugins.json"));
    const m = j && j.plugins && typeof j.plugins === "object" ? j.plugins : {};
    const rows = [];
    for (const [id, v] of Object.entries(m)) {
      for (const e of Array.isArray(v) ? v : [v]) {
        if (e && typeof e === "object") rows.push({ id, version: e.version, enabled: undefined, installPath: e.installPath, scope: e.scope || "user", projectPath: e.projectPath || null, errors: [], errorDetails: [] });
      }
    }
    rows.fromCli = false;
    return rows;
  };
  const liveMarket = (markets) => markets.find((m) => m && m.name === LIVE) || null;
  // THE REGISTERED KEY MUST BE THIS FOLDER'S KEY (round-3 review). A library registered with an
  // older or someone else's key has the right shape and the wrong credential. Compared as hashes
  // of the canonical addresses, so neither key is ever printed or logged.
  const digest = (u) => crypto.createHash("sha256").update(String(u)).digest("hex");
  const sameKey = (registeredUrl, wantUrl) => {
    const a = parseLiveUrl(registeredUrl);
    return !!a && digest(a.url) === digest(wantUrl);
  };
  const liveIsOurs = (m, wantUrl) => !!m && isLiveUrl(m.url) && (!wantUrl || sameKey(m.url, wantUrl));
  /** Did Claude Code report that this plugin failed to load? */
  const loadErrors = (row) => !!row && ((row.errors && row.errors.length) || (row.errorDetails && row.errorDetails.length)) > 0;
  const samePath = (a, b) => {
    if (!a || !b) return false;
    const norm = (p) => { let r = p; try { r = fs.realpathSync.native(p); } catch { r = path.resolve(p); } return process.platform === "win32" ? r.toLowerCase() : r; };
    return norm(a) === norm(b);
  };
  const pluginFiles = (row) => !!row && exists(row.installPath) &&
    (() => { const pj = readJson(path.join(row.installPath, ".claude-plugin", "plugin.json")); return !!pj && pj.name === LIVE; })();
  /**
   * Do other folders on this computer still rely on the USER-WIDE starter? (round-5 review, 9/26/26)
   * A folder whose own settings switch the live toolkit off, or switch the starter on, keeps running
   * on the user-wide starter after this folder moves to live. Claude Code lists every folder it
   * knows in <CLAUDE_CONFIG_DIR or home>/.claude.json (its "projects" map). Each one's
   * .claude/settings.json and .claude/settings.local.json is read for ONE field, enabledPlugins;
   * nothing else is looked at, kept, or printed (settings.local.json can hold a key).
   * Returns { complete, needed }: complete=false when the list or any settings file present could
   * not be read, and then nothing user-wide is removed.
   */
  const otherFoldersNeedStarter = () => {
    try {
      const gc = path.join(process.env.CLAUDE_CONFIG_DIR || os.homedir(), ".claude.json");
      const g = readJson(gc);
      if (!g || typeof g !== "object" || !g.projects || typeof g.projects !== "object") return { complete: false, needed: false };
      let needed = false;
      for (const dir of Object.keys(g.projects)) {
        if (samePath(dir, projectDir)) continue;
        for (const f of ["settings.json", "settings.local.json"]) {
          const file = path.join(dir, ".claude", f);
          if (!exists(file)) continue;
          const j = readJson(file);
          if (!j || typeof j !== "object") return { complete: false, needed: false };
          const ep = j.enabledPlugins;
          if (ep && typeof ep === "object" && (ep[LIVE_ID] === false || ep[STARTER_ID] === true)) needed = true;
        }
      }
      return { complete: true, needed };
    } catch { return { complete: false, needed: false }; }
  };
  /**
   * Is the live toolkit switched on USER-WIDE? (round-6 review, 9/26/26) A folder with no settings of
   * its own follows the user settings, so the user-wide starter may only go when the user settings
   * say live is on (enabledPlugins["king-intelligence@king-intelligence"] === true) and no managed
   * settings file switches it off. A missing or unreadable user settings file, a missing key, or a
   * managed file that exists and cannot be read all answer no. Only enabledPlugins is read.
   */
  const managedSettingsPath = () => {
    if (process.env.KI_CONNECT_MANAGED_SETTINGS) return process.env.KI_CONNECT_MANAGED_SETTINGS; // tests only
    if (process.platform === "darwin") return "/Library/Application Support/ClaudeCode/managed-settings.json";
    if (process.platform === "win32") return path.join(process.env.ProgramData || "C:\\ProgramData", "ClaudeCode", "managed-settings.json");
    return "/etc/claude-code/managed-settings.json";
  };
  const liveOnUserWide = () => {
    try {
      const u = readJson(path.join(cfg, "settings.json"));
      if (!u || typeof u !== "object" || !u.enabledPlugins || u.enabledPlugins[LIVE_ID] !== true) return false;
      const mp = managedSettingsPath();
      if (exists(mp)) {
        const m = readJson(mp);
        if (!m || typeof m !== "object") return false;
        if (m.enabledPlugins && m.enabledPlugins[LIVE_ID] === false) return false;
      }
      return true;
    } catch { return false; }
  };
  /** The starter is only "in use here" when Claude Code's own answer for this folder says it is switched on and its files are there. */
  const starterUsable = (st) => st.rows.fromCli === true && !st.starterRows.some(loadErrors) && st.starterRows.some((r) => r.enabled === true && pluginFiles(r));
  /** Proof by source: the id names the live library, its files are there, and that library is the member's own. */
  let wantUrl = null; // set once the folder's key is read
  const verifyLive = () => {
    const markets = readMarkets();
    const rows = readInstalled();
    const liveRows = rows.filter((r) => r && r.id === LIVE_ID);
    const row = liveRows.find((r) => r.enabled === true) || liveRows[0] || null;
    const m = liveMarket(markets);
    const filesThere = !!row && !/king-intelligence-starter/.test(String(row.installPath)) && pluginFiles(row);
    // POSITIVE PROOF ONLY (9/26/26 review). "Switched on" must come from Claude Code's own
    // answer for this folder (enabled === true); a listing that failed, or an answer that does
    // not say, is unproven, and an unproven live toolkit never removes the starter.
    const confirmed = rows.fromCli === true && markets.fromCli === true;
    // any row for the live id (including Claude Code's separate "failed to load" rows) with errors
    const liveErrors = liveRows.some(loadErrors);
    return {
      ok: confirmed && !!row && row.enabled === true && !liveErrors && filesThere && liveIsOurs(m, wantUrl),
      unconfirmed: !confirmed,
      row, market: m, rows, markets, filesThere, liveErrors,
      starterRows: rows.filter((r) => r && r.id === STARTER_ID),
      starterInstalled: rows.some((r) => r && r.id === STARTER_ID),
      starterMarket: markets.some((x) => x && x.name === STARTER),
    };
  };

  // ---- 0. can the program be run at all ----------------------------------------------------
  if (!cli) {
    out.verdict = "no-cli";
    line("Toolkit", "could not be checked: a part of the toolkit this step needs is missing from the folder");
    return finish();
  }
  const ver = run(["--version"], 15000);
  if (!ver.ok) {
    out.verdict = "no-cli";
    line("Toolkit", `could not be checked: ${why(ver)}`);
    return finish();
  }

  // ---- 1. the key in this folder ---------------------------------------------------------------
  const found = liveUrlFromFolder(projectDir);
  if (found) {
    const m = found.url.match(/^https?:\/\/([^@/\s]+)@/);
    secret = m ? m[1] : null;
    out.via = found.via;
    wantUrl = found.url;
  }

  // A keyed member whose download could not carry their key gets a marker file instead of
  // silence (members portal, 9/26/26). With it present, "no key" is a failure to fix, never
  // the normal free starter.
  const missingMarker = path.join(projectDir, ".claude", "ki-connect-missing.json");
  const keyWasMissed = exists(missingMarker);
  const missedLine = () => line("Toolkit", "your download should have carried your personal key and did not. To fix it, open members.king-intelligence.com/system, copy the Connect this computer message, and paste it into this chat");

  // ---- no key: the free starter, said plainly -----------------------------------------------
  if (!found) {
    const state = verifyLive();
    if (state.ok) {
      out.verdict = "live";
      out.version = state.row.version || null;
      line("Toolkit", `the live toolkit from your personal library is installed${out.version ? ` (${out.version})` : ""}`);
      return finish();
    }
    // THE STARTER COUNTS ONLY WHEN IT IS PROVEN USABLE HERE (round-3 review): Claude Code's own
    // answer for this folder says switched on, and its files are on disk. A row alone, a row
    // read from the files, or a command that merely exited 0, is not proof.
    let st = state;
    const bundle = starterBundle(projectDir);
    if (!st.starterInstalled) {
      if (!exists(path.join(bundle, ".claude-plugin", "marketplace.json"))) {
        out.verdict = "starter-failed";
        line("Toolkit", "this folder carries no personal key, and the starter copy that should ship inside it is missing");
        return finish();
      }
      if (!st.starterMarket) {
        const a = run(["plugin", "marketplace", "add", bundle], CAP_ADD);
        if (!a.ok) { out.verdict = "starter-failed"; line("Toolkit", `the starter copy could not be added: ${why(a)}`); return finish(); }
      }
      run(["plugin", "install", STARTER_ID], CAP_INSTALL);
      out.changed = true;
      st = verifyLive();
    }
    if (!starterUsable(st) && st.rows.fromCli === true && st.starterRows.length) {
      // present but switched off here: switch it on; present but its files are gone: install again
      if (st.starterRows.some((r) => pluginFiles(r)) && !st.starterRows.some((r) => r.enabled === true)) {
        run(["plugin", "enable", STARTER_ID], CAP_REMOVE);
      } else if (!st.starterRows.some((r) => pluginFiles(r))) {
        run(["plugin", "install", STARTER_ID], CAP_INSTALL);
      }
      out.changed = true;
      st = verifyLive();
    }
    if (!starterUsable(st)) {
      out.verdict = keyWasMissed ? "live-failed" : "starter-failed";
      if (keyWasMissed) missedLine();
      line("Toolkit", "the starter copy could not be confirmed as installed and switched on for this folder");
      return finish();
    }
    if (keyWasMissed) {
      out.verdict = "live-failed";
      missedLine();
      line("Old copy", "the free starter copy is installed so you have tools today");
      return finish();
    }
    out.verdict = "starter";
    line("Toolkit", `this folder carries no personal key, so the free starter copy ${out.changed ? "was installed" : "is in use"}. It is a frozen copy: it works, and it does not update by itself`);
    return finish();
  }

  // ---- 2. the member's own library --------------------------------------------------------------
  let state = verifyLive();
  const existing = liveMarket(state.markets);
  if (existing && !liveIsOurs(existing)) {
    out.verdict = "live-failed";
    line("Library", "a different library is already registered under the King Intelligence name on this computer, so nothing was changed. Jacob will sort it out with you");
    return finish();
  }
  if (existing && !sameKey(existing.url, found.url)) {
    // Registered with a key that is not this folder's. Never replaced here (round-4 review):
    // replacing it means removing a library, and a removal happens only on the one clean path.
    out.verdict = "live-failed";
    line("Library", "this computer is connected with a different key; ask Jacob for the move-over step");
    if (state.starterInstalled) line("Old copy", "the free starter copy was left in place, so you still have tools today");
    return finish();
  }
  if (!existing) {
    const a = run(["plugin", "marketplace", "add", found.url], CAP_ADD);
    state = verifyLive();
    if (!liveIsOurs(liveMarket(state.markets), found.url)) {
      out.verdict = "live-failed";
      const keyish = /401|403|unauthori[sz]ed|authentication|could not read from/i.test(String(a.tail || ""));
      line("Library", `your personal library could not be connected: ${why(a)}${keyish ? ". Your key may need a fresh copy from members.king-intelligence.com/system" : ""}`);
      if (state.starterInstalled) line("Old copy", "the free starter copy was left in place, so you still have tools today");
      return finish();
    }
    out.changed = true;
    line("Library", "your personal King Intelligence library is now connected");
  } else {
    line("Library", "your personal King Intelligence library was already connected");
  }

  // ---- 3. the toolkit from that library -------------------------------------------------------------
  let installFail = null;
  if (!state.row) {
    const i = run(["plugin", "install", LIVE_ID], CAP_INSTALL);
    if (!i.ok) installFail = i;
    state = verifyLive();
    if (state.row) out.changed = true;
  } else if (state.row.enabled === false && !state.unconfirmed) {
    run(["plugin", "enable", LIVE_ID], CAP_REMOVE);
    state = verifyLive();
    out.changed = true;
  }

  // ---- 4. proof by source -------------------------------------------------------------------------
  if (!state.ok) {
    out.verdict = "live-failed";
    const reason = installFail ? why(installFail)
      : state.unconfirmed ? "Claude Code did not answer when asked what is installed, so it could not be confirmed"
      : !state.row ? "it did not show up as installed from your personal library"
      : !state.filesThere ? "its files are not where Claude Code says they are"
      : state.row.enabled !== true ? "it is installed but not switched on for this folder"
      : state.liveErrors ? "it is switched on, but Claude Code reported errors loading it"
      : "the library it came from could not be confirmed as registered with the key in this folder";
    line("Toolkit", `the live toolkit could not be switched on: ${reason}`);
    if (state.starterInstalled) line("Old copy", "the free starter copy was left in place, so you still have tools today");
    return finish();
  }
  out.version = state.row.version || null;
  out.verdict = "live";
  line("Toolkit", `the live toolkit is installed from your personal library${out.version ? ` (${out.version})` : ""}, and it keeps itself current`);

  // ---- 5. THE ONE CLEAN PATH: the starter copy goes only now ----------------------------------------
  // state.ok was computed from a fresh listing run in this folder, just above: live switched on,
  // no load errors, files present, registered with this folder's key. Nothing above this line
  // removes anything.
  // SCOPED (round-3 review). Removing the starter LIBRARY uninstalls it everywhere, and another
  // second brain on this computer may still run on it. So: uninstall only the installs that
  // belong to THIS folder (a local or project install whose project is this folder), plus a
  // user-wide install when the live toolkit itself is user-wide and therefore covers every folder.
  // The library and Claude Code's cached copy go only when no install of the starter remains.
  // USER-WIDE removal only when the user settings switch live on (round-6) AND no other folder
  // relies on the starter (round-5 review). Anything user-wide
  // (the user-scope install, the starter library, its cache) waits for a completed scan of every
  // folder Claude Code knows; if another folder still relies on it, or the scan cannot finish,
  // the starter is only switched off for THIS folder and everything user-wide stays.
  if (state.starterInstalled || state.starterMarket) {
    const liveUserWide = state.row && state.row.scope === "user";
    const scan = otherFoldersNeedStarter();
    const userLive = liveOnUserWide();
    const globalOk = userLive && scan.complete && !scan.needed;
    let offHereOnly = false;
    for (const r of state.starterRows) {
      const mine = (r.scope === "local" || r.scope === "project") && samePath(r.projectPath, projectDir);
      if (mine) run(["plugin", "uninstall", STARTER_ID, "--scope", r.scope], CAP_REMOVE);
      else if (r.scope === "user" && liveUserWide) {
        if (globalOk) run(["plugin", "uninstall", STARTER_ID, "--scope", "user"], CAP_REMOVE);
        else offHereOnly = true;
      }
    }
    if (offHereOnly) run(["plugin", "disable", STARTER_ID, "--scope", "local"], CAP_REMOVE);
    let after = verifyLive();
    const others = after.starterRows.filter((r) => !((r.scope === "local" || r.scope === "project") && samePath(r.projectPath, projectDir)));
    if (globalOk && after.rows.fromCli === true && after.starterRows.length === 0 && after.starterMarket) {
      run(["plugin", "marketplace", "remove", STARTER], CAP_REMOVE);
      // Claude Code's own leftovers only. The bundle inside the member's folder is never touched.
      for (const d of [path.join(plugins, "cache", STARTER), path.join(plugins, "marketplaces", STARTER)]) {
        try { if (exists(d)) fs.rmSync(d, { recursive: true, force: true }); } catch { /* harmless */ }
      }
      after = verifyLive();
    }
    out.changed = true;
    if (offHereOnly) line("Old copy", !userLive ? "the free starter copy was switched off for this folder and kept for your other folders, which are not yet set to the live toolkit" : scan.complete ? "the free starter copy was switched off for this folder and kept for your other folders that still use it" : "the free starter copy was switched off for this folder and kept on this computer, because your other folders could not all be checked");
    else if (others.length) line("Old copy", "the free starter copy was removed from this folder and kept for your other folders that still use it");
    else line("Old copy", after.starterInstalled ? "the free starter copy could not be fully removed (harmless, the live toolkit is the one in use)" : "the free starter copy was removed");
  }

  // the marker from a download that missed the key has done its job
  try { if (keyWasMissed) fs.rmSync(missingMarker, { force: true }); } catch { /* harmless */ }

  // ---- 6. updates keep working in the background ------------------------------------------------------
  try {
    if (nat && nat.ensureNativeAutoUpdate) {
      const r = nat.ensureNativeAutoUpdate({ configDir: cfg });
      if (r && r.changed) line("Automatic updates", "switched on");
    }
  } catch { /* best effort */ }
  try {
    if (cli.discoverClaudeBin && cli.rememberClaudeBin) {
      const hit = cli.discoverClaudeBin();
      if (hit && hit.how !== "remembered") cli.rememberClaudeBin(hit.path, hit.how);
    }
  } catch { /* best effort */ }

  return finish();

  function finish() {
    if (out.changed && (out.verdict === "live" || out.verdict === "starter")) {
      line("One thing to do", "close VS Code completely and open it again (on Windows: File, then Exit; on a Mac: Code, then Quit), so the toolkit loads");
    }
    console.log(`KI_CONNECT=${out.verdict}`);
    for (const l of receipt) console.log(scrub(l));
    if (JSON_OUT) console.log(scrub(JSON.stringify({ ...out, receipt })));
  }
}

// Entry at the bottom, after every declaration above (the 8/5/26 TDZ lesson).
// Compared through realpath: macOS hands out /var for a folder whose real name is /private/var,
// and Windows may hand out a short 8.3 name or a different drive-letter case, so a plain string
// compare would silently decide "imported, not run" and print nothing at all.
const invokedDirectly = (() => {
  try {
    if (!process.argv[1]) return false;
    const norm = (p) => { let r = p; try { r = fs.realpathSync.native(p); } catch { r = path.resolve(p); } return process.platform === "win32" ? r.toLowerCase() : r; };
    return norm(path.resolve(process.argv[1])) === norm(fileURLToPath(import.meta.url));
  } catch { return false; }
})();
if (invokedDirectly) {
  try { await main(); } catch (e) {
    console.log("KI_CONNECT=live-failed");
    console.log(`Toolkit: stopped early: ${String((e && e.message) || e).replace(/https?:\/\/[^@\s/]+@/gi, "https://TOKEN@").slice(0, 160)}`);
  }
  process.exitCode = 0;
}
