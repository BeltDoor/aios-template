---
name: your-voice-your-approval
description: Write something the owner would send — an email, a text, a reply, a post — in their own captured voice, then stop it dead at a draft that waits for their explicit yes before anything goes out. Use whenever the owner wants something written as themselves ("draft a reply to X", "write back to this", "follow up with Y", "send Z a note", "post this") and any time you're about to produce send-as-them text. This is the proof that the system sounds like the owner AND never acts without their approval, so route send-as-them writing through here rather than free-handing it, even if they never name the skill.
---

# /your-voice-your-approval

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

> Before drafting, read [`onboarding/voice-profile.md`](onboarding/voice-profile.md). The output must match the voice captured there. If that file is missing, the owner hasn't captured their voice yet — say so and offer to run `/capture-voice` first; do not fake their voice from a guess.

The proof of two of the nine make-or-break wins at once: it **sounds like the owner** (their real voice, not generic AI), and **they stay in control** (nothing ever sends without their explicit yes). Sounding-like-them on the first try is one of the two capabilities only promised publicly once it has really run, so the voice match has to be real, not close-enough.

## How it works

1. **Read the voice first.** Open `onboarding/voice-profile.md` and read it top to bottom: the rules, the banned patterns, and especially the exemplars at the bottom (those are the gold standard). Match the opener pattern, sentence rhythm, sign-off, and vocabulary. Honor every banned pattern. The exemplars are how you check yourself, write something that would sit naturally beside them.

2. **Write the draft.** Produce the actual thing the owner would send. Keep it in their register, not yours. No throat-clearing, no padding the owner wouldn't write.

3. **Stop at the gate — this is the part that matters.** Do not send. Do not auto-create-and-send. Write the draft to a `drafts/` file with a status header that makes the state unmistakable:

   ```
   STATUS: ⛔ PENDING YOUR APPROVAL — nothing has been sent.
   To:       <recipient>
   Subject:  <subject, if an email>
   Written in your voice from: onboarding/voice-profile.md
   ------------------------------------------------------------
   <the draft body>
   ------------------------------------------------------------
   What happens next: nothing, until you say so.
     • "Send it" → I put it in your drafts to hit send yourself (or send, if you tell me to).
     • A change  → tell me what to fix and I'll rewrite it.
   This draft does not send on its own. The approval is yours.
   ```

4. **Show it and wait.** Present the draft in chat, point at the saved path, and stop. The default is always draft-only. Only on an explicit "send it" do you move it forward — and even then, prefer creating a draft in their email tool for them to hit send, unless they clearly say "send it now." A change request loops you back to step 2 with the fix.

## Why the gate is non-negotiable

The single fastest way to lose a non-technical owner's trust is for the system to send something as them that they didn't see. So the gate is a hard line, not a preference: **send-as-them text never leaves without an explicit, in-the-moment yes.** A draft sitting in `drafts/` marked PENDING is the system working correctly. An email that went out on its own is a failure, even if the wording was perfect. When in doubt, draft and wait.

## Proving the voice match (when this is the Setup proof run)

To prove it genuinely sounds like the owner and isn't generic: write the draft, then show it beside the profile's banned-pattern list and exemplars, and point out the match plainly (same opener style, same sign-off, none of their banned tells). The owner recognizing their own voice in a first-try draft, sitting safely in a PENDING state, is the whole proof.

## Notes

- **This is the canonical send-as-them path in the owner's brain.** Email, text, post, or reply, if it goes out as the owner, route it through here so it reads *their* `onboarding/voice-profile.md` and stops at the approval gate. Don't let a generic "draft an email" request bypass the gate by going somewhere that sends without an explicit yes; the gate is the win, not a nicety.
- This skill PRODUCES send-as-them text, so the voice profile is a hard requirement, never skip the read.
- No script: the value is the discipline (match the captured voice, hold the gate), not a deterministic transform.
- Exempt from self-ping (the manual-time saving is already tracked by whatever send-as-them skill calls this; this is the voice + gate layer underneath them).
