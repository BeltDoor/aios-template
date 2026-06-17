# Discovery sources for Layer 2 (new finds)

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

Where the `/networking` skill looks for fresh events. Customize the source list for your metro area — the examples below show an Akron/NE Ohio setup as a starting point.

## Tooling rules (hard)

- Use **`perplexity_search`** (cheap, ~$0.005/call) for finding events, **WebSearch** for broad lookups, **WebFetch** to read a specific event/calendar page and confirm a date.
- **Banned, no exceptions:** Firecrawl (any tool), `perplexity_reason`, `perplexity_research`. These are hook-blocked and expensive. For "deep" coverage, run several cheap `perplexity_search` calls and synthesize yourself.
- Keep total discovery to roughly **10-20 search calls** per run. Breadth over depth.

## Best machine-readable sources (start here)

Replace or extend this table with sources for your city/metro. Good patterns: Eventbrite city pages, Meetup group pages, innovation hub event calendars, chamber member portals.

| Source | What it has | How to query |
|---|---|---|
| **Eventbrite — your city** | networking / AI / entrepreneur / small-business events | Fetch the city-topic pages: `eventbrite.com/d/<state>--<city>/networking/`, `.../ai/`, `.../entrepreneur/`, `.../small-business/`. Read dates + cost + venue off the cards. |
| **Meetup — local AI/tech group** | recurring AI meetup + spinoffs | Your local Meetup group URL, e.g. `meetup.com/<your-group>/events/` |
| **Local innovation hub** | workshops, founder events | Hub's own events page + their Eventbrite collection |
| **Regional chamber (member portal)** | the chamber's full programming | Member calendar URL |
| **Roundtable / speaker luncheon org** | monthly speaker luncheons (big rooms) | Org website |
| **Library small-business network** | small-business / entrepreneur programming | Library's SBN events page |
| **Luma — regional startup network** | pitch nights, startup events | `lu.ma/<network-slug>` |
| **Free recurring networking series** | e.g. monthly free-lunch networking | Search Eventbrite or Meetup for your city |

## Metro carve-out (farther city — AI only)

If your config includes a `metroCarveOut` (e.g. a larger city 30-45 min away), include events from it ONLY when explicitly AI-focused. Tag them with the city name in the receipt so the drive time is obvious.

| Source | What |
|---|---|
| Larger-city AI/Data Meetup | `meetup.com/<group>/` |
| Regional tech partnership AI events | Organization website |

## Benefits / insurance ICP (weight up on "benefits only")

Add sources relevant to your ICP here. Examples:
- NABIP (National Association of Benefits and Insurance Professionals) local chapter
- NAIFA state/local chapter
- Local SHRM chapters (HR/benefits crowds)

## Phone-only / JS-walled — CANNOT auto-pull (note in receipt, do not fake)

Some chambers and organizations run real programming but have no machine-readable calendar. The skill cannot see them, so it should tell the user "call to confirm" rather than imply coverage. List any such sources here with their phone numbers so the receipt can include them.

Examples of the pattern:
- Fairlawn Area Chamber (phone), Hudson Chamber, local suburban chambers
- BNI chapter map (JS-walled) — only matters for visitor 1-on-1s, not this skill

## Scoring the finds (keep ~5-10)

Rank candidates by:
1. **Room fit** — does it hold buyers (chamber/small-biz/benefits) or peers/referrers (AI/founders/consultants)? Keep the balanced mix.
2. **Drive time** — closer is better; 0-15 min beats 25-30 min beats the metro carve-out city.
3. **Cost** — free/cheap beats paid, but a paid room full of buyers can still win.
4. **Timing** — sooner in the window is more actionable.
5. **Freshness** — something the user has not been to recently beats the same room again.

If a focus argument was given ("AI only", "benefits only"), filter to it first, then rank.
