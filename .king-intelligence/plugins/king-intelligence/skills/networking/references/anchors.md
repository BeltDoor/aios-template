# Networking anchors + filter rules

Source of truth for the `/networking` skill's recurring-series and filter-rule layer. This file is meant to be filled in and maintained by the user for their own market — the skill reads it every run, so keeping it accurate is what stops the next run from repeating a mistake.

When a cadence here drifts from reality, fix it here — the skill reads this file every run.

## Filter rules (apply to everything, both layers)

- **Radius:** pull from the user's config (`radius` from `homeZip`). Update the examples below once real local distances are known.
- **Metro carve-out:** if a nearby larger metro only makes sense to include for AI-focused events, apply the `metroCarveOut` rule from config rather than hardcoding a city name here.
- **ICP balance:** decide the buyer-vs-peer mix that fits the user (e.g. "roughly half buyer rooms — chamber / small-business / benefits, half peer/referral rooms — AI community, founders, consultants") and record the chosen split here once it's set.
- **Out of scope, never add:** one-on-one coffees (referral/Calendly driven), and speaking bookings (a separate pipeline) — unless the user says otherwise.
- **Cost:** paid events are fine — include them, just put the price in the description. Do not filter by price alone.

## Cadence notation

"nth Weekday" = the nth occurrence of that weekday in the month (e.g. "3rd Friday" = third Friday). The skill computes the in-window dates from this, then verifies against a source link where one exists. Anything only projected (not confirmed from a source) gets tagged `(date projected — confirm)` in the receipt.

## Core anchors — auto-add every run when they fall in the window

Fill this table with the user's own standing recurring rooms: their own chapter/group memberships and any series they already attend regularly. Leave rows empty (or delete the examples) until real ones are known — never invent a local venue to fill space.

| Series | Cadence | Time | Venue | Cost | Room type | Verify against |
|---|---|---|---|---|---|---|
| *(example)* the user's own referral chapter | Weekly, e.g. Thu | e.g. 7:15–9:30 AM | *(the user's real venue)* | member | referral | **DO NOT ADD — already a recurring event on the user's calendar.** Listed so the skill knows to skip it. |
| *(example)* a known monthly breakfast series | 1st Tue | e.g. 8:00–9:30 AM | *(the user's real venue)* | e.g. $20 | buyer/general | *(link to the series' own listing page)* |

## Secondary anchors — include when they fit the window / focus arg (not every run)

Same idea, lower priority. Add the user's known secondary rooms here as they're discovered, with a note on why they matter or clash with something else.

| Series | Cadence | Venue | Cost | Room type | Notes |
|---|---|---|---|---|---|
| *(example)* a chamber after-hours mixer | ~Monthly | *(the user's real venue)* | TBD | buyer/general | walk-up friendly |

## Known traps

Keep a running list of anything discovered that would otherwise repeat a mistake: two series that clash on the same recurring slot, months where a listing goes unposted and the date has to be projected, chambers with no machine-readable calendar (note them so the skill doesn't pretend it has coverage there, and instead flags them on the chase list as "call to confirm").
