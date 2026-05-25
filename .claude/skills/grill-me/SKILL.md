---
name: grill-me
description: Interview the user relentlessly about a plan, design, or decision until you reach shared understanding. Walk down each branch of the decision tree, resolving open questions one at a time. Use when the user wants their plan stress-tested, says "grill me", asks you to poke holes, or hands you a draft they want pressure-tested before shipping. For open exploration where there isn't a plan yet, use `/brainstorm` instead.
---

# /grill-me

Interview me relentlessly about every part of this plan until we reach a shared understanding. The goal is to expose every assumption, force a resolution on every open question, and end with a plan that's actually executable — not a plan that just sounds good.

## When to use this skill

You're here because I have something I want stress-tested. It's usually one of these:

- A business plan, offer, or pricing decision.
- A workflow or automation I'm designing.
- A skill I want you (or `/skill-builder`) to build for me.
- A message I'm about to send, a meeting agenda, a hiring call.
- Any decision where I want to check my own thinking before committing.

If I haven't told you what we're grilling, ask me. One sentence is enough: "What are we grilling?"

If I don't have a plan yet — I'm still thinking through what to even do — stop and tell me `/brainstorm` is the better fit, then route there.

## How to grill

**One question at a time.** Never bundle. I should be answering one thing per turn.

**Walk the decision tree.** Start at the biggest open question. Resolve it. Then move to the next branch that opens up. Don't skip ahead to small stuff while a big assumption is still unresolved.

**Recommend an answer with every question.** Don't ask blank-canvas questions. Tell me what you'd pick and why, then ask if I agree or want to push back. Use `AskUserQuestion` with 2-4 options when the question is multiple-choice; your first option is always your considered recommendation, suffixed "(Recommended)". The tradeoff goes in the description so I can see what each pick costs.

**Read before asking.** If the answer is sitting in a file I've already written — [`CLAUDE.md`](../../../CLAUDE.md), [`SKILLS.md`](../../../SKILLS.md), [`CONNECTIONS.md`](../../../CONNECTIONS.md), the `/references/` docs, anything in `/onboarding/` or `/decisions/` — read it instead of asking me to repeat myself.

**Push back when warranted.** If I say something that contradicts an earlier decision, a file in this folder, or basic reality, name it. Don't pretend I'm consistent when I'm not. Don't ask leading questions — ask the real one.

**Capture as we go.** When I lock an answer, repeat it back in plain English so I can confirm. Don't move on until I've signed off on that branch.

## When to stop

You're done when:

- Every open question in the plan has a locked answer.
- I can describe the plan back to you in 2-3 sentences without any "I'm not sure" hedges.
- The next action (build it / send it / commit it / hand it to `/skill-builder`) is obvious.

If we hit a question that needs outside input — a vendor's pricing page, a tool's docs, my calendar — pause the interview, fetch the info, then resume.

If the grilling reveals the plan is wrong and I need to start over, say so. Don't keep grilling a broken plan to look productive.

## Output

At the end of the grill, summarize:

1. **What we decided** — one line per locked decision.
2. **Open items** — anything we deliberately parked (with the reason).
3. **Next action** — the single concrete thing to do next.

If the grill produced enough material for a real plan document, ask whether to write it to `/decisions/{date}-{topic}.md`.

## Self-ping (do this at the end of every invocation)

Before you finish, increment my row in [`TIME-SAVED.md`](../../../TIME-SAVED.md):

- Skill: `/grill-me`
- Manual time per use: 30 min (rough cost of stress-testing a plan alone — usually means missing things)
- Increment "Total uses" by 1
- Add the cumulative saved time (manual time minus the few minutes this took)
- Update "Last used" to today's date

If `/grill-me` doesn't have a row yet, add one with the same fields.
