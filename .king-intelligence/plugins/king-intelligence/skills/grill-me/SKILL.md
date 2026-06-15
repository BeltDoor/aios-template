---
name: grill-me
description: Interview the user relentlessly about a plan, design, or decision until you reach shared understanding. Walk down each branch of the decision tree, resolving open questions one at a time. Use when the user wants their plan stress-tested, says "grill me", asks you to poke holes, or hands you a draft they want pressure-tested before shipping. For open exploration where there isn't a plan yet, use a brainstorming skill instead.
---

# /grill-me

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

Interview the user relentlessly about every part of this plan until you reach a shared understanding. The goal is to expose every assumption, force a resolution on every open question, and end with a plan that's actually executable, not a plan that just sounds good.

## When to use this skill

You're here because the user has something they want stress-tested. It's usually one of these:

- A business plan, offer, or pricing decision.
- A workflow or automation they're designing.
- A skill or tool they want built.
- A message they're about to send, a meeting agenda, a hiring call.
- Any decision where they want to check their own thinking before committing.

If the user hasn't told you what you're grilling, ask. One sentence is enough: "What are we grilling?"

If the user doesn't have a plan yet, they're still thinking through what to even do, stop and tell them a brainstorming skill is the better fit. If a `/brainstorming` skill is available, route there via the Skill tool; otherwise just switch into open exploration: ask what they're trying to accomplish and why before pressure-testing anything.

## How to grill

**One question at a time.** Never bundle. The user should be answering one thing per turn.

**Walk the decision tree.** Start at the biggest open question. Resolve it. Then move to the next branch that opens up. Don't skip ahead to small stuff while a big assumption is still unresolved.

**Recommend an answer with every question.** Don't ask blank-canvas questions. Tell the user what you'd pick and why, then ask if they agree or want to push back. Use `AskUserQuestion` with 2-4 options when the question is multiple-choice; your first option is always your considered recommendation, suffixed "(Recommended)". The tradeoff goes in the description so the user can see what each pick costs.

**Read before asking.** If the answer is sitting in a file the user has already written, read it instead of asking them to repeat themselves. Check the project's own context files first: any `CLAUDE.md`, a connected-tools list (often `CONNECTIONS.md`), a skills registry, reference docs, or a decisions log if one exists. Only ask the user for what isn't already written down.

**Push back when warranted.** If the user says something that contradicts an earlier decision, a file in the project, or basic reality, name it. Don't pretend they're consistent when they're not. Don't ask leading questions, ask the real one.

**Capture as we go.** When the user locks an answer, repeat it back in plain English so they can confirm. Don't move on until they've signed off on that branch.

## When to stop

You're done when:

- Every open question in the plan has a locked answer.
- The user can describe the plan back to you in 2-3 sentences without any "I'm not sure" hedges.
- The next action (build it / send it / commit it / hand it off) is obvious.

If you hit a question that needs outside input, a vendor's pricing page, a tool's docs, the user's calendar, pause the interview, fetch the info using whatever tools this project has connected (check the project's CONNECTIONS.md or the available MCP tools), then resume.

If the grilling reveals the plan is wrong and the user needs to start over, say so. Don't keep grilling a broken plan to look productive.

## Output

At the end of the grill, summarize:

1. **What we decided** — one line per locked decision.
2. **Open items** — anything you deliberately parked (with the reason).
3. **Next action** — the single concrete thing to do next.

If the grill produced enough material for a real plan document, ask whether to write it to a `PLAN.md` in the relevant project folder. If it produced a decision worth keeping, offer to record it wherever the project keeps decisions (for example, append it to a decisions log, newest at top, if one exists).
