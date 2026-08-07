# Networking anchors + filter rules

Source of truth for the `/networking` skill's Layer 1 (your own recurring rooms). This file starts as a template — replace the example rows below with your own real recurring events the first time you run the skill, then keep it current. When a cadence drifts from reality, fix it here — the skill reads this file every run.

## Filter rules (apply to everything, both layers)

- **Radius:** set your own drive-time cutoff from `homeZip` in the config (a typical default is ~30 minutes). Decide case by case whether a slightly-further town is worth including.
- **Further-metro carve-out:** if a nearby larger metro is out of your normal radius, allow it in only when the event is explicitly on-topic for you (e.g. AI-focused, or your specific niche).
- **ICP balance:** decide your own mix — e.g. roughly half buyer rooms (chamber / small-business / your ICP's trade group), half peer/referral rooms (community, founders, consultants).
- **Out of scope, never add:** one-on-one coffees (referral/Calendly driven), and speaking bookings (separate pipeline).
- **Cost:** paid events are fine — include them, just put the price in the description. Do not filter by price alone.

## Cadence notation

"nth Weekday" = the nth occurrence of that weekday in the month (e.g. "3rd Friday" = third Friday). The skill computes the in-window dates from this, then verifies against a source link where one exists. Anything only projected (not confirmed from a source) gets tagged `(date projected — confirm)` in the receipt.

## Core anchors — auto-add every run when they fall in the window

Replace this example table with your own standing rooms. The row for your own recurring chapter/group should say **DO NOT ADD** so the skill knows to skip it (you're already going).

| Series | Cadence | Time | Venue | Cost | Room type | Verify against |
|---|---|---|---|---|---|---|
| **[Your own referral chapter]** | Weekly [day] | [time] | [venue] | member | referral | **DO NOT ADD — already a recurring event on your calendar.** Listed so the skill knows to skip it. |
| **[Example] Breakfast Series** | 1st Tue | 8:00–9:30 AM | [venue] | $20 | buyer/general | [event page link] |
| **[Example] Happy Hour** | 2nd Wed | 4:00–6:00 PM | [venue] | Free (cash bar) | buyer/general | [event page link] — often unposted more than a month out; project + confirm with the organizer |
| **[Example] AI Breakfast** | 3rd Tue | 8:30–10:00 AM | [venue] | Free (pay food) | peer/AI | [event page link] — search current month |
| **[Example] AI Meetup** | 2nd Fri | 6:00 PM | [venue] | Free | peer/AI | [Meetup link] |
| **[Example] Chamber Morning Buzz** | Monthly, ~3rd Fri | 7:30–9:00 AM | [chamber HQ] | TBD | buyer/general | [chamber calendar link] — confirm exact date; high-signal room |
| **[Example] Chamber Small Business Lunch & Learn** | Monthly | 11:30 AM–1:00 PM | [chamber HQ] | TBD | buyer/small-biz | [chamber calendar link] |

## Secondary anchors — include when they fit the window / focus arg (not every run)

| Series | Cadence | Venue | Cost | Room type | Notes |
|---|---|---|---|---|---|
| **[Example] Breakfast, second venue** | 3rd Tue | [venue] | $25 | buyer/general | Clashes with another example above (both 3rd Tue AM); pick one, flag the conflict |
| **[Example] Chamber After-Hours Networking** | ~Monthly | [chamber area] | TBD | buyer/general | walk-up friendly |
| **[Example] Chamber Resource Roundtable** | ~Monthly | [chamber HQ] | TBD | buyer/small-biz | |
| **[Example] Roundtable Series** | Monthly | [venue] | ~$30 | mixed/visibility | big rooms, strong speakers — also a speaking target |
| **[Example] Walk-up Connect** | 1st Fri | [venue] | Free, no RSVP | general | walk-up friendly |
| **[Example] AI/Startup Workshop** | ~Bi-monthly | [venue] | $5 / free for members | peer/AI | topics rotate; on-topic ones are top-fit |
| **[Example] Trade Association Educational** | Monthly | [venue] | TBD | **your ICP's trade group** | your target market — weight up when it's a direct match |
| **[Example] Neighboring-town Chamber** | varies | [venue] | varies | buyer/local | warm relationship, if you have one |
| **[Example] Regional Networking** | Monthly (in-person + virtual) | rotates | Free | general | low-friction, free |

## Known traps

- **Same-slot clash:** two good rooms can land on the same morning. Surface it as a conflict, do not silently add both.
- **Far-out drift:** dates more than a month or two out are often unposted for recurring series. Project from the cadence, tag `(date projected — confirm)`, and note the confirm contact in the receipt.
- **Phone-only rooms** (small chambers, some local groups) have no machine-readable calendar — the skill can't auto-pull them. Note them in the receipt as "call to confirm" rather than pretending coverage.
