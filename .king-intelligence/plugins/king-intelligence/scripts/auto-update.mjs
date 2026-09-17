#!/usr/bin/env node
// Session-start AUTO-UPDATE. Per the 6/24/26 dial: TOOLS update silently on their own, while
// anything that touches the client's OWN files stays a one-tap, never-overwrite suggestion that
// lives in /king-intelligence:update Part 3. So this hook refreshes the catalog and, when a newer
// version exists, SILENTLY APPLIES it (claude plugin update), then NARRATES what landed and INVITES
// the client to review file-level suggestions. It never edits the client's files itself. When
// there is no new version it still surfaces unseen suggestions. Throttled to once / ~20h. ALWAYS
// exits 0.
//
// THE REHEARSAL: KI_AUTOUPDATE_DRYRUN=1, plus KI_AUTOUPDATE_FAKE_LATEST=x.y.z and optionally
// KI_AUTOUPDATE_FAKE_WHATSNEW="...", walks the real message path and prints the line the member
// would hear. It ignores the throttle, calls no command line, and writes nothing at all: no
// throttle marker, no config. Checked 9/16/26, because the flag had quietly stopped producing any
// message and a documented lever that silently does nothing is what cost the fleet two weeks.
//
// 9/16/26, 0.54.0 - WHY THIS FILE CHANGED. Three member machines carried an update failure whose
// recorded reason was the single sentence "Command failed: claude plugin marketplace update
// king-intelligence". Node writes that identical sentence for a missing binary, any non-zero exit
// and a timeout kill, and the old code threw away the exit code, the signal and stderr. So nobody
// could say which of five causes it was, on any of them, for weeks. Four things changed here:
//   - every CLI call goes through claude-cli.mjs, which finds the binary, keeps git on the child's
//     PATH, masks credentials, and comes back with an exit code, a signal and a stderr tail;
//   - the failure note names a STAGE from a real taxonomy, so an expired membership stops
//     masquerading as a broken updater, and keeps the last three failures instead of one;
//   - the hook has a stated time budget instead of an internal worst case longer than its own
//     timeout, and a step skipped for want of budget says so rather than dying anonymously;
//   - the member's line asks only whether the version MOVED since we last looked, so an update
//     that landed through Claude Code's own rail is narrated too.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, copyFileSync } from "node:fs";
// (rmSync + existsSync are also used by the update-failure record added 8/21/26)
import { join } from "node:path";
// The removal judgement lives in its own module so it can be tested; this file does its
// work on import and reaches the network, so nothing here could otherwise be exercised.
import { confirmEnded } from "./kill-switch-rules.mjs";
// The repo's own copies of the maintenance scripts refresh from the NEWEST installed toolkit
// on every session start (9/14/26): a plugin update on its own never reached them before.
import { refreshLocalScripts, semverGt, configDir, newestPluginRoot } from "./local-scripts.mjs";
import { homedir } from "node:os";

const emit = (msg) => {
  try {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: msg },
    }));
  } catch {}
};

const readVersion = (p) => { try { return JSON.parse(readFileSync(p, "utf8")).version || null; } catch { return null; } };

// Find the latest available plugin version from the refreshed marketplace cache (best-effort).
function latestFromCatalog() {
  const base = join(configDir(), "plugins", "marketplaces");
  const candidates = [
    join(base, "king-intelligence", "plugins", "king-intelligence", ".claude-plugin", "plugin.json"),
  ];
  for (const c of candidates) { const v = readVersion(c); if (v) return v; }
  // fallback: shallow-scan marketplace dirs for any king-intelligence plugin manifest
  try {
    for (const dir of readdirSync(base)) {
      const p = join(base, dir, "plugins", "king-intelligence", ".claude-plugin", "plugin.json");
      const v = readVersion(p); if (v) return v;
    }
  } catch {}
  return null;
}

// The plain, client-friendly one-line "what's new" for the version just pulled. Authored per release
// in defaults/whats-new.txt (NOT the technical CHANGELOG). Read from the refreshed marketplace cache,
// same place as the version. Fully optional: any miss returns null and the message stays generic.
function latestWhatsNew() {
  if (process.env.KI_AUTOUPDATE_DRYRUN === "1") return process.env.KI_AUTOUPDATE_FAKE_WHATSNEW || null;
  const base = join(configDir(), "plugins", "marketplaces");
  const first = (p) => { try { const t = readFileSync(p, "utf8").trim(); return t ? t.split("\n")[0].trim() : null; } catch { return null; } };
  const direct = first(join(base, "king-intelligence", "plugins", "king-intelligence", "defaults", "whats-new.txt"));
  if (direct) return direct;
  try { for (const dir of readdirSync(base)) { const v = first(join(base, dir, "plugins", "king-intelligence", "defaults", "whats-new.txt")); if (v) return v; } } catch {}
  return null;
}

