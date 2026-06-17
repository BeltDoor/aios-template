---
name: networking
description: Fill your Google Calendar with tentative (purple) networking events for the next ~60 days — your recurring anchors plus a fresh batch of new local events worth attending in your travel radius. Use when the user types /networking or says "refresh my networking calendar", "find me events to go to", "what should I attend", "fill my calendar with networking", "add some networking events", "any good events coming up", or hands over any ask about which local rooms to show up at — even if the skill name is never mentioned. When run, it lists every event inline first, then drops each onto the calendar as a tentative purple hold with a Yes/No/Maybe RSVP button on the event. NOT for 1-on-1 coffees (those are referral/Calendly driven, not discoverable) and NOT for getting booked to SPEAK (that is the separate speaking pipeline).
argument-hint: "[optional: '30 days' | '90 days' | 'AI only' | 'benefits only']"
disable-model-invocation: false
---

# /networking — auto-fill the calendar with the right rooms

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## Step 0 — load your settings

Before anything else, read **`references/king-intelligence-config.md`** from the repo root (use the Read tool on that exact repo-relative path; the session CWD is the repo root). Find the **`## networking`** section and parse its `- key: value` lines. These are the per-user settings this skill runs on:

- **`city`** — home base for the radius filter and the search anchor.
- **`homeZip`** — the ZIP the drive-time radius is measured from.
- **`radius`** — how far to travel for an event. Default to **~30-min drive** if missing.
- **`calendarTool`** — `google`, `outlook`, `other`, or `none`. Decides whether events auto-insert or just get handed over as a list.
- **`selfEmail`** — the email to add as a guest so the Yes/No/Maybe RSVP prompt shows. Passed to the inserter script.
- **`calendarColor`** — the colorId for the tentative holds (e.g. `3` = purple).
- **`icpProfile`** — the buyer/peer mix to aim for (e.g. balanced — half buyer rooms, half peer/referral).
- **`metroCarveOut`** — any exception to the radius (e.g. a nearby metro allowed only if explicitly AI-focused).
- **`anchorsFile`** — the repo-relative path to the recurring-anchor definitions + filter rules. Read the anchor list from THERE, not from this skill folder.

If the file or the `## networking` section is missing, tell the user to create it (you may scaffold a starter `## networking` block from the keys above), then continue with safe generic fallbacks: city/zip unknown so ask once, ~30-min radius, `calendarTool: none` (hand over a copy-paste list instead of auto-inserting), no self-as-guest RSVP, a balanced buyer/peer mix, no metro carve-out, and the anchors guide at `references/anchors.md` inside this skill folder.

Everywhere below that says "the `<key>` from your settings," use the value you just parsed.

---

The user networks in two layers. **Layer 1 — anchors:** recurring rooms they reliably show up to. **Layer 2 — new finds:** fresh local events worth attending. This skill shows the full list inline first, then refreshes both onto the calendar as tentative/purple holds. The user is added as a guest on each one so the calendar shows a Yes/No/Maybe RSVP prompt — that is how they curate: Yes locks it in, Maybe keeps it tentative, No drops it. No per-event approval gate in chat; the inline list is the preview and the RSVP is the decision.

**Out of scope, on purpose:** one-on-one coffees (relationship/Calendly driven, not discoverable) and speaking bookings (separate pipeline). Never add those here.

## What "done" looks like

The user first sees the full inline list of every event the run found. Then the next ~60 days of their calendar hold in-window anchors plus ~5-10 new events, all tentative + the `calendarColor` from your settings, each with the user added as a guest (the `selfEmail` from your settings) so the Yes/No/Maybe RSVP prompt shows, none duplicated against what was already there. The user RSVPs on each event to curate.

## How to run it

### 1. Set the window and read context
- Get today's date: `date '+%m/%-d/%y - %H:%M %Z'` (bare `date`, never a `TZ=` override).
- Default horizon: **60 days**. An argument can override ("30 days", "90 days") or filter focus ("AI only", "benefits only").
- Read the anchors guide at the `anchorsFile` from your settings (the recurring-series definitions + radius/ICP rules) and [`references/sources.md`](${CLAUDE_PLUGIN_ROOT}/skills/networking/references/sources.md) (where to look + the banned-tool rules). Read them every run; they are the source of truth, not anything hardcoded here.

