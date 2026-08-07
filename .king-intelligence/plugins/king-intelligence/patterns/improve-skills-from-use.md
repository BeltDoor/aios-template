---
id: improve-skills-from-use
title: Improve skills from real use
applies-to: claude-md-rule
since: 7/24/26
---

## What this is

The forward half of the learning loop. `learn-from-failures` captures what broke into notes; this feeds what I noticed while *using a skill* back into that skill's own instructions, so the tools I run sharpen from real use instead of staying frozen at the day they were written. It is on-demand and judgment-gated, never an automatic reflection after every skill, so it costs almost nothing until there's something real to fix.

On `shareable-rules.txt` since 8/5/26 (owner-approved; closed the open question from 7/24/26).

## Canonical content

### Improve skills from real use

When a skill I run hits real friction — a hand-edit it should have done itself, a workaround, a missed step, a wrong trigger, a rough output I had to fix — that friction is the best signal for how to make the skill better. Don't let it evaporate.

- **Offer, don't nag.** After a *substantial* skill run that hit *real* friction, end with one line: "That run of `/X` hit some friction — want me to sharpen it?" Only act if I say yes. Do **not** offer after tiny skills or clean runs, and never fire a full reflection automatically after every skill — that's noise and wasted spend.
- **Ground every suggestion in what actually happened.** Point at the specific friction from this run, not generic advice. If nothing real surfaced, say "that ran clean, nothing worth changing" instead of inventing improvements. Padding to hit a count is fabrication.
- **Let me triage, then apply.** Show the suggestions, let me pick which to do now, which to shelve, and which need explaining. Write the ones I approve back into the skill's own instructions, and shelve the rest somewhere durable so they're not lost.
- **Only edit skills I own.** Never modify a borrowed, mirrored, or auto-synced skill (its edits get overwritten, or its real master lives elsewhere). Read those as the quality standard to judge against, never as a target.

## Merge guidance

Append as a new rule section to the client's CLAUDE.md. Pairs directly with `learn-from-failures` (that captures failures into notes; this feeds real-use friction back into the skill itself) — put it right after that section. If the client has no way to edit their own skills, keep the rule as behavior (offer to improve, shelve the ideas) and skip the write-back step. Additive only; never rewrite their existing rules.
