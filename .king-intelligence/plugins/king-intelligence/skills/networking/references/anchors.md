# Anchors reference — data model for the /networking skill

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

This file is a **data-model explainer**. Your actual recurring anchors (the series you reliably attend), filter rules, and accumulated gotchas live at the path set in `anchorsFile` inside your `## networking` config block in `references/king-intelligence-config.md`. The skill reads THAT file every run — this file just documents the expected shape so you can populate your own.

---

## Filter rules block (apply to everything, both anchors and new finds)

A short set of rules at the top of your anchors file that apply to every candidate:

- **Radius** — how far you'll drive (e.g. "≤30-min drive from ZIP 4XXXX"). A slightly farther town can still be IN if the actual drive time is close; state the exception explicitly rather than relying on straight-line distance.
- **Metro carve-out** — any exception to the radius (e.g. "a farther city is allowed only if explicitly AI-focused").
- **ICP balance** — your preferred buyer/peer ratio (e.g. "roughly half buyer rooms — chamber/small-business/benefits — half peer/referral rooms — AI community/founders/consultants").
- **Out of scope, never add** — event types the skill must never surface (e.g. one-on-one coffees, speaking bookings — these run through other channels).
- **Cost policy** — whether paid events are included (usually yes — include them, just put the price in the description; don't filter by price alone).

## Cadence notation

"nth Weekday" = the nth occurrence of that weekday in the month (e.g. "3rd Friday" = third Friday). The skill computes the in-window dates from this, then verifies against a source link where one exists. Anything only projected (not confirmed from a source) gets tagged `(date projected — confirm)` in the receipt.

## Core anchors table — auto-add every run when they fall in the window

| Series | Cadence | Time | Venue | Cost | Room type | Verify against |
|---|---|---|---|---|---|---|
| Your own referral chapter (e.g. BNI) | Weekly | — | — | member | referral | **DO NOT ADD — already a recurring event on your calendar.** List it so the skill knows to skip it. |
| Recurring breakfast/lunch series | 1st Tue | 8:00–9:30 AM | Venue name + address | ~$20 | buyer/general | Eventbrite series link, if one exists |
| Recurring happy hour / evening series | 2nd Wed | 4:00–6:00 PM | Venue name + address | Free (cash bar) | buyer/general | Eventbrite link — flag if often unposted, note who to confirm with |
| Local AI breakfast / mastermind | 3rd Tue | 8:30–10:00 AM | Venue name + address | Free (pay for food) | peer/AI | Eventbrite — search current month |
| Regional AI meetup | 2nd Fri | 6:00 PM | Venue name + address | Free | peer/AI | Meetup group link |
| Chamber "morning buzz" style networking | Monthly, e.g. 3rd Fri pattern | 7:30–9:00 AM | Chamber HQ | TBD | buyer/general | Chamber calendar — confirm exact date, high-signal room |
| Chamber lunch & learn | Monthly | 11:30 AM–1:00 PM | Chamber HQ | TBD | buyer/small-biz | Chamber calendar |

Add as many rows as you actually have. Mark any series that's already a true recurring calendar event with a note to skip it — the dedup step catches it too, but marking it explicitly is cleaner.

## Secondary anchors table — include when they fit the window / focus arg (not every run)

| Series | Cadence | Venue | Cost | Room type | Notes |
|---|---|---|---|---|---|
| Same series in a second nearby town | 3rd Tue | Venue name + address | ~$25 | buyer/general | Clashes with your AI breakfast (both 3rd Tue AM) — pick one, flag the conflict |
| Chamber after-hours networking | ~Monthly | Chamber area | TBD | buyer/general | Walk-up friendly |
| Chamber small-business roundtable | ~Monthly | Chamber HQ | TBD | buyer/small-biz | |
| Regional speaker luncheon | Monthly, midday | Venue name | ~$30 | mixed/visibility | Big rooms, strong speakers — also a speaking target |
| Walk-up local networking group | 1st Fri | Venue name | Free, no RSVP | general | Walk-up friendly, no barrier to entry |
| Innovation-hub workshop series | ~Bi-monthly | Venue name | $5 / free for members | peer/AI | Topics rotate; AI-focused ones are top fit |
| Industry-specific association (e.g. benefits/insurance) | Monthly | Usually nearby | TBD | **target ICP** | Your target market — weight up on a focused filter arg |
| Suburban chamber events | Varies | Suburb + circle | Varies | buyer/local | Note any warm relationship here |
| Free rotating regional meetup | Monthly (in-person + virtual) | Rotates between towns | Free | general | Low-friction, free |

## Known traps

Document your own recurring gotchas here as you find them. Examples of the pattern:

- **Same-morning clash** — two series can land on the same weekday morning some months. Surface it as a conflict, don't silently add both.
- **Summer/holiday drift** — some series go quiet for a stretch and dates for months 2–3 out are often unposted. Project from the cadence, tag `(date projected — confirm)`, and note the confirm contact in the receipt.
- **Phone-only chambers** — chambers with no machine-readable calendar can't be auto-pulled. Note them in the receipt as "call to confirm" rather than pretending coverage.
