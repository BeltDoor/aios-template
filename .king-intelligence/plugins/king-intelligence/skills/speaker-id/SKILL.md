---
name: speaker-id
description: Fix who-said-what in a messy transcript. Automatic-transcription tools (Otter, Granola, Zoom, Super Whisper) routinely mislabel speakers — splitting a 2-person call into "Speaker 1-9," swapping people, or letting side conversations bleed in. This skill rebuilds the real cast and relabels every line to the correct person, flagging the handful it genuinely can't resolve instead of guessing. Use when a transcript's speaker labels look wrong or generic, when someone asks to "fix the speakers," "clean up who said what," "figure out who's talking," "relabel this transcript," or pastes an Otter/Granola/Zoom transcript with "Speaker 1/2/3" tags — even if they don't say speaker-id. Called by /king-intelligence:debrief Phase 2 to clean the transcript before it's saved. NOT for transcribing raw audio (that happens upstream); this works on the text transcript a tool already produced.
argument-hint: "[transcript path or pasted text] | called by /king-intelligence:debrief"
allowed-tools: "Read, Write, Edit, Grep, Glob, Bash"
---

# Speaker ID — fix who said what

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

Auto-transcription gets speaker attribution wrong all the time. Your job is to figure out who actually said each line and **relabel the whole transcript to real names** — best-effort, every line, regardless of length. The one outcome to avoid is a **confident wrong label** (it puts words in someone's mouth, and everything downstream trusts the transcript). When you genuinely can't tell, an honest **flag** beats a guess. Never change the words; relabeling touches the speaker tag only.

## How this runs

- **Standalone:** someone hands you a transcript (a file path or pasted text) and wants the speakers fixed. Read it, run the procedure, hand back the relabeled transcript + speaker map + confidence note.
- **Called by `/king-intelligence:debrief` Phase 2:** debrief passes the staged transcript plus what it knows (the host is always present; `calendar_guests` names+emails and `matched_email` from the staged frontmatter; the other participant's name from context or their `CLAUDE.md`; the source = otter/zoom). It takes back the relabeled transcript + map + confidence and keeps going. For a long transcript, debrief may run this in a subagent to keep its own context lean.

## What you need (the inputs)

1. **The transcript** (whatever labels the source gave it).
2. **A roster** — the real people who were in the meeting (names, plus emails/roles if available). If the caller didn't supply one, build it from the transcript header, any attendee/guest info, and context. If you still can't tell how many real people were present and it matters, ask.
3. **A source hint** — `otter` | `granola` | `zoom` | `other` — so you know which failure mode to expect.

## The procedure

1. **Build the roster first, before reading for content.** Write down the closed set of real attendees. That set, plus the side-conversation label and the flag below, is the only thing you're allowed to put on a line. Two-person meetings are the common case: the roster is the host + one other person.
2. **Map every label by content, not by the tool's label.** Read the dialogue and attribute by what's being said and the back-and-forth logic. Collapse several raw labels onto one real person whenever the content shows it's the same voice. (Tools also drop one-word replies — the missing answer is usually embedded in the next speaker's line, e.g. "okay, so for Mac you press FN" means the other person said Mac. Recover those before flagging.)
3. **Apply the source quirk profile:**
   - **otter** — fragments a 2-person call into many "Speaker N" labels and swaps speakers freely; expect heavy relabeling and collapsing.
   - **zoom** — usually carries real names from the VTT, but can still mis-split or attach a stretch to the wrong name; trust content over the label when they disagree.
   - **granola / other** — generic: treat labels as hints only.
4. **Handle the known failure modes explicitly:**
   - **2-person roster, many labels** → every non-host line is the one other person. Collapse Speaker 1..N onto that person; do not preserve fake extra speakers.
   - **Host and guest swapped** → trust content. The host runs the meeting, sells, demos, asks; the other person describes their own world. Reassign mislabeled lines.
   - **Bleed-in** (a phone call, someone walking in, music/TV) → label only the *outsider's* speech, never a participant: `[Side conversation]` for a separate human nearby (a phone call, someone walking in), `[Background]` for ambient noise transcribed as words (music, a TV). When a participant turns and talks *to* the outsider, those lines are still that participant's — keep them attributed; only the outsider's own speech is bleed-in. Misattributed bleed-in is the worst failure: it invents quotes.
5. **Confidence:**
   - **High confidence → assign the real name.** This is almost every line once the roster and content are in hand.
   - **Genuine ambiguity that survives all of the above → flag it** with `⟦?⟧` before your best guess, e.g. `**⟦?⟧ Sam Rivera:**` (or `**⟦?⟧ Speaker:**` if even the guess is a coin flip). Never leave a bare "Speaker N" and never assign a name you don't believe. A `⟦?⟧` line is low-confidence by definition — downstream it must not be quoted publicly and must not be written into a third party's record.

## What you hand back

1. **The full relabeled transcript** — every line preserved, words untouched, real names (or a `⟦?⟧` flag / `[Side conversation]` label) on every line. No bare "Speaker N" survives. Never truncate or summarize.
2. **A speaker map** — raw label → resolved name, e.g. `Speaker 1,3,5,7 → Sam Rivera; Speaker 2 → [Side conversation]; 4 lines flagged ⟦?⟧`.
3. **A one-line confidence note** — speaker count, overall confidence, and the count of flagged lines.

Show the speaker map whenever you return a result — it's how the caller catches a bad map. Self-check before handing back: `grep -nE 'Speaker [0-9]'` over the **dialogue body** should return nothing except inside a `⟦?⟧` flag (the speaker map and any diarization note legitimately name the raw labels — those hits are expected), and the flagged-line count should match the confidence note.
