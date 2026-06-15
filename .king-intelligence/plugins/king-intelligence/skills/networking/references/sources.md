# Discovery sources for Layer 2 (new finds)

Where the `/networking` skill looks for fresh events. These are *templates* — parameterize each by the user's configured `city`. Add anything in the config's `eventSources` to this list at runtime.

## Cost / tooling rules (hard)

- Use **ordinary web search**: `WebSearch` for broad lookups, `WebFetch` to read a specific event or calendar page and confirm a date.
- **Avoid expensive deep-research API calls.** For "deep" coverage, run several cheap searches and synthesize the results yourself rather than reaching for a costly research endpoint.
- Keep total discovery to roughly **10–20 search calls** per run. Breadth over depth.

## Best machine-readable source types (start here)

Replace `<city>` with the user's city and `<region>` with their state/metro.

| Source type | What it has | How to query |
|---|---|---|
| **Eventbrite — city + topic** | networking / AI / entrepreneur / small-business events | Fetch the city-topic pages: `eventbrite.com/d/<region>--<city>/networking/`, `.../ai/`, `.../entrepreneur/`, `.../small-business/`. Read dates + cost + venue off the cards. |
| **Meetup — local groups** | recurring tech / AI / founder / industry meetups | Search Meetup for `<city>` + the user's field; read the group's `/events/` page. |
| **Local / regional chamber of commerce** | chamber programming (breakfasts, lunch-and-learns, after-hours) | Find the chamber's events or "Atlas"-style calendar page and fetch it. |
| **Coworking / innovation hubs** | founder events, workshops, demo nights | Find the hub's `/events/` page or its Eventbrite collection. |
| **Public library — small-business/entrepreneur programming** | free small-business and entrepreneur sessions | Search the main library's small-business or business-resource page. |
| **Luma / startup networks** | pitch nights, startup events | Search Luma for the local or regional startup network. |
| **Industry associations the user sells into** | the buyer rooms — association chapters in the user's target market | Find the local chapter's meeting-info / events page. |

## Focus carve-outs

If the user gave a focus argument ("AI only", "buyers only"), filter to it first, then rank. A focus is also what justifies a longer drive: an event in a farther city is allowed only when it tightly matches the named focus. Tag those with the drive time so it's obvious.

## Phone-only / JS-walled — CANNOT auto-pull (note in receipt, don't fake)

Some chambers and groups run real programming but expose no machine-readable calendar (phone-only, members-only portals, JS-walled). The skill can't see them, so it should tell the user "call to confirm" rather than imply coverage. If the user knows their numbers, capture them in config so you can surface them in the receipt.

## Scoring the finds (keep ~5–10)

Rank candidates by:
1. **Room fit** — does it hold buyers (chamber / small-biz / the user's target industries) or peers/referrers (their professional community / founders / consultants)? Keep the balanced mix.
2. **Drive time** — closer is better; in-city beats 25–30 min beats a focus-justified farther city.
3. **Cost** — free/cheap beats paid, but a paid room full of buyers can still win.
4. **Timing** — sooner in the window is more actionable.
5. **Freshness** — something the user hasn't been to recently beats the same room again.
