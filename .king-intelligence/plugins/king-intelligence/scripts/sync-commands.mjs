#!/usr/bin/env node
/**
 * sync-commands.mjs — keeps the member's typed slash commands in step with the
 * Skills Door (the members-portal MCP server that now serves every skill).
 *
 * On each throttled session start, a machine connected to the door (a project
 * .mcp.json naming members.king-intelligence.com/api/mcp) asks the door for the
 * live skill list and mirrors it into .claude/commands/ as one stub per skill:
 * new skill published -> stub appears; skill retired -> stub removed;
 * membership ended -> the door lists nothing -> the stubs empty themselves.
 * Nothing is maintained by hand, which is the only kind of feature that lives.
 *
 * Discipline (same as backup.mjs): hard gates first, swallow every error,
 * ALWAYS exit 0 — a stub problem must never break a member's session. Only
 * stubs this script created (tracked in .claude/commands/.ki-stubs.json) are
 * ever touched; a member's own command files are invisible to it.
 *
 * That last sentence was FALSE for the write path until 8/27/26, and it is worth
 * saying so here rather than quietly correcting it: only deletes respected it, while
 * writes were unconditional, so a member who had built their own /email command lost
 * it the first time this ran. A comment claiming a safety that the code does not have
 * is worse than no comment, because it stops anyone looking.
 *
 * A successful HTTP answer is the only thing that changes anything. Network
 * errors, timeouts, 5xx and 401 all do NOTHING (the never-mass-delete rule:
 * an outage must not strip a paying member's commands).
 *
 * WIRED WITHOUT A SessionStart MATCHER ON PURPOSE (8/27/26). The four session
 * sources are startup, resume, clear and compact (confirmed in the claude
 * binary's own strings). Matched to "startup" alone, a member who lives in
 * resumed sessions would never pick up a newly published skill's command. The
 * 1h throttle makes the extra firings free no-ops.
 */

import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DOOR_HOST = "members.king-intelligence.com";
const DOOR_PATH = "/api/mcp";
// Overridable ONLY so the two paths that matter can be drilled against a fake door: a
// membership that has genuinely ENDED (the door answers with an empty list and the stubs
// must empty themselves) and a door that cannot be reached (nothing may be touched). Both
// are destructive-looking behaviours that must never be trusted on reasoning alone, and
// neither can be triggered against production without revoking a real member. A machine
// where someone can already set environment variables is a machine they already own, so
// this adds no exposure. Unset in normal use.
const DOOR_BASE = process.env.KI_DOOR_URL || `https://${DOOR_HOST}${DOOR_PATH}`;
const THROTTLE_MS = 60 * 60 * 1000; // 1h
const STATE_REL = join(".claude", "commands", ".ki-stubs.json");

function doorToken(root) {
  try {
    const cfg = JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8"));
    for (const server of Object.values(cfg?.mcpServers ?? {})) {
      const url = String(server?.url ?? "");
      if (!url.includes(DOOR_HOST + DOOR_PATH)) continue;
      const auth = String(server?.headers?.Authorization ?? "");
      const m = auth.match(/^Bearer\s+(.+)$/i);
      if (m) return m[1].trim();
    }
  } catch {}
  return null;
}

/** The member's own switched-off list, from the plugin's settings file. */
function readDisabledSkills() {
  try {
    const data = process.env.CLAUDE_PLUGIN_DATA;
    if (!data) return new Set();
    const cfg = JSON.parse(readFileSync(join(data, "config.json"), "utf8"));
    const list = Array.isArray(cfg.disabledSkills) ? cfg.disabledSkills : [];
    return new Set(list.filter((n) => typeof n === "string" && /^[a-z0-9][a-z0-9-]*$/i.test(n)));
  } catch {
    return new Set();
  }
}

function readState(root) {
  try {
    const s = JSON.parse(readFileSync(join(root, STATE_REL), "utf8"));
    return { lastSync: Number(s.lastSync) || 0, managed: Array.isArray(s.managed) ? s.managed : [] };
  } catch {
    return { lastSync: 0, managed: [] };
  }
}

