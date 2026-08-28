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

export function rollup(rows) {
  const sessions = [...rows.values()].sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const seen = new Set();
  let created = 0, changed = 0, drafts = 0, activeMin = 0, creditMin = 0, working = 0;
  const days = new Set();
  const skillUses = {};

  for (const s of sessions) {
    let sCreated = 0, sChanged = 0;
    for (const h of s.touched || []) {
      if (seen.has(h)) sChanged += 1;
      else { seen.add(h); sCreated += 1; }
    }
    const sDrafts = Number(s.drafts) || 0;
    const sActive = Number(s.activeMin) || 0;
    const byHand = sCreated * MIN_CREATED + sChanged * MIN_CHANGED + sDrafts * MIN_OUTWARD;

    created += sCreated;
    changed += sChanged;
    drafts += sDrafts;
    activeMin += sActive;
    const credit = Math.max(sActive, byHand); // the machine's own working time is the floor
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

  return {
    hours: Math.round((creditMin / 60) * 100) / 100,
    machineHours: Math.round((activeMin / 60) * 100) / 100,
    sessions: working,
    sessionsSeen: sessions.length,
    activeDays: days.size,
    docsCreated: created,
    docsChanged: changed,
    drafts,
    skills: skillUses,
    firstSession: sessions.length ? sessions[0].start : null,
    lastSession: sessions.length ? sessions[sessions.length - 1].end : null,
  };
}
