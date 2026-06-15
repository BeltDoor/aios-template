# Follow-Up Email Drafting Rules

Draft a follow-up email in the user's voice after every meeting. **Prefer the `/king-intelligence:email` skill if it's available** — invoke it through the Skill tool, which enforces the user's full email voice + anti-slop pass + stored signature, and hand its output straight into the draft. Use the rules below only when that skill isn't available (draft inline) or to understand the standard this skill holds emails to.

## Voice Calibration

If a `voiceGuidePath` swap point is set, read it for the user's full voice profile and reuse it. **Follow-up emails use a slightly more formal register than a casual message:** professional but still human, zero profanity, warm but not manic, get to the point then be warm, focus on THEM and what was discussed rather than on yourself.

## Hard Rules

1. **No em dashes** (the long dash). Use commas, periods, or rephrase.
2. **No corporate jargon:** leverage, synergy, cutting-edge, game-changer, revolutionize, utilize, facilitate, bandwidth (corporate sense), circle back, touch base, move the needle, low-hanging fruit, value-add, deep dive (as a noun).
3. **No fake enthusiasm:** "I'm SO excited to..." / "What an AMAZING conversation..."
4. **No begging:** "Would love the opportunity to..." / "I'd be honored to..."
5. **No exclamation marks** (one absolute max, only if it feels natural).
6. **Closer is just "Thanks," — never type the user's name before the signature.** The email signature block (name + brand) is appended to every draft and already shows the name. Typing the name above it duplicates it and makes the email look amateur. End the body with a comma-closer like "Thanks," "Talk soon," or simply leave no closer if the last sentence already carries the warmth, then the signature renders. No name. No title. No phone number. Ever.
7. **Subject lines: no "re:" / "Re:" on a NEW thread.** "Re:" is a reply indicator the email client auto-prepends when you actually reply into an existing thread. A fresh post-meeting follow-up (almost always a new thread, the meeting wasn't an email thread) gets a clean phrase ("Today's chat," "Following up from this morning," "Our conversation today"). Only use "re:" when the draft is genuinely a reply on an existing inbound thread.
8. **No attachments or links** unless the user specifically discussed sending something.
9. **Under 150 words** for the body. Shorter is better.
10. **Reference something specific** from the meeting (a detail, a decision, a problem they mentioned). Proves it's not a template.
11. **Plain language:** "show" not "demonstrate," "use" not "utilize," "help" not "assist," "next" not "moving forward."
12. **Lead with the reader's benefit**, not with "I build X" or "my company does Y." They care about what they get.
13. **Real paragraph breaks**, one idea per short paragraph. Don't wall-of-text.

## Structure by Meeting Type

### Discovery Call Follow-Up
1. **Opening:** Reference something specific from the call (not "great meeting you").
2. **Recap:** 1-2 sentences on what was discussed or decided.
3. **Commitment:** What the user will do next (and by when).
4. **CTA:** Clear, low-friction next step for them.
5. **Closer:** "Thanks," then the signature block renders the name + brand.

### Coaching Session Follow-Up
1. **Opening:** Reference what was accomplished or attempted.
2. **Quick wins:** 1-2 things they can try before next session.
3. **Homework reminder:** What they need to do before next time.
4. **Next session:** Confirm date/time.
5. **Closer:** "Thanks," then the signature.

### Check-In Follow-Up
1. **Opening:** Brief reference to what was covered.
2. **Status update:** Where things stand.
3. **Next steps:** What happens next.
4. **Closer:** "Thanks," then the signature.

### Demo Follow-Up
1. **Opening:** Reference their reaction to something specific.
2. **Value reinforcement:** 1 sentence connecting what they saw to their specific problem.
3. **Next step:** Trial access, proposal, or next call.
4. **Closer:** "Thanks," then the signature.

### Proposal Review Follow-Up
1. **Opening:** Reference a specific discussion point.
2. **Clarification:** Address any questions that came up.
3. **Timeline:** When they can expect the next thing.
4. **Closer:** "Thanks," then the signature.

### Onboarding Follow-Up
1. **Opening:** Confirm what was set up.
2. **Quick reference:** Logins, links, or first steps they need.
3. **Support:** How to reach the user if something breaks.
4. **Closer:** "Thanks," then the signature.

## Tone by Relationship Stage

| Stage | Tone | Example Opening |
|-------|------|-----------------|
| First meeting (cold lead) | Professional, confident, light | "Good talking with you today." |
| First meeting (warm intro) | Friendly, direct, relaxed | "Hey [name], good call today." |
| Active prospect (2nd+ meeting) | Familiar, specific, forward | "Hey [name], wanted to get you the [thing] we talked about." |
| Active client | Casual, brief, action-oriented | "Hey [name], quick recap from today." |
| Coaching client | Warm, encouraging, direct | "Hey [name], good session today." |

## Drafting it inline (when `/king-intelligence:email` is unavailable)

1. **Always create the draft AND show the email inline in chat** — both, every time. Don't gate draft creation on approval.
2. **Drafts only, never send.** Create the draft in the configured `emailTool`; the user sends manually.
3. **Signature:** if the user has a stored HTML signature, load it from the configured source and append it verbatim (strip any broken placeholder links and flag them). If no stored signature is configured, close on "Thanks," and leave the signature for the user's email client to append, then tell the user once they can wire a stored signature via `/king-intelligence:adapt debrief`.
4. **Links in the body are pretty hyperlinks**, never a raw URL. Render every link as a styled `<a>` with short, friendly anchor text that names the destination ("watch the recording", "book a call", "the proposal"), in the user's brand link color if one is configured.
5. **Recipient required.** If the email can't be resolved (notes file, email search, transcript), stop and ask.
6. **Run the draft through `/king-intelligence:stop-slop` if available** before showing it; otherwise self-check it against the hard rules above.
7. **Money:** if money was agreed and a `paymentsTool` is configured, put the real invoice/payment link in the body. If not, don't fabricate one, flag it.

## Example (Discovery Call, Warm Prospect)

**Context:** First call with a benefits broker who came via cold email. Good energy, wants AI training. Budget locked until July but said "it's a when question, not an if." This is the FIRST email to him after the call, a new thread, not a reply.

```
Subject: Our call today

Hey Cody,

Good call today. The renewal spreadsheet pain is real, and I think there's a
clear path to taking that off your plate once you're ready.

I'll send over a proposal for the training session by end of week. Nothing
fancy, just what we'd cover and what it costs. You can look at it whenever.

No rush on anything. I know you've got a lot of moving pieces right now.
When the timing's right, we'll make it happen.

Thanks,

<<signature block renders here — name + brand>>
```

**Why this works:**
- References something specific (the renewal spreadsheet pain).
- States what the user will do next (send the proposal).
- Acknowledges his timeline without being pushy.
- Short, direct, zero fluff. Sounds like a person, not a template.
- Subject is a clean new-thread phrase (no fake "Re:").
- Body ends with "Thanks," and the signature handles the name + brand below it.

## When "re:" IS correct

If you're drafting a reply INTO an existing inbound thread (the recipient or another party sent something and you're responding within that same thread), the email client will auto-prepend "Re:" when you create the draft as a reply (with the thread set on the API call). Don't type "re:" into the subject yourself, let the threading mechanic handle it. Your subject for a true reply is typically the SAME as the original thread's subject, unchanged.

For a fresh outbound email after a meeting (no prior email thread on the topic), use a clean subject line: *"Today's chat"*, *"Following up from this morning"*, *"Our conversation today"*, *"Quick recap."*
