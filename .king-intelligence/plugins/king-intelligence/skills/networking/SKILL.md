---
name: networking
description: Finds local networking events worth going to and, once approved, puts them on the user's calendar. Use when the user types /networking or says "refresh my networking calendar", "find me events to go to", "what should I attend", "fill my calendar with networking", "add some networking events", "any good events coming up", "what's happening locally", "find me some rooms", "I need to get out and meet people", "any referral groups I should visit", or hands over any ask about which local rooms to show up at. Use even if they don't say networking. NOT for one-on-one coffees (referral/Calendly driven, not discoverable) and NOT for getting booked to speak.
argument-hint: "[optional: '60 days' | 'AI only' | 'chambers only' | 'BNI visits']"
disable-model-invocation: false
---

# /networking

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

Your calendar should always have somewhere worth going. This finds those rooms, proves the dates are real, checks you're actually free, and shows you everything on an approval page. **Nothing reaches your calendar until you check a box.**

This flow is approve-first by design: an earlier automatic-insert version treated the calendar RSVP itself as the curation step, which meant a bad suggestion could sit on the calendar looking real. This version never writes anything until you've explicitly said yes.

## Step 0 — load settings and state

1. Read `references/king-intelligence-config.md` from the repo root (use the Read tool on that exact repo-relative path; the session CWD is the repo root) → the `## networking` section. Keys: `city`, `homeZip`, `radius`, `horizonDays`, `weeklyCapacity`, `conflictRule`, `confirmedDatesOnly`, `calendarTool`, `selfEmail`, `calendarColor`, `metroCarveOut`, `anchorsFile`, `blocklistFile`.
2. Read the `anchorsFile` → the recurring series, the filter rules, and the accumulated gotchas.
3. Read the `blocklistFile` → rooms the user killed and why. **Filter these out before they ever see them**, both exact titles and the learned patterns. Re-showing a room they already rejected is the friction that makes them stop running this.
4. Get today's date: `date '+%m/%-d/%y - %H:%M %Z'` (bare `date`, never a `TZ=` override).

If the config or its `## networking` section is missing, tell the user once (you may scaffold a starter `## networking` block from the keys above), then continue with safe generic fallbacks: ask once for city/ZIP, 30-min radius, 30-day horizon, 2 events/week, confirmed-dates-only, and hand over a list instead of writing to a calendar.

## The flow

### 1. Research, four categories, in parallel

Fan out one subagent per category (`model: sonnet` — this is gathering, not judgment). Source lists and per-category query tactics are in [`references/sources.md`](references/sources.md). A sensible default weighting, most businesses find:

1. **AI-specific events** — often the highest-converting category. Attendance self-selects for people who already care about AI, which matters if that's part of the pitch.
2. **Structured referral networks** — visitor days at other BNI chapters, LeTip, AmSpirit, Gold Star. For a referral-driven business, visiting undrained chapters is usually the highest-confidence bet on the list.
3. **Every chamber in radius** — including the ones with no machine-readable calendar. Dig their event pages and Facebook rather than writing them off.
4. **Trade and industry associations** — the rooms the user's actual clients live in.

Service clubs (Rotary, Kiwanis, Lions) are out by default — they tend to pay off mainly if the user has an active speaking/visibility pipeline. Bring them back in with a focus argument (or adjust the weighting in `sources.md`) if that's a priority.

**Spend guard.** Discovery costs roughly $0.30 to $0.60 per run. Cap each subagent at **12 `perplexity_search` calls** and the whole run at **60**. `perplexity_reason` and `perplexity_research` are banned and hook-blocked; Firecrawl is out of scope here. For depth, run more cheap searches and synthesise yourself.

### 2. Prove every date

A date only counts if it was read off a live page or listing this run. Cadence arithmetic is a hypothesis, not a source. The anchors file has recorded real drift before: a monthly series landing on the 2nd Friday one month when the file claimed the 3rd, and an Eventbrite page whose "Tuesday, September 16" turned out to be the prior year.

