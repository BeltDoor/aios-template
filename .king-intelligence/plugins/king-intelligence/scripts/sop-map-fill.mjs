#!/usr/bin/env node
// sop-map-fill: writes a member's own answers into a copy of the SOP map template.
// It replaces only the data blocks (STEPS, SOPS, SOP_ART) and the page labels; the page's
// design and code stay exactly as they are.
//
//   node sop-map-fill.mjs --answers sop-map/answers.json --out sop-map/sop-map.html [--template <file>]
//   node sop-map-fill.mjs --check-answers sop-map/answers.json      (validate only, write nothing)
//
// Exit 0: written (or valid). Exit 1: the answers break a rule the page needs; every problem is listed.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null }
const answersPath = opt('--answers') || opt('--check-answers')
const checkOnly = args.includes('--check-answers')
const outPath = opt('--out')
if (!answersPath || (!checkOnly && !outPath)) {
  console.error('usage: sop-map-fill.mjs --answers <answers.json> --out <sop-map.html> [--template <file>]')
  process.exit(1)
}

function findTemplate() {
  const tries = [opt('--template'), path.join(here, 'sop-map-template.html'), path.join(here, '..', 'assets', 'sop-map-template.html')].filter(Boolean)
  for (const t of tries) if (fs.existsSync(t)) return t
  console.error('No template found. Looked in:\n  ' + tries.join('\n  '))
  process.exit(1)
}

const A = JSON.parse(fs.readFileSync(answersPath, 'utf8'))
const problems = [], warnings = []
const bad = (m) => problems.push(m)

// ---------- every string the member will read ----------
const SAMPLE = /sample/i
const DASH = /[\u2014\u2013]/
function walkText(v, where, fn) {
  if (typeof v === 'string') return fn(v, where)
  if (Array.isArray(v)) return v.forEach((x, i) => walkText(x, where + '[' + i + ']', fn))
  if (v && typeof v === 'object') for (const k of Object.keys(v)) { if (k !== 'logo') walkText(v[k], where + '.' + k, fn) }
}
const textCheck = (s, where) => {
  if (SAMPLE.test(s)) bad(where + ' still says "sample": write the real thing or drop the line ("' + s + '")')
  if (DASH.test(s)) bad(where + ' has a long dash: use a comma, a period or a colon ("' + s + '")')
}

// ---------- the boxes ----------
const steps = Array.isArray(A.steps) ? A.steps : []
const WHO_BOX = new Set(['crown', 'robot', 'them'])
const ids = new Set(steps.map((s) => s.id))
const tops = steps.filter((s) => s.kind === 'top')
const lows = steps.filter((s) => s.kind === 'low')
if (tops.length !== 10) bad('the gold line needs exactly 10 boxes (6 that win the customer, then 4 that look after them); it has ' + tops.length)
tops.forEach((s, i) => {
  if (s.id !== 't' + (i + 1)) bad('gold box ' + (i + 1) + ' must have id t' + (i + 1) + ' (has ' + s.id + ')')
  if (s.col !== i + 1 || s.row !== 1) bad(s.id + ' must sit at col ' + (i + 1) + ', row 1')
})
const cells = new Map()
for (const s of steps) {
  const where = 'box ' + (s.id || '?')
  if (!['top', 'low'].includes(s.kind)) bad(where + ': kind must be "top" or "low"')
  for (const k of ['title', 'short', 'say', 'next', 'whoText', 'board']) if (!s[k] || typeof s[k] !== 'string') bad(where + ': missing ' + k)
  if (!Array.isArray(s.who) || !s.who.length || s.who.some((w) => !WHO_BOX.has(w))) bad(where + ': who must list crown (the owner), robot (Claude) or them')
  if (s.kind === 'low') {
    if (!/^b\d+$/.test(s.id)) bad(where + ': a drop-down box id is b1, b2, ...')
    if (!(s.row >= 2 && s.row <= 4)) bad(where + ': a drop-down box sits on row 2, 3 or 4')
    if (!(s.col >= 1 && s.col <= 10)) bad(where + ': col must be 1 to 10')
    if (!s.parent || !ids.has(s.parent)) bad(where + ': parent must be the id of the box it drops from')
    if (!s.label) bad(where + ': label (the words on the arrow down, like "No reply") is missing')
    const par = steps.find((x) => x.id === s.parent)
    if (par && s.col !== par.col + 1) bad(where + ': a drop-down box sits one column right of the box it drops from (' + s.parent + ' is col ' + par.col + ', so col ' + (par.col + 1) + ')')
    if (s.rise && s.rise.to !== 't' + s.col) bad(where + ': its way back up goes to the gold box straight above it (t' + s.col + ')')
  }
  if (s.rise && !(s.rise.to && /^t\d+$/.test(s.rise.to) && ids.has(s.rise.to) && s.rise.label)) bad(where + ': rise needs { to: a gold box id, label }')
  const cell = s.col + ':' + s.row
  if (cells.has(cell)) bad(where + ' and ' + cells.get(cell) + ' sit in the same spot (col ' + s.col + ', row ' + s.row + ')')
  cells.set(cell, s.id)
  for (const k of ['say', 'next']) if (s[k] && s[k].split(/\s+/).length > 18) warnings.push(where + ': ' + k + ' is over 18 words, it will crowd the panel')
  if (s.title && s.title.length > 40) warnings.push(where + ': title is long for a box (' + s.title.length + ' letters)')
  if (s.ways && !(Array.isArray(s.ways) && s.ways.every((w) => Array.isArray(w) && typeof w[0] === 'string' && typeof w[1] === 'number'))) bad(where + ': ways must be [["Referral", 12], ...] with real counts, or left out')
  walkText(s, where, textCheck)
}
if (!lows.some((s) => s.id === 'b3')) bad('one drop-down box must have id b3: the page lines up its big background words on it, so give b3 to the lowest drop-down box')

