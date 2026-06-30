#!/usr/bin/env node
// scoreboard.mjs — the honest counter behind the Time-Back Scoreboard proof-skill.
//
// It reads ONE source of truth: TIME-SAVED.md at the brain's root. Every row there is a real
// skill that really ran, with a per-task minute baseline the owner set themselves. The scoreboard
// just sums what's already there and renders it — it never invents a number. The headline is
// auditable: every minute traces to a visible row.
//
// Usage (run from the brain's root, or pass --repo):
//   node scoreboard.mjs                       -> render scoreboard.html + print JSON summary
//   node scoreboard.mjs --date 06/17/26       -> stamp today's snapshot with this date (pass from `date`)
//   node scoreboard.mjs --business "Acme Co"  -> put the business name on the scoreboard
//   node scoreboard.mjs --repo /path/to/brain --out scoreboard.html

import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const opt = (flag, def = null) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? args[i + 1] : def }
const repo = path.resolve(opt('--repo', process.cwd()))
const outPath = path.resolve(repo, opt('--out', 'scoreboard.html'))
const business = opt('--business', '')
const today = opt('--date', '') // MM/DD/YY, passed from the shell's `date` so the script never guesses

const tsPath = path.join(repo, 'TIME-SAVED.md')

// ---- parse TIME-SAVED.md (the only input) ----
function parseLedger(file) {
  if (!fs.existsSync(file)) return { rows: [], found: false }
  const rows = []
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t.startsWith('|')) continue
    const cells = t.split('|').slice(1, -1).map((c) => c.trim())
    if (cells.length < 4) continue
    const skill = cells[0].replace(/`/g, '').trim()
    if (!skill || /^skill$/i.test(skill) || /^-+$/.test(skill)) continue // header / separator
    const manualMin = parseInt((cells[1].match(/-?\d+/) || [])[0], 10) // NaN if "(pending...)"
    const uses = parseInt((cells[2].match(/-?\d+/) || [])[0], 10) || 0
    // a non-positive minutes or uses figure is a typo, not real saved time — never let it corrupt the
    // one number the whole guarantee rides on. Treat the row as pending (uncounted) rather than subtract.
    const pending = /pending/i.test(cells[1]) || !(manualMin > 0) || uses <= 0
    const savedMin = pending || !uses ? 0 : manualMin * uses
    rows.push({ skill, manualMin: pending ? null : manualMin, uses, savedMin, pending })
  }
  return { rows, found: true }
}

// ---- growth snapshot history (so the owner sees it climbing, honestly) ----
function updateHistory(repoDir, totalTasks, totalMinutes, dateStr) {
  const dir = path.join(repoDir, '.claude', 'scoreboard')
  const file = path.join(dir, 'history.json')
  let hist = []
  try { hist = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { hist = [] }
  const stamp = dateStr || ''
  const last = hist[hist.length - 1]
  if (last && last.date === stamp) { last.totalTasks = totalTasks; last.totalMinutes = totalMinutes }
  else hist.push({ date: stamp, totalTasks, totalMinutes })
  // the prior snapshot to measure growth against = most recent entry from a different day
  let prior = null
  for (let i = hist.length - 2; i >= 0; i--) { if (hist[i].date !== stamp) { prior = hist[i]; break } }
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(hist, null, 2) + '\n')
  return prior
}

const fmtHM = (min) => {
  min = Math.max(0, min) // the total can never be negative; a bad row is dropped upstream, this is a belt-and-suspenders guard
  const h = Math.floor(min / 60), m = min % 60
  if (h && m) return `${h} hours ${m} minutes`
  if (h) return `${h} hour${h === 1 ? '' : 's'}`
  return `${m} minute${m === 1 ? '' : 's'}`
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const { rows, found } = parseLedger(tsPath)
const counted = rows.filter((r) => !r.pending && r.uses > 0)
const totalTasks = counted.reduce((a, r) => a + r.uses, 0)
const totalMinutes = counted.reduce((a, r) => a + r.savedMin, 0)
const prior = updateHistory(repo, totalTasks, totalMinutes, today)
const deltaTasks = prior ? totalTasks - prior.totalTasks : null
const deltaMinutes = prior ? totalMinutes - prior.totalMinutes : null

// Keep the ledger's own hand-written "Total time saved" footer in sync with the computed total, so
// the owner can never open TIME-SAVED.md and see a number that disagrees with the scoreboard.
function syncLedgerFooter(file, minutes) {
  if (!fs.existsSync(file)) return
  const txt = fs.readFileSync(file, 'utf8')
  const next = txt.replace(/(\*\*Total time saved to date:\*\*).*/i, `$1 ${fmtHM(minutes)}`)
  if (next !== txt) fs.writeFileSync(file, next)
}

// ---- render the artifact ----
const sorted = [...counted].sort((a, b) => b.savedMin - a.savedMin)
const tableRows = sorted.map((r) => `        <tr>
          <td class="skill">${esc(r.skill)}</td>
          <td class="num">${r.uses}</td>
          <td class="num">${r.manualMin} min</td>
          <td class="num strong">${fmtHM(r.savedMin)}</td>
        </tr>`).join('\n')

const empty = totalTasks === 0
const growthLine = prior && deltaMinutes > 0
  ? `<p class="growth">+${esc(fmtHM(deltaMinutes))} and ${deltaTasks} more task${deltaTasks === 1 ? '' : 's'} since ${esc(prior.date)}.</p>`
  : ''

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Time-Back Scoreboard${business ? ' — ' + esc(business) : ''}</title>
<style>
  :root { --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --accent:#0d9488; --bg:#f8fafc; }
  * { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--ink);
    font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  .wrap { max-width:760px; margin:0 auto; padding:48px 24px 64px; }
  .eyebrow { text-transform:uppercase; letter-spacing:.12em; font-size:12px; color:var(--muted); font-weight:700; margin:0 0 8px; }
  h1 { font-size:22px; margin:0 0 28px; font-weight:700; }
  .hero { background:#fff; border:1px solid var(--line); border-radius:16px; padding:36px 32px; text-align:center;
    box-shadow:0 1px 2px rgba(15,23,42,.04); }
  .big { font-size:54px; line-height:1.05; font-weight:800; color:var(--accent); margin:4px 0; letter-spacing:-.01em; }
  .sub { font-size:18px; color:var(--ink); margin:0; }
  .sub b { font-weight:700; }
  .growth { color:var(--accent); font-weight:600; margin:14px 0 0; font-size:15px; }
  table { width:100%; border-collapse:collapse; margin:32px 0 0; background:#fff; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  th,td { padding:12px 16px; text-align:left; border-bottom:1px solid var(--line); }
  th { font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); background:#f1f5f9; }
  td.num,th.num { text-align:right; font-variant-numeric:tabular-nums; }
  td.strong { font-weight:700; color:var(--accent); }
  tr:last-child td { border-bottom:none; }
  .skill { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:14px; }
  .note { color:var(--muted); font-size:13px; margin:24px 4px 0; }
  .empty { background:#fff; border:1px dashed var(--line); border-radius:12px; padding:24px; color:var(--muted); margin-top:28px; }
</style></head>
<body><div class="wrap">
  <p class="eyebrow">Time-Back Scoreboard${business ? ' · ' + esc(business) : ''}</p>
  <h1>Real work your system has done for you</h1>
  <div class="hero">
    <div class="big">${esc(fmtHM(totalMinutes))}</div>
    <p class="sub">saved across <b>${totalTasks}</b> task${totalTasks === 1 ? '' : 's'} your system ran${business ? ' for ' + esc(business) : ''}.</p>
    ${growthLine}
  </div>
${empty ? `  <div class="empty">Nothing is counted yet. The moment your system finishes its first real task, it shows up here, and this number starts climbing on its own.</div>`
        : `  <table>
    <thead><tr><th>Task it runs</th><th class="num">Times run</th><th class="num">Your time each</th><th class="num">Time saved</th></tr></thead>
    <tbody>
${tableRows}
    </tbody>
  </table>`}
  <p class="note">How this is counted: every row is a task your system actually completed. "Your time each" is the minutes you told us it takes you by hand. Times run, your number, that's the whole math. Nothing here is estimated up, and tasks we don't track are not counted, so the real figure is at least this.</p>
</div></body></html>`

fs.writeFileSync(outPath, html)
syncLedgerFooter(tsPath, totalMinutes)

const summary = {
  business: business || null,
  found,
  totalTasks,
  totalMinutes,
  timeSaved: fmtHM(totalMinutes),
  perSkill: sorted.map((r) => ({ skill: r.skill, uses: r.uses, manualMin: r.manualMin, savedMin: r.savedMin })),
  since: prior ? prior.date : null,
  deltaTasks,
  deltaMinutes,
  htmlPath: outPath,
  headline: empty
    ? 'Nothing counted yet — your scoreboard starts climbing the moment your first task runs.'
    : `Your system has done ${totalTasks} tasks and saved you ${fmtHM(totalMinutes)} so far.`,
}
console.log(JSON.stringify(summary, null, 2))
