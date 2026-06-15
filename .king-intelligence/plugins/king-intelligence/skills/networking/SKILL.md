---
name: networking
description: Fill the user's calendar with tentative (purple) networking events for the next ~60 days, their recurring anchors (rooms they reliably show up to) plus a fresh batch of new local events worth attending inside their travel radius. Use when the user types /networking or says "refresh my networking calendar", "find me events to go to", "what should I attend", "fill my calendar with networking", "add some networking events", "any good events coming up", or hands over any ask about which local rooms to show up at, even if they never say the skill name. When run, it lists every event inline first, then drops each onto the calendar as a tentative hold the user can confirm or drop. NOT for one-on-one coffees (those are referral driven, not discoverable) and NOT for getting booked to SPEAK (that is a separate pipeline).
argument-hint: "[optional: '30 days' | '90 days' | 'AI only' | 'buyers only']"
disable-model-invocation: false
allowed-tools: Read, Bash, WebSearch, WebFetch
---

# /networking — auto-fill the calendar with the right rooms
*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

> Usage note: this skill reads its own per-client settings at runtime (city, radius, calendar tool, etc.). It never assumes a fixed city or a specific calendar.

## This client's wiring

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/print-config.mjs" "${CLAUDE_PLUGIN_DATA}/config.json"`

Read this skill's settings from `skills["networking"]` in the JSON printed above. The settings you care about:

- **`city`** — the user's home base, used for the radius filter and as the search anchor.
- **`radius`** — how far they will travel (e.g. "30 min" or "25 miles"). Default to **~30-min drive** if missing.
- **`calendarTool`** — `google`, `outlook`, `other`, or `none`. Decides whether the skill auto-inserts events or just hands the list over to add. Default to a copy-paste handoff if missing.
- **`selfEmail`** — optional; used to add the user as a guest so a Yes/No/Maybe RSVP prompt appears on each hold (Google path only).
- **`recurringAnchors`** — optional; the user's own list of recurring rooms. **Starts empty** and grows over time as the user tells you which series they keep showing up to.
- **`eventSources`** — optional; extra local source URLs the user already knows about.

If a needed setting is missing, fall back to the sensible generic behavior described below, do the run anyway, and tell the user once: "I can tailor this better — run `/king-intelligence:adapt networking` to set your city, radius, and calendar."

## The model

Networking runs in two layers. **Layer 1 — anchors:** recurring rooms the user reliably shows up to. **Layer 2 — new finds:** fresh local events worth attending. This skill shows the full list inline first, then refreshes both onto the calendar as tentative holds. Where the calendar supports it, the user is added as a guest on each one so a Yes/No/Maybe RSVP prompt shows — that is how they curate: Yes locks it in, Maybe keeps it tentative, No drops it. No per-event approval gate in chat; the inline list is the preview and the RSVP (or a later "keep/drop") is the decision.

**Out of scope, on purpose:** one-on-one coffees (relationship driven, not discoverable) and speaking bookings (a separate pipeline). Never add those here.

## What "done" looks like

The user first sees the full inline list of every event the run found. Then the next ~60 days of their calendar hold their in-window anchors plus ~5–10 new events, all tentative, none duplicated against what was already there. If the calendar can be written to, the events land as holds; if not, the user gets a clean copy-paste list to add by hand.

## How to run it

### 1. Set the window and read context
- Get today's date with `date '+%m/%-d/%y - %H:%M %Z'` (bare `date`).
- Default horizon: **60 days**. An argument can override ("30 days", "90 days") or filter focus ("AI only", "buyers only").
- Read [`references/anchors.md`](references/anchors.md) (how anchors work + the radius/fit rules) and [`references/sources.md`](references/sources.md) (where to look + the cost guardrails). Read them every run. The user's actual anchor list lives in config (`recurringAnchors`), not hardcoded here.

### 2. Build Layer 1 — anchors
For each entry in the config's `recurringAnchors`, compute the occurrence dates that fall inside the window from its cadence rule (e.g. "1st Tuesday", "3rd Friday"). Computing a known cadence is fine; do not invent a date for a series whose pattern you do not know.
- Where a quick source check exists (an Eventbrite series link, an org calendar), confirm the real posted date with WebFetch. If it is posted, use it. If it is only projected from the cadence, keep it but tag it `(date projected — confirm)` in the receipt.
- **Skip any series the user already has as a true recurring event on their calendar** — do not even build it as a candidate. The dedup step also catches it, but skipping it up front keeps the list clean.
- If `recurringAnchors` is empty (the common case for a new client), say so plainly: "You haven't told me your recurring rooms yet, so this run is all new finds. As you find rooms you'll keep going back to, tell me and I'll remember them as anchors." Then proceed with Layer 2 only.

