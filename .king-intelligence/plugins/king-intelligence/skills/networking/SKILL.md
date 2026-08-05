---
name: networking
description: Finds local networking events worth going to and, once approved, puts them on the user's calendar. Use when the user types /networking or says "refresh my networking calendar", "find me events to go to", "what should I attend", "fill my calendar with networking", "add some networking events", "any good events coming up", "what's happening locally", "find me some rooms", "I need to get out and meet people", "any BNI chapters I should visit", or hands over any ask about which local rooms to show up at. Use even if they don't say networking. NOT for one-on-one coffees (referral/Calendly driven, not discoverable) and NOT for getting booked to speak.
argument-hint: "[optional: '60 days' | 'AI only' | 'chambers only' | 'BNI visits']"
disable-model-invocation: false
---

# /networking

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

The user's calendar should always have somewhere worth going. This finds those rooms, proves the dates are real, checks they're actually free, and shows everything on an approval page. **Nothing reaches the calendar until the user checks a box.**

Curation happens on the approval page, never automatically. A version that inserted events straight to the calendar and treated the RSVP itself as the curation step nearly double-booked a user against a paid commitment — that failure mode is exactly what this flow guards against.

## Step 0 — load settings and state

1. Read [`references/king-intelligence-config.md`](../../../references/king-intelligence-config.md) → the `## networking` section. Keys: `city`, `homeZip`, `radius`, `horizonDays`, `radarDays`, `weeklyCapacity`, `conflictRule`, `confirmedDatesOnly`, `calendarTool`, `selfEmail`, `calendarColor`, `metroCarveOut`, `anchorsFile`, `blocklistFile`.
2. Read the `anchorsFile` → the user's recurring series, the filter rules, and the accumulated gotchas.
3. Read the `blocklistFile` → rooms the user killed and why. **Filter these out before they're ever shown**, both exact titles and the learned patterns. Re-showing a room the user already rejected is the friction that makes them stop running this.
4. **Ask the brain which orgs the user already belongs to** (see Step 0.5 below), if a knowledge vault is available.
5. Get today's date: `date '+%m/%-d/%y - %H:%M %Z'` (bare `date`, never a `TZ=` override).

If the config or its `## networking` section is missing, say so, ask the user for their home city/zip and preferred radius, and fall back to: 30-min radius, 30-day horizon, 2 events/week, confirmed-dates-only, and hand over a list instead of writing to a calendar.

### Step 0.5 — read the knowledge graph before researching anything (if the user keeps one)

If the setup maintains a `knowledge/` vault, check it before researching anything new:

```bash
grep -l -E "tags:.*(\[|[[:space:]])(networking|networking-org|chamber|chamber-of-commerce|referral-source|masterminds)(,|\])" knowledge/companies/*.md \
  | xargs grep -l "^status: active"
```

Every hit is a **first-class research target**, exactly like a source in `sources.md`. Open each note and pull its `related:` links so the approval row can name the real connector — "met through Sam at Acme" is a far better reason to attend than "a sales and marketing group."

**Why this step exists.** An org the user is already connected to can sit tagged and active in the vault and still get missed if the source list is a hand-written file nobody has revisited in a while. A standing "consult the brain before acting" habit only holds if this skill actually reads it. This is the durable fix: as the vault grows, new orgs get picked up with no edit to `sources.md` required.

**Match the tag SET, not one tag.** Real vaults tag inconsistently — one org might carry `networking-org`, another `networking` + `referral`, another just `chamber-of-commerce`. A single-tag grep only finds the first pattern. Don't re-tag the vault to fix this; widen the match.

**Deliberately excludes bare `referral-partner`.** That tag marks individual partner companies who send the user work — they don't hold meetings, so pulling them in adds false targets and wastes a research budget.

If there's no `knowledge/` vault, skip this step and go straight to research.

## The flow

### 1. Research, four categories, in parallel

Fan out one subagent per category (`model: sonnet` — this is gathering, not judgment). Source lists and per-category query tactics are in [`references/sources.md`](references/sources.md). Weight them in this order, which reflects what tends to convert best:

1. **AI-specific events** — highest weight. Attendance self-selects for people who already care about AI, which is the whole pitch.
2. **Structured referral networks** — visitor days at other BNI chapters, LeTip, AmSpirit, Gold Star. If a referral-network chapter has already produced real results for the user, visiting undrained chapters of the same network is often the highest-confidence bet on the list.
3. **Every chamber in radius** — including the ones with no machine-readable calendar. Dig their event pages and Facebook rather than writing them off.
4. **Trade and industry associations** — the rooms the user's actual clients live in.

Service clubs (Rotary, Kiwanis, Lions) are out by default — they only pay off as part of a speaking-bookings play, which is a separate pipeline from this skill.

