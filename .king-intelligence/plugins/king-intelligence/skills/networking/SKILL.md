---
name: networking
description: Finds local networking events worth going to and, once approved, puts them on your calendar. Use when you type /networking or say "refresh my networking calendar", "find me events to go to", "what should I attend", "fill my calendar with networking", "add some networking events", "any good events coming up", "what's happening locally", "find me some rooms", "I need to get out and meet people", "any BNI chapters I should visit", or hand over any ask about which local rooms to show up at. Use even if you don't say networking. NOT for one-on-one coffees (referral/Calendly driven, not discoverable) and NOT for getting booked to speak.
argument-hint: "[optional: '60 days' | 'AI only' | 'chambers only' | 'BNI visits']"
disable-model-invocation: false
---

# /networking

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

Your calendar should always have somewhere worth going. This finds those rooms, proves the dates are real, checks you're actually free, and shows you everything on an approval page. **Nothing reaches your calendar until you check a box.**

An earlier version of this skill inserted events automatically and treated the calendar RSVP as the curation step. That's the wrong shape: it nearly double-booked a paid commitment, because a filter that silently commits you is worse than a page you can approve or skip in two seconds. This version asks first, every time.

## Step 0 — load settings and state

1. Read `references/king-intelligence-config.md` from the repo root (use the Read tool on that exact repo-relative path; the session CWD is the repo root) → the `## networking` section. Keys: `city`, `homeZip`, `radius`, `horizonDays`, `radarDays`, `weeklyCapacity`, `conflictRule`, `confirmedDatesOnly`, `calendarTool`, `selfEmail`, `calendarColor`, `metroCarveOut`, `anchorsFile`, `blocklistFile`.
2. Read the `anchorsFile` → the recurring series, the filter rules, and the accumulated gotchas.
3. Read the `blocklistFile` → rooms you already killed and why. **Filter these out before you ever see them again**, both exact titles and the learned patterns. Re-showing a room you already rejected is the friction that makes you stop running this.
4. **Ask the knowledge graph which orgs you already belong to** (see Step 0.5 below).
5. Get today's date: `date '+%m/%-d/%y - %H:%M %Z'` (bare `date`, never a `TZ=` override).

If the config or its `## networking` section is missing, say so and fall back to: your home city/zip, 30-min radius, 30-day horizon, 2 events/week, confirmed-dates-only, and hand over a list instead of writing to a calendar.

### Step 0.5 — read the knowledge graph before researching anything

If this setup keeps a knowledge vault (a `knowledge/companies/*.md` note per company, tagged with a `tags:` line), check it before researching anything new:

```bash
grep -l -E "tags:.*(\[|[[:space:]])(networking|networking-org|chamber|chamber-of-commerce|referral-source|masterminds)(,|\])" knowledge/companies/*.md \
  | xargs grep -l "^status: active"
```

Every hit is a **first-class research target**, exactly like a source in `sources.md`. Open each note and pull its `related:` links so the approval row can name the real connector — "the org that introduced you to Client X" is a far better reason to attend than "a sales and marketing group."

**Why this step exists.** A networking org can sit in the vault tagged `networking-org, referral-source, status: active` — because someone you know there produced a real referral — and still get missed on every run if the skill's idea of "where to look" is a hand-written list nobody has touched in months. There's a standing "consult the brain before acting" rule for exactly this reason; skip it here and you're violating your own rule.

This is the durable half of the fix: as the vault grows, new orgs get picked up with no edit to `sources.md`.

**Match the tag SET, not one tag.** Real vaults are inconsistent about which tag they use — `networking-org` on one note, `networking` + `referral` on another, `chamber-of-commerce` on a third, `networking` + `masterminds` on a fourth. A single-tag grep only finds one of them. Don't re-tag the vault to fix this; widen the match.

**Deliberately excludes bare `referral-partner`.** That tag marks individual partner companies who send you work — they don't hold meetings, so pulling them in adds false targets and wastes a research budget.

If there's no knowledge vault, skip this step and go straight to `sources.md`.

## The flow

### 1. Research, four categories, in parallel

Fan out one subagent per category (`model: sonnet` — this is gathering, not judgment). Source lists and per-category query tactics are in [`references/sources.md`](references/sources.md). Weight them in this order, which reflects what tends to convert:

1. **AI-specific events** — highest weight, if AI is part of your pitch. Attendance self-selects for people who already care about the topic.
2. **Structured referral networks** — visitor days at other BNI-style chapters, LeTip, AmSpirit, Gold Star. If a referral network has ever produced real business for you, visiting its undrained chapters is the highest-confidence bet on the list.
3. **Every chamber in radius** — including the ones with no machine-readable calendar. Dig their event pages and Facebook rather than writing them off.
4. **Trade and industry associations** — the rooms your actual clients live in.

