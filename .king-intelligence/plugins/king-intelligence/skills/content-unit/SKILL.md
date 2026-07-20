---
name: content-unit
description: Turn any raw input — an idea, a story, a topic, a transcript chunk, a half-formed thought — into one finished, on-voice social post built on Alex Hormozi's content-unit framework (Hook, Retain, Reward) and run through /stop-slop before it's ever shown. Use when the user says "turn this into a post", "make a content unit", "content-unit this", "make this a LinkedIn post", "write me a post about X", "turn this clip/story/idea into content", "Hormozi-ify this", or types /content-unit — and lean toward firing whenever they hand over raw material they want shaped into something postable as themselves or a client, even if they never say the skill name. Not for emails (use /email) or bulk multi-platform client runs (the SMM app).
argument-hint: "[raw idea, story, topic, or pasted text | optional voice-profile path]"
allowed-tools: Read, Grep, Glob, Bash, AskUserQuestion, Skill
disable-model-invocation: false
---

# /content-unit — Turn any input into a Hormozi content unit

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

> Before drafting, read [`onboarding/voice-profile.md`](onboarding/voice-profile.md) if it exists. The output must match the voice captured there. If it's missing, write in a clean, professional voice and say so once.

This is the front door for crafting a single post the user (or an SMM client) will publish. It takes whatever raw material you give it and shapes it into Hormozi's atomic **content unit** — the smallest piece of material that hooks attention, retains it, and rewards it — then forces the draft through `/stop-slop` so nothing ships that reads like AI. The full framework, quoted from *$100M Leads* Ch. 6-7, lives in [`references/`](references/); read the relevant one when you need the detail, not all three up front.

## Why a framework instead of just writing

A post that grows an audience does one thing: it rewards the person who consumed it. That only happens if you give them a reason to start (Hook), keep them reading (Retain), and pay off the reason they started (Reward). Skip any of the three and the post dies in the feed. Encoding Hormozi's anatomy is what makes the output reliably good instead of hit-or-miss.

## The workflow

### 1. Read the voice

Default = the user's own profile (`onboarding/voice-profile.md`, read above). If the user passed a different voice-profile path as the argument (e.g. `v2.0/voice-profiles/<client>.md`), read **that** instead — this lets the same skill draft in a client's brand voice, which is what makes it reusable for SMM client content. Keep the hard post rules in front of you while drafting: lead with the reader's BENEFIT (never "I build X" — nobody cares what you build, they care what they get), no em-dashes, real paragraph breaks (no wall of text). The Phase 7 gate enforces these, but write them in from the start.

### 2. Parse the input and classify the topic

Take the input as-is — an idea, a story, a transcript chunk, a rough line. Find the one lesson or piece of value the audience actually gets from it, then place it in one of Hormozi's five topic types (Far Past / Recent Past / Present / Trending / Manufactured). The type shapes the angle. If the input is thin, mine it for the "story without the scar" — the relatable struggle plus the epiphany. Detail + examples: [`references/hook.md`](references/hook.md).

**If the caller flags the input as anonymized** (e.g. `/debrief`'s Phase 6 feeds a client meeting): never re-introduce a real name, company, or identifying number — keep every specific general ("a contractor I work with," not a named client).

### 3. Build the Hook — surface ONE choice

Draft 2-3 candidate hooks. Each one pairs the topic with a headline that uses **at least two** of the seven news components (Recency, Relevancy, Celebrity, Proximity, Conflict, Unusual, Ongoing), shaped to the target platform's format. Then present the candidates with `AskUserQuestion` so the user picks the angle — one real decision, then you build. (If they've told you "just pick," take the strongest and say which.) Headline + format rules: [`references/hook.md`](references/hook.md).

### 4. Retain

Structure the body so each beat makes them want the next, using Lists, Steps, or Stories (interweave if it helps — a story under each list item, a list inside a step). Lists are flexible with a softer payoff; steps are ordered with an explicit payoff; stories drive "what happens next." Pick what the material wants. Detail: [`references/retain-reward.md`](references/retain-reward.md).

### 5. Reward

Completely pay off the promise the hook made. Think value per second — if the hook said "3 ways," give three real ways the reader can use, not four, not recycled ones, not aimed at the wrong audience. Apply the quality guardrails: "How I" not "How To" (share your experience, don't preach), narrow the focus (king of the puddle beats lost in the ocean), no walls of text. Bad-reward failure examples: [`references/retain-reward.md`](references/retain-reward.md).

### 6. Optional ask

Default to pure "give" — no CTA. Hormozi's whole monetization lesson is give, give, give until they ask; an ask on every post slows growth. So only offer to append one **integrated** CTA if the user wants it this run, and if they do, place it after the valuable moment or at the very end, advertising either their core offer or a lead magnet (lead magnet is lower-risk). Ratios, placement, and the verbatim CTA templates: [`references/ask.md`](references/ask.md).

### 7. /stop-slop GATE — mandatory, never skipped

This is the half of the skill that makes it "both at once." Before you show the user anything, invoke the `stop-slop` skill on the draft via the **Skill tool**, apply every fix it returns, and **re-run until it comes back clean**. Nothing emits that skipped this gate. Confirm by eye that the final text carries no em-dashes, leads with the reader's benefit, and breaks into real paragraphs (no wall of text). A unit that hooks, retains, and rewards but reads like AI is a failed unit.

### 8. Output

Deliver two things, in this order:

```
────────── CONTENT UNIT ──────────
[the clean, ready-to-publish post]
───────────────────────────────────

Hook:    [topic type] + [which headline components] + [format note]
Retain:  [list / steps / story — and how curiosity is carried]
Reward:  [the promise the hook made, and how the body pays it off]
Ask:     [none — pure give] OR [the integrated CTA used]
```

The breakdown is there so the user can see why it works and tweak one part without rebuilding the whole thing. If they didn't ask for an ask, the Ask line reads "none — pure give."

## Scope

One content unit, one platform, per run. To chain several units into a long-form piece, run it again and link them (Hormozi's short-vs-long method is just linked units). Bulk generation across every platform is the SMM app's job, not this skill's. For an email, that's `/email`. This is the single-post craftsman.

## Invocation examples

- `/content-unit` (no args) → asks for the raw material and the target platform
- `/content-unit "the time a client almost fired me then 10x'd their spend"` → classifies it (Recent Past), drafts hooks, surfaces the angle pick
- "turn this transcript bit into a LinkedIn post" + pasted text → auto-fires, runs the full unit
- "make a content unit from this for Riley" + a client voice path → reads the client profile instead of the user's own

## Self-ping (do this at the end of every invocation)

Before you finish, update this skill's row in `TIME-SAVED.md` (at the user's repo root, if present):

- Increment "Total uses" by 1
- Recompute "Total saved (cumulative)" as `Total uses × 10 min`
- Update "Last used" to today's date
