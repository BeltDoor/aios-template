#!/usr/bin/env node
// reconcile.mjs — deterministic two-sided reconciliation for the Reconcile half of
// /ask-your-business-anything. The matching is done in code, NOT by the model, so a match is
// only ever claimed when an exact amount lines up inside a date window. Anything that does not
// line up — or that lines up only loosely (a few days apart, or with no usable date) — is FLAGGED
// for a human, never quietly netted away or guessed.
//
// The model's job is the extraction: read whatever the owner provides (bank statement, Stripe
// payouts, PO list, expense export) and write two normalized JSON files. Then this script matches.
//
// Usage:
//   node reconcile.mjs <moneyIn.json> <expected.json> [--window 7] [--out reconciliation.md]
//
// moneyIn.json  : [{ "date":"MM/DD/YY", "amount":1250.00, "label":"STRIPE TRANSFER ..." }]   (deposits / payouts actually received)
// expected.json : [{ "id":"INV-1042", "who":"Acme Co", "amount":1250.00, "date":"MM/DD/YY" }]  (invoices marked paid, POs due, etc.)

import fs from 'node:fs'
import path from 'node:path'

const a = process.argv.slice(2)
const opt = (f, d) => { const i = a.indexOf(f); return i >= 0 && a[i + 1] ? a[i + 1] : d }
const files = a.filter((x) => !x.startsWith('--') && !/^\d+$/.test(x))
const [moneyInPath, expectedPath] = files
if (!moneyInPath || !expectedPath) { console.error('usage: reconcile.mjs <moneyIn.json> <expected.json> [--window 7] [--out reconciliation.md]'); process.exit(2) }
const windowDays = parseInt(opt('--window', '7'), 10)
const looseDays = 2 // a match more than this many days apart is real but worth a human confirm
const outPath = path.resolve(opt('--out', 'reconciliation.md'))

const load = (p) => JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'))
const cents = (n) => Math.round(Number(n) * 100)
const money = (c) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// MM/DD/YY -> day number (no TZ math, just for proximity + ordering). NaN if unparseable.
const day = (s) => { const m = String(s ?? '').match(/(\d{1,2})\D(\d{1,2})\D(\d{2,4})/); if (!m) return NaN
  let [, mo, d, y] = m; y = +y < 100 ? 2000 + +y : +y; return Math.floor(Date.UTC(y, +mo - 1, +d) / 86400000) }

const moneyIn = load(moneyInPath).map((r, i) => ({ ...r, _i: i, _c: cents(r.amount), _d: day(r.date), used: false }))
const expected = load(expectedPath).map((r, i) => ({ ...r, _i: i, _c: cents(r.amount), _d: day(r.date), used: false }))

// Build every candidate pair (exact amount only), then assign GLOBALLY closest-date-first so the
// outcome doesn't depend on row order. A pair where either date is missing/garbage can't have its
// proximity confirmed, so it's eligible but always marked loose (matched on amount alone).
const candidates = []
for (const e of expected) for (const m of moneyIn) {
  if (e._c !== m._c) continue
  const known = !Number.isNaN(e._d) && !Number.isNaN(m._d)
  if (known) { const dist = Math.abs(m._d - e._d); if (dist <= windowDays) candidates.push({ e, m, dist, loose: dist > looseDays, why: dist > looseDays ? `${dist} days apart` : '' }) }
  else candidates.push({ e, m, dist: Number.POSITIVE_INFINITY, loose: true, why: 'no usable date, matched on amount alone' })
}
candidates.sort((x, y) => x.dist - y.dist)
const matched = []
for (const c of candidates) { if (c.e.used || c.m.used) continue; c.e.used = true; c.m.used = true; matched.push(c) }

const cleanMatches = matched.filter((c) => !c.loose)
const looseMatches = matched.filter((c) => c.loose)
const unmatchedExpected = expected.filter((e) => !e.used) // marked paid / due but NOT seen in the money-in
const unmatchedMoneyIn = moneyIn.filter((m) => !m.used)   // money in with nothing to tie it to

const sum = (arr) => arr.reduce((t, r) => t + r._c, 0)
const totalIn = sum(moneyIn), totalExp = sum(expected)
const flaggedCount = looseMatches.length + unmatchedExpected.length + unmatchedMoneyIn.length