Service clubs (Rotary, Kiwanis, Lions) are worth including only if a live speaking or visibility goal justifies them; otherwise leave them out.

**Two horizons.** Categories 2–4 look out `horizonDays` (default 30). **Category 1 and any annual/marquee event look out `radarDays`** (default 120), because the best niche rooms are sparse and sell out — a 30-day window sees none of them with time to register. Anything landing beyond `horizonDays` goes in the **radar** array, not the main list.

**Spend guard.** Discovery costs roughly $0.30 to $0.60 per run. Cap each subagent at **12 `perplexity_search` calls** and the whole run at **60**. `perplexity_reason` and `perplexity_research` are banned and hook-blocked; Firecrawl is out of scope here. For depth, run more cheap searches and synthesise yourself.

### 2. Prove every date

A date only counts if it was read off a live page or listing this run. Cadence arithmetic is a hypothesis, not a source: a "3rd Friday" series can drift, and an event page's relative date ("Tuesday, September 16") can be a leftover from a prior year.

- **Verified** → eligible for the calendar.
- **Unverified** → goes to the page's "worth chasing" section with the specific person and number to contact. It does not become a hold. A hold you can't trust teaches you to ignore the calendar.

### 3. Filter

- Inside `radius` of `homeZip`. Apply the `metroCarveOut` if the config sets one (e.g. a further-out metro only counts if the event is explicitly on-topic).
- Drop anything on the blocklist.
- Drop duplicates of each other and of what's already on your calendar.
- **Skip your own recurring rooms** (your own BNI chapter, etc.) — already a true recurring event. Visiting *other* chapters is a first-class suggestion.

### 4. Check you're actually free

Write the survivors to `state/candidates.json` (shape in the script header), then:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/networking/scripts/check-conflicts.mjs"
```

**Nothing on your calendar blocks anything. Everything is bendable.** The script annotates and never removes.

This rule is worth stating plainly because it's counterintuitive: a version that blocks on any confirmed commitment can hide most of the real options, and a version that blocks only on work commitments can still silently kill an event you personally asked for — with no visible reason the run looks thin. The instruction that fixes it: *don't let anything on the calendar actually block things.*

So every candidate reaches the page carrying its collisions ("Overlaps your 9-10 AM standing meeting"). You judge in two seconds what a filter can't judge at all. Travel buffer stays 30 minutes, used only to decide what to *mention*.

**The general lesson, worth applying beyond this skill: a filter that silently deletes options is worse than a page that shows a conflict you can dismiss.**

### 5. Rank and cut

Score by: category weight first (see `sources.md`), then drive time, then how soon, then cost, then freshness (a room you haven't worked beats one you have).

Mark the top `weeklyCapacity`-worth as `recommended: true`. That's the realistic plan at roughly 2 events a week, so about 4 or 5 for a 30-day window. Everything else still renders below a visible cut line. **Never truncate silently.**

### 6. Show the approval page

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/networking/scripts/preview-events.mjs" --data <abs path to state/approval-data.json> --open
```

Each row gets Add / Skip this time / Never again, and "Never again" opens a one-line reason box. Give every row a real "why it fits" grounded in who is in that room, not a generic label.

Also print the list inline in chat, tight and plain. Chat is often read before the page opens, and it's the only version that works from a phone.

### 7. You approve, then write

You paste the reply blob back. Then:

1. Write only the ADD rows to `state/approved.json`.
2. Append every NEVER row to the blocklist with your verbatim reason plus a conservatively derived `pattern`. When the reason is ambiguous, store the kill without a pattern rather than over-blocking good rooms.
3. Insert:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/networking/scripts/add-events.mjs" state/approved.json --dry-run   # read the JSON first
node "${CLAUDE_PLUGIN_ROOT}/skills/networking/scripts/add-events.mjs" state/approved.json             # real
```

Approved events land **confirmed**, not tentative. That's what lets next month's conflict check see them.

### 8. Receipt

One short block: what landed, what was blocked and by what, what's on the chase list with who to call, and anything newly added to the blocklist. Then one concrete next action.

## Re-running

Monthly is a reasonable default. A re-run never disturbs events you already approved; it only adds new ones. If a series' real date drifts from the cadence in the anchors file, **fix the anchors file**. It's the memory that stops the next run repeating the mistake.

## Out of scope

One-on-one coffees (relationship-driven, not discoverable), speaking bookings, and post-event contact capture. This skill fills the calendar; it does not track what came of it.
