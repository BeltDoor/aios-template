# Discovery sources — four categories

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

Where the `/networking` skill looks for events, grouped by category so the weighting in SKILL.md has something to fan out over. Customize the source list for your own metro area — the examples below (Eventbrite/Meetup/chamber URL patterns) are a starting point, not a fixed list.

One subagent per category (`model: sonnet`). Weighting and the spend cap live in SKILL.md.

## Tooling rules (hard)

- **`perplexity_search`** (~$0.005/call) for discovery, **WebSearch** for broad lookups, **WebFetch** to open a specific page and confirm a date.
- **Banned, no exceptions:** Firecrawl (any tool), `perplexity_reason`, `perplexity_research`. Hook-blocked and expensive. For depth, run more cheap searches and synthesise.
- **Cap:** 12 searches per category subagent, 60 for the whole run.
- **Always open the page before trusting a date.** Search snippets carry stale years and relative dates ("Tuesday at 8:00 AM") that read as current. See the stale-Eventbrite-year gotcha in your anchors file.

---

## 1. AI-specific events

Attendance self-selects for people already interested in AI, which is often why this category ranks first.

| Source | How to query |
|---|---|
| Local AI meetup group | `meetup.com/<your-ai-meetup-group>/events/` — some go dormant for months, check, don't project |
| A named local AI mastermind/breakfast | Search Eventbrite for the current month by name |
| Local IT-pro association chapter | `meetup.com/<your-it-pro-group>/` — frequent AI topics |
| Local UX/design meetup | `<your-ux-group>.com/events/` — often runs AI-focused nights with partner groups |
| Innovation-hub workshop series | `<your-hub>.org/events/` — the AI-topic sessions are top fit |
| Statewide or regional AI programming | e.g. a state AI-readiness initiative's events page |
| A larger nearby metro's AI/data meetup | `meetup.com/<metro-ai-group>/` — CLE-style carve-out applies, tag with the city name |
| Regional partnership AI/tech programming | Larger metro chamber-of-commerce-style org's AI roundtable, carve-out applies |

Also sweep generically: `eventbrite.com/d/<state>--<city>/ai/`, and search "artificial intelligence" + your city/county for one-off workshops and summits.

## 2. Structured referral networks

Often the proven channel for referral-driven businesses. The user's own chapter is skipped; visiting others is the point.

| Source | How to query |
|---|---|
| **BNI** | The national chapter finder is often JS-walled — go around it: search "BNI &lt;town&gt; &lt;state&gt; chapter meeting" per nearby town, and check each chapter's own page/Facebook for meeting day, time, venue and visitor policy |
| Named target chapter | If the user has a specific chapter they want to visit, confirm the venue and visitor terms directly |
| Other chapters in radius | Enumerate the nearby towns worth checking |
| LeTip | `letip.com` chapter locator |
| AmSpirit Business Connections | Search for chapters in your region; several show on Eventbrite |
| Gold Star Referral Clubs | `goldstarreferralclubs.com` — search your state |
| Network After Work | Metro-area events, usually on Eventbrite |

Capture the **visitor policy** for each (free? how many visits before joining?) — it belongs in the event description.

## 3. Every chamber in radius

Several chambers have no machine-readable calendar. Dig rather than writing them off.

| Chamber | Where to look |
|---|---|
| Main regional chamber | `<chamber>.org/events/` + a member portal calendar (often JS-walled — use the main site instead) |
| Suburb/city chambers | Each chamber's own site + Facebook events |
| Area chamber | chamber site + Facebook |
| Smaller local chambers | site events page, else Facebook |

For the phone-only ones: try the site's events page, then their **Facebook events tab**, which is usually the real calendar. Only fall back to "call to confirm" after both fail, and then it goes on the chase list with the number, not the calendar. (Keep the actual phone numbers and contact names in your own `anchorsFile`/`blocklistFile`, not in this shared reference.)

## 4. Trade and industry associations

Narrower rooms, but everyone in them owns a business in an industry the user has already sold into.

| Segment | Sources |
|---|---|
| Roofing / contractors / trades | State roofing contractor associations, NARI, local home-builders association, local contractor meetups |
| HVAC / mechanical | ACCA state chapter, local supply-house training events |
| Insurance + benefits | NABIP local chapter, NAIFA state/local chapter |
| HR | Local SHRM chapters |
| Manufacturing / industry-specific clusters | Regional industry cluster orgs, sector-specific meetups |

## General sweeps (all categories)

`eventbrite.com/d/<state>--<city>/business-networking/`, `.../small-business/`, `.../entrepreneur/` · `meetup.com/find/<region>/professional-networking/` · `allevents.in/<city>/business` · your local innovation hub's events page · your library system's small-business-network events page · `luma.com/<your-regional-network>` · regional free-networking sites · local speaker-luncheon org's site

## Scoring

1. **Category weight** — AI, then referral networks, then chambers, then trade.
2. **Drive time** — closer wins.
3. **How soon** — sooner in the window is more actionable.
4. **Cost** — free beats paid, but a paid room full of buyers still wins.
5. **Freshness** — a room the user hasn't worked beats one they have.

If a focus argument was given ("AI only", "chambers only", "BNI visits"), filter to it first, then score.
