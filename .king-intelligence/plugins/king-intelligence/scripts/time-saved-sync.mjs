#!/usr/bin/env node
// time-saved-sync.mjs — the deterministic core of the Time-Back / "Your Impact" tracker.
//
// It does the math and the phone-home so the /end-session "Time-Back review" never has to
// hand-edit JSON or hand-compute a total. Two jobs:
//   1. record  — fold a CONFIRMED session roll-up (+ harvested catch-a-wins) into the local
//                ledger .claude/time-saved/state.json, recompute everything deterministically.
//   2. send    — POST the full cumulative snapshot up to the members portal using the per-member
//                token already on this machine. Offline => queue and retry next close. Never blocks.
//
// The honest-number rule from time-back-scoreboard applies here too: the HEADLINE total is
// skills (from TIME-SAVED.md) + CONFIRMED ad-hoc roll-ups ONLY. Catch-a-wins are human-asserted
// and ride in wins[] — shown separately, never folded into the headline floor.
//
// Usage (run from the brain root, or pass --repo):
//   node time-saved-sync.mjs record --adhoc-min 150 --summary "..." --session-id <id> --date 06/30/26 \
//        [--wins-json '[{"text":"...","minutes":180}]'] [--tools "email,recall"] [--rate 150] [--send]
//   node time-saved-sync.mjs send                 -> retry sending the current snapshot only
//   node time-saved-sync.mjs send --reset         -> deliberate recalibration: lets the portal ACCEPT a lower total
//   node time-saved-sync.mjs set-rate 150         -> set the member's hourly rate (enables $ value)
//   node time-saved-sync.mjs show                 -> print the current state summary (read-only)
//
// Token / endpoint resolution (first hit wins):
//   token   : --token  | $KI_MEMBER_TOKEN | the token baked into the king-intelligence marketplace URL
//   portal  : --portal | $PORTAL_BASE     | the host from that marketplace URL | members.king-intelligence.com
// A github.com host (a legacy PAT client) or no token => send is a clean no-op; state still records.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ---------- args ----------
const argv = process.argv.slice(2)
const cmd = argv[0]
const flag = (name, def = null) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : def }
const has = (name) => argv.includes(name)
const repo = path.resolve(flag('--repo', process.cwd()))

const STATE_PATH = path.join(repo, '.claude', 'time-saved', 'state.json')
const TS_PATH = path.join(repo, 'TIME-SAVED.md')
// v2 adds per-skill counts (skills: [{slug, uses, minutes_saved}]) to the snapshot.
// Counts only — no session summaries, no free text. The portal accepts v1 unchanged.
const SCHEMA_VERSION = 2
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// ---------- state load / seed ----------
function seedState() {
  let businessName = 'My business'
  try {
    const cl = fs.readFileSync(path.join(repo, 'CLAUDE.md'), 'utf8')
    const m = cl.match(/^#\s+(.+)$/m)
    if (m) businessName = m[1].trim()
  } catch { /* default */ }
  return {
    schemaVersion: SCHEMA_VERSION,
    businessName,
    rate: { amount: null, currency: 'USD' },
    hours: { skillsMinutes: 0, adhocMinutes: 0, totalMinutes: 0 },
    sessions: { count: 0, lastEndedAt: null, weekOrdinals: [], weeksActive: 0, streakWeeksCurrent: 0, streakWeeksBest: 0 },
    toolsAdopted: [],
    milestones: [],
    rollups: [],
    wins: [],
    sendQueue: [],
    lastSync: { at: null, ok: false, lastError: null },
  }
}
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
    const base = seedState()
    return { ...base, ...s, rate: { ...base.rate, ...(s.rate || {}) }, hours: { ...base.hours, ...(s.hours || {}) }, sessions: { ...base.sessions, ...(s.sessions || {}) }, lastSync: { ...base.lastSync, ...(s.lastSync || {}) } }
  } catch { return seedState() }
}
function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true })
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n')
}

