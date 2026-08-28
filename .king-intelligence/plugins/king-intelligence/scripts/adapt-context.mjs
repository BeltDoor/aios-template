#!/usr/bin/env node
// Print everything /king-intelligence:adapt needs in one shot: the config path to write to,
// the client's current config, and every shipped skill's swap-point manifest.
// Runs identically on any OS/shell. Usage: node adapt-context.mjs [rootDir] [dataDir]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const root = process.argv[2] || process.env.CLAUDE_PLUGIN_ROOT || ".";
const data = process.argv[3] || process.env.CLAUDE_PLUGIN_DATA || ".";
const cfgPath = join(data, "config.json");

console.log("CONFIG_PATH=" + cfgPath);
console.log("--- CURRENT CONFIG ---");
try {
  console.log(readFileSync(cfgPath, "utf8"));
} catch {
  console.log(JSON.stringify({ _status: "NOT_CONFIGURED", client: null, skills: {} }));
}

/**
 * Where the swap points come from (8/27/26). They used to sit beside each skill on
 * disk. From v0.47.0 the plugin ships no skills, so /adapt would have had nothing to
 * read and would simply have printed "could not list skills": not an error anyone
 * would chase, just a command that quietly stopped working. Four skills still carry
 * real swap points (email, content-unit, install-dictation and the adapt demo), so
 * this is live, not vestigial.
 *
 * So it asks the door, using the machine's own membership key, exactly as the rest of
 * the toolkit does. On-disk skills are still read first when they exist, which keeps
 * this working unchanged on a machine that has not updated yet.
 */
const DOOR = "https://members.king-intelligence.com/api/mcp";

function memberToken() {
  try {
    const km = JSON.parse(readFileSync(join(homedir(), ".claude", "plugins", "known_marketplaces.json"), "utf8"));
    const url = km?.["king-intelligence"]?.source?.url || "";
    const m = url.match(/^https:\/\/([^@/]+)@members\.king-intelligence\.com/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

async function door(method, params, token, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(DOOR, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: ctrl.signal,
    });
    if (res.status !== 200) return null;
    return await res.json();
  } catch { return null; } finally { clearTimeout(t); }
}

console.log("--- AVAILABLE SKILLS + SWAP POINTS ---");

let printedFromDisk = false;
try {
  const names = readdirSync(join(root, "skills"));
  if (names.length) {
    for (const name of names) {
      const sp = join(root, "skills", name, "swap-points.json");
      console.log("### " + name);
      console.log(existsSync(sp) ? readFileSync(sp, "utf8") : '{"swapPoints":[]}');
    }
    printedFromDisk = true;
  }
} catch { /* no skills on disk: the door path below is the normal case now */ }

if (!printedFromDisk) {
  const token = memberToken();
  if (!token) {
    console.log("(no membership connection on this computer, so there are no skills to adapt)");
  } else {
    const listed = await door("tools/call", { name: "list_skills", arguments: {} }, token);
    let skills = [];
    try { skills = JSON.parse(listed.result.content[0].text); } catch { skills = []; }
    if (!skills.length) {
      console.log("(could not reach your skills just now, nothing was changed)");
    } else {
      const results = await Promise.all(
        skills.map(async (s) => {
          const r = await door("tools/call", { name: "get_skill_file", arguments: { name: s.name, path: "swap-points.json" } }, token);
          const text = r?.result?.content?.[0]?.text;
          const missing = r?.result?.isError || !text;
          return { name: s.name, body: missing ? '{"swapPoints":[]}' : text };
        })
      );
      for (const r of results) {
        console.log("### " + r.name);
        console.log(r.body);
      }
    }
  }
}
