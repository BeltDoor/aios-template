#!/usr/bin/env node
/**
 * passwords.mjs, the two file jobs in a password refresh.
 *
 * trim  : keep only the chosen business sites out of an exported password file.
 * shred : delete the export files and prove they are gone.
 *
 * Hard rule: this script NEVER prints a password, a username, or a site to
 * stdout, stderr, or any log. It prints counts. That is deliberate, the output
 * of this script is read by an AI assistant and lands in a transcript.
 *
 * Node only, no dependencies. Works the same on Mac and Windows. (An earlier
 * version of this flow shelled out to python3, which is not present on a
 * default Windows machine.)
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname } from 'node:path'

// ---------------------------------------------------------------- CSV parsing

/** Parse RFC4180-ish CSV, which is what every browser and password manager exports. */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  let i = 0
  // strip a UTF-8 byte order mark; Chrome and Safari both emit one
  if (text.charCodeAt(0) === 0xfeff) i = 1
  for (; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { quoted = false }
      } else field += c
      continue
    }
    if (c === '"') { quoted = true; continue }
    if (c === ',') { row.push(field); field = ''; continue }
    if (c === '\r') continue
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''))
}

function toCsv(rows) {
  const esc = v => /[",\n\r]/.test(v ?? '') ? `"${String(v).replaceAll('"', '""')}"` : String(v ?? '')
  return rows.map(r => r.map(esc).join(',')).join('\n') + '\n'
}

/**
 * Every exporter names its columns differently, and the browser's importer only
 * accepts url / username / password. So we find the columns wherever they are and
 * write the output with the names the importer actually wants. Without this, an
 * export from Safari, Bitwarden or 1Password is silently refused on import.
 */
const ALIASES = {
  name:     ['name', 'title', 'item name', 'item_name', 'display name', 'account'],
  url:      ['url', 'web_address', 'web address', 'website', 'login_uri', 'login uri', 'urls', 'site', 'hostname'],
  username: ['username', 'user name', 'login_username', 'login username', 'user', 'login', 'email', 'account name'],
  password: ['password', 'login_password', 'login password', 'pass'],
}

/** Map each wanted field to the column index it lives in, or -1. */
function locate(header) {
  const lower = header.map(h => String(h ?? '').trim().toLowerCase().replace(/^"|"$/g, ''))
  const at = {}
  for (const [field, names] of Object.entries(ALIASES)) {
    at[field] = -1
    for (const n of names) {
      const hit = lower.indexOf(n)
      if (hit !== -1) { at[field] = hit; break }
    }
  }
  return at
}

/** example.com matches example.com and app.example.com, but never notexample.com */
function hostMatches(url, domain) {
  let host
  try { host = new URL(url).hostname.toLowerCase() }
  catch { host = String(url).toLowerCase().replace(/^[a-z]+:\/\//, '').split('/')[0] }
  const d = domain.toLowerCase().replace(/^www\./, '')
  return host === d || host.endsWith('.' + d)
}

// -------------------------------------------------------------------- actions

function trim(src, dst, domains) {
  if (!existsSync(src)) fail(`No exported file at that location.`)
  if (!domains.length) fail(`No sites given, so there is nothing to keep.`)

  const rows = parseCsv(readFileSync(src, 'utf8'))
  if (rows.length < 2) fail(`That file has no logins in it. Check the export finished.`)

  const at = locate(rows[0])
  if (at.url === -1) fail(`Cannot tell which column holds the website address. This export is in an unexpected format.`)
  if (at.password === -1) fail(`Cannot tell which column holds the password. This export is in an unexpected format.`)

  // exactly the four column names a browser's password importer accepts
  const kept = [['name', 'url', 'username', 'password']]
  const matchedDomains = new Set()
  let skippedNonWeb = 0
  let missingPassword = 0

  for (const r of rows.slice(1)) {
    const url = r[at.url] ?? ''
    // importers silently refuse anything that is not a normal web address
    if (!/^https?:\/\//i.test(url)) { skippedNonWeb++; continue }
    const hit = domains.find(d => hostMatches(url, d))
    if (!hit) continue
    const password = at.password === -1 ? '' : (r[at.password] ?? '')
    if (!password) { missingPassword++; continue }
    let host = ''
    try { host = new URL(url).hostname } catch { host = hit }
    kept.push([
      at.name === -1 ? host : (r[at.name] || host),
      url,
      at.username === -1 ? '' : (r[at.username] ?? ''),
      password,
    ])
    matchedDomains.add(hit.toLowerCase())
  }

  writeFileSync(dst, toCsv(kept), 'utf8')

  const missing = domains.filter(d => !matchedDomains.has(d.toLowerCase()))
  console.log(`kept ${kept.length - 1} logins across ${matchedDomains.size} of the ${domains.length} sites you asked for`)
  if (missing.length) console.log(`no saved login found for: ${missing.join(', ')}`)
  if (skippedNonWeb) console.log(`ignored ${skippedNonWeb} entries that are not ordinary websites (importers refuse those anyway)`)
  if (missingPassword) console.log(`ignored ${missingPassword} entries on your sites that have no password saved (often a passkey or a note)`)
  if (kept.length === 1) {
    console.log(`NOTHING WAS KEPT, do not continue: the site list and the export do not match up`)
    process.exit(2)
  }
}

function shred(paths) {
  let deleted = 0
  for (const p of paths) {
    try { unlinkSync(p); deleted++ }
    catch (e) {
      if (e.code === 'ENOENT') continue          // already gone, fine
      fail(`Could not delete a file that holds passwords (${basename(p)}): ${e.code}. Delete it by hand before going on.`)
    }
  }

  // Prove it. "I could not look" must never be reported as "it is gone".
  const stillThere = []
  const unprovable = []
  for (const p of paths) {
    try { statSync(p); stillThere.push(basename(p)) }
    catch (e) {
      if (e.code === 'ENOENT') continue          // proven gone
      unprovable.push(`${basename(p)} (${e.code})`)
    }
  }
  if (stillThere.length) fail(`STILL ON DISK: ${stillThere.join(', ')}. Delete by hand before going on.`)
  if (unprovable.length) fail(`Cannot confirm these are gone: ${unprovable.join(', ')}. Check by hand before going on.`)

  console.log(`deleted ${deleted} file(s); confirmed all ${paths.length} named file(s) are gone`)

  // Advisory sweep: anything else password-shaped left lying in the same folders.
  const nearby = []
  for (const dir of new Set(paths.map(p => dirname(p)))) {
    try {
      for (const f of readdirSync(dir)) if (/password/i.test(f)) nearby.push(f)
    } catch { nearby.push(`(could not read ${dir})`) }
  }
  if (nearby.length) console.log(`heads up, still in those folders: ${nearby.join(', ')}, check whether any is another copy of the export`)
  else console.log(`nothing password-shaped is left in those folders`)
}

function fail(msg) { console.log(`STOPPED: ${msg}`); process.exit(2) }

// ----------------------------------------------------------------------- main

const [verb, ...rest] = process.argv.slice(2)
if (verb === 'trim') {
  const [src, dst, ...domains] = rest
  trim(src, dst, domains.flatMap(d => d.split(',')).map(s => s.trim()).filter(Boolean))
} else if (verb === 'shred') {
  if (!rest.length) fail(`Nothing to delete was named.`)
  shred(rest)
} else {
  console.log(`usage:\n  node passwords.mjs trim <exported-file> <trimmed-file> <site> [site...]\n  node passwords.mjs shred <file> [file...]`)
  process.exit(1)
}
