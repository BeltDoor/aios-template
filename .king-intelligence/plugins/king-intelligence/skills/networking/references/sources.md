# Discovery sources — four categories

One subagent per category (`model: sonnet`). Weighting and the spend cap live in SKILL.md.

## Tooling rules (hard)

- **`perplexity_search`** (~$0.005/call) for discovery, **WebSearch** for broad lookups, **WebFetch** to open a specific page and confirm a date.
- **Banned, no exceptions:** Firecrawl (any tool), `perplexity_reason`, `perplexity_research`. Hook-blocked and expensive. For depth, run more cheap searches and synthesise.
- **Cap:** 12 searches per category subagent, 60 for the whole run.
- **Always open the page before trusting a date.** Search snippets carry stale years and relative dates ("Tuesday at 8:00 AM") that read as current — confirm on the live page before it goes anywhere near a calendar.

---

## 1. AI-specific events (highest weight)

Attendance self-selects for people already interested in AI, which is why this category is ranked first.

**Format is not a filter.** If the topic is AI and the room is business owners, it counts — workshop, training, summit, breakfast, or meetup. Don't demote a room just because it's framed as a "workshop" rather than a "networking event": a room of owners who showed up to learn about AI *is* the target room. Exclude only on a real eligibility bar (see below) or a genuine radius miss.

**How to find them:**
- Search `eventbrite.com/d/<state>--<city>/ai/` and sweep "artificial intelligence" plus the user's metro/county names for one-off workshops and summits.
- Search Meetup for AI-focused groups local to the user's area — business-AI meetups, AI/data meetups run by tech chapters, and UX/PM/IT-pro groups that occasionally run AI-focused nights.
- Check the user's local chamber(s) and small-business orgs for one-off AI programming — many run an "AI for small business" session that doesn't surface in a generic events search.
- Check for any statewide AI-readiness or economic-development initiative in the user's state; some run regional events that land in radius.
- If a nearby larger metro qualifies under the `metroCarveOut` rule, its AI/tech meetup scene is in scope only when explicitly AI-focused.

### Annual / marquee AI events — radar tier, book early

The highest-fit rooms in a market are often annual, and a 30-day window can never see them in time — some sell out weeks or months ahead. Watch for patterns like: a regional chamber-run AI summit (often ~$25-50, half-day, executives + managers), an annual small-business tech summit run by an urban league or economic-development org, or a university-hosted AI/tech conference. Research these out to `radarDays` and surface them on the radar block with a registration deadline once found.

### Known ineligible pattern — do not surface

Some AI-focused orgs explicitly restrict attendance to non-vendors — no service providers, consultants, or sales leads. Check eligibility before listing a room: an event can be AI-focused, in radius, and still be a hard miss for a user who sells AI services. Add anything caught this way to the blocklist so it doesn't get re-surfaced.

## 2. Structured referral networks

Often the highest-confidence category once a referral-network chapter has already produced real results for the user — visiting *other* chapters of the same network is the point (the user's own chapter is skipped, it's already recurring).

**How to find them:**
- **BNI** — the national/regional chapter locator is often JS-walled; search "BNI &lt;town&gt; &lt;state&gt; chapter meeting" per nearby town, and check each chapter's own page/Facebook for meeting day, time, venue, and visitor policy.
- **LeTip**, **AmSpirit Business Connections**, **Gold Star Referral Clubs**, **Network After Work** — check each network's own chapter locator for coverage in the user's area. Some referral networks have no presence in a given region; that's a legitimate finding, not an oversight — note it once and don't keep re-checking every run.
- Any referral org already surfaced by Step 0.5's knowledge-graph check (see SKILL.md) is a first-class target here too — pull its `related:` links so the approval row can name the real connector.

Capture the **visitor policy** for each (free? how many visits before joining?) — it belongs in the event description.

## 3. Every chamber in radius

Several chambers have no machine-readable calendar. Dig rather than writing them off, which is the mistake an earlier version of this skill made.

**How to find them:**
- Search for every chamber of commerce within the config `radius` of the user's home zip — city chambers, township/area chambers, and any regional chamber.
- For each, try the chamber's own events page first, then its **Facebook events tab**, which is often the real calendar when the website isn't kept current.
- Only fall back to "call to confirm" after both fail, and then it goes on the chase list with the number, not the calendar.

## 4. Trade and industry associations

Narrower rooms, but everyone in them owns a business in an industry the user has already sold into. Build this list from the user's own client/prospect industries (ask if unclear) rather than a fixed list — e.g. trades associations, an insurance/benefits producer group (NABIP, NAIFA chapters), local SHRM chapters, manufacturing clusters.

| Segment | Where to look |
|---|---|
| Roofing / contractors / trades | state/regional roofing contractor associations, NARI, local home-builders association, local contractor meetups |
| HVAC / mechanical | ACCA state chapter, local supply-house training events |
| Insurance + benefits | NABIP regional chapter, NAIFA state chapter |
| HR | local SHRM chapters |
| Manufacturing | regional manufacturing/economic-development cluster events |

Search `<industry> association <user's metro/county/state>` per relevant industry.

## General sweeps (all categories)

Generic patterns to run for the user's own city/state — swap in the real values before searching:
`eventbrite.com/d/<state>--<city>/business-networking/`, `.../small-business/`, `.../entrepreneur/` · `meetup.com/find/us--<state>--<city>/professional-networking/` · `allevents.in/<city>/business` · the user's local library's small-business events page, if it has one · any local startup-community hub (Luma groups, coworking-space calendars) · a local business-journal or roundtable speaker series, if one exists

## Scoring

1. **Category weight** — AI, then referral networks, then chambers, then trade.
2. **Drive time** — closer wins.
3. **How soon** — sooner in the window is more actionable.
4. **Cost** — free beats paid, but a paid room full of buyers still wins.
5. **Freshness** — a room the user hasn't worked beats one they have.

If a focus argument was given ("AI only", "chambers only", "BNI visits"), filter to it first, then score.
