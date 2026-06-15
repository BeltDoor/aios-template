# Transcript File Template

Use this structure for all saved transcripts. The header provides context; the body is the complete, unedited transcript with cleaned speaker labels.

## Template

```
# [Meeting Type] - Raw Transcript

[date stamp: M/D/YY - HH:MM]

**Date:** YYYY-MM-DD
**Participants:** [Name (Company)] for each person
**Platform:** [Google Meet / Zoom / Phone / In-person]
**Duration:** ~[X] minutes
**Source:** [transcript source, e.g. Otter / Zoom / Fathom / Granola / manual]

---

[Full transcript content here]
```

## Speaker Label Rules

1. Normalize all of the user's labels to **You:** (not their full name, not "Speaker 1").
2. Normalize the contact's labels to **[First Name Last Name]:** (not "Speaker 2", not a mislabeled name).
3. If timestamps exist in the original (e.g., `Speaker  0:12`), preserve them as `**You** (0:12):`.
4. If no timestamps exist, just use `**[Name]:**` followed by their text.
5. Keep paragraph breaks from the original as-is.
6. Do NOT fix grammar, remove filler words, or clean up speech. This is a raw transcript.
7. Do NOT truncate or summarize. Save everything.
