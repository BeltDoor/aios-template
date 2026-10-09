// How a member's sessions become the hours on their page.
//
// This is the ONLY place a total is computed, and it lives in its own module for one reason:
// `measure-sessions.mjs` runs its command line the moment it is imported, so `rollup` was
// exported but could never actually be imported by anything. Its tests print the CLI's usage
// text instead. Now it can be asked the questions a member would ask if they doubted the
// number: does a busy session always count, can the figure go DOWN, is a file I edited twice
// charged twice, does an empty window pad it.
//
// The prices are the owner's, shipped rather than invented locally, and deliberately the
// floor of what the work would cost by hand.
//
// Created 08/28/26 - 06:05 EDT.

export const MIN_CREATED = 20;
export const MIN_CHANGED = 5;
export const MIN_OUTWARD = 10;

// NON-FILE WORK ADDS NOTHING YET (10/7/26). Version-2 rows carry research, reading, planning and
// review counts (session-evidence.mjs), but the time a person would have spent without the
// toolkit is not in any transcript. Until outside evidence supports a factor for a kind
// of work, the extra credit is exactly 1.0x: the headline stays max(active time, priced work).
// rollup() never reads a row's `signals`, and a test pins this at 1.
export const EXTRA_CREDIT_MULTIPLIER = 1;

/** A row measured under the per-session rules (session-evidence.mjs). Everything else is legacy. */
export const isV2Row = (s) => !!s && Number(s.v) >= 2 && Array.isArray(s.created) && Array.isArray(s.changed);

/** What a version-2 row's own evidence prices at, ignoring every other row. */
export function v2Price(s) {
  const c = new Set(s.created);
  const sCreated = c.size;
  const sChanged = new Set(s.changed.filter((h) => !c.has(h))).size;
  const sDrafts = Number(s.drafts) || 0;
  return { sCreated, sChanged, sDrafts, sActive: Number(s.activeMin) || 0, byHand: sCreated * MIN_CREATED + sChanged * MIN_CHANGED + sDrafts * MIN_OUTWARD };
}

/** A version-2 row's own credit, from its evidence alone. */
export const v2Credit = (s) => { const p = v2Price(s); return Math.max(p.sActive, p.byHand); };

/**
 * LEGACY ROWS ARE FROZEN (10/7/26, after four review rounds on this seam).
 *
 * A row without the version-2 marker is never re-measured, rewritten or added to by this engine
 * (measure-sessions.mjs), and it is priced here EXACTLY as the old code priced it: legacy rows
 * only, in their original order, through the old cross-session `seen` set, summed first and in the
 * same order. New work in a reopened pre-release chat earns nothing new (Jacob's decision).
 *
 * Version-2 rows never read or write `seen`; each is priced from its own evidence. Monotonic with
 * no floor: transcripts are append-only, so a version-2 row's active minutes, created/changed sets
 * and draft set only grow (a file's kind is fixed by its first successful action).
 *
 * STORAGE (Codex round 8). After activation version-2 rows live in their own file and the legacy
 * rows reach this function only as the frozen snapshot (`frozen`), so the two never meet in one
 * file an older toolkit can rewrite.
 */
/**
 * The snapshot taken at activation: every legacy row's credit exactly as rollup() assigns it at
 * that moment (same order, same file history). Stored by measure-sessions.mjs in a file older
 * engines never touch, and from then on the ONLY source of the legacy share.
 */
export function legacyCredits(rows) {
  const out = {};
  const all = [...rows.values()].sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const seen = new Set();
  for (const s of all) {
    if (isV2Row(s) || !s.id) continue;
    let cr = 0, ch = 0;
    for (const h of s.touched || []) { if (seen.has(h)) ch += 1; else { seen.add(h); cr += 1; } }
    const d = Number(s.drafts) || 0, a = Number(s.activeMin) || 0;
    out[s.id] = { c: Math.max(a, cr * MIN_CREATED + ch * MIN_CHANGED + d * MIN_OUTWARD), cr, ch, d, a, s: s.start || null, e: s.end || null, k: Array.isArray(s.skills) ? s.skills : [] };
  }
  return out;
}

