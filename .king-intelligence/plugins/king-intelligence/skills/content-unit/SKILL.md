---
name: content-unit
description: Turn any raw input — an idea, a story, a topic, a transcript chunk, a half-formed thought — into one finished, on-voice social post built on Alex Hormozi's content-unit framework (Hook, Retain, Reward), cleaned of AI tells before it is ever shown. Use when the user says "turn this into a post", "make a content unit", "content-unit this", "make this a LinkedIn post", "write me a post about X", "turn this clip/story/idea into content", "Hormozi-ify this", or types /king-intelligence:content-unit — and lean toward firing whenever they hand over raw material to shape into something postable. Not for emails or bulk multi-platform runs.
argument-hint: "[raw idea, story, topic, or pasted text]"
allowed-tools: Read, Grep, Glob, Bash, AskUserQuestion, Skill
disable-model-invocation: false
---

# content-unit — Turn any input into a Hormozi content unit

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## This client's voice wiring (read live from the persistent data folder)

The block below prints THIS client's saved wiring. Read the `skills["content-unit"]` block from it for `voiceProfilePath`, `voiceDescription`, and `defaultPlatform`.

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/print-config.mjs" "${CLAUDE_PLUGIN_DATA}/config.json"`

This is the front door for crafting a single post the user will publish. It takes whatever raw material they give and shapes it into Hormozi's atomic **content unit** — the smallest piece of material that hooks attention, retains it, and rewards it — then cleans every AI tell out before anything ships. The full framework, quoted from *$100M Leads* Ch. 6-7, lives in [`references/`](references/); read the relevant one when you need the detail, not all three up front.

## Why a framework instead of just writing

A post that grows an audience does one thing: it rewards the person who consumed it. That only happens if you give them a reason to start (Hook), keep them reading (Retain), and pay off the reason they started (Reward). Skip any of the three and the post dies in the feed. Encoding Hormozi's anatomy is what makes the output reliably good instead of hit-or-miss.

## The workflow

### 1. Load the voice

Read the voice wiring printed above (`skills["content-unit"]`):
- If `voiceProfilePath` is set, use the Read tool to read that file and write in exactly that voice.
- Else if `voiceDescription` is set, write to that description.
- Else, write in a clean, neutral, professional voice AND tell the user once: "I'm writing in a neutral voice for now. Run /king-intelligence:adapt content-unit to point me at your voice guide so posts sound like you."

Universal post rules, always on (these are good writing, not any one person's house style): lead with the reader's BENEFIT (never "I build X" — nobody cares what you build, they care what they get), no em-dashes, real paragraph breaks (no wall of text). The Phase 7 gate enforces these; write them in from the start.

### 2. Parse the input and classify the topic

Take the input as-is — an idea, a story, a transcript chunk, a rough line. Find the one lesson or piece of value the audience actually gets from it, then place it in one of Hormozi's five topic types (Far Past / Recent Past / Present / Trending / Manufactured). The type shapes the angle. If the input is thin, mine it for the "story without the scar" — the relatable struggle plus the epiphany. Detail + examples: [`references/hook.md`](references/hook.md).

**If the caller flags the input as anonymized** (e.g. a client meeting fed in by another skill): never re-introduce a real name, company, or identifying number — keep every specific general ("a contractor I work with," not a named client).

### 3. Build the Hook — surface ONE choice

Draft 2-3 candidate hooks. Each one pairs the topic with a headline that uses **at least two** of the seven news components (Recency, Relevancy, Celebrity, Proximity, Conflict, Unusual, Ongoing), shaped to the target platform's format (default `defaultPlatform` if the user did not name one). Then present the candidates with `AskUserQuestion` so the user picks the angle — one real decision, then you build. (If they have said "just pick," take the strongest and say which.) Headline + format rules: [`references/hook.md`](references/hook.md).

### 4. Retain

Structure the body so each beat makes them want the next, using Lists, Steps, or Stories (interweave if it helps — a story under each list item, a list inside a step). Lists are flexible with a softer payoff; steps are ordered with an explicit payoff; stories drive "what happens next." Pick what the material wants. Detail: [`references/retain-reward.md`](references/retain-reward.md).

### 5. Reward

Completely pay off the promise the hook made. Think value per second — if the hook said "3 ways," give three real ways the reader can use, not four, not recycled ones, not aimed at the wrong audience. Apply the quality guardrails: "How I" not "How To" (share your experience, don't preach), narrow the focus (king of the puddle beats lost in the ocean), no walls of text. Bad-reward failure examples: [`references/retain-reward.md`](references/retain-reward.md).

### 6. Optional ask

Default to pure "give" — no CTA. Hormozi's whole monetization lesson is give, give, give until they ask; an ask on every post slows growth. So only offer to append one **integrated** CTA if the user wants it this run, and if they do, place it after the valuable moment or at the very end, advertising either their core offer or a lead magnet (lead magnet is lower-risk). Ratios, placement, and the verbatim CTA templates: [`references/ask.md`](references/ask.md).

### 7. Anti-slop GATE — mandatory, never skipped

Before you show the user anything, run an anti-slop pass:
- If a stop-slop skill is available (the King Intelligence `stop-slop` skill or the user's own), invoke it via the **Skill tool**, apply every fix it returns, and **re-run until it comes back clean**.
- If none is available, apply this inline checklist and fix every hit: no em-dashes; no throat-clearing openers ("In today's world," "Let's dive in"); no emphasis-crutch adverbs ("truly," "incredibly"); no business jargon; no "it's not X, it's Y" binary-contrast filler; no false agency ("this empowers you to"); active voice; lead with the reader's benefit; real paragraph breaks, no wall of text.

Confirm by eye that the final text carries no em-dashes, leads with the reader's benefit, and breaks into real paragraphs. A unit that hooks, retains, and rewards but reads like AI is a failed unit.

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

The breakdown is there so the user can see why it works and tweak one part without rebuilding the whole thing. If they did not ask for an ask, the Ask line reads "none — pure give."

## Scope

One content unit, one platform, per run. To chain several units into a long-form piece, run it again and link them (Hormozi's short-vs-long method is just linked units). For an email, that is a different tool. This is the single-post craftsman.