// ---------- the SOPs ----------
const tmplPath = findTemplate()
const html = tmplPath ? fs.readFileSync(tmplPath, 'utf8') : ''
const artLine = html.match(/^const SOP_ART = (\{.*\});$/m)
const baseArt = artLine ? JSON.parse(artLine[1]) : {}
const art = { ...baseArt, ...(A.art || {}) }
// A neutral mark for a tool that has no logo here: never a logo the member does not use.
art.tool = art.tool || 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="5" y="5" width="22" height="22" rx="5" fill="none" stroke="#9A988F" stroke-width="2"/><path d="M11 13h10M11 17h10M11 21h6" stroke="#9A988F" stroke-width="2" stroke-linecap="round"/></svg>')

const sops = A.sops && typeof A.sops === 'object' ? A.sops : {}
const WHO_STEP = new Set(['claude', 'owner', 'them'])
const STATE = new Set(['runs', 'part', 'new'])
const usedArt = new Set(['claude'])
for (const t of tops) if (!sops[t.id] || !sops[t.id].length) bad('gold box ' + t.id + ' (' + t.title + ') has no SOP yet')
for (const [boxId, list] of Object.entries(sops)) {
  if (!ids.has(boxId)) { bad('SOPs listed for ' + boxId + ', which is not a box'); continue }
  list.forEach((sop, n) => {
    const where = 'SOP ' + boxId + '#' + (n + 1)
    sop.box = boxId; sop.order = n + 1
    if (!sop.status || sop.status === 'sample') sop.status = 'written'
    walkText(sop, where, textCheck)
    if (!sop.title) bad(where + ': missing title')
    if (sop.status === 'not written') return
    for (const k of ['purpose', 'starts', 'check', 'handsOff', 'ifWrong']) if (!Array.isArray(sop[k]) || !sop[k].length) bad(where + ': ' + k + ' needs at least one line')
    if (!sop.who || !(sop.who.claude || sop.who.owner)) bad(where + ': who needs a claude list, an owner list, or both')
    if (!Array.isArray(sop.tools) || !sop.tools.length) bad(where + ': tools needs at least one tool')
    const toolLogos = new Set()
    for (const tool of sop.tools || []) {
      if (!tool.name) bad(where + ': a tool has no name')
      if (!tool.logo) tool.logo = 'tool'
      if (!art[tool.logo]) bad(where + ': no logo "' + tool.logo + '" (known: ' + Object.keys(art).join(', ') + '); leave logo out to use the plain mark')
      toolLogos.add(tool.logo)
      // toolPart draws every tool but Gmail as <img src>, so a logo kept as raw svg markup (Google Calendar) needs an image copy
      if (art[tool.logo] && art[tool.logo].trim().startsWith('<') && tool.logo !== 'gmail') {
        const img = tool.logo + 'Img'
        art[img] = art[img] || 'data:image/svg+xml;utf8,' + encodeURIComponent(art[tool.logo].replace(/<!--[\s\S]*?-->/g, '').trim())
        tool.logo = img
      }
      usedArt.add(tool.logo)
      if (tool.logo === 'gmail') usedArt.add('gmailBig')
    }
    if (!Array.isArray(sop.steps) || !sop.steps.length) bad(where + ': needs its steps, top to bottom')
    ;(sop.steps || []).forEach((st, k) => {
      const w = where + ' step ' + (k + 1)
      if (!st.do || !st.when) bad(w + ': needs do and when')
      if (!WHO_STEP.has(st.who)) bad(w + ': who must be claude, owner or them')
      if (!STATE.has(st.state)) bad(w + ': state must be runs (works today), part (partly) or new (not done yet)')
      const x = st.ex
      if (!x) return
      if ((x.kind === 'mail' || x.kind === 'draft') && !toolLogos.has('gmail')) bad(w + ': a mail or draft example shows the Gmail logo, so it only fits an SOP whose tools include Gmail (use a gap or card example, or none)')
      if (x.kind === 'cal' && !toolLogos.has('gcal')) bad(w + ': a calendar example shows the Google Calendar logo, so it only fits an SOP whose tools include Google Calendar')
      if (x.kind === 'mail' || x.kind === 'draft') usedArt.add('gmail')
      if (x.kind === 'cal') usedArt.add('gcal')
      if (x.kind === 'card' && !x.logo) x.logo = art.crm || art.tool
      if (!['mail', 'draft', 'gap', 'cal', 'card'].includes(x.kind)) bad(w + ': example kind must be mail, draft, gap, cal or card')
    })
  })
}