/**
 * `extraMin` (10/8/26): minutes a total must carry beyond its rows. Used only after activation, for
 * the part of the highest total ever reported that the frozen snapshot's own credits fall short of
 * (measure-sessions.mjs, "THE CREDITED-TOTAL FLOOR"). It adds to the hours and to nothing else.
 */
export function rollup(rows, { extraMin = 0 } = {}) {
  const all = [...rows.values()].sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const seen = new Set();
  let created = 0, changed = 0, drafts = 0, activeMin = 0, creditMin = 0, working = 0;
  const days = new Set();
  const skillUses = {};

  // 1. the frozen legacy set, exactly as the old code priced it
  const v2Origin = (s) => isV2Row(s);
  for (const s of all) {
    if (v2Origin(s)) continue;
    let sCreated, sChanged, sDrafts, sActive, credit;
    if (s.frozen && typeof s.frozen === "object") {
      // AFTER ACTIVATION the legacy share comes from the snapshot taken at activation ONLY
      // (measure-sessions.mjs hands it in as `frozen`). An older window can still rewrite these
      // rows or add rows for pre-activation sessions; neither moves a minute (Codex round 7).
      const f = s.frozen;
      sCreated = Number(f.cr) || 0; sChanged = Number(f.ch) || 0; sDrafts = Number(f.d) || 0;
      sActive = Number(f.a) || 0; credit = Number(f.c) || 0;
    } else {
      sCreated = 0; sChanged = 0;
      for (const h of s.touched || []) {
        if (seen.has(h)) sChanged += 1;
        else { seen.add(h); sCreated += 1; }
      }
      sDrafts = Number(s.drafts) || 0;
      sActive = Number(s.activeMin) || 0;
      const byHand = sCreated * MIN_CREATED + sChanged * MIN_CHANGED + sDrafts * MIN_OUTWARD;
      credit = Math.max(sActive, byHand); // the machine's own working time is the floor
    }

    created += sCreated;
    changed += sChanged;
    drafts += sDrafts;
    activeMin += sActive;
    creditMin += credit;
    // A session only COUNTS if it did something. A window opened and closed, or one of the
    // automated loops that can open hundreds of them in a day, displaces no work and must not
    // pad the figure the owner reads. On a real machine this was two thirds of all sessions.
    if (credit >= 1) {
      working += 1;
      if (s.start) days.add(s.start.slice(0, 10));
    }
    for (const k of s.skills || []) skillUses[k] = (skillUses[k] || 0) + 1;
  }

  // 2. version-2 rows, each from its own evidence
  for (const s of all) {
    if (!v2Origin(s)) continue;
    // its own evidence, never below its own previous credit (floorMin, kept in sessions-v2.jsonl)
    const { sCreated, sChanged, sDrafts, sActive, byHand } = v2Price(s);
    const credit = Math.max(sActive, byHand, Number(s.floorMin) || 0);
    created += sCreated;
    changed += sChanged;
    drafts += sDrafts;
    activeMin += sActive;
    creditMin += credit;
    if (credit >= 1) {
      working += 1;
      if (s.start) days.add(s.start.slice(0, 10));
    }
    for (const k of s.skills || []) skillUses[k] = (skillUses[k] || 0) + 1;
  }

  return {
    hours: Math.round(((creditMin + (Number(extraMin) > 0 ? Number(extraMin) : 0)) / 60) * 100) / 100,
    machineHours: Math.round((activeMin / 60) * 100) / 100,
    sessions: working,
    sessionsSeen: all.length,
    activeDays: days.size,
    docsCreated: created,
    docsChanged: changed,
    drafts,
    skills: skillUses,
    firstSession: all.length ? all[0].start : null,
    lastSession: all.length ? all[all.length - 1].end : null,
  };
}