function sanitize(text) {
  const s = String(text)
    .replace(/—/g, ",")
    // An em-dash becomes a comma, which leaves " , " floating mid-sentence, and a
    // description wrapped in quotes in its own frontmatter arrives with them attached.
    // Both are visible to a member in their own command menu, so both go.
    .replace(/\s+([,;:])/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/^["']+|["']+$/g, "")
    .trim();
  if (!s) return s;

  // A skill's own description is written for the MODEL: one plain sentence saying what
  // the skill does, then a pile of trigger phrases ("Invoke when the user says..."). A
  // member sees this text in their own slash menu, so give them the sentence and leave
  // the triggers out. Before 8/27/26 this simply cut at 220 characters, and every one of
  // the 40 commands ended mid-clause: "...when you", "...invoices,", "...before". Forty
  // dangling fragments reads as broken software.
  const firstSentence = (s.match(/^.*?[.!?](?=\s|$)/) || [])[0]?.trim();
  if (firstSentence && firstSentence.length >= 30 && firstSentence.length <= 220) {
    return firstSentence;
  }

  // No usable sentence (one long run-on, or a very short fragment). Fall back to a word
  // boundary and finish with an ellipsis, so a cut LOOKS like a cut rather than like the
  // sentence simply stopping.
  if (s.length > 220) {
    const cut = s.slice(0, 220).lastIndexOf(" ");
    return (cut > 80 ? s.slice(0, cut) : s.slice(0, 220)).replace(/[,;:]$/, "") + "...";
  }
  return s;
}

function stubBody(name, description) {
  const desc = sanitize(description) || `The King Intelligence ${name} skill.`;
  return [
    "---",
    `description: ${JSON.stringify(desc)}`,
    "---",
    "",
    `Call the king-intelligence MCP tool use_skill with name "${name}" and follow the returned instructions exactly for the rest of this conversation. If it returns a message about membership instead, relay it to me and stop. If the king-intelligence tool is not available at all, do not guess at what this command does: tell me my toolkit connection needs refreshing, that the fresh block is on my Your System page at members.king-intelligence.com/system, and stop. My input: $ARGUMENTS`,
    "",
  ].join("\n");
}

async function fetchSkillList(token) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(DOOR_BASE, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "prompts/list" }),
      signal: ctrl.signal,
    });
    if (res.status !== 200) return null; // 401 / 5xx / anything odd = could not check = do nothing
    const body = await res.json();
    const prompts = body?.result?.prompts;
    return Array.isArray(prompts) ? prompts : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * ZERO-TOUCH MIGRATION (8/27/26). An existing member's machine already holds a
 * working portal token: it is baked into the marketplace URL the plugin
 * installs from. So a member who has never seen the connect block does not need
 * to paste anything, and Jacob does not need a migration wave. If this folder is
 * a real managed second brain and the machine's own token answers the door, the
 * hook writes the .mcp.json itself.
 *
 * Three hard gates, in order, and all three must hold:
 *   1. the second-brain trio must exist here (the same gate backup.mjs uses), so
 *      a .mcp.json can never land in some unrelated folder;
 *   2. the token must be portal-shaped (a GitHub-PAT or free-starter machine has
 *      none, and is left alone exactly as the kill switch leaves it);
 *   3. the door must ANSWER for that token first. A dead or revoked token never
 *      gets written to disk, so this can never plant a broken connection.
 * An existing .mcp.json is MERGED, never overwritten: other servers survive, and
 * a server already named king-intelligence is left exactly as the member has it.
 *
 * Honest limit: Claude Code asks the member once whether to trust a project MCP
 * server, so the first session after this writes still needs one click from them.
 */
function machineToken() {
  try {
    const km = JSON.parse(
      readFileSync(join(homedir(), ".claude", "plugins", "known_marketplaces.json"), "utf8")
    );
    const url = km?.["king-intelligence"]?.source?.url || "";
    const m = url.match(/^https:\/\/([^@/]+)@members\.king-intelligence\.com\/marketplace\.git$/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function isManagedBrain(root) {
  return ["CLAUDE.md", "SKILLS.md", "CONNECTIONS.md"].every((f) =>
    existsSync(join(root, f))
  );
}

/** Add our server to .mcp.json without disturbing anything already in it. */
function writeConnection(root, token) {
  const path = join(root, ".mcp.json");
  let cfg = {};
  try {
    if (existsSync(path)) cfg = JSON.parse(readFileSync(path, "utf8")) || {};
  } catch {
    return false; // unreadable or not JSON: never clobber a file we cannot parse
  }
  if (!cfg.mcpServers || typeof cfg.mcpServers !== "object") cfg.mcpServers = {};
  if (cfg.mcpServers["king-intelligence"]) return false; // member already has one
  cfg.mcpServers["king-intelligence"] = {
    type: "http",
    url: `https://${DOOR_HOST}${DOOR_PATH}`,
    headers: { Authorization: `Bearer ${token}` },
  };
  try {
    writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}

/**
 * THE ONE MEMBER THIS CANNOT HELP, TOLD PLAINLY (8/27/26).
 *
 * A machine on the legacy GitHub lane pulls the plugin straight from GitHub and has no
 * portal token anywhere on it, so there is nothing here to connect them with. From
 * v0.47.0 the plugin carries no skills, so on that machine every skill simply stops,
 * with no error and nothing to read. At least one paying member is on that lane.
 *
 * Nothing in this script can fix that, and pretending otherwise would be worse. What it
 * can do is refuse to let it happen in silence: say what changed, in one plain sentence,
 * with the one thing that fixes it. Said ONCE and then never again, because a message
 * that repeats every session is a message people learn to scroll past.
 */
function noticeOnce(root, text) {
  const marker = join(root, ".claude", "commands", ".ki-door-notice");
  try {
    if (existsSync(marker)) return;
    mkdirSync(join(root, ".claude", "commands"), { recursive: true });
    writeFileSync(marker, new Date().toISOString());
  } catch {
    return; // cannot remember having said it, so do not say it
  }
  try {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text },
      })
    );
  } catch {}
}

