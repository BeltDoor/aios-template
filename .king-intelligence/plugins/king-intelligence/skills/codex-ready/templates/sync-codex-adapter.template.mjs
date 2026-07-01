#!/usr/bin/env node
// sync-codex-adapter.mjs (TEMPLATE shipped by the codex-ready skill)
//
// Keeps a repo's OpenAI Codex adapter in sync with its Claude Code setup so both tools
// run at full power without drift. CLAUDE.md stays the source of truth.
//
// On each run it:
//   1. Generates AGENTS.md = a preamble + (optionally) the same shared rule files CLAUDE.md
//      inlines, since AGENTS.md cannot @import.
//   2. Ensures .agents/skills -> .claude/skills (symlink mirror; .agents/ is gitignored and
//      regenerable, so the skills tree is never duplicated).
//   3. Prints a short status + flags anything out of sync (subagents, hooks).
//
// Idempotent and safe to run repeatedly (e.g. from a session-close ritual). The only files
// it writes are AGENTS.md and the .agents/skills symlink.
//
// ===========================================================================
// CONFIG: the codex-ready skill sets these to match this repo. Adjust if paths move.
// ===========================================================================
const CONFIG = {
  // Preamble source for AGENTS.md (the Codex-facing brief, business identity + voice + security).
  preamble: 'references/operating/codex/AGENTS.preamble.md',
  // OPTIONAL: a directory of shared rule files to inline after the preamble, in this order.
  // Leave ruleFiles empty if this repo has no separate shared-rule files.
  rulesDir: 'references/operating/rules',
  ruleFiles: [], // e.g. ['critical-thinking', 'verify-before-asserting', 'close-the-loop']
  // If a rule file is a client-facing doc with extra packaging, keep only the section under
  // this heading (set to null to inline the whole file).
  canonicalHeading: '## Canonical content',
  stopHeading: '## Merge guidance',
}
// ===========================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync, symlinkSync, lstatSync, readlinkSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = []
const log = (m) => out.push(m)

// --- 1. Generate AGENTS.md -------------------------------------------------
function sectionBody(md) {
  if (!CONFIG.canonicalHeading) return md.trim()
  const start = md.indexOf(CONFIG.canonicalHeading)
  if (start === -1) return md.trim()
  const after = md.slice(start + CONFIG.canonicalHeading.length)
  const end = CONFIG.stopHeading ? after.indexOf(CONFIG.stopHeading) : -1
  return (end === -1 ? after : after.slice(0, end)).trim()
}

const preamblePath = join(ROOT, CONFIG.preamble)
if (!existsSync(preamblePath)) {
  console.error(`FATAL: preamble missing at ${CONFIG.preamble}`)
  process.exit(1)
}
const BANNER = '<!-- GENERATED FILE, do not hand-edit. Regenerate with the sync script. -->\n\n'
let preambleRaw = readFileSync(preamblePath, 'utf8').replace(/^(?:\s*<!--[\s\S]*?-->\s*)+/, '')
let agents = BANNER + preambleRaw.trim() + '\n'
const missing = []
for (const name of CONFIG.ruleFiles) {
  const f = join(ROOT, CONFIG.rulesDir, `${name}.md`)
  if (!existsSync(f)) { missing.push(name); continue }
  agents += `\n${sectionBody(readFileSync(f, 'utf8'))}\n`
}
writeFileSync(join(ROOT, 'AGENTS.md'), agents)
const kb = (Buffer.byteLength(agents, 'utf8') / 1024).toFixed(1)
log(`AGENTS.md written: ${kb} KB, ${agents.split('\n').length} lines (Codex soft cap ~32 KB)`)
if (Buffer.byteLength(agents, 'utf8') > 32 * 1024) log('  WARNING: AGENTS.md over 32 KB, Codex may truncate it.')
if (missing.length) log(`  WARNING: rule files missing: ${missing.join(', ')}`)

// --- 2. Ensure .agents/skills -> .claude/skills ----------------------------
const agentsDir = join(ROOT, '.agents')
const skillsLink = join(agentsDir, 'skills')
const skillsTarget = join(ROOT, '.claude/skills')
const relTarget = relative(agentsDir, skillsTarget)
if (!existsSync(agentsDir)) mkdirSync(agentsDir, { recursive: true })
let exists = false
try { lstatSync(skillsLink); exists = true } catch {}
if (exists) {
  const st = lstatSync(skillsLink)
  if (st.isSymbolicLink()) {
    const cur = readlinkSync(skillsLink)
    log(cur === relTarget ? `.agents/skills symlink OK -> ${relTarget}` : `  NOTE: .agents/skills points at "${cur}", expected "${relTarget}".`)
  } else {
    log('  NOTE: .agents/skills is a real directory, not a symlink. Remove it to enable the no-duplication mirror.')
  }
} else {
  symlinkSync(relTarget, skillsLink)
  log(`.agents/skills symlink created -> ${relTarget}`)
}

// --- 3. Status + drift flags ----------------------------------------------
function countSkills(dir) {
  let n = 0
  for (const e of readdirSync(dir)) {
    try { if (statSync(join(dir, e)).isDirectory() && existsSync(join(dir, e, 'SKILL.md'))) n++ } catch {}
  }
  return n
}
if (existsSync(skillsTarget)) log(`Skills available to Codex: ${countSkills(skillsTarget)} (via .agents/skills)`)
const nClaudeAgents = existsSync(join(ROOT, '.claude/agents')) ? readdirSync(join(ROOT, '.claude/agents')).filter((f) => f.endsWith('.md')).length : 0
const nCodexAgents = existsSync(join(ROOT, '.codex/agents')) ? readdirSync(join(ROOT, '.codex/agents')).filter((f) => f.endsWith('.toml')).length : 0
if (nClaudeAgents !== nCodexAgents) log(`  DRIFT: ${nClaudeAgents} Claude subagents vs ${nCodexAgents} Codex subagents.`)
if (!existsSync(join(ROOT, '.codex/hooks.json'))) log('  DRIFT: no .codex/hooks.json yet (port the guard hooks).')

console.log('Codex adapter sync complete.\n' + out.map((l) => '  ' + l).join('\n'))