// ---------- TIME-SAVED.md skills spine (same honesty rules as scoreboard.mjs) ----------
function skillsFromLedger() {
  if (!fs.existsSync(TS_PATH)) return { minutes: 0, tools: [], rows: [] }
  let minutes = 0
  const tools = []
  const rows = []
  for (const line of fs.readFileSync(TS_PATH, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t.startsWith('|')) continue
    const cells = t.split('|').slice(1, -1).map((c) => c.trim())
    if (cells.length < 4) continue
    const skill = cells[0].replace(/`/g, '').trim()
    if (!skill || /^skill$/i.test(skill) || /^-+$/.test(skill)) continue
    const manualMin = parseInt((cells[1].match(/-?\d+/) || [])[0], 10)
    const uses = parseInt((cells[2].match(/-?\d+/) || [])[0], 10) || 0
    const pending = /pending/i.test(cells[1]) || !(manualMin > 0) || uses <= 0
    if (!pending) {
      minutes += manualMin * uses
      const name = skill.replace(/^\//, '')
      tools.push(name)
      rows.push({ slug: name, uses, minutesSaved: manualMin * uses })
    }
  }
  return { minutes, tools, rows }
}

// ---------- week math (DST-safe, anchored to a known Monday) ----------
const REF_MONDAY = Date.UTC(1970, 0, 5) // 1970-01-05 was a Monday
function weekOrdinal(mmddyy) {
  const m = String(mmddyy || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  let [, mo, d, y] = m
  if (y.length === 2) y = '20' + y
  const t = Date.UTC(Number(y), Number(mo) - 1, Number(d))
  return Math.floor((t - REF_MONDAY) / (7 * 86400000))
}
function streaks(ordinals) {
  const uniq = [...new Set(ordinals)].filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (!uniq.length) return { weeksActive: 0, current: 0, best: 0 }
  let best = 1, run = 1
  for (let i = 1; i < uniq.length; i++) { run = uniq[i] === uniq[i - 1] + 1 ? run + 1 : 1; if (run > best) best = run }
  // current = trailing consecutive run ending at the most recent week
  let current = 1
  for (let i = uniq.length - 1; i > 0; i--) { if (uniq[i] === uniq[i - 1] + 1) current++; else break }
  return { weeksActive: uniq.length, current, best }
}

// ---------- milestones (honest thresholds only) ----------
const THRESHOLDS = [
  { key: 'first_win', label: 'First win', hit: (st) => st.hours.totalMinutes > 0 || st.wins.length > 0 },
  { key: 'hours_10', label: '10 hours saved', hit: (st) => st.hours.totalMinutes >= 600 },
  { key: 'hours_50', label: '50 hours saved', hit: (st) => st.hours.totalMinutes >= 3000 },
  { key: 'hours_100', label: '100 hours saved', hit: (st) => st.hours.totalMinutes >= 6000 },
]
function refreshMilestones(state, dateStr) {
  const have = new Set(state.milestones.map((m) => m.key))
  for (const th of THRESHOLDS) {
    if (!have.has(th.key) && th.hit(state)) state.milestones.push({ key: th.key, label: th.label, achievedAt: dateStr || null })
  }
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32)

// ---------- recompute everything from the parts ----------
function recompute(state, dateStr) {
  const { minutes: skillsMinutes, tools: skillTools } = skillsFromLedger()
  const adhocMinutes = state.rollups.reduce((a, r) => a + (Number(r.confirmedMinutes) > 0 ? Number(r.confirmedMinutes) : 0), 0)
  state.hours = { skillsMinutes, adhocMinutes, totalMinutes: skillsMinutes + adhocMinutes }
  const s = streaks(state.sessions.weekOrdinals)
  state.sessions.weeksActive = s.weeksActive
  state.sessions.streakWeeksCurrent = s.current
  state.sessions.streakWeeksBest = s.best
  state.toolsAdopted = [...new Set([...skillTools, ...(state.toolsAdopted || [])])]
  refreshMilestones(state, dateStr)
}

// ---------- the POST snapshot (the wire contract) ----------
function snapshotOf(state) {
  return {
    schema_version: SCHEMA_VERSION,
    snapshot_at: new Date().toISOString(),
    hours_saved: round2(state.hours.totalMinutes / 60),
    hours_breakdown: { skills: round2(state.hours.skillsMinutes / 60), adhoc: round2(state.hours.adhocMinutes / 60) },
    hourly_rate: state.rate.amount ?? null,
    rate_currency: state.rate.currency || 'USD',
    sessions: state.sessions.count,
    weeks_active: state.sessions.weeksActive,
    streak_weeks_current: state.sessions.streakWeeksCurrent,
    streak_weeks_best: state.sessions.streakWeeksBest,
    tools_adopted: state.toolsAdopted,
    // wire v2: per-skill counts straight from the TIME-SAVED.md ledger (the same
    // honest source the headline minutes come from). Counts only, no free text.
    skills: skillsFromLedger().rows.map((r) => ({
      slug: r.slug, uses: r.uses, minutes_saved: round2(r.minutesSaved),
    })),
    last_active_at: state.sessions.lastEndedAt,
    milestones: state.milestones.map((m) => ({ key: m.key, label: m.label, achieved_at: m.achievedAt })),
    wins: state.wins.map((w) => ({ id: w.id, at: w.at, text: w.text, hours: round2((Number(w.minutes) || 0) / 60) })),
    // --reset marks a DELIBERATE recalibration: the portal's monotonic guard ignores any
    // snapshot that lowers hours_saved unless this is true. Never pass it on a normal close.
    reset: has('--reset'),
  }
}

// ---------- token + endpoint resolution ----------
function resolveTarget() {
  let token = flag('--token', process.env.KI_MEMBER_TOKEN || null)
  let host = null
  if (!token) {
    try {
      const km = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', 'plugins', 'known_marketplaces.json'), 'utf8'))
      // shape: { "king-intelligence": { source: { url: "https://<token>@<host>/marketplace.git" } }, ... } (best-effort)
      const findUrl = (obj) => {
        for (const v of Object.values(obj || {})) {
          if (v && typeof v === 'object') {
            const u = v.source?.url || v.url
            if (typeof u === 'string' && /marketplace\.git/.test(u)) return u
            const nested = findUrl(v)
            if (nested) return nested
          }
        }
        return null
      }
      const url = findUrl(km)
      if (url) {
        const m = url.match(/^https?:\/\/([^@/]+)@([^/]+)\//)
        if (m) { token = m[1]; host = m[2] }
      }
    } catch { /* no marketplace config -> no token */ }
  }
  let portal = flag('--portal', process.env.PORTAL_BASE || null)
  if (!portal) portal = host ? `https://${host}` : 'https://members.king-intelligence.com'
  const isGithub = /github\.com/i.test(host || portal)
  return { token, portal, isGithub }
}

async function send(state) {
  const { token, portal, isGithub } = resolveTarget()
  if (!token || isGithub) {
    state.lastSync = { at: new Date().toISOString(), ok: false, lastError: token ? 'legacy host (not the portal) — kept local' : 'no member token on this machine — kept local' }
    return { sent: false, reason: state.lastSync.lastError }
  }
  const body = JSON.stringify(snapshotOf(state))
  try {
    const res = await fetch(`${portal.replace(/\/$/, '')}/api/time-saved/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body,
    })
    const txt = await res.text()
    if (!res.ok) {
      state.lastSync = { at: new Date().toISOString(), ok: false, lastError: `HTTP ${res.status}` }
      return { sent: false, reason: `HTTP ${res.status} ${txt.slice(0, 140)}` }
    }
    state.lastSync = { at: new Date().toISOString(), ok: true, lastError: null }
    state.sendQueue = []
    let parsed = {}
    try { parsed = JSON.parse(txt) } catch { /* tolerate non-json ok */ }
    return { sent: true, response: parsed }
  } catch (e) {
    state.lastSync = { at: new Date().toISOString(), ok: false, lastError: (e && e.message) || String(e) }
    return { sent: false, reason: state.lastSync.lastError }
  }
}

// ---------- commands ----------
async function doRecord() {
  const state = loadState()
  const dateStr = flag('--date', null)
  const adhocMin = Math.max(0, parseInt(flag('--adhoc-min', '0'), 10) || 0)
  const summary = flag('--summary', '') || ''
  const sessionId = flag('--session-id', null) || `${dateStr || 'session'}-${state.rollups.length + 1}`
  const rollupId = `rollup_${sessionId}`

  // dedup by rollup id => re-running record for the same session UPDATES, never double-counts
  const existing = state.rollups.find((r) => r.id === rollupId)
  const isNewSession = !existing
  const endedAt = new Date().toISOString()
  if (existing) {
    existing.endedAt = endedAt; existing.summary = summary; existing.confirmedMinutes = adhocMin
  } else {
    state.rollups.push({ id: rollupId, endedAt, summary, confirmedMinutes: adhocMin, source: 'session-end' })
  }

  // sessions / weeks: only advance on a genuinely new session
  if (isNewSession) {
    state.sessions.count += 1
    const wk = weekOrdinal(dateStr)
    if (wk !== null && !state.sessions.weekOrdinals.includes(wk)) state.sessions.weekOrdinals.push(wk)
  }
  state.sessions.lastEndedAt = endedAt

  // catch-a-wins harvested from the scratchpad (human-asserted; capped; shown separately)
  const WIN_CAP_MIN = 40 * 60
  let winsJson = []
  try { winsJson = JSON.parse(flag('--wins-json', '[]')) } catch { winsJson = [] }
  for (const w of Array.isArray(winsJson) ? winsJson : []) {
    const text = String(w.text || '').trim()
    if (!text) continue
    const id = w.id || `win_${dateStr || 'd'}_${slug(text)}`
    if (state.wins.some((x) => x.id === id)) continue
    let minutes = Math.max(0, parseInt(w.minutes, 10) || 0)
    if (minutes > WIN_CAP_MIN) minutes = WIN_CAP_MIN // sanity cap on a single asserted win
    state.wins.push({ id, at: endedAt, text, minutes, source: 'catch-a-win' })
  }

  // optional rate set + extra tool/work-type names
  const rate = flag('--rate', null)
  if (rate !== null && rate !== '') { const n = Number(rate); if (Number.isFinite(n) && n >= 0) state.rate.amount = n }
  const tools = flag('--tools', null)
  if (tools) state.toolsAdopted = [...new Set([...(state.toolsAdopted || []), ...tools.split(',').map((t) => t.trim()).filter(Boolean)])]

  recompute(state, dateStr)
  state.sendQueue = [rollupId, ...state.wins.map((w) => w.id)]
  writeState(state)

  let result = { sent: false, reason: 'send not requested' }
  if (has('--send')) result = await send(state)
  writeState(state)

  console.log(JSON.stringify({
    ok: true,
    totalHours: round2(state.hours.totalMinutes / 60),
    skillsHours: round2(state.hours.skillsMinutes / 60),
    adhocHours: round2(state.hours.adhocMinutes / 60),
    dollarValue: state.rate.amount ? Math.round((state.hours.totalMinutes / 60) * state.rate.amount) : null,
    sessions: state.sessions.count,
    weeksActive: state.sessions.weeksActive,
    streakWeeks: state.sessions.streakWeeksCurrent,
    wins: state.wins.length,
    newMilestones: state.milestones.map((m) => m.label),
    send: result,
  }, null, 2))
}

async function doSend() {
  const state = loadState()
  recompute(state, flag('--date', null))
  const result = await send(state)
  writeState(state)
  console.log(JSON.stringify({ ok: true, send: result, lastSync: state.lastSync }, null, 2))
}

function doSetRate() {
  const state = loadState()
  const n = Number(argv[1])
  if (!Number.isFinite(n) || n < 0) { console.error('set-rate needs a non-negative number'); process.exit(1) }
  state.rate.amount = n
  writeState(state)
  console.log(JSON.stringify({ ok: true, rate: state.rate }, null, 2))
}

function doShow() {
  const state = loadState()
  recompute(state, flag('--date', null))
  console.log(JSON.stringify({
    business: state.businessName,
    totalHours: round2(state.hours.totalMinutes / 60),
    breakdown: { skills: round2(state.hours.skillsMinutes / 60), adhoc: round2(state.hours.adhocMinutes / 60) },
    rate: state.rate, sessions: state.sessions, tools: state.toolsAdopted,
    milestones: state.milestones, wins: state.wins.length, lastSync: state.lastSync,
  }, null, 2))
}

try {
  if (cmd === 'record') await doRecord()
  else if (cmd === 'send') await doSend()
  else if (cmd === 'set-rate') doSetRate()
  else if (cmd === 'show') doShow()
  else { console.error('commands: record | send | set-rate <n> | show'); process.exit(2) }
} catch (e) {
  // a state/usage error is a real bug -> surface it. (Network failures are handled inside send() and never reach here.)
  console.error('ERROR: ' + ((e && e.message) || e))
  process.exit(1)
}