/** Is this machine on the old GitHub lane rather than the membership one? */
function onLegacyGitHubLane() {
  try {
    const km = JSON.parse(
      readFileSync(join(homedir(), ".claude", "plugins", "known_marketplaces.json"), "utf8")
    );
    const url = String(km?.["king-intelligence"]?.source?.url || "");
    return url.includes("github.com") && !url.includes("members.king-intelligence.com");
  } catch {
    return false;
  }
}

async function main() {
  const root = process.cwd();

  // Gate 1: this project is connected to the door. No token = do nothing, even if
  // stubs were managed here before: without a token we cannot ASK the door what is
  // current, and deleting on a guess would break the never-mass-delete rule. A
  // deliberately disconnected folder keeps its last stubs (harmless dead commands).
  let token = doorToken(root);
  const state = readState(root);

  if (!token && isManagedBrain(root)) {
    // Not connected yet, but this IS a second brain: try the machine's own token.
    const own = machineToken();
    if (own && (await fetchSkillList(own)) !== null) {
      if (writeConnection(root, own)) token = own;
    }
  }
  if (!token) {
    // Nothing to connect them with. If this is a real second brain on the old GitHub
    // lane, their skills have just stopped and they deserve to be told why.
    if (isManagedBrain(root) && onLegacyGitHubLane()) {
      noticeOnce(
        root,
        "Tell the user, once, in plain words: their King Intelligence skills now come from " +
          "their membership rather than being installed on this computer, and this computer is " +
          "still set up the old way, so the skills have stopped working here. The fix takes a " +
          "minute: open https://members.king-intelligence.com/system, copy the connection block " +
          "shown there, and ask Claude to save it as .mcp.json in this folder. Do not attempt " +
          "the fix without them."
      );
    }
    return; // not on the door: never write into an unrelated folder
  }

  // Gate 2: throttle.
  if (Date.now() - state.lastSync < THROTTLE_MS) return;

  const prompts = await fetchSkillList(token);
  if (prompts === null) return; // could not check: change nothing

  const dir = join(root, ".claude", "commands");
  mkdirSync(dir, { recursive: true });

  // A skill the member has turned OFF (8/27/26). `disabledSkills` used to work by
  // deleting the skill's folder from the installed plugin, and from v0.47.0 there is no
  // folder, so the preference would have stopped meaning anything without erroring and
  // without anyone finding out: a member who deliberately removed a skill would see it
  // come back. Honoured here instead, where the member's own settings already live: no
  // stub is written, so the command disappears from their menu, which is what "off" has
  // always meant to them. Honest limit, and it was true of the old way too: this hides
  // the command, it cannot stop a model calling the skill by name.
  const disabled = readDisabledSkills();

  // What this script already owns, so it can tell its own files from the member's.
  const tracked = new Set(state.managed);
  const kept = [];

  const desired = new Set();
  for (const p of prompts) {
    const name = String(p?.name ?? "");
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) continue;
    if (disabled.has(name)) continue;
    desired.add(name);
    const file = join(dir, `${name}.md`);
    const body = stubBody(name, p?.description ?? "");
    try {
      // NEVER overwrite a file this script did not create (8/27/26). The rule was already
      // written at the top of this file and was only true of the DELETE path: the write
      // was unconditional, so a member who had built their own /email command lost it the
      // first time this ran. Members are actively encouraged to build their own tools, and
      // a name collision with one of 40 skills is not a remote possibility.
      //
      // Ours to replace: a file we are already tracking, or one that is not there yet.
      // Anything else is theirs, and it stays, and their name wins in their own menu.
      const ours = tracked.has(name) || !existsSync(file);
      if (!ours) { kept.push(name); continue; }
      if (!existsSync(file) || readFileSync(file, "utf8") !== body) writeFileSync(file, body);
    } catch {}
  }

  // Remove only stubs WE created that the door no longer lists.
  for (const name of state.managed) {
    if (desired.has(name)) continue;
    try { unlinkSync(join(dir, `${name}.md`)); } catch {}
  }

  // A name we left alone is NOT ours, so it must not enter the tracked list: doing so
  // would make the next run believe it owns the member's file and overwrite it after all.
  const owned = [...desired].filter((n) => !kept.includes(n)).sort();
  try {
    writeFileSync(join(root, STATE_REL), JSON.stringify({ lastSync: Date.now(), managed: owned }, null, 2));
  } catch {}
}

main().catch(() => {}).finally(() => process.exit(0));
