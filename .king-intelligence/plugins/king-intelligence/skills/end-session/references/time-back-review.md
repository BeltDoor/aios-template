# Time-Back capture

**Nothing in this phase is estimated any more, and the old calibration is gone with the estimating.**

## What changed and why

This file used to tell you to price the session's work as a competent person would have done it by hand, multiply it down, and round. That existed because a model was guessing, and the calibration was the guard on the guess.

The guessing is over. The machine already keeps a timestamped record of every session, so the work is counted rather than judged:

- **Active working time** is the sum of the gaps between consecutive actions, with any gap over 5 minutes discarded. A window left open earns exactly nothing.
- **Documents created and changed** are counted once each. A document counts as created the first time it is ever written and as changed in every later session that touches it, so rewriting the same file forty times never bills forty new documents.
- **Outward drafts** are the things that leave no file behind: an email or message drafted, a post, a calendar event.

The prices are a deliberate floor: 20 minutes per document created, 5 per document changed, 10 per outward draft. A session never credits less than the time the machine genuinely worked.

## What you do

One command, and it is already in Phase 3.55:

```bash
node <timeSavedSyncScript> record --send
```

Read the JSON. `totalHours` and `send.sent` are the two fields the receipt line needs.

## The rules that still hold

1. **Silent. Never ask.** No confirm question, no pop-up, no breakdown shown. One receipt line in the close-out, nothing more.
2. **Never invent a number.** `--adhoc-min` and `--summary` are still accepted for compatibility and are deliberately IGNORED. If you find yourself wanting to write a figure by hand, the answer is that the measurement already covers it.
3. **Flagged wins stay out of the headline.** A `[WIN]` line the owner flagged is a story, not a measurement. It never adds hours.
4. **The number is honest or it is nothing.** It is a floor, and it is framed that way: at least this much.

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*