**Two horizons.** Categories 2–4 look out `horizonDays` (30 by default). **Category 1 and any annual/marquee event look out `radarDays` (120 by default)**, because the best AI rooms are sparse and can sell out weeks or months ahead. A monthly 30-day run sees none of them with time to register. Anything landing beyond `horizonDays` goes in the **radar** array, not the main list.

**Spend guard.** Discovery costs roughly $0.30 to $0.60 per run. Cap each subagent at **12 `perplexity_search` calls** and the whole run at **60**. `perplexity_reason` and `perplexity_research` are banned and hook-blocked; Firecrawl is out of scope here. For depth, run more cheap searches and synthesise yourself.

### 2. Prove every date

A date only counts if it was read off a live page or listing this run. Cadence arithmetic is a hypothesis, not a source. The anchors file has recorded months where a recurring series landed on a different week than its usual cadence, and Eventbrite pages whose date snippet ("Tuesday, September 16") turned out to be from a prior year.

- **Verified** → eligible for the calendar.
- **Unverified** → goes to the page's "worth chasing" section with the specific person and number to contact. It does not become a hold. A hold he can't trust teaches him to ignore the calendar.

### 3. Filter

- Inside `radius` of `homeZip`. Apply the `metroCarveOut` rule from config (a nearby larger metro only if explicitly AI-focused).
- Drop anything on the blocklist.
- Drop duplicates of each other and of what's already on the user's calendar.
- **Skip the user's own BNI chapter** (or other standing recurring commitment) — already a true recurring event. Visiting *other* chapters is a first-class suggestion.

### 4. Check the user is actually free

Write the survivors to `state/candidates.json` (shape in the script header), then:

```bash
node .claude/skills/networking/scripts/check-conflicts.mjs
```

**Nothing on the calendar blocks anything by default. Everything is bendable.** The script annotates and never removes.

This rule was learned the hard way. An early version blocked on any confirmed commitment and hid most of the real options. A second version blocked only on work commitments and still silently killed events the user genuinely wanted, with no visible sign anything had been dropped — the run just looked thin for no obvious reason. The fix: don't let anything on the calendar actually block things; treat it all as bendable unless the user says otherwise.

So every candidate reaches the page carrying its collisions ("Overlaps your Tuesday call, 9-10 AM"). The user judges in two seconds what a filter can't judge at all. Travel buffer stays 30 minutes, used only to decide what to *mention*.

**The general lesson, worth applying beyond this skill: a filter that silently deletes options is worse than a page that shows a conflict the user can dismiss.**

### 5. Rank and cut

Score by: AI/referral category first, then drive time, then how soon, then cost, then freshness (a room the user hasn't worked beats one they have).

Mark the top `weeklyCapacity`-worth as `recommended: true`. That's the realistic plan at the user's stated pace — commonly around 2 events a week including BNI, so about 4 or 5 for a 30-day window. Everything else still renders below a visible cut line. **Never truncate silently.**

### 6. Show the approval page

```bash
node .claude/skills/networking/scripts/preview-events.mjs --data <abs path to state/approval-data.json> --open
```

Each row gets Add / Skip this time / Never again, and "Never again" opens a one-line reason box. Give every row a real "why it fits" grounded in who is in that room, not a generic label.

Also print the list inline in chat, tight and plain. The user often reads chat before opening the page, and it's the only version that works from a phone.

### 7. The user approves, then write

The user pastes the reply blob back. Then:

1. Write only the ADD rows to `state/approved.json`.
2. Append every NEVER row to the blocklist with the user's verbatim reason plus a conservatively derived `pattern`. When the reason is ambiguous, store the kill without a pattern rather than over-blocking good rooms.
3. Insert:

```bash
node .claude/skills/networking/scripts/add-events.mjs state/approved.json --dry-run   # read the JSON first
node .claude/skills/networking/scripts/add-events.mjs state/approved.json             # real
```

Approved events land **confirmed** and purple, not tentative. That's what lets next month's conflict check see them.

### 8. Receipt

One short block: what landed, what was blocked and by what, what's on the chase list with who to call, and anything newly added to the blocklist. Then one concrete next action.

## Re-running

Monthly. A re-run never disturbs events the user already approved; it only adds new ones. If a series' real date drifts from the cadence in the anchors file, **fix the anchors file**. It's the memory that stops the next run repeating the mistake.

## Out of scope

One-on-one coffees (relationship-driven, not discoverable), speaking bookings, and post-event contact capture. This skill fills the calendar; it does not track what came of an event afterward — that's a separate workflow.

---

**Self-ping.** Update the `/networking` row in [`TIME-SAVED.md`](../../../TIME-SAVED.md): increment Total uses, recompute Total saved as `uses × 25 min`, set Last used to today.
