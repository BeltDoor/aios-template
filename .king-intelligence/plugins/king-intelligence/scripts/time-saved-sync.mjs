#!/usr/bin/env node
// time-saved-sync.mjs — kept as the front door, rebuilt 8/21/26 as a thin shim.
//
// This script used to BE the tracker: it kept a running tally in .claude/time-saved/state.json,
// folded in a figure the model estimated at session close, and posted the whole cumulative total.
// That design is retired. It understated badly (a full session of work was worth 10 or 30
// minutes), it double-counted whenever the model wrote an inconsistent session id, and a lost or
// reseeded state file froze a member's portal figure for weeks because the server had to refuse
// any number lower than the last one it saw.
//
// Nothing is estimated any more. measure-sessions.mjs reads Claude Code's own record of every
// session and counts what actually happened. This file stays because skills, habits and docs
// still call it by name, and every one of those callers should now get a MEASURED answer instead
// of writing a stale one over the top of it.
//
// Every old verb still works:
//   record [--adhoc-min N] [--summary "..."] [--session-id X] [--send]   measure + send
//   send [--reset]                                                       send what is measured
//   show                                                                 print the totals
//   set-rate <n>                                                         the rate lives on the
//                                                                        portal now; this is a no-op
// --adhoc-min and --summary are accepted and IGNORED on purpose: a hand-written figure can no
// longer raise or lower a measured one. Always exits 0, never blocks a session close.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const cmd = argv[0];
const has = (n) => argv.includes(n);
const flag = (n, d = null) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d;
};

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Where the engine might be: beside this file (the plugin ships them together), under the plugin
// root, or in the installed plugin cache when this copy lives in a repo's own scripts folder.
function findEngine() {
  const candidates = [
    path.join(HERE, "measure-sessions.mjs"),
    process.env.CLAUDE_PLUGIN_ROOT ? path.join(process.env.CLAUDE_PLUGIN_ROOT, "scripts", "measure-sessions.mjs") : null,
    path.join(os.homedir(), ".claude", "plugins", "marketplaces", "king-intelligence", "plugins", "king-intelligence", "scripts", "measure-sessions.mjs"),
  ].filter(Boolean);
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch { /* keep looking */ }
  }
  // last resort: the newest version in the installed plugin cache
  try {
    const base = path.join(os.homedir(), ".claude", "plugins", "cache", "king-intelligence", "king-intelligence");
    const versions = fs.readdirSync(base).sort((a, b) => {
      const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
      const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
      for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
      return 0;
    });
    for (const v of versions) {
      const c = path.join(base, v, "scripts", "measure-sessions.mjs");
      if (fs.existsSync(c)) return c;
    }
  } catch { /* nothing installed */ }
  return null;
}

function run(engine, args) {
  const out = execFileSync(process.execPath, [engine, ...args], {
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(out);
}

try {
  if (cmd === "set-rate") {
    // The hourly rate lives on the member's own portal page now, and a snapshot that omits it is
    // deliberately not allowed to blank it. Setting it here would do nothing, so say so plainly.
    console.log(JSON.stringify({ ok: true, note: "the hourly rate is set on your members page, not here" }, null, 2));
    process.exit(0);
  }

  const engine = findEngine();
  if (!engine) {
    // No engine on disk means this setup has not updated yet. Report cleanly rather than
    // posting a stale hand-kept figure over a measured one.
    console.log(JSON.stringify({ ok: true, measured: false, note: "measurement engine not installed yet; nothing sent" }, null, 2));
    process.exit(0);
  }

  const wantsSend = has("--send") || cmd === "send";
  const sessionId = flag("--session-id", null);
  const engineArgs =
    cmd === "show"
      ? ["total"]
      : sessionId && cmd === "record"
        ? ["session", sessionId, ...(wantsSend ? ["--send"] : [])]
        : ["sweep", ...(wantsSend ? ["--send"] : [])];

  const passthrough = ["--token", "--portal", "--send-timeout-ms"];
  for (const f of passthrough) {
    const v = flag(f, null);
    if (v !== null) engineArgs.push(f, v);
  }
  if (has("--dry-run")) engineArgs.push("--dry-run");

  const r = run(engine, engineArgs);

  // The shape old callers read, filled from the measured figures.
  console.log(JSON.stringify({
    ok: true,
    measured: true,
    totalHours: r.hours,
    machineHours: r.machineHours,
    adhocHours: r.hours, // no skills/adhoc split any more: it is one measured number
    skillsHours: 0,
    docsCreated: r.docsCreated,
    docsChanged: r.docsChanged,
    sessions: r.sessions,
    weeksActive: null,
    dollarValue: null, // computed on the portal from the member's own rate
    send: r.send ?? { sent: false, reason: "send not requested" },
  }, null, 2));
} catch (e) {
  // A close must never fail because of this.
  console.log(JSON.stringify({ ok: true, measured: false, note: "sync skipped: " + ((e && e.message) || String(e)).slice(0, 160) }, null, 2));
}
process.exit(0);