### 2. Build Layer 1 — anchors
For each **core anchor** in the `anchorsFile` from your settings, compute its occurrence dates that fall inside the window from its cadence rule (e.g. "1st Tuesday", "3rd Friday"). Computing a known cadence is fine; do not invent a date for a series whose pattern you do not know.
- Where a quick source check exists (an Eventbrite series link, an org calendar), confirm the real posted date with WebFetch. If it is posted, use it. If it is only projected from the cadence, keep it but tag it `(date projected — confirm)` in the receipt.
- **Any anchor already set as a true recurring event on the calendar — never re-add it.** The dedup step will also catch it, but do not even build it as a candidate. The `anchorsFile` should note which series to skip.

### 3. Build Layer 2 — new finds (~5-10, balanced)
Discover fresh events in the window using **`perplexity_search` + WebSearch + WebFetch only** (see `sources.md` for the source list and per-source query tips). Aim for the balanced mix in the `icpProfile` from your settings: some buyer rooms (chamber / small-business / benefits + insurance) and some peer/referral rooms (AI community, founders, consultants).
- Filter to the `radius` from your settings of the `homeZip` from your settings. Apply the `metroCarveOut` from your settings: e.g. a nearby metro only if explicitly AI-focused.
- Drop anything that duplicates an anchor or an existing event.
- Score by fit (buyer/peer balance, drive time, cost, how soon) and keep the best ~5-10. If a focus arg was given, weight to it.
- **No silent truncation:** if you found more good events than the cap, say so in the receipt and name a couple you dropped.

### 4. Show the user the full list inline FIRST
Before anything touches the calendar, print the complete list in chat so the user sees what is coming. Plain language, no jargon, no em-dashes. Group it:
- **Anchors** — date, name, time, cost, drive time, one-line why. Flag any tagged `(date projected — confirm)`.
- **New finds** — same columns.
- **Conflicts + things to decide** — two events the same morning, register-by deadlines, paid events, anything a source could not confirm (e.g. a phone-only chamber).

This inline list is the preview. The user does not approve each one, but sees everything before it lands.

### 5. Stage candidates and insert
Write the combined anchor + new-find list to `state/candidates.json` (shape in the script header): each event with `summary`, `location`, `description`, `start`/`end` (`dateTime` + `timeZone` matching your locale). Put cost, registration link, drive time, a one-line "why it fits", and `Added by /networking <today>` in the description. No double-quotes inside description text (cmd.exe quoting).

Then run the inserter. It lists the live calendar, dedupes (same day, ±150 min, similar title), and adds survivors as tentative/purple with the user added as a guest (so the RSVP prompt shows). Pass the `selfEmail` from your settings so the inserter adds them as a guest under the right address:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/networking/scripts/add-events.mjs --self-email <selfEmail> --dry-run   # preview first
node ${CLAUDE_PLUGIN_ROOT}/skills/networking/scripts/add-events.mjs --self-email <selfEmail>             # real insert
```

(`<selfEmail>` is the `selfEmail` from your settings; you can also set it once via the `NET_SELF_EMAIL` env var instead of the flag.) Always `--dry-run` first, read its `added`/`skipped`/`errors` JSON, sanity-check it, then run for real. The script is the only thing that writes to the calendar (deterministic, handles the Windows quoting, and adds the user as a guest with `sendUpdates:none` so no invite emails ever go out).

### 6. Confirm
One short line: how many anchors + new finds landed, how many were skipped as already-on-calendar. Remind the user they can RSVP **Yes / No / Maybe** on each event right on the calendar — No drops it from consideration, Maybe leaves it undecided, Yes locks it in.

## Guardrails (do not cross)

- **Tools:** `perplexity_search` (cheap, ~$0.005/call) for discovery; WebSearch + WebFetch to verify. **Never** Firecrawl, **never** `perplexity_reason`, **never** `perplexity_research` (banned + hook-blocked). Keep discovery to roughly 10-20 search calls.
- **Never** duplicate or double-book — the script dedupes, but also reason about it when building candidates.
- **Never** touch confirmed events. The skill only ever adds new tentative events; it does not edit or delete.
- **Never** add coffees or speaking gigs.
- **Never** fabricate an event date. Compute from a known cadence or verify from a source; otherwise say it is unconfirmed.

## Why a script instead of inserting inline
The calendar insert is deterministic and Windows `cmd.exe` quoting is genuinely error-prone (a "Lunch & Learn" title can break a raw insert). Bundling it in `scripts/add-events.mjs` keeps the quoting + dedup correct every run.