// PER-SKILL OPT-OUT (added 7/20/26, client feedback). A client can turn off individual skills by
// listing folder names under `disabledSkills` in $CLAUDE_PLUGIN_DATA/config.json, e.g.
// { "disabledSkills": ["email", "brainstorming"] }. This prunes those folders from the installed
// plugin so they never load — and because it runs EVERY session start (before the 20h throttle)
// and again right after a silent update applies, an update can never resurrect a disabled skill.
// Unknown names are ignored; native commands (adapt/update) are untouchable by design. Returns the
// number of folders pruned this run (0 when already clean).
//
// 9/16/26: it now runs against the NEWEST installed toolkit as well as this session's pinned one.
// Once Claude Code's own rail is switched on, an update lands in a brand new version folder minutes
// after startup, after both of the old call sites had already run, and the opted-out skill came
// back. The worst case was the rescue population itself: on a machine whose refresh fails, the
// post-update prune is never reached at all.
//
// 9/16/26, SECOND PASS: "the newest toolkit" was the WRONG ADDRESS for this. newestPluginRoot()
// also considers the marketplace git clone, and on a tie it keeps the clone, which is exactly the
// state right after an update (the clone is refreshed first, then the version is installed). So
// the prune reached a git working tree, where Claude Code never loads a skill from, and MISSED the
// brand new cache folder it does load from. The promise at the top of this comment would have been
// false on the native rail, which is the whole population this release is for. It now prunes every
// INSTALLED version folder, and never anything under plugins/marketplaces.
function pruneDisabledSkills(root, data) {
  try {
    const cfg = JSON.parse(readFileSync(join(data, "config.json"), "utf8"));
    const list = Array.isArray(cfg.disabledSkills) ? cfg.disabledSkills : [];
    let pruned = 0;
    for (const name of list) {
      if (typeof name !== "string" || !/^[a-z0-9][a-z0-9-]*$/i.test(name)) continue; // no path tricks
      const dir = join(root, "skills", name);
      if (existsSync(dir)) { try { rmSync(dir, { recursive: true, force: true }); pruned++; } catch {} }
    }
    return pruned;
  } catch { return 0; }
}

// Every INSTALLED toolkit folder on this computer, keyed and free-starter alike. These are the
// folders Claude Code actually loads skills from, and after an update the newest one is a folder
// this session has never pointed at.
function installedRoots() {
  const out = [];
  try {
    const base = join(configDir(), "plugins", "cache");
    for (const mk of ["king-intelligence", "king-intelligence-starter"]) {
      const dir = join(base, mk, "king-intelligence");
      let names = [];
      try { names = readdirSync(dir); } catch { continue; }
      for (const v of names) out.push(join(dir, v));
    }
  } catch {}
  return out;
}

// The opt-out, applied to the session's own toolkit AND to every installed version. A folder under
// plugins/marketplaces is skipped on purpose: that is the git clone the refresh fast-forwards, its
// files are tracked, and nothing loads skills from it.
function pruneEverywhere(root, data) {
  const seen = new Set();
  for (const dir of [root, ...installedRoots()]) {
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    if (/[\\/]plugins[\\/]marketplaces[\\/]/.test(String(dir))) continue;
    pruneDisabledSkills(dir, data);
  }
}

