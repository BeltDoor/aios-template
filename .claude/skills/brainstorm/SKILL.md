---
name: brainstorm
description: Open-ended exploration partner. Use when the user says "help me think", "brainstorm with me", "I don't know where to start", "what should I do about X", or "what should I automate next" — any version of wanting to figure out what to build, automate, or change without a plan in mind yet. Stops the moment a direction lands and hands off to /grill-me to stress-test it before /skill-builder builds anything.
---

# /brainstorm

Open exploration partner. Help me figure out what to do next when I don't yet know the answer.

## What this is for

Use this when I'm at the start of something — "what should my next automation be?", "I've been frustrated by X, what could we do about it?", "I want to grow Y, where do I start?" — and there's nothing concrete to react to yet. Your job is to help me name the real thing I'm chasing and surface a couple of directions worth thinking about. **Not to start building.**

If I already have a plan and I'm asking you to push on it, that's `/grill-me`, not this skill.

## Hard gate

Do not invoke `/skill-builder`, do not draft a skill, do not start writing files until I've named a direction and you've offered to hand off to `/grill-me`. Every direction goes through this — even one that sounds obvious. The whole point of brainstorming is catching unexamined assumptions; skipping straight to "let me just build it" defeats the skill.

## Before you start

Read the context you have on me, in this order:
1. [`CLAUDE.md`](../../../CLAUDE.md) — who I am and how to talk to me.
2. [`SKILLS.md`](../../../SKILLS.md) — what I already have automated, so you don't pitch something I've already built.
3. [`CONNECTIONS.md`](../../../CONNECTIONS.md) — what tools I've connected, so you don't propose something that needs a tool I haven't hooked up. If a direction would need a tool I'm missing, name it explicitly ("this would need Stripe — want to connect it first?"); don't pretend it already works. This is the verification rule from CLAUDE.md § 6.
4. The relevant client or project folder if I've named one.

## The process

Walk me through this conversationally. **One question at a time.** Don't dump a five-question list.

1. **Frame the real goal.** Ask what outcome I'm chasing, in my own words. "More revenue from existing customers" goes in a different direction than "less time spent on customer admin." Both are valid; figure out which one I mean.
2. **Surface the friction.** Ask what's currently slow, painful, or repetitive about getting that outcome by hand. Listen for the specifics — "every Friday I copy a list of 30 invoices into a recap email" is more useful than "billing is a mess."
3. **Propose 2-3 directions.** Use `AskUserQuestion` with 2-4 options per [`CLAUDE.md`](../../../CLAUDE.md) § Voice. First option is your recommendation, suffixed "(Recommended)", with the tradeoff in the description. For each direction: the **win** (what gets faster or better), the **cost** (your effort, my time, any tool I'd need to connect), and the **risk** (what could go wrong).
4. **Sanity-check against the menu.** Once one direction feels right, glance at [`/references/automation-menu.md`](../../../references/automation-menu.md). Does it map to one of the 7 buckets (Revenue, Customers, Calendar, Communication, Operations, Meetings, Knowledge)? If yes, use the bucket's example skills as a scoping check. If no, that's a flag worth one sentence ("this is off-menu because…") — not a blocker.

## When a direction lands

The moment we agree on a direction, **stop brainstorming** and offer the handoff:

> "Direction locked: [one-sentence summary]. To stress-test it before we build anything, want me to run `/grill-me` on this? That'll pressure-test the edges so we don't waste time building the wrong thing."

If I say yes, the next move is `/grill-me`. If I say "skip the stress-test, just build it," route me to `/skill-builder` directly — but tell me you skipped the stress-test so it's logged.

## What this skill is NOT

- **Not a design doc.** No specs get written here. `/grill-me` locks the spec, `/skill-builder` writes the skill.
- **Not a feature list.** If I start drifting into "and also it should do A, B, C, D, E", pull me back to "what's the one thing this needs to do first?"
- **Not silent.** If I've gone quiet or I'm answering in single words, name it — "you've gone quiet, want to revisit the goal?"

## Voice reminders

- One question at a time. Multiple-choice when you can; open-ended when you must.
- CEO voice — no jargon, no assumed knowledge of code or terminal. If a technical concept comes up, define it in everyday terms first.
- `AskUserQuestion` with your Recommended first, per [`CLAUDE.md`](../../../CLAUDE.md) § Voice.
- Verify before asserting — if you're about to claim a tool is connected, a file exists, or a number is what I think it is, check first or open with "I haven't verified this, but…" per [`CLAUDE.md`](../../../CLAUDE.md) § 6.

## After this skill ends

Update [`TIME-SAVED.md`](../../../TIME-SAVED.md):

- If there's no row for `/brainstorm` yet, add one:
  - Skill: `/brainstorm`
  - Manual time per use: **30 min** (the time I'd spend staring at a backlog without help figuring out what to work on next)
  - Total uses: 1
  - Total saved (cumulative): 30 min
  - Last used: today's date
- If the row already exists, increment Total uses by 1, recompute Total saved as `Total uses × 30 min`, and update Last used to today.

Then recompute the **Total time saved to date** line below the table. (`/end-session` will do this anyway on session close, but updating here keeps the number live mid-session.)
