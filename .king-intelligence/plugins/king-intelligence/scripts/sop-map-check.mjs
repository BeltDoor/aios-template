#!/usr/bin/env node
// sop-map-check: opens a filled sop-map.html in a headless browser and proves it draws.
// Clicks every box, opens every SOP panel, and counts script errors on the way.
//
//   node sop-map-check.mjs <sop-map.html> [--shot <file.png>] [--open]
//
// Exit 0: PASS. Exit 1: FAIL (errors, an empty box, or template wording left).
// Exit 2: no headless browser library on this computer; the output says what to do instead.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const shot = args.includes('--shot') ? args[args.indexOf('--shot') + 1] : null
const file = args.find((a) => !a.startsWith('--') && a !== shot)
if (!file || !fs.existsSync(file)) { console.error('usage: sop-map-check.mjs <sop-map.html> [--shot <png>] [--open]'); process.exit(1) }
const abs = path.resolve(file)
const url = pathToFileURL(abs).href

function openInBrowser() {
  const cmd = process.platform === 'darwin' ? ['open', [abs]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', abs]] : ['xdg-open', [abs]]
  spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref()
  console.log('OPENED ' + abs)
}

async function loadPlaywright() {
  try { return await import('playwright') } catch {}
  try { return createRequire(path.join(process.cwd(), 'x.js'))('playwright') } catch {}
  return null
}

const pw = await loadPlaywright()
if (!pw) {
  console.log('NO BROWSER LIBRARY: check the page with the browser tool instead.')
  console.log('1. Open ' + url + ' in the browser tool (if it refuses a file address, run: npx -y http-server "' + path.dirname(abs) + '" -p 8765, and open http://127.0.0.1:8765/' + path.basename(abs) + ').')
  console.log('2. Read its console messages: there must be no error.')
  console.log('3. Run this in the page and read the answer: [...document.querySelectorAll(".box .t")].map(e => e.textContent.trim())')
  console.log('   Every box must show its own title, and the page text must not contain the word "sample".')
  if (args.includes('--open')) openInBrowser()
  process.exit(2)
}

const errors = []
const browser = await pw.chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
page.on('pageerror', (e) => errors.push('script: ' + e.message))
page.on('requestfailed', (r) => errors.push('missing file: ' + r.url().slice(0, 120)))
const settle = () => page.waitForFunction(() => document.body.dataset.busy === '0' && document.body.dataset.mode === 'normal', null, { timeout: 8000 }).catch(() => {})
await page.goto(url, { waitUntil: 'load' })
await settle()

const boxes = await page.$$eval('.box', (els) => els.map((e) => ({ id: e.dataset.id, title: (e.querySelector('.t') || {}).textContent?.trim() || '' })))
const empty = boxes.filter((b) => !b.title)
let sheetsOk = 0, sopsOpened = 0, sopProblems = [], noPanel = []
for (const b of boxes) {
  let h2 = ''
  for (let tries = 0; tries < 3 && !h2; tries++) {
    await page.evaluate((id) => document.querySelector('.box[data-id="' + id + '"]').click(), b.id)
    await page.waitForTimeout(400); await settle()
    h2 = await page.$eval('.sheet.open #shTitle', (e) => e.textContent.trim()).catch(() => '')
  }
  if (h2) sheetsOk++; else noPanel.push(b.id)
  if (await page.$('#shSops')) {
    await page.evaluate(() => document.querySelector('#shSops').click())
    await page.waitForTimeout(120)
    const n = await page.$$eval('#sop.open .sop-steps tbody tr', (r) => r.length).catch(() => 0)
    const none = await page.$('#sop.open .sop-none')
    if (n > 0 || none) sopsOpened++
    else sopProblems.push(b.id)
    await page.evaluate(() => document.querySelector('#sopClose').click())
    await page.waitForTimeout(80)
  }
}
await page.keyboard.press('Escape')
const bodyText = await page.evaluate(() => document.body.innerText)
const sampleLeft = /sample/i.test(bodyText)

if (shot) {
  await page.reload({ waitUntil: 'load' })
  await settle(); await page.waitForTimeout(400)
  await page.screenshot({ path: shot, fullPage: false })
}
await browser.close()

const pass = !errors.length && !empty.length && boxes.length > 0 && sheetsOk === boxes.length && !sopProblems.length && !sampleLeft
console.log(JSON.stringify({ result: pass ? 'PASS' : 'FAIL', boxes: boxes.length, boxesWithText: boxes.length - empty.length, panelsOpened: sheetsOk, panelsThatDidNotOpen: noPanel, sopPanelsOpened: sopsOpened, sopPanelsEmpty: sopProblems, scriptErrors: errors.length, errors, sampleWordLeft: sampleLeft, titles: boxes.map((b) => b.id + ': ' + b.title), screenshot: shot || null }, null, 1))
if (args.includes('--open')) openInBrowser()
process.exit(pass ? 0 : 1)
