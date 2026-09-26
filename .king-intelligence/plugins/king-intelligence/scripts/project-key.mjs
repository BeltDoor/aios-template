// project-key.mjs: find a member's key in their second brain folder, never print it.
// Created 09/26/26 - 12:03 EDT.
//
// WHY THIS EXISTS. Since 9/24/26 a keyed member's download carries two files that hold their
// personal key: `.claude/settings.local.json` (the line that turns the toolkit on when the
// folder is trusted) and `.mcp.json` (the Skills Door connection). The hours sender only ever
// looked in Claude Code's own marketplace registry, so on a computer where the toolkit switch
// never registered (a fresh Windows install, 9/25/26) the key sat in the folder, the sender
// found "no member token", and the member's hours never reached their page with nothing
// anywhere saying so.
//
// This module only READS those two files and hands back { token, host, via }. It never writes
// a key anywhere, never logs one, and accepts a key only when it is addressed to the members
// portal, so a folder cannot point a member's numbers at some other server.
//
// Pure apart from the file reads, which go through an injectable reader so the Windows cases
// can be tested on any machine.

import fs from "node:fs";
import path from "node:path";

/** The only host a key found inside a project folder may be used with. */
export const PORTAL_HOST = "members.king-intelligence.com";

/**
 * The key inside a marketplace address, or null. Parsed with URL, never matched by pattern
 * (9/26/26 review: a pattern read https://other.example?x@members.king-intelligence.com/... as a
 * portal address). https only, the exact portal host, no port, path /marketplace.git, nothing
 * after it, one "@", a key-shaped user part and no password.
 */
export function keyFromMarketplaceUrl(url) {
  if (typeof url !== "string") return null;
  const raw = url.trim();
  if (!raw || /\s/.test(raw) || /[?#]/.test(raw) || (raw.match(/@/g) || []).length !== 1) return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" || u.hostname.toLowerCase() !== PORTAL_HOST || u.port !== "") return null;
  if (u.pathname !== "/marketplace.git" || u.password !== "") return null;
  if (!/^[A-Za-z0-9._~-]{6,}$/.test(u.username)) return null;
  return { token: u.username, host: PORTAL_HOST };
}

/** JSON.parse that tolerates the byte-order mark Windows editors put at the top of a file. */
export function parseJsonText(text) {
  try {
    const s = String(text == null ? "" : text).replace(/^﻿/, "");
    const v = JSON.parse(s);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

/**
 * The key inside a `.claude/settings.local.json`, or null.
 * Looks at every extraKnownMarketplaces entry (the starter zip names it "king-intelligence")
 * for a `https://<key>@members.king-intelligence.com/marketplace.git` address.
 */
export function keyFromSettingsLocal(text) {
  const j = parseJsonText(text);
  if (!j) return null;
  const tables = [j.extraKnownMarketplaces, j.knownMarketplaces].filter((t) => t && typeof t === "object");
  for (const table of tables) {
    const names = Object.keys(table).sort((a, b) => (a === "king-intelligence" ? -1 : b === "king-intelligence" ? 1 : 0));
    for (const name of names) {
      const e = table[name];
      const url = e && typeof e === "object" && e.source && typeof e.source === "object" ? e.source.url : null;
      const hit = keyFromMarketplaceUrl(url);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * The key inside a `.mcp.json`, or null.
 * The starter zip writes mcpServers["king-intelligence"] = { url: "https://members.../api/mcp",
 * headers: { Authorization: "Bearer <key>" } }. Any server addressed to the portal counts.
 */
export function keyFromMcpJson(text) {
  const j = parseJsonText(text);
  const servers = j && j.mcpServers && typeof j.mcpServers === "object" ? j.mcpServers : null;
  if (!servers) return null;
  const names = Object.keys(servers).sort((a, b) => (a === "king-intelligence" ? -1 : b === "king-intelligence" ? 1 : 0));
  for (const name of names) {
    const s = servers[name];
    if (!s || typeof s !== "object" || typeof s.url !== "string") continue;
    let host = null;
    try {
      const u = new URL(s.url.trim());
      if (u.protocol !== "https:") continue;
      host = u.hostname.toLowerCase();
    } catch {
      continue;
    }
    if (host !== PORTAL_HOST) continue;
    const headers = s.headers && typeof s.headers === "object" ? s.headers : {};
    const auth = Object.entries(headers).find(([k]) => k.toLowerCase() === "authorization");
    const m = auth && typeof auth[1] === "string" ? auth[1].trim().match(/^Bearer\s+(\S+)$/i) : null;
    if (m) return { token: m[1], host };
  }
  return null;
}

/**
 * The folders to look in, in order, with duplicates and blanks removed.
 * `dirs` is whatever the caller knows: --project-dir, CLAUDE_PROJECT_DIR, the working folder,
 * the folder remembered from an earlier find.
 */
export function candidateDirs(dirs, p = path) {
  const out = [];
  const seen = new Set();
  for (const d of dirs || []) {
    if (typeof d !== "string" || !d.trim()) continue;
    let r;
    try { r = p.resolve(d.trim()); } catch { continue; }
    const key = p === path.win32 ? r.toLowerCase() : r;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/**
 * findProjectKey(dirs, { read, p }) -> { token, host, via, dir } or null
 *
 * `read(file)` returns the file's text or throws; defaults to fs.readFileSync.
 * `p` is the path module; tests pass path.win32 to prove Windows folders resolve.
 * settings.local.json wins over .mcp.json inside the same folder, and an earlier folder wins
 * over a later one.
 */
export function findProjectKey(dirs, opts = {}) {
  const p = opts.p || path;
  const read = opts.read || ((f) => fs.readFileSync(f, "utf8"));
  const tryRead = (f) => { try { return read(f); } catch { return null; } };
  for (const dir of candidateDirs(dirs, p)) {
    const settingsText = tryRead(p.join(dir, ".claude", "settings.local.json"));
    const a = settingsText == null ? null : keyFromSettingsLocal(settingsText);
    if (a) return { ...a, via: "project-settings", dir };
    const mcpText = tryRead(p.join(dir, ".mcp.json"));
    const b = mcpText == null ? null : keyFromMcpJson(mcpText);
    if (b) return { ...b, via: "project-connection", dir };
  }
  return null;
}