// ---- report ----
const L = []
L.push('# Reconciliation report', '')
L.push(`Matched by exact amount within a ${windowDays}-day window. The matching is done in code, so a clean match is only ever claimed when the amounts line up and the dates are close (within ${looseDays} days). Two different items of the same amount can still look alike, so anything matched only loosely, or not matched at all, is flagged below for you to confirm. Nothing is guessed or netted away.`, '')
L.push(`- Money in (received): **${money(totalIn)}** across ${moneyIn.length} deposit(s)`)
L.push(`- Expected (invoiced/marked paid, or due): **${money(totalExp)}** across ${expected.length} item(s)`)
L.push(`- Clean matches: **${cleanMatches.length}** · Needs a quick confirm: **${flaggedCount}**`, '')

const matchRow = (c) => `| ${c.e.id || ''} | ${c.e.who || ''} | ${money(c.e._c)} | ${c.e.date || ''} | ${c.m.date || ''} | ${c.m.label || ''} |`
L.push('## Matched — money received that ties cleanly to an expected item', '')
if (cleanMatches.length) { L.push('| Item | Who | Amount | Expected date | Received date | Deposit label |', '|---|---|---|---|---|---|'); cleanMatches.forEach((c) => L.push(matchRow(c))) }
else L.push('_None._')
L.push('')

L.push('## Flag: matched, but worth a quick confirm', '')
L.push('Same amount, but the dates are off or missing, so this could be a coincidence of two same-amount items. Confirm the payer before you trust it.', '')
if (looseMatches.length) { L.push('| Item | Who | Amount | Expected date | Received date | Why flagged |', '|---|---|---|---|---|---|'); looseMatches.forEach((c) => L.push(`| ${c.e.id || ''} | ${c.e.who || ''} | ${money(c.e._c)} | ${c.e.date || ''} | ${c.m.date || ''} | ${c.why} |`)) }
else L.push('_None — every match was same-amount and same-few-days._')
L.push('')

L.push('## Flag: marked paid / due, but NOT found in the money-in', '')
L.push('You think this money came in, but nothing in the deposits matches it. Confirm it actually landed.', '')
if (unmatchedExpected.length) { L.push('| Item | Who | Amount | Date |', '|---|---|---|---|'); unmatchedExpected.forEach((e) => L.push(`| ${e.id || ''} | ${e.who || ''} | ${money(e._c)} | ${e.date || ''} |`)); L.push('', `Subtotal to chase down: **${money(sum(unmatchedExpected))}**`) }
else L.push('_None — every expected item was received._')
L.push('')

L.push('## Flag: money in with NO matching invoice', '')
L.push('Real money landed that nothing was billed for. Confirm what it was and that it is recorded.', '')
if (unmatchedMoneyIn.length) { L.push('| Date | Amount | Label |', '|---|---|---|'); unmatchedMoneyIn.forEach((m) => L.push(`| ${m.date || ''} | ${money(m._c)} | ${m.label || ''} |`)); L.push('', `Subtotal to account for: **${money(sum(unmatchedMoneyIn))}**`) }
else L.push('_None — every deposit ties to an invoice._')
L.push('')

const gap = totalIn - totalExp
L.push('## Bottom line', '')
L.push(`Deposits total ${money(totalIn)}; invoiced-paid total ${money(totalExp)}; a difference of ${money(Math.abs(gap))}.`)
if (unmatchedExpected.length || unmatchedMoneyIn.length) {
  L.push('That difference is not one mystery number, it is these flagged items:')
  if (unmatchedExpected.length) L.push(`- ${money(sum(unmatchedExpected))} marked paid but not seen in the bank`)
  if (unmatchedMoneyIn.length) L.push(`- ${money(sum(unmatchedMoneyIn))} received with no invoice behind it`)
  L.push(looseMatches.length ? 'Clear those, and confirm the loose matches above, and your books tie out.' : 'Clear those two and your books tie out.')
} else if (looseMatches.length) {
  L.push(`Every dollar is accounted for, but ${looseMatches.length} match(es) were made on amount alone. Confirm the loose match(es) above and you're done.`)
} else L.push('Everything ties out cleanly. Nothing to chase.')
L.push('')

const report = L.join('\n')
fs.writeFileSync(outPath, report)
console.log(JSON.stringify({
  cleanMatches: cleanMatches.length, looseMatches: looseMatches.length,
  unmatchedExpected: unmatchedExpected.length, unmatchedMoneyIn: unmatchedMoneyIn.length, flaggedCount,
  totalInCents: totalIn, totalExpectedCents: totalExp,
  flaggedExpectedCents: sum(unmatchedExpected), flaggedMoneyInCents: sum(unmatchedMoneyIn),
  reportPath: outPath,
  headline: flaggedCount
    ? `${cleanMatches.length} clean match(es); ${flaggedCount} item(s) flagged to confirm.`
    : `${cleanMatches.length} clean match(es); everything ties out.`,
}, null, 2))
