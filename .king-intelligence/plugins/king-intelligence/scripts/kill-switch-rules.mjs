// When may the toolkit remove itself from a paying member's computer?
//
// This is the most dangerous decision the toolkit makes, because it is not reversible from
// the member's side: removing the plugin removes the hook that would have healed it, so
// recovery needs a fresh install line from /system, which needs a live membership to view. A
// member wrongly cut off cannot get themselves back.
//
// And "ended" has been WRONG for real members twice: two were keyed with a subscription
// status of "none" (8/21/26), and an expired-trial sweep stamped another as revoked the day
// before she was reinstated (8/24/26). Every one of them would have read as ended.
//
// Hence two confirmations at least six hours apart. A membership that has really ended is
// still ended six hours later, so a genuine removal is delayed by a session or two and
// nothing else, while a wrong column gets the chance to be right first.
//
// It lives in its own module because `auto-update.mjs` does its work on import and reaches
// the network, so this judgement could not otherwise be tested at all. `kill-switch.test.mjs`
// asks it every question that matters.
//
// Created 08/28/26 - 05:48 EDT.

export const GAP_MS = 6 * 60 * 60 * 1000;

// The earliest timestamp this file could honestly hold. Anything below it is corruption, not
// history: the toolkit did not exist in 2020.
const FLOOR_MS = Date.UTC(2020, 0, 1);

/**
 * @param status  "live" | "ended" | anything else (null on a network error, timeout or 5xx)
 * @param now     epoch ms
 * @param raw     the confirmation file's contents, or null when it is not there
 * @returns {{confirmed:boolean, write:number|null, clear:boolean, why:string}}
 *          confirmed -> remove the toolkit. write -> save this number. clear -> delete the file.
 */
export function confirmEnded(status, now, raw) {
  const none = { confirmed: false, write: null, clear: false, why: "" };

  // A network error, a timeout or a 5xx answers null, and NOTHING happens: not a removal, and
  // not a cleared countdown either. Only a real answer moves this.
  if (status !== "ended" && status !== "live") return { ...none, why: "no usable answer, so nothing changes" };

  // Any live answer clears the count outright. A member briefly misread must not carry a
  // half-finished countdown around for the rest of the week.
  if (status === "live") return { ...none, clear: true, why: "live, so any countdown is cancelled" };

  const parsed = Number.parseInt(String(raw ?? "").trim(), 10);

  // A TIMESTAMP THAT CANNOT BE TRUE IS NOT HISTORY. `parseInt("1")` is 1, and `now - 1` clears
  // six hours by four decades, so a file holding a single stray digit — a truncated write, a
  // half-synced folder, a stray edit — would confirm removal on the FIRST ended reading and
  // take a paying member's toolkit with no second look. A value that is impossible, or in the
  // future beyond ordinary clock skew, restarts the clock instead of ending it.
  const plausible = Number.isFinite(parsed) && parsed >= FLOOR_MS && parsed <= now + 24 * 60 * 60 * 1000;
  if (!plausible) {
    return { ...none, write: now, why: raw == null ? "first ended reading; start the clock" : "unusable timestamp; start the clock over" };
  }

  if (now - parsed >= GAP_MS) {
    return { confirmed: true, write: null, clear: false, why: "ended twice, at least six hours apart" };
  }
  return { ...none, why: "ended, but not yet six hours since the first reading" };
}