### 3. Build Layer 2 — new finds (~5–10, balanced)
Discover fresh events in the window using ordinary web search (`WebSearch` for broad lookups, `WebFetch` to read a specific event or calendar page and confirm a date). See `sources.md` for the source templates and per-source query tips. Aim for a balanced mix: some buyer rooms (chamber / small-business / industry associations the user sells to) and some peer/referral rooms (their professional community, founders, consultants).
- Filter to the user's `radius` from their `city`. A farther city is allowed only when it tightly matches a focus the user named (e.g. an AI-only event in the next metro over).
- Drop anything that duplicates an anchor or an existing event.
- Score by fit (buyer/peer balance, drive time, cost, how soon) and keep the best ~5–10. If a focus arg was given, weight to it.
- **No silent truncation:** if you found more good events than the cap, say so in the receipt and name a couple you dropped.

### 4. Show the full list inline FIRST
Before anything touches the calendar, print the complete list in chat so the user sees what is coming. Plain language, no jargon, no em-dashes, lead each "why" with what the user gets out of the room. Group it:
- **Anchors** — date, name, time, cost, drive time, one-line why. Flag any tagged `(date projected — confirm)`.
- **New finds** — same columns.
- **Conflicts + things to decide** — two events the same morning, register-by deadlines, paid events, anything a source couldn't confirm (e.g. a phone-only chamber).

This inline list is the preview. The user does not approve each one, but they see everything before it lands.

### 5. Get the events onto the calendar (route by `calendarTool`)

Write the combined anchor + new-find list to a candidates JSON (shape in the script header): each event with `summary`, `location`, `description`, `start`/`end` (`dateTime` + the user's `timeZone`). Put cost, registration link, drive time, a one-line "why it fits", and `Added by /networking <today>` in the description. Avoid double-quotes inside description text.

Then, depending on `calendarTool`:

- **`google`** — use the connected Google Calendar tooling to insert each survivor as a tentative hold, and (if `selfEmail` is set) add the user as a guest with no email notification so the Yes/No/Maybe RSVP prompt shows. The bundled helper does this deterministically and handles the dedup + the Windows quoting:

  ```bash
  node scripts/add-events.mjs <candidates.json> --dry-run   # preview first
  node scripts/add-events.mjs <candidates.json>             # real insert
  ```

  Pass the user's `selfEmail` and the calendar command via env (`NET_SELF_EMAIL`, `NET_CAL_CMD`) or let the script read them from the config path you pass as `--config`. Always `--dry-run` first, read its `added`/`skipped`/`errors` JSON, sanity-check it, then run for real.

- **`outlook` / `other`** — if a write-capable calendar tool for that platform is connected this session, use it to create each survivor as a tentative event (run the same dedup logic from the script first, or run `add-events.mjs --dry-run` purely to get the deduped survivor list). If no write-capable tool is connected, fall through to the handoff below. **Do not fail or pretend.** Honest caveat: the auto-insert helper is written for a Google-style calendar CLI; on other calendars the reliable move is to find and list the events and hand them over.

- **`none` or unknown** — skip writing entirely. Run `add-events.mjs --dry-run` only to dedup against any calendar you can read, then present the survivors as a clean, copy-paste-ready list (date, time, title, location, registration link) and say: "I couldn't add these to your calendar automatically, so here they are to drop in yourself."

### 6. Confirm
One short line: how many anchors + new finds landed (or were handed over), how many were skipped as already-on-calendar. If they landed as Google holds with RSVP, remind the user they can answer **Yes / No / Maybe** right on each event — No drops it, Maybe leaves it undecided, Yes locks it in. Otherwise tell them how to add the ones they want.

### 7. Offer to remember anchors
If the run surfaced a room the user clearly treats as recurring (they mention they go every month, it matched a series), offer to save it to `recurringAnchors` so future runs auto-include it. This is how the user builds their own anchor list over time.

## Guardrails (do not cross)

- **Cost discipline:** use ordinary web search for discovery and verification. **Avoid expensive deep-research API calls** — for "deep" coverage, run several cheap searches and synthesize yourself. Keep discovery to roughly **10–20 search calls** per run. Breadth over depth.
- **Never** duplicate or double-book — the script dedupes, but also reason about it when building candidates.
- **Never** touch a confirmed event or a true recurring event. This skill only adds new tentative events; it does not edit or delete.
- **Never** add coffees or speaking gigs.
- **Never** fabricate an event date. Compute from a known cadence or verify from a source; otherwise say it is unconfirmed.
- **Never** silently fail on a calendar it can't write to — find, list, and hand over instead.

## Why a script for the Google insert
The calendar insert is deterministic, and on Windows the `cmd.exe` quoting is genuinely error-prone (a title with an `&` can break a raw insert). Bundling it in `scripts/add-events.mjs` keeps the quoting + dedup correct every run, and isolates the one platform-specific bit so the rest of the skill stays calendar-agnostic.

## Related craft
- If a `/king-intelligence:content-unit` or `/king-intelligence:stop-slop` skill is available, use it (via the Skill tool) when you write any prose the user will see publicly. If not, just keep the inline-list copy plain, benefit-led, and free of em-dashes and AI filler.