const business = (A.business || '').trim()
if (!business) bad('business (the name on the page) is missing')
walkText({ business, title: A.title || '', lede: A.lede || '' }, 'page', textCheck)

for (const w of warnings) console.log('NOTE: ' + w)
if (problems.length) {
  console.error('NOT WRITTEN. ' + problems.length + ' thing(s) to fix first:')
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
if (checkOnly) { console.log('ANSWERS OK: ' + steps.length + ' boxes, ' + Object.values(sops).flat().length + ' SOPs'); process.exit(0) }

// ---------- write the copy ----------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function escAll(v, key) {
  if (typeof v === 'string') return key === 'logo' ? v : esc(v)
  if (Array.isArray(v)) return v.map((x) => escAll(x))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, escAll(x, k)]))
  return v
}
const keptArt = Object.fromEntries(Object.entries(art).filter(([k]) => usedArt.has(k)))
const jsJson = (v) => JSON.stringify(v).replace(/<\/(script)/gi, '<\\/$1')

let out = html
const swap = (re, to, name) => { if (!re.test(out)) { console.error('Template changed shape: cannot find ' + name); process.exit(1) } out = out.replace(re, () => to) }
swap(/^const SOPS = \{.*\};$/m, 'const SOPS = ' + jsJson(escAll(sops)) + ';', 'the SOPS block')
swap(/^const SOP_ART = \{.*\};$/m, 'const SOP_ART = ' + jsJson(keptArt) + ';', 'the SOP_ART block')
swap(/^const STEPS = \[[\s\S]*?^\];$/m, 'const STEPS = ' + JSON.stringify(escAll(steps), null, 1).replace(/<\/(script)/gi, '<\\/$1') + ';', 'the STEPS block')
const name = esc(business)
swap(/<!-- SOP map template\.[^\n]*-->|<!-- Blank template[^\n]*-->/, '<!-- ' + name.replace(/--/g, '-') + ': business map, made with the sop-map skill. -->', 'the top note')
swap(/<title>[^<]*<\/title>/, '<title>' + name + ' business map</title>', 'the page title')
swap(/<h1>[^<]*<\/h1>/, '<h1>' + esc(A.title || business + ': how the business runs') + '</h1>', 'the heading')
swap(/<p class="lede">[\s\S]*?<\/p>/, '<p class="lede">The gold line is everything going perfectly. Anything else drops down.<br><b>' + esc(A.lede || 'Tap a box to see who does it, then open its SOPs.') + '</b></p>', 'the lede')

// ---------- prove the copy carries no template wording ----------
const visible = out.replace(/data:[a-z/+.-]+;base64,[A-Za-z0-9+/=]+/g, '').replace(/data:image\/svg\+xml;utf8,[^"']+/g, '')
const left = visible.match(/[^\n]{0,40}sample[^\n]{0,40}/gi) || []
if (left.length) { console.error('Written copy still holds "sample":\n  ' + left.join('\n  ')); process.exit(1) }
fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true })
fs.writeFileSync(outPath, out)
console.log('WROTE ' + outPath + ': ' + steps.length + ' boxes (' + tops.length + ' gold, ' + lows.length + ' drop-down), ' + Object.values(sops).flat().length + ' SOPs, logos kept: ' + [...usedArt].join(', '))
