# Transcript File Template

Use this structure for all saved transcripts. The header provides context plus a diarization-quality note; the body is the complete, unedited transcript, fully relabeled to real speaker names (with `⟦?⟧` flags on any genuinely unattributable lines), per the `/speaker-id` skill.

## Template

```
# [Meeting Type] - Raw Transcript

[date stamp: M/D/YY - HH:MM]

**Date:** YYYY-MM-DD
**Participants:** [Name (Company)] for each person
**Platform:** [Google Meet / Zoom / Phone / In-person]
**Duration:** ~[X] minutes
**Source:** [Otter.ai / Super Whisper / manual / other]

> **Diarization note.** [N]-person meeting: [real names]. Source labeled it [N raw "Speaker" tags / clean]; relabeled to real names by content. Confidence: [high / mostly high, see flags]. Flagged: [none / "N lines marked ⟦?⟧ — genuinely unattributable"].

---

[Full transcript content here]
```

## Speaker Label Rules

The relabeling itself is done by the `/speaker-id` skill (Otter/Granola/Zoom mislabel speakers constantly). These rules govern the saved format.

1. Normalize the user's labels to **You:** (not their full name, not "Speaker 1").
2. Normalize every other speaker to their real name **[First Name Last Name]:** (not "Speaker 2", not the source's mislabel). Relabel the WHOLE transcript — no bare "Speaker N" tag survives.
3. **Flag the genuinely unattributable.** If `/speaker-id` truly couldn't resolve a line, it carries a `⟦?⟧` prefix on the best guess, e.g. `**⟦?⟧ Riley Stone:**` (or `**⟦?⟧ Speaker:**` if even the guess is a coin flip). Keep the flag; never silently swap in a confident name. `⟦?⟧` is the one greppable marker for "low-confidence attribution" — a `⟦?⟧` line must never be quoted in a post (content-post.md) or written into another client's file (lane-model.md).
4. **Isolate bleed-in.** Phone audio, side talk, or someone walking in is labeled `**[Side conversation]:**` or `**[Background]:**`, never a participant.
5. If timestamps exist in the original (e.g., `Full Name  0:12`), preserve them as `**You** (0:12):`.
6. If no timestamps exist, just use `**[Name]:**` followed by their text.
7. Keep paragraph breaks from the original as-is.
8. Do NOT fix grammar, remove filler words, or clean up speech. Relabeling changes the speaker tag ONLY, never the words. This is a raw transcript.
9. Do NOT truncate or summarize. Save everything.