// KILL SWITCH (added 8/26/26). A machine whose membership has ENDED turns the toolkit off
// itself. The portal's /api/plugin-access/status answers with the machine's own marketplace
// token: "live" (carry on), "ended" (membership positively over -> disable the plugin locally),
// "unknown" (the token matches nothing — a regenerated line — tell the member, never disable).
// A network error, timeout, or 5xx answers null and NOTHING happens: only a confirmed "ended"
// from a successful database read ever disables, the same never-cut-off-on-an-outage law the
// portal's own revoke cron follows. Free-starter installs have no portal marketplace and are
// skipped entirely.
function portalToken() {
  try {
    const km = JSON.parse(readFileSync(join(configDir(), "plugins", "known_marketplaces.json"), "utf8"));
    const url = km?.["king-intelligence"]?.source?.url || "";
    const m = url.match(/^https:\/\/([^@/]+)@members\.king-intelligence\.com\/marketplace\.git$/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

// KI_AUTOUPDATE_FAKE_ACCESS is honoured WHENEVER IT IS SET, not only under DRYRUN (fixed 9/16/26).
// It used to be gated behind the dry-run flag, which also skips the real CLI calls, so there was no
// way to exercise the real update path against a fake entitlement answer. Every sandbox run
// therefore fired a real authenticated request at the live portal. KI_PORTAL_BASE exists for the
// same reason: the production URL used to be hardcoded with no override at all.
async function accessStatus(token, timeoutMs) {
  const fake = process.env.KI_AUTOUPDATE_FAKE_ACCESS;
  if (fake) return fake === "null" ? null : fake;
  if (process.env.KI_AUTOUPDATE_DRYRUN === "1") return null;
  try {
    const base = process.env.KI_PORTAL_BASE || "https://members.king-intelligence.com";
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
    const res = await fetch(base + "/api/plugin-access/status", {
      headers: { Authorization: "Bearer " + token },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.status !== 200) return null; // 5xx / anything odd = could not check = do nothing
    const body = await res.json();
    return body && (body.access === "live" || body.access === "ended" || body.access === "unknown")
      ? body.access
      : null;
  } catch { return null; }
}

function unseenPatternCount(root, data) {
  try {
    const shipped = readdirSync(join(root, "patterns")).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
    let cfg = {}; try { cfg = JSON.parse(readFileSync(join(data, "config.json"), "utf8")); } catch {}
    const p = cfg.patterns || {};
    const seen = new Set([...(p.adopted || []), ...(p.declined || [])]);
    return shipped.filter((id) => !seen.has(id)).length;
  } catch { return 0; }
}

// Never shown to the member. It is how the model knows to say the line in its own words and, in
// particular, never to hand the member a command to type.
const MODEL_INSTRUCTION =
  "IMPORTANT: say the line above to the user in your own words as your first reply, then carry on " +
  "with whatever they asked. Do not tell them to type any command. If they say yes to the " +
  "suggestions, run /king-intelligence:update yourself.";

// Leaving early is a thrown sentinel the outer catch swallows, never a hard process.exit(): on
// Node 24 / Windows a hard exit right after the access-status fetch() aborts the process with a
// libuv assertion while the connection is still closing (9/11/26). A natural exit is safe.
class Done extends Error {}
try {
  const data = process.env.CLAUDE_PLUGIN_DATA;
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  if (!data || !root) throw new Done();

  // HELPERS LOAD HERE, NOT AT THE TOP OF THE FILE. A top-level import of a new module is the
  // highest-blast-radius line in this release: if it throws or is missing for any reason (a bad
  // publish, a half-fetched clone, a version folder swept mid-write) the WHOLE hook dies before
  // the prune, the script refresh, the kill switch and the update, on every member, silently and
  // for ever, and the hook is the mechanism that would have healed them. Inside the try, a broken
  // helper costs only the feature it carries. Same reason ki-run.mjs does it.
  let cli = null;
  try { cli = await import("./claude-cli.mjs"); } catch { /* the hook still runs, it just cannot shell out */ }

  // A local mask, so that even with the helper missing a member's token can never reach the disk.
  const mask = (s) => {
    try { if (cli && cli.maskSecrets) return cli.maskSecrets(s); } catch {}
    try { return String(s == null ? "" : s).replace(/https?:\/\/[^@\s/]+@/gi, "https://TOKEN@"); } catch { return ""; }
  };
  const runCli = (args, ms) => {
    if (!cli || !cli.runClaude) return { ok: false, status: null, signal: null, code: "KI_NO_RUNNER", tail: "", bin: null, how: null, ms: 0 };
    try {
      const r = cli.runClaude(args, ms);
      // THE ADDRESS IS WRITTEN DOWN THE FIRST TIME IT WORKS (9/17/26). A rung that had to ask the
      // operating system, or search the editor's extension folders, answers once and is then
      // remembered, so every later session start finds the command line in one file read. A path
      // that has since moved is caught on the read, never trusted blind.
      if (r && r.ok && cli.rememberClaudeBin && r.how !== "bare" && r.how !== "remembered") {
        try { cli.rememberClaudeBin(r.bin, r.how); } catch { /* remembering is a convenience */ }
      }
      return r;
    }
    catch (e) { return { ok: false, status: null, signal: null, code: String((e && e.code) || (e && e.message) || "throw"), tail: "", bin: null, how: null, ms: 0 }; }
  };

  // IS THE SECOND ROUTE SWITCHED ON? Read, never written here. It rides in every failure note so
  // the fleet report can tell "one route down, the other covering" from "this machine has no
  // working way to update at all", which are two different urgencies.
  const nativeFlagState = () => {
    try {
      const s = JSON.parse(readFileSync(join(configDir(), "settings.json"), "utf8"));
      const k = s.extraKnownMarketplaces ? "extraKnownMarketplaces" : s.knownMarketplaces ? "knownMarketplaces" : null;
      const e = k && s[k] ? s[k]["king-intelligence"] : null;
      if (!e) return null;
      return e.autoUpdate === true ? true : e.autoUpdate === false ? false : null;
    } catch { return null; }
  };

  // ---- TIME BUDGET ----
  // hooks.json gives this hook an explicit 90s timeout. It carried none before, so it inherited
  // the 60s default while its own internal worst case was 98s, which means a genuinely slow
  // update was killed before it could write down why. Every cap is overridable so the sandbox
  // runs the same code in about a second per step.
  const startedAt = Date.now();
  const plainMs = (name, dflt) => { const v = parseInt(process.env[name] || "", 10); return Number.isFinite(v) && v > 0 ? v : dflt; };
  const ALL_MS = parseInt(process.env.KI_AUTOUPDATE_TIMEOUT_MS || "", 10);
  const capMs = (name, dflt) => {
    const per = parseInt(process.env[name] || "", 10);
    if (Number.isFinite(per) && per > 0) return per;
    if (Number.isFinite(ALL_MS) && ALL_MS > 0) return ALL_MS;
    return dflt;
  };
  const CAP_STATUS = capMs("KI_AUTOUPDATE_STATUS_MS", 8000);
  const CAP_REFRESH = capMs("KI_AUTOUPDATE_REFRESH_MS", 40000);
  const CAP_UPDATE = capMs("KI_AUTOUPDATE_UPDATE_MS", 35000);
  const CAP_KILL = capMs("KI_AUTOUPDATE_KILL_MS", 30000);
  const CAP_DIAG = capMs("KI_AUTOUPDATE_DIAG_MS", 5000);
  const CAP_GITFB = capMs("KI_AUTOUPDATE_GITFB_MS", 15000);
  // The budget itself is NOT scaled by KI_AUTOUPDATE_TIMEOUT_MS: shrinking every step would
  // otherwise shrink the budget under its own reserve and every step would report "budget".
  const BUDGET_MS = plainMs("KI_AUTOUPDATE_BUDGET_MS", 85000);
  const RESERVE_MS = plainMs("KI_AUTOUPDATE_RESERVE_MS", 10000);
  const budgetLeft = () => BUDGET_MS - (Date.now() - startedAt);
  const haveBudget = () => budgetLeft() > RESERVE_MS;

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  // THE REHEARSAL. KI_AUTOUPDATE_DRYRUN=1 walks the whole message path without touching the real
  // install: no CLI call, no throttle marker written, no config written. It is read here, above the
  // throttle, because a rehearsal on a machine that checked this morning would otherwise do nothing
  // at all and look like a broken lever.
  const DRY = process.env.KI_AUTOUPDATE_DRYRUN === "1";

  // enforce the client's per-skill opt-out on EVERY session start, before the throttle can exit —
  // cheap, and it guarantees a disabled skill stays gone no matter when the last update landed.
  // ...on this session's toolkit AND on every other version installed on the computer, which after
  // a native-rail update includes a folder this session has never pointed at.
  pruneEverywhere(root, data);

  // Level the repo's own script copies with the newest installed toolkit, EVERY session start,
  // before the throttle: a member whose plugin updated in the background last night runs the
  // new memory tidy this morning, not the one she migrated on. Cheap: one stat per script.
  refreshLocalScripts(projectDir);

  // Switch ON Claude Code's own background updater for this marketplace, before the throttle, so
  // it lands on the very next session of every member rather than up to 20 hours later. Loaded
  // with await import() for the same reason as the CLI helper, and it also has its OWN entry in
  // hooks.json so neither rail can take the other down.
  try {
    const nat = await import("./native-autoupdate.mjs");
    nat.ensureNativeAutoUpdate();
  } catch { /* the hook rail still works on its own */ }

  // throttle
  const marker = join(data, ".last-autocheck");
  const now = Date.now();
  const TWENTY_H = 20 * 60 * 60 * 1000;
  const ONE_H = 60 * 60 * 1000;
  // marker format is "<epoch>" (old) or "<epoch>:<waitMs>" (new). A run that FAILED writes the
  // short wait, so a machine that cannot update retries within the hour instead of once a day.
  // A machine can otherwise sit versions behind for weeks while in daily use, silently.
  let last = 0, wait = TWENTY_H;
  try {
    const raw = String(readFileSync(marker, "utf8")).trim().split(":");
    last = parseInt(raw[0], 10) || 0;
    if (raw[1]) wait = parseInt(raw[1], 10) || TWENTY_H;
  } catch {}
  // NOT a Done() any more. The member's line below asks only whether the version moved since we
  // last looked, and an update that landed through Claude Code's own rail moves it on a session
  // where the throttle is closed. Only the CLI work is throttled.
  const throttled = DRY ? false : (now - last < wait);

  // Whatever happens below, leave a record of it. It rides up to the portal on the next snapshot,
  // which is the only way the owner ever finds out a client's updates are failing.
  // Is this machine even ON the updatable rail? A free-starter install has only a local
  // marketplace (king-intelligence-starter) and can never pull a release, by design. Telling
  // those two cases apart is what keeps the short retry meaningful.
  const onKeyedRail = (() => {
    try {
      const km = JSON.parse(readFileSync(join(configDir(), "plugins", "known_marketplaces.json"), "utf8"));
      return Object.keys(km || {}).some((k) => k === "king-intelligence");
    } catch { return false; }
  })();

  // WRITTEN WHERE THE ENGINE ACTUALLY READS (fixed 8/28/26).
  //
  // This note is the ONLY way anyone finds out that a member's updates are failing. It was
  // being written under the plugin's own data folder while measure-sessions.mjs reads from
  // the home folder, which is where the ledger moved on 8/21 when per-machine state was
  // taken out of CLAUDE_PLUGIN_DATA. The reader moved and the writer did not, so the note
  // landed somewhere nothing looks: every machine in the fleet reported no update failure,
  // and that read as "everyone is updating cleanly" when it only ever meant "nobody can
  // see". Same resolution as the engine, override included, so the two cannot drift again.
  //
  // THIS ONE STAYS ON THE HOME FOLDER WHILE EVERY OTHER SITE IN THIS FILE MOVED TO THE CONFIG
  // FOLDER (9/16/26). The reader is measure-sessions.mjs line 64, and it resolves from the home
  // folder too, by os.homedir, not by the config-folder helper.
  // Moving the writer without moving the reader is precisely the 8/28/26 bug, in the very file
  // that warns against it, and it would land on exactly the CLAUDE_CONFIG_DIR machines 0.52.4
  // shipped for. The two move together or not at all.
  const errDir =
    process.env.KI_TIME_SAVED_DIR ||
    join(homedir(), ".claude", "king-intelligence", "time-saved");
  const errPath = join(errDir, "update-error.json");
  // The old location, still cleared on success so a stale note from a previous version
  // cannot sit there for ever claiming a failure that has since been fixed.
  const legacyErrPath = join(data, "time-saved", "update-error.json");

  // THE FAILURE NOTE. `stage` names WHICH step, `exit`/`signal`/`code` name HOW it ended, `bin`
  // names which rung found the command line, `gitOk` says whether git runs on this machine at all,
  // and `cc` is the version of the binary WE WOULD CALL (not necessarily the one running this
  // session: on a VS Code install those are two different files). `recent` keeps the last three,
  // because the note used to be overwritten on every run, so on all three affected machines the
  // first and most diagnostic failure was already gone by the time anyone looked. Kept under 1 KB.
  // WHAT WENT WRONG THIS RUN, if anything. It exists because the note used to be written and then
  // erased four lines later: reaching the library was treated as proof the whole rail was alive, so
  // an update that FAILED TO INSTALL left no record at all and the machine was stamped not to try
  // again for twenty hours. That is the single most important new failure stage in this release and
  // it was the one stage that could never reach the fleet.
  let failedStage = null;
  const noteFailure = (stage, r) => {
    failedStage = stage;
    try {
      mkdirSync(errDir, { recursive: true });
      const prev = (() => { try { return JSON.parse(readFileSync(errPath, "utf8")).recent || []; } catch { return []; } })();
      const at = new Date().toISOString();
      writeFileSync(errPath, JSON.stringify({
        stage, at,
        detail: mask((r && (r.tail || r.code)) || "").slice(0, 200),
        exit: r && r.status !== undefined ? r.status : null,
        signal: (r && r.signal) || null,
        bin: (r && r.how) || null,
        gitOk: r && r.gitOk !== undefined ? r.gitOk : null,
        cc: (r && r.cc) || null,
        // true: Claude Code's own updater is switched on for this library, so a dead hook rail is
        // covered. false: the member switched it off. null: no entry or unreadable (not switched).
        native: nativeFlagState(),
        recent: [{ stage, at, exit: r && r.status !== undefined ? r.status : null }, ...(Array.isArray(prev) ? prev : [])].slice(0, 3),
      }));
    } catch {}
  };
  // Two extra reads, on the failure path ONLY and only with budget to spare. They separate "our
  // lookup of the command line is wrong", "this machine has no git" and "this machine is on an old
  // Claude Code" on the very next fleet report, with no further investigation. cc is the field the
  // fleet has never had; CLAUDE_CODE_VERSION does not exist in a hook environment, so it is read.
  const withDiag = (r) => {
    try {
      if (!r || typeof r !== "object") return r;
      if (!haveBudget()) return r;
      if (cli && cli.gitVersionOk) r.gitOk = cli.gitVersionOk(3000);
      const v = runCli(["--version"], CAP_DIAG);
      r.cc = v && v.ok ? String(v.tail || "").split("\n")[0].trim().slice(0, 60) : null;
    } catch {}
    return r;
  };
  const clearFailure = () => {
    failedStage = null;
    for (const p of [errPath, legacyErrPath]) {
      try { if (existsSync(p)) rmSync(p, { force: true }); } catch {}
    }
  };
  const stamp = (waitMs) => { try { mkdirSync(data, { recursive: true }); writeFileSync(marker, now + ":" + waitMs); } catch {} };

  // gate: only keyed clients can pull from the marketplace. A free-starter / offline client
  // makes the catalog refresh throw; we swallow it and fall back to the pattern nudge.
  const installed = readVersion(join(root, ".claude-plugin", "plugin.json"));

  // ---- THE MEMBER'S LINE, DECIDED BEFORE THE THROTTLE ----
  // Stop asking WHO updated the toolkit, ask only whether the version MOVED since we last looked.
  // The old line only ever fired inside our own apply, so an update that landed through Claude
  // Code's own rail was completely silent and the member never heard what changed.
  const cfgPath = join(data, "config.json");
  let cfg0 = {}; try { cfg0 = JSON.parse(readFileSync(cfgPath, "utf8")); } catch {}
  // A MACHINE THAT HAS NEVER RECORDED A VERSION HAS NOT "MOVED" (fixed 9/16/26). semverGt coerces a
  // missing right-hand side to 0.0.0 and answers true for anything, so a first-ever session, and
  // every session on a machine whose config was never seeded, told the member their tools had just
  // updated themselves when nothing had happened at all. First sight now records the version and
  // says nothing. The line the member DOES get on the session where we installed something is
  // carried by appliedVersion below, so nothing is lost.
  const lastSeen = cfg0.autoUpdate && typeof cfg0.autoUpdate.lastCheckedVersion === "string"
    ? cfg0.autoUpdate.lastCheckedVersion : null;
  const versionMoved = !!(installed && lastSeen && semverGt(installed, lastSeen));

  let catalogRefreshed = false;
  let appliedVersion = null;

  if (!throttled) {
    // ---- KILL SWITCH: is this machine's membership still live? ----
    // Runs before the catalog refresh so an ended membership is handled in one clean step
    // instead of surfacing as a mysterious failed update. Only a portal-keyed machine is
    // checked; GitHub-PAT and free-starter machines have no portal token and are skipped.
    let portalAnswered = null; // null = never asked, true = it answered, false = we could not read it
    {
      const tok = DRY ? "dry-run" : portalToken();
      if (tok) {
        // The gate is read ONCE, before the call, and the same answer decides both lines. Asking a
        // second time after the await meant a membership check that completed and used up the last
        // of the budget filed a note saying the budget ran out before it, which is both false and
        // destructive: noteFailure overwrites the whole file, including a real note from this run.
        const hadBudget = haveBudget();
        const status = hadBudget ? await accessStatus(tok, CAP_STATUS) : null;
        if (!hadBudget) noteFailure("budget", { code: "the session-start budget ran out before the membership check" });
        portalAnswered = status !== null;

        // ONE answer is not enough to take a paying member's toolkit away (8/28/26).
        //
        // "ended" is a reading of two database columns, and those columns have been WRONG for
        // real members twice: two were keyed with a subscription status of "none" (8/21/26),
        // and an expired-trial sweep stamped another as revoked the day before Jacob
        // reinstated her (8/24/26). Every one of them would have read as ended here.
        //
        // What made that dangerous is that the act is not reversible from the member's side:
        // removing the plugin removes the hook that would have healed it, so recovery needs a
        // fresh install line from /system, which needs a live membership to view. A member
        // wrongly cut off cannot get themselves back.
        //
        // So it now takes TWO confirmations at least six hours apart. A membership that has
        // really ended is still ended six hours later, so a genuine removal is delayed by a
        // session or two and nothing else. A wrong column, or a bad minute in the database,
        // gets the chance to be right before anyone's tools are taken.
        // The judgement itself lives in kill-switch-rules.mjs, next to its test. Everything
        // here is the filing: read the note, do what it says, write the note back.
        const streakFile = join(data, ".ended-confirmations");
        let raw = null;
        try { raw = existsSync(streakFile) ? readFileSync(streakFile, "utf8") : null; } catch {}
        const verdict = confirmEnded(status, now, raw);
        if (verdict.write !== null) { try { writeFileSync(streakFile, String(verdict.write)); } catch {} }
        if (verdict.clear) { try { if (existsSync(streakFile)) rmSync(streakFile, { force: true }); } catch {} }
        const confirmed = verdict.confirmed;

        if (status === "ended" && !confirmed) {
          // A MEMBERSHIP ENDING IS NOT A BROKEN UPDATER (new 9/16/26). One of the three machines
          // under investigation had simply reached the end of a trial three hours and 53 minutes
          // earlier; the library answered 401, the refresh failed, and it was filed as
          // "marketplace-refresh" and counted against the updater for a fortnight. So on a first
          // ended sighting we record what it really is and SKIP THE REFRESH ENTIRELY, because
          // that refresh is certain to 401 and certain to be misread.
          noteFailure("membership-ending", { code: "the library says this membership has ended; waiting for a second reading before doing anything" });
          stamp(ONE_H);
          throw new Done();
        }

        if (status === "ended" && confirmed) {
          // REMOVE, not just disable (Jacob's call, 8/26/26): the skills must not remain on a
          // non-member's machine. Uninstall the plugin (fallback: disable), drop the keyed
          // marketplace (the cached clone is a second on-disk copy of every skill), then sweep
          // any leftover king-intelligence folders under ~/.claude/plugins. ONLY those two
          // exactly-named folders are ever touched — never the member's own files, never other
          // plugins, and never CLAUDE_PLUGIN_DATA (their config survives so a rejoin restores
          // their setup exactly). The starter marketplace (king-intelligence-starter) is not
          // touched either; a machine on it never reaches this code (no portal token).
          if (!DRY) {
            // Switch Claude Code's own background updater OFF for this marketplace first, through
            // the same locked writer. It SETS ONE BOOLEAN. It does not delete the entry and does
            // not touch enabledPlugins: the promise a few lines above is that a rejoin restores
            // the member's setup exactly, and that file also holds their env, model, theme and
            // permissions. The real enforcement is server-side anyway, because the library
            // answers 401 to a revoked token, so no code can reach the machine either way.
            try {
              const nat = await import("./native-autoupdate.mjs");
              const res = nat.ensureNativeAutoUpdate({ want: false, onlyIfUndefined: false });
              if (res && res.error) noteFailure("kill-switch-settings", { code: res.error });
            } catch (e) { noteFailure("kill-switch-settings", { code: String((e && e.message) || e) }); }

            const un = runCli(["plugin", "uninstall", "king-intelligence@king-intelligence"], CAP_KILL);
            if (!un.ok) {
              const dis = runCli(["plugin", "disable", "king-intelligence@king-intelligence"], CAP_KILL);
              if (!dis.ok) noteFailure("kill-switch-disable", withDiag(dis));
            }
            // This used to be a bare try{}catch{} that swallowed the failure whole. A marketplace
            // that would not go is the difference between a clean removal and a member's machine
            // still carrying a full copy of every skill.
            const rm = runCli(["plugin", "marketplace", "remove", "king-intelligence"], CAP_KILL);
            if (!rm.ok) noteFailure("kill-switch-marketplace-remove", withDiag(rm));

            for (const leftover of [
              join(configDir(), "plugins", "marketplaces", "king-intelligence"),
              join(configDir(), "plugins", "cache", "king-intelligence"),
            ]) {
              try { if (existsSync(leftover)) rmSync(leftover, { recursive: true, force: true }); } catch {}
            }
          }
          emit(
            "Your King Intelligence membership has ended, so the toolkit has been removed from this computer. " +
            "Nothing of yours was touched: your files, your notes, and everything you built are exactly where they were. " +
            "Rejoin any time at https://members.king-intelligence.com and your tools come right back. " +
            "IMPORTANT: tell the user the line above in your own first reply, then carry on with whatever they asked."
          );
          stamp(ONE_H); // if the disable didn't stick, try again within the hour
          throw new Done();
        }
        if (status === "unknown") {
          // The member is told, but until now the FLEET saw nothing at all, so a rotated access
          // line looked identical to a healthy machine on the owner's Sunday report.
          noteFailure("token-rotated", { code: "this computer's access line matches nothing in the library" });
          emit(
            "King Intelligence: this computer's access line is out of date (it was probably regenerated on the member page). " +
            "Updates are paused until it's refreshed. Tell the user: grab the new install line from " +
            "https://members.king-intelligence.com/system and paste it here. Mention this once, briefly, then carry on."
          );
          stamp(TWENTY_H); // don't nag every session; tools keep working locally meanwhile
          throw new Done();
        }
        // "live" or null (couldn't check) -> carry on to the normal update path.
      }
    }

    // refresh the catalog (gate: a free-starter / offline client makes this fail, so we fall back
    // to the unseen-suggestion path and never apply anything).
    if (DRY) { catalogRefreshed = true; }
    else if (!haveBudget()) {
      noteFailure("budget", { code: "the session-start budget ran out before the library refresh" });
    } else {
      const r = runCli(["plugin", "marketplace", "update", "king-intelligence"], CAP_REFRESH);
      if (r.ok) catalogRefreshed = true;
      else if (onKeyedRail) {
        // A machine that cannot reach the portal AT ALL is a different fix from a machine whose
        // refresh failed with the portal answering fine. They used to be the same line.
        const stage = portalAnswered === false ? "marketplace-refresh-unreachable" : "marketplace-refresh";
        const diag = withDiag(r);

        // LAST RESORT. Only when there was NO SUCH COMMAND on this computer. It installs NOTHING
        // and must never claim it did. What it genuinely buys: the marketplace clone is one of the
        // folders the toolkit finder looks in, so a successful fast-forward levels the member's own
        // .claude/scripts/ and ki-run.mjs to the new toolkit even while the installed plugin stays
        // stale.
        // "there is no such command" arrives three ways: ENOENT when we spawned a path directly,
        // exit 127 when the bare word went through a shell, and BAD_EXECUTABLE on Windows when the
        // thing we found was a .cmd shim. It is NOT gated on the bare rung any more (9/16/26): a
        // Windows member whose .cmd shim cannot be spawned lands on a "known" rung, and the narrow
        // gate meant the one population that needed the fallback most could never reach it.
        const why = String(r.code || "");
        const noSuchCommand = why.includes("ENOENT") || why.includes("BAD_EXECUTABLE") || why.includes("EINVAL") || r.status === 127;
        if (noSuchCommand && cli && cli.gitFfPull) {
          if (!haveBudget()) noteFailure("budget", { code: "the session-start budget ran out before the fallback" });
          else {
            const g = cli.gitFfPull(join(configDir(), "plugins", "marketplaces", "king-intelligence"), CAP_GITFB);
            // gitOk answers "does git run on this machine at all", which is what the fleet report
            // turns into "and git did not run there". It is NOT this pull's own result: the most
            // likely failure here is the library refusing a stale access line, and reporting that
            // as a missing git would send the owner to install git on a machine whose git is fine.
            // The pull's own outcome is already in exit, signal and detail.
            g.gitOk = diag.gitOk === undefined ? null : diag.gitOk;
            // WRITTEN FIRST, ON PURPOSE. The note keeps a short history and shows the newest entry
            // on the fleet report, and the thing that needs fixing on that computer is "there is no
            // such command", not "the stand-in also ran". So the last resort goes into the history
            // here and the root cause is written over the top of it a line below, carrying a plain
            // summary of what the stand-in managed.
            noteFailure("git-fallback", g);
            // The clone is the only new code this machine can get on this path, so it is
            // explicitly allowed as a source here and nowhere else.
            if (g.ok) refreshLocalScripts(projectDir, newestPluginRoot(projectDir, { includeClone: true }));
            const base = diag.tail || diag.code || `exit ${diag.status}`;
            diag.tail = `${base} | last resort: ${g.ok
              ? "the library copy was brought up to date, nothing was installed"
              : `it could not run either (${g.status === null ? g.code : "exit " + g.status})`}`;
          }
        }
        noteFailure(stage, diag);
      }
    }

    if (catalogRefreshed) {
      const latest = DRY ? (process.env.KI_AUTOUPDATE_FAKE_LATEST || null) : latestFromCatalog();
      if (latest && installed && semverGt(latest, installed)) {
        // SILENT APPLY: tools update on their own (the dial). Best-effort; it lands on next restart.
        let applied = false;
        if (DRY) { applied = true; }
        else if (!haveBudget()) {
          noteFailure("budget", { code: "the session-start budget ran out before the update itself" });
        } else {
          const r = runCli(["plugin", "update", "king-intelligence@king-intelligence"], CAP_UPDATE);
          if (r.ok) { applied = true; clearFailure(); }
          else noteFailure("apply-update", withDiag(r));
        }

        if (applied) {
          appliedVersion = latest;
          // the fresh update just restored every skill folder — re-apply the client's opt-out now,
          // on the pinned root AND on the version folder the update actually landed in
          if (!DRY) pruneEverywhere(root, data);
          // and level the repo's script copies with the version that just landed (the cache now
          // holds it, even though this session's CLAUDE_PLUGIN_ROOT still points at the old one)
          refreshLocalScripts(projectDir);
        }
      }
    }

    // Reaching the library means the FIRST half of the rail is alive, and nothing more. This used
    // to clear the note unconditionally, four lines after the failed install wrote it, so the one
    // stage that says "the update itself would not install" could never reach anybody.
    if (catalogRefreshed && !failedStage) clearFailure();
  }

  // ---- WHAT THE MEMBER HEARS ----
  // One line, plain, no command to type. The update landed in the background either way; which
  // rail carried it is our business, not theirs.
  let msg = null;
  // Either the version moved since we last looked (Claude Code's own rail carried it, or ours did
  // on an earlier session), or we installed it ourselves a moment ago. Both are "it updated in the
  // background", and recording the applied version below is what stops the member hearing it twice.
  if (versionMoved || appliedVersion) {
    const whatsNew = latestWhatsNew();
    msg =
      "Your King Intelligence tools updated themselves in the background, so you're current." +
      (whatsNew ? ` What's new: ${whatsNew}` : "") +
      " Nothing you set up was changed, and the new pieces switch on the next time you open Claude Code.";
  }
  // THE SUGGESTIONS HALF IS THROTTLED, THE UPDATE HALF IS NOT (fixed 9/16/26). The update line
  // latches itself: the version is written down every run, so it cannot repeat. The suggestion
  // count does not. It only shrinks when the member runs /king-intelligence:update, so left
  // outside the throttle it fired at EVERY session start, resume, clear and compact, for ever, on
  // any member who had not adopted every shipped rule. One quiet line per day was the decision.
  const unseen = throttled ? 0 : unseenPatternCount(root, data);
  if (unseen > 0) {
    msg = msg
      ? msg + ` I also have ${unseen} suggestion${unseen === 1 ? "" : "s"} for how your own setup works. Want me to walk you through ${unseen === 1 ? "it" : "them"}? Nothing changes without your yes.`
      : `King Intelligence: I have ${unseen} new way${unseen === 1 ? "" : "s"} of working to suggest for your setup. Want to hear ${unseen === 1 ? "it" : "them"}? I never overwrite what you already have, and nothing changes without your yes.`;
  }

  // THE MEMBER IS TOLD WHEN THEIR OWN UPDATES FAIL (9/17/26, David Russo's point). Until now a
  // failed update was written to a file nobody on that computer would ever open and sent to the
  // owner, and the member sat three versions behind with no visible sign. One quiet line, at most
  // once a day, only for a failure of the update itself (a membership ending and a budget squeeze
  // have their own lines or none), and never a command to type: the retry is automatic.
  try {
    const REAL_FAILURES = new Set(["marketplace-refresh", "marketplace-refresh-unreachable", "apply-update"]);
    if (failedStage && REAL_FAILURES.has(failedStage) && !DRY) {
      const toldFile = join(data, ".last-failure-told");
      let toldAt = 0;
      try { toldAt = parseInt(readFileSync(toldFile, "utf8"), 10) || 0; } catch {}
      if (now - toldAt > TWENTY_H) {
        try { mkdirSync(data, { recursive: true }); writeFileSync(toldFile, String(now)); } catch {}
        const covered = nativeFlagState() === true;
        const line =
          "King Intelligence: your toolkit could not update itself just now" +
          (installed ? ` (you are on version ${installed})` : "") +
          ". Your tools still work and nothing on your computer is broken. " +
          (covered
            ? "Claude Code's own updater is also switched on for it, so the update should still arrive on its own, and this is reported to Jacob automatically. "
            : "It will try again within the hour, and this is reported to Jacob automatically. ") +
          "If you see this line more than a couple of times, tell Jacob.";
        msg = msg ? msg + " " + line : line;
      }
    }
  } catch { /* a line we could not compose is not worth a crash */ }

  if (msg) emit(msg + " " + MODEL_INSTRUCTION);

  // record + stamp only after emitting, so a write failure never silences the next session.
  // A rehearsal writes NOTHING: it must not be able to silence the real check for twenty hours.
  try {
    if (!throttled && !DRY) {
      // The retry window keys on whether the WHOLE run came off, not on whether the library
      // answered. A refresh that worked and an install that failed is a machine that needs to try
      // again within the hour, and it used to be stamped for twenty.
      const clean = !failedStage;
      stamp(clean && (catalogRefreshed || !onKeyedRail) ? TWENTY_H : ONE_H);
    }
    if (!DRY) {
      // SEED FIRST, THEN MERGE (fixed 9/16/26). This block creates config.json when it is missing,
      // which is right, but it was writing a stub holding nothing but autoUpdate. seed-config.mjs
      // refuses to seed a file that exists, and it only runs on a cold start while this runs on
      // resume, clear and compact too, so a member on that path was left for ever with no status,
      // no client, no skills container and no patterns container. Copying the shipped defaults
      // first costs one stat on every later run and leaves the member whole.
      mkdirSync(data, { recursive: true });
      if (!existsSync(cfgPath)) {
        try { copyFileSync(join(root, "defaults", "config.json"), cfgPath); } catch { /* the merge below still writes */ }
      }
      let cfg = {}; try { cfg = JSON.parse(readFileSync(cfgPath, "utf8")); } catch {}
      if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) cfg = {};
      // THE HIGHEST VERSION WE HAVE SEEN, AND IT NEVER GOES BACKWARDS. When we install something
      // ourselves the session keeps running from the OLD folder, so recording what this session
      // opened on would step the number back down, and the member would be told about the same
      // update a second time when they next open Claude Code on the new one. Members cannot
      // downgrade, so a number that only ever climbs is the honest record of "what we last looked
      // at", and it is what makes the line above fire exactly once per update.
      const higher = (a, b) => (!a ? b : !b ? a : semverGt(a, b) ? a : b);
      cfg.autoUpdate = {
        ...(cfg.autoUpdate || {}),
        lastCheckedVersion: higher(higher(installed, lastSeen), appliedVersion),
        lastCheckedAt: now,
      };
      if (appliedVersion) cfg.autoUpdate.lastAppliedVersion = appliedVersion;
      writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
    }
  } catch {}
} catch {}
process.exitCode = 0;
