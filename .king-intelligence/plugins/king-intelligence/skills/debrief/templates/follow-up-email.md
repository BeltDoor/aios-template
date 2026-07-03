# Follow-Up Email Drafting Rules

Draft a follow-up email in the user's voice after every meeting. Display in chat only. Never save to a file. The user will review, edit, and send manually.

## Voice Calibration

Read the `voiceGuidePath` from your settings for the user's full voice profile.

**Follow-up emails use a modified voice:**

```yaml
formality: 0.5         # Professional but still human (bumped from default 0.3)
profanity_level: 0.0   # Zero. Professional context.
enthusiasm: 0.6        # Warm, not manic
humor_frequency: 0.1   # Maybe one light moment, max
directness: 0.8        # Get to the point, then be warm
self_reference: 0.3    # Focus on THEM and what was discussed
```

## Hard Rules

1. **No em dashes** (the long dash). Use commas, periods, or rephrase.
2. **No corporate jargon:** leverage, synergy, cutting-edge, game-changer, revolutionize, utilize, facilitate, bandwidth (corporate sense), circle back, touch base, move the needle, low-hanging fruit, value-add, deep dive (as noun)
3. **No fake enthusiasm:** "I'm SO excited to..." / "What an AMAZING conversation..."
4. **No begging:** "Would love the opportunity to..." / "I'd be honored to..."
5. **No exclamation marks** (one absolute max, only if it feels natural)
6. **Closer is just "Thanks," — never type the user's name before the signature.** The Gmail signature block (logo + name + tagline) is appended to every draft and already shows the user's full name with branding. Typing the name above it duplicates it and makes the email look amateur. End the body with a comma-closer like "Thanks," "Talk soon," or simply leave no closer if the last sentence already carries the warmth — then the signature renders. No name. No title. No phone number. Ever.
7. **Subject lines: no "re:" / "Re:" on a NEW thread.** "Re:" is a reply indicator that Gmail auto-prepends when you actually reply into an existing thread. If you're starting a fresh email to the client (which post-meeting follow-ups almost always are — the meeting itself wasn't an email thread), the subject is a clean phrase ("Today's chat," "Following up from this morning," "Free AIOS build — putting the deal in writing," "Our conversation today"). Only use "re:" when the draft is genuinely a reply on an existing inbound Gmail thread.
8. **No attachments or links** unless the user specifically discussed sending something
9. **Under 150 words** for the body. Shorter is better.
10. **Reference something specific** from the meeting (a detail, a decision, a problem they mentioned). Proves it's not a template.
11. **Plain language:** "show" not "demonstrate," "use" not "utilize," "help" not "assist," "next" not "moving forward"

## Structure by Meeting Type

### Discovery Call Follow-Up
1. **Opening:** Reference something specific from the call (not "great meeting you")
2. **Recap:** 1-2 sentences on what was discussed or decided
3. **Commitment:** What the user will do next (and by when)
4. **CTA:** Clear, low-friction next step for them
5. **Closer:** "Thanks," then the Gmail signature block renders the user's name + brand. Never type the user's name before the signature.

### Coaching Session Follow-Up
1. **Opening:** Reference what was accomplished or attempted
2. **Quick wins:** 1-2 things they can try before next session
3. **Homework reminder:** What they need to do before next time
4. **Next session:** Confirm date/time
5. **Closer:** "Thanks," then the Gmail signature block renders the user's name + brand. Never type the user's name before the signature.

### Check-In Follow-Up
1. **Opening:** Brief reference to what was covered
2. **Status update:** Where things stand
3. **Next steps:** What happens next
4. **Sign-off:** the user's name (via signature)

### Demo Follow-Up
1. **Opening:** Reference their reaction to something specific
2. **Value reinforcement:** 1 sentence connecting what they saw to their specific problem
3. **Next step:** Trial access, proposal, or next call
4. **Sign-off:** the user's name (via signature)

### Proposal Review Follow-Up
1. **Opening:** Reference a specific discussion point
2. **Clarification:** Address any questions that came up
3. **Timeline:** When they can expect the next thing
4. **Sign-off:** the user's name (via signature)

### Onboarding Follow-Up
1. **Opening:** Confirm what was set up
2. **Quick reference:** Logins, links, or first steps they need
3. **Support:** How to reach the user if something breaks
4. **Sign-off:** the user's name (via signature)

## Tone by Relationship Stage

| Stage | Tone | Example Opening |
|-------|------|-----------------|
| First meeting (cold lead) | Professional, confident, light | "Good talking with you today." |
| First meeting (warm intro) | Friendly, direct, relaxed | "Hey [name], good call today." |
| Active prospect (2nd+ meeting) | Familiar, specific, forward | "Hey [name], wanted to get you the [thing] we talked about." |
| Active client | Casual, brief, action-oriented | "Hey [name], quick recap from today." |
| Coaching client | Warm, encouraging, direct | "Hey [name], good session today." |

## Example (Discovery Call, Warm Prospect)

**Context:** First call with a benefits broker who came via cold email. Good energy, wants AI training. Budget locked until July but said "it's a when question, not an if." This is the FIRST email to them after the call — a new thread, not a reply to anything.

```
Subject: Our call today

Hey Riley,

Good call today. The renewal spreadsheet pain is real, and I think there's a
clear path to taking that off your plate once you're ready.

I'll send over a proposal for the training session by end of week. Nothing
fancy, just what we'd cover and what it costs. You can look at it whenever.

No rush on anything. I know you've got a lot of moving pieces right now.
When the timing's right, we'll make it happen.

Thanks,

<<Gmail signature block renders here — logo + the user's name + tagline>>
```

**Why this works:**
- References something specific (renewal spreadsheet pain)
- States what the user will do next (send proposal)
- Acknowledges their timeline without being pushy
- Short, direct, zero fluff
- Sounds like a person, not a template
- Subject is a clean new-thread phrase (no fake "Re:")
- Body ends with "Thanks," — the Gmail signature handles the name + brand below it. Never type the user's name above the signature.

## When "re:" IS correct

If you are drafting a reply INTO an existing inbound Gmail thread (the recipient or another party sent something and you're responding within that same thread), Gmail will auto-prepend "Re:" when you create the draft as a reply (with `threadId` set on the API call). Do not type "re:" into the subject yourself — let the threading mechanic handle it. Your subject line for a true reply is typically the SAME as the original thread's subject, unchanged.

For a fresh outbound email after a meeting (no prior email thread on the topic), use a clean subject line. Examples:
- *"Today's chat"*
- *"Following up from this morning"*
- *"Free AIOS build, putting the deal in writing"*
- *"Our conversation today"*
- *"Quick recap"*
