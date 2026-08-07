# Discovery sources — four categories

One subagent per category (`model: sonnet`). Weighting and the spend cap live in SKILL.md.

The tables below are templates. Replace the `[Example]` rows with the real orgs, sites, and contacts in your own metro the first time you run this skill — a flat generic site list keeps surfacing the same handful of rooms and misses the ones that actually convert (the good targets are usually the ones with no clean calendar page, that you have to dig for).

## Tooling rules (hard)

- **`perplexity_search`** (~$0.005/call) for discovery, **WebSearch** for broad lookups, **WebFetch** to open a specific page and confirm a date.
- **Banned, no exceptions:** Firecrawl (any tool), `perplexity_reason`, `perplexity_research`. Hook-blocked and expensive. For depth, run more cheap searches and synthesise.
- **Cap:** 12 searches per category subagent, 60 for the whole run.
- **Always open the page before trusting a date.** Search snippets carry stale years and relative dates ("Tuesday at 8:00 AM") that read as current. See the stale-date gotcha in the anchors file.

---

## 1. AI-specific events (highest weight, if AI is part of your pitch)

Attendance self-selects for people already interested in the topic, which is why this category is ranked first when it's relevant to your business.

**Format is not a filter.** If the topic is on-target and the room is business owners, it counts — workshop, training, summit, breakfast or meetup. Don't exclude an AI-agents workshop as "vendor training rather than a networking event" — a room of owners who showed up to learn about your topic *is* the target room. Exclude only on a real eligibility bar or a genuine radius miss.

| Source | How to query |
|---|---|
| **[Example] local AI community group** | The closest thing to a purpose-built room for your buyer — monthly meetups explicitly aimed at local small-business owners exploring AI. Confirm venue/time by RSVP or phone if the site doesn't publish it |
| **[Example] sales/marketing org with AI programming** | A trade org that runs occasional AI-focused sessions. Also worth checking as a referral-network entry, see §2 |
| **[Example] founder-run AI breakfast/mastermind** | Monthly, search the host's name + your city on Eventbrite for the current month |
| **[Example] regional AI meetup** | Meetup-hosted groups can go dormant for months and their pages sometimes disappear entirely; check, never project |
| **[Example] IT/tech professional chapter** | Frequent AI-adjacent topics |
| **[Example] UX/design community** | Sometimes co-hosts AI-focused nights with adjacent groups |
| **[Example] startup hub workshop series** | Recurring weekday-morning slot; the AI-topic sessions are top fit |
| Statewide AI initiative or association | Some in-region events |
| Neighboring-metro AI/tech meetup | If in your extended radius, tag `(out-of-core-metro)` |
| Neighboring-metro chamber tech/AI programming | Tag `(out-of-core-metro)` |

Also sweep generically: `eventbrite.com/d/<state>--<city>/ai/`, and search "artificial intelligence" + your city/county names for one-off workshops and summits.

### Annual / marquee AI events — radar tier, book early

These are the highest-fit rooms in most regions and a 30-day window can never see them in time — some sell out. Research these out to `radarDays` and surface them on the radar block with a registration deadline.

| Event | Roughly when | Detail |
|---|---|---|
| **[Example] Regional AI Tech Innovation Summit** | annual | Executives + managers, breakout tracks. Can sell out — check early |
| **[Example] Metro Chambers AI Summit** | annual | Half-day, chamber-hosted |
| **[Example] Trade-org AI workshop** | varies | See the trade-org entry above |
| **[Example] Urban League / civic Tech Summit** | annual | Small-business tech track |
| **[Example] University Conference** | annual | University-hosted, student-union venue |

### Known ineligible — do not surface

Some real-looking rooms have an eligibility bar that quietly excludes you. Example pattern: a "roundtable" that markets itself as open networking but explicitly states in its own materials that it cannot invite service providers, consultants, or sales leads — which is exactly a consultant's profile. That's an eligibility bar, not a preference; don't keep re-surfacing it. Once you confirm a room is ineligible, add it to the blocklist so future runs don't re-research it.

## 2. Structured referral networks

If a referral network has ever produced real business for you, this is the highest-confidence category. Your own chapter is skipped; visiting others is the point.

| Source | How to query |
|---|---|
| **[Your referral network]'s chapter finder** | If the official locator is JS-walled, go around it: search "<network> <town> <state> chapter meeting" per town, and check each chapter's own page/Facebook for meeting day, time, venue and visitor policy |
| Named target chapters | List the specific chapters worth a visit as you identify them, with day/time |
| Other chapters in your radius | List the nearby towns you haven't visited yet |
| LeTip | chapter locator for your region |
| AmSpirit Business Connections | chapters in your region; several show on Eventbrite |
| Gold Star Referral Clubs | chapter locator for your region |
| Network After Work | events in your metro, usually Eventbrite |
| **[Example] sales/marketing trade org** | If you're already connected here through someone, note the connector — that chain is worth naming on the approval row |

**Verified absent, don't re-hunt:** once a network confirms it has no presence in your region (its own locator returns nothing, or its nearest chapter is well outside your radius), keep it in the table so a future run doesn't treat the absence as an oversight, but don't spend calls re-confirming it.

Capture the **visitor policy** for each (free? how many visits before joining?) — it belongs in the event description.

## 3. Every chamber in radius

Several have no machine-readable calendar. Dig rather than writing them off.

| Chamber | Where to look |
|---|---|
| Main metro chamber | its own `/events/` page, plus any members-only calendar (often JS-walled — use the main public site instead) |
| Neighboring-town chambers | each chamber's own site + Facebook events |
| Smaller/phone-only chambers | site's events page, then Facebook events tab, then phone |

For the phone-only ones: try the site's events page, then their **Facebook events tab**, which is usually the real calendar. Only fall back to "call to confirm" after both fail, and then it goes on the chase list with the number, not the calendar.

## 4. Trade and industry associations

Narrower rooms, but everyone in them owns a business in an industry you've already sold into.

| Segment | Sources |
|---|---|
| Your top 1-2 client industries | State/regional trade associations, local supply-house or industry meetups |
| Insurance + benefits (if relevant) | Regional NABIP/NAIFA-style chapters |
| HR (if relevant) | Local SHRM chapters |
| Manufacturing / your other verticals | Regional industry clusters and trade events |

## General sweeps (all categories)

`eventbrite.com/d/<state>--<city>/business-networking/`, `.../small-business/`, `.../entrepreneur/` · `meetup.com/find/<state>--<city>/professional-networking/` · `allevents.in/<city>/business` · local library small-business-network pages · `luma.com/<relevant-community>` · regional "outstanding networking" style event aggregators · chamber-hosted "roundtable"/speaker series pages

## Scoring

1. **Category weight** — AI/on-topic, then referral networks, then chambers, then trade.
2. **Drive time** — closer wins.
3. **How soon** — sooner in the window is more actionable.
4. **Cost** — free beats paid, but a paid room full of buyers still wins.
5. **Freshness** — a room you haven't worked beats one you have.

If a focus argument was given ("AI only", "chambers only", "BNI visits"), filter to it first, then score.
