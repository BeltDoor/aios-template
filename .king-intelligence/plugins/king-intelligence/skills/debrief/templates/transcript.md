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
**Source:** [Otter.ai / Super Whisper / manual / other]

---

[Full transcript content here]
```

## Speaker Label Rules

1. Normalize all user labels to **[User Name]:** (not a generic "Speaker 1")
2. Normalize client labels to **[First Name Last Name]:** (not "Speaker 2", not mislabeled names)
3. If timestamps exist in the original (e.g., `Your Name  0:12`), preserve them as `**[User Name]** (0:12):`
4. If no timestamps exist, just use `**[Name]:**` followed by their text
5. Keep paragraph breaks from the original as-is
6. Do NOT fix grammar, remove filler words, or clean up speech. This is a raw transcript.
7. Do NOT truncate or summarize. Save everything.
