# Anchors reference — data model for the /networking skill

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

This file is a **data-model explainer**. Your actual recurring anchors (the series you reliably attend) live at the path set in `anchorsFile` inside your `## networking` config block in `references/king-intelligence-config.md`. The skill reads THAT file every run; this file just documents the expected shape so you can populate your own.

---

## What an anchors file should contain

### Filter rules block

A short set of rules that apply to ALL events (both Layer 1 anchors and Layer 2 new finds):

- **Radius** — how far you will drive (e.g. "30-min drive from ZIP 44XXX"). Everything outside this is out unless the metro carve-out applies.
- **Metro carve-out** — any exception to the radius (e.g. "a farther city is allowed only if explicitly AI-focused").
- **ICP balance** — your preferred buyer/peer ratio (e.g. "roughly half buyer rooms — chamber/small-biz/benefits — half peer/referral rooms — AI/founders/consultants").
- **Out of scope** — types of events the skill must never add (e.g. one-on-one coffees, speaking bookings).
- **Cost policy** — whether paid events are included and how to flag them.

### Cadence notation

Use "nth Weekday" format: e.g. "1st Tuesday", "3rd Friday" = the nth occurrence of that weekday in the month. The skill computes in-window dates from this cadence, then verifies against a source link where one exists. Anything only projected (not confirmed from a source) gets tagged `(date projected — confirm)` in the receipt.

### Core anchors table (auto-add every run when they fall in the window)

| Series | Cadence | Time | Venue | Cost | Room type | Verify against |
|---|---|---|---|---|---|---|
| Your recurring series A | e.g. 1st Tue | 8:00-9:30 AM | Venue name + address | $XX or Free | buyer/general | Link or "call to confirm" |
| Your recurring series B | e.g. 2nd Fri | 6:00 PM | Venue name + address | Free | peer/AI | Link |
| **[SKIP — already recurring on calendar]** | Weekly | — | — | — | — | List here so the skill knows to never re-add it. |

Add as many rows as you need. Mark any series that is already a true recurring Google Calendar event with a note to skip it — the dedup step catches it too, but marking it explicitly is cleaner.

### Secondary anchors table (include when they fit the window or a focus argument)

| Series | Cadence | Venue | Cost | Room type | Notes |
|---|---|---|---|---|---|
| Optional series A | ~Monthly | Venue | Free | buyer/general | Include under "AI only" filter, etc. |

### Known traps block

Document recurring gotchas here: scheduling clashes between two series that can fall on the same morning, series that go dark for summer months, chambers with no machine-readable calendar (note "call to confirm" rather than pretending coverage), etc.

---

## Example structure

```
## Filter rules
- Radius: ≤30-min drive from 44XXX
- Metro carve-out: [City] events allowed only if explicitly AI-focused
- ICP balance: half buyer rooms, half peer/AI
- Out of scope: one-on-one coffees, speaking bookings
- Cost: paid events OK — include, flag the price

## Core anchors
| Series | Cadence | Time | Venue | Cost | Room type | Verify against |
|---|---|---|---|---|---|---|
| Acme BNI Chapter | [SKIP — already recurring on calendar] | — | — | member | referral | Do not add. |
| Riverside Chamber Breakfast | 1st Tue | 8:00 AM | 123 Main St | $20 | buyer | eventbrite.com/... |
| NE Regional AI Meetup | 2nd Fri | 6:00 PM | Innovation Hub | Free | peer/AI | meetup.com/... |

## Secondary anchors
| Series | Cadence | Venue | Cost | Room type | Notes |
|---|---|---|---|---|---|
| Sam's Founders Lunch | ~Monthly Tue noon | TBD | ~$30 | mixed | Great for peer intros |

## Known traps
- 3rd-Tuesday clash: two series can both fall on the same morning — surface as a conflict, do not add both.
- Summer drift: some series go dark July-Aug; project from cadence, tag (date projected — confirm).
- Phone-only chambers: no machine-readable calendar — note "call to confirm" in the receipt.
```
