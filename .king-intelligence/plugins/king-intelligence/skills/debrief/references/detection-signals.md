# Detection signals — what to scan the transcript for

This is the breadth fix. The old flow detected actions LAST, off the already-written summary, using crisp action-verb heuristics only. By then the summary had compressed away the soft signals, and verbs-only missed everything that wasn't an explicit "I'll do X." Result: it missed offer ideas, person-to-person connections, and meeting-prep coaching.

**Two rules that fix the root cause:**

1. **Detect from the RAW transcript, not the summary.** Run this scan in Phase 2 (right after diarization), BEFORE the summary is written. The summary is then built FROM the signal ledger, so nothing soft gets dropped on the way.
2. **Scan for all seven signal types below, every time.** Not just verbs. Read the transcript like a sharp chief of staff whose job is to make sure nothing said in this room falls through the cracks.

Output of this scan = a **signal ledger**: a flat list of every signal found, each tagged with its type and a confidence note. The ledger feeds the summary (Phase 3B) and the triage (Phase 5).

---

## The seven signal types

### 1. Tasks & commitments
Anything either party said they would do. The classic action-verb layer (see [detection-heuristics.md](detection-heuristics.md) for the utterance→intent patterns). "I'll send you X," "I'll set that up," "let me look into Y," "I owe you Z."
- Capture the owner (user or the other person) and any deadline.

### 2. Imminent meetings + how to handle them
A future meeting was named, AND/OR someone coached the user on how to approach a person or meeting. This is a key pattern: a senior contact may spend several minutes telling the user exactly how to sell to someone on Thursday — that is gold that must not be lost to "meeting Thursday." The old skill would log only the appointment and drop the entire playbook.
- Capture: who, when, and **every piece of how-to-handle guidance** (what to say, what they care about, how to price, what to avoid).
- Almost always becomes a **Lane-3 loaded prompt** (meeting prep is standalone work, not "needed for the email"). Flag urgency by date.

### 3. Person-to-person connections
"I know that guy." "He's connected to X." "I'll introduce you." "You should talk to Y." Someone in the conversation reveals a relationship to a third party the user cares about, or offers/implies a warm intro.
- Capture both people and the nature of the tie.
- Action: cross-reference into BOTH people's `clients/*/CLAUDE.md` (or knowledge graph). **Cross-client writes require high diarization confidence** — if the line is garbled, flag it instead of writing it.
- If a warm intro was offered, that may also be a Lane-2 (draft the intro ask) or Lane-3 item.

### 4. Offer / strategy / business-model ideas
The other person, often a sharp operator, hands the user an idea to improve their own offer, pricing, packaging, or positioning. These are never phrased as action items, so verb-detection misses them entirely. A contact might redesign the user's onboarding sequence or pricing model in passing.
- Capture the idea verbatim-ish and what it would change.
- Usually lands in the summary + memory + possibly a `decisions/log.md` candidate or a Lane-3 "rework the offer" prompt. Don't let these evaporate.

### 5. Project work (stated or implied)
Work the user is now on the hook for, whether or not they said "I'll do it." "Can you build this?" "Could you stand up that website?" "Here's an Excel I get all the time." Sometimes it's an explicit yes; sometimes it's an implied recurring need worth turning into a skill.
- Capture the deliverable, the recurrence (one-off vs repeating → skill candidate), and any spec details given in the room.
- Triage: needed-for-the-email → inline; standalone build → Lane-3 prompt.

### 6. Money
Pricing agreed, rate quoted, invoice owed, barter floated, rate change. "Bill me that." "$100/hr." "$300." Money signals are high-value and easy to under-capture.
- Capture amount, what it's for, who owes whom, and the payment vehicle if named.
- Action: usually a Lane-2 staged invoice (outward, money → never auto-send).

### 7. Intel owed / promised
Something either party said they'd bring, learn, or report back. "I'll bring back what the competitor pitched." "I'll get you that list." Open loops that aren't quite tasks.
- Capture who owes what and by when, so the next begin-session/debrief can chase it.

---

## Plus: relationship & working-style intel (always)

Not a "signal" to action, but capture it: retention risk, how they like to work, personal details, buying temperature, what's driving them. Feeds the summary's relationship section + memory.

---

## How to run the scan

1. Read the full raw transcript once with these seven buckets in mind. Diarization may be scrambled (Otter swaps speakers) — attribute by content, not just the label, and note confidence where it matters (especially for cross-client writes, type 3).
   - **Infer dropped short answers from the other speaker's next line before flagging "unconfirmed."** Otter routinely drops one-word replies (machine, email, tool, city, budget). If the reply is missing, the answer is almost always embedded in the responder's follow-up: "okay, so for Mac, you press FN" means the client said Mac; "great, since you use Pipedrive" means they confirmed Pipedrive. Read the dialogue logic, not just the labeled lines. Only mark "unconfirmed"/"[not mentioned]" after that inference genuinely fails.
2. Build the signal ledger: one line per signal, tagged `[type N]`, with owner/date/amount where relevant and a confidence flag if the source line is garbled.
3. Don't pad and don't force-fit. A short meeting yields a short ledger. But a rich 2-3 hour session should yield many signals across most of the seven types — if you only found tasks, you ran a verb scan and missed the point. Re-read for types 2, 3, 4 specifically; those are the ones that get dropped.
4. Hand the ledger to Phase 3 (summary) and Phase 5 (triage).