- **Verified** → eligible for the calendar.
- **Unverified** → goes to the page's "worth chasing" section with the specific person and number to contact. It does not become a hold. A hold the user can't trust teaches them to ignore the calendar.

### 3. Filter

- Inside `radius` of `homeZip`. Apply the `metroCarveOut` (a farther metro only if explicitly AI-focused).
- Drop anything on the blocklist.
- Drop duplicates of each other and of what's already on the calendar.
- **Skip the user's own BNI chapter (or equivalent referral group)** — already a true recurring event. Visiting *other* chapters is a first-class suggestion.

### 4. Check the user is actually free

Write the survivors to `state/candidates.json` (shape in the script header), then:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/networking/scripts/check-conflicts.mjs
```

**Nothing on the calendar blocks anything. Everything is bendable**, with one exception: a single sacred commitment (defaults to the user's own referral chapter, e.g. BNI — see `references/king-intelligence-config.md` / the script header for how to change it) that never bends. The script annotates and never removes anything else.

This rule was learned the hard way, twice in one day, on a real run: a version that blocked on any confirmed commitment hid most of the good options. A version that blocked only on work commitments still silently killed a confirmed recurring anchor and a chapter visit the user had specifically asked for — they never saw either, and the run just looked thin for no visible reason. The rule that survived: don't let anything on the calendar actually block a suggestion; let the user judge it themselves.

So every candidate reaches the page carrying its collisions ("Overlaps your 9-10 AM team call"). The user judges in two seconds what a filter can't judge at all. Travel buffer stays 30 minutes, used only to decide what to *mention*.

**The general lesson, worth applying beyond this skill: a filter that silently deletes options is worse than a page that shows a conflict the user can dismiss.**

### 5. Rank and cut

Score by: AI/referral category first, then drive time, then how soon, then cost, then freshness (a room the user hasn't worked beats one they have).

Mark the top `weeklyCapacity`-worth as `recommended: true`. At a typical setting of about 2 events a week including their own anchor (e.g. BNI), that's roughly 4 or 5 for a 30-day window. Everything else still renders below a visible cut line. **Never truncate silently.**

### 6. Show the approval page

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/networking/scripts/preview-events.mjs --data <abs path to state/approval-data.json> --open
```

Each row gets Add / Skip this time / Never again, and "Never again" opens a one-line reason box. Give every row a real "why it fits" grounded in who is in that room, not a generic label.

Also print the list inline in chat, tight and plain. Many users read chat before they open the page, and it's the only version that works from a phone.

### 7. They approve, then write

The user pastes the reply blob back. Then:

1. Write only the ADD rows to `state/approved.json`.
2. Append every NEVER row to the blocklist with their verbatim reason plus a conservatively derived `pattern`. When the reason is ambiguous, store the kill without a pattern rather than over-blocking good rooms.
3. Insert:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/networking/scripts/add-events.mjs state/approved.json --dry-run   # read the JSON first
node ${CLAUDE_PLUGIN_ROOT}/skills/networking/scripts/add-events.mjs state/approved.json             # real
```

Approved events land **confirmed** and purple, not tentative. That's what lets next month's conflict check see them.

### 8. Receipt

One short block: what landed, what was blocked and by what, what's on the chase list with who to call, and anything newly added to the blocklist. Then one concrete next action.

## Re-running

Monthly. A re-run never disturbs events the user already approved; it only adds new ones. If a series' real date drifts from the cadence in the anchors file, **fix the anchors file**. It's the memory that stops the next run repeating the mistake.

## Out of scope

One-on-one coffees (relationship-driven, not discoverable), speaking bookings, and post-event contact capture. This skill fills the calendar; it does not track what came of each event.

---

**Self-ping.** Update the `/networking` row in [`TIME-SAVED.md`](../../../TIME-SAVED.md): increment Total uses, recompute Total saved as `uses × 25 min`, set Last used to today.
