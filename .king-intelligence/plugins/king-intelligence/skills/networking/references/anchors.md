# Networking anchors + fit rules

This is the guide for the `/networking` skill's **Layer 1 (recurring anchors)** and the shared fit filters. The user's *actual* anchor list lives in their config (`skills["networking"].recurringAnchors`), not here. This file explains how anchors work and how the list grows.

## What an anchor is

An anchor is a recurring room the user reliably shows up to: a weekly chapter meeting, a monthly chamber breakfast, a standing meetup. The skill computes each anchor's in-window dates from its cadence and adds the occurrences that fall in the horizon.

**The list starts empty.** A new client has no anchors. They build the list over time: each run surfaces new rooms, and when one becomes a regular, the user tells you and you save it to `recurringAnchors`. Do not invent anchors to fill the list.

## Cadence notation

Each saved anchor carries a cadence rule. "nth Weekday" = the nth occurrence of that weekday in the month (e.g. "3rd Friday" = third Friday). The skill computes the in-window dates from this, then verifies against a source link where one exists. Anything only projected (not confirmed from a source) gets tagged `(date projected — confirm)` in the receipt.

A reasonable shape for each saved anchor:

```
{ "name": "...", "cadence": "1st Tuesday", "time": "8:00–9:30 AM",
  "venue": "...", "cost": "...", "roomType": "buyer | peer | mixed",
  "verify": "https://... (Eventbrite series / org calendar, optional)" }
```

## Fit rules (apply to everything, both layers)

- **Radius:** keep events within the user's configured `radius` of their `city` (default ~30-min drive). A farther city is allowed only when the event tightly matches a focus the user named (e.g. an AI-only event in the next metro over). Tag those so the longer drive is obvious.
- **ICP balance:** aim for a balanced mix — roughly half buyer rooms (chambers, small-business groups, the industries the user sells into) and half peer/referral rooms (their professional community, founders, consultants). The user can override with a focus argument.
- **Out of scope, never add:** one-on-one coffees (referral driven, not discoverable), and speaking bookings (a separate pipeline).
- **Cost:** paid events are fine — include them, just put the price in the description. Do not filter by price.

## Building the anchor list over time

- When the user says they attend something regularly, or a discovered event clearly belongs to a series they keep going to, offer to save it as an anchor.
- When a saved cadence drifts from reality (the series moved nights, changed venue), update it in config so the next run is right.
- **Skip-don't-duplicate:** if the user already has a series as a true recurring event on their calendar, do NOT also add it as an anchor candidate — the dedup will catch it, but skipping up front keeps the receipt clean.

## Known traps to watch for

- **Same-slot clashes:** two anchors (or an anchor and a strong new find) can fall on the same morning. Surface it as a conflict, do not silently add both.
- **Seasonal drift:** dates for series 2–3 months out are often unposted. Project from the cadence, tag `(date projected — confirm)`, and note the confirm contact in the receipt if the user gave you one.
- **Phone-only / JS-walled sources:** some chambers and groups run real programming but have no machine-readable calendar. The skill can't see them — note them in the receipt as "call to confirm" rather than pretending coverage.
