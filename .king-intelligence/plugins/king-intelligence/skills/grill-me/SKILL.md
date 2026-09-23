---
name: grill-me
description: Interview the user relentlessly about a plan, design, or decision until you reach shared understanding. Use when the user wants their plan stress-tested, says "grill me", asks you to poke holes, or hands you a draft they want pressure-tested before shipping. For open exploration where there isn't a plan yet, use `/brainstorming` instead. If this setup has its own tailored version of this skill, prefer that one.
---

# Grill Me

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

**Ask every question through `AskUserQuestion`.** This is the whole delivery format for a grill, and it holds even when another skill you loaded prints its own template. If `pocock-grilling` or `pocock-grill-me` shows you a prose format with `❓` and `➡️` markers, keep its decision tree and its rounds and drop its delivery.

Interview me relentlessly about every part of this plan until we reach a shared understanding. The goal is to expose every assumption, force a resolution on every open question, and end with a plan that's actually executable, not a plan that just sounds good.

## When to use this skill

You're here because I have something I want stress-tested. It's usually one of these:

- A business plan, offer, or pricing decision.
- A workflow or automation I'm designing.
- A skill I want you (or `/skill-builder`) to build for me.
- A message I'm about to send, a meeting agenda, a hiring call.
- Any decision where I want to check my own thinking before committing.

If I haven't told you what we're grilling, ask me. One sentence is enough: "What are we grilling?"

If I don't have a plan yet — I'm still thinking through what to even do — stop and tell me `/brainstorming` is the better fit, then route there.

## How to grill

**One round at a time.** A round is one `AskUserQuestion` call holding up to 4 questions that are all answerable right now, none of them waiting on another question in the same round. More than 4 ready? Ask four, wait, ask the rest. A question whose answer depends on an open one belongs to a later round.

**Walk the decision tree.** Start at the biggest open question. Resolve it. Then move to the next branch that opens up. Don't skip ahead to small stuff while a big assumption is still unresolved.

**Recommend an answer with every question.** Never a blank canvas. Your first option is always your considered recommendation, suffixed "(Recommended)", and what each pick costs goes in its description. Labels stay 1-5 words: previews truncate, so a long label is a label I can't read. When a question needs real context, print that context inline in your message first, then ask the short question through the tool. Every number in an option is one you looked up, never one you invented, because I click it and it becomes the decision.

**Find facts yourself.** When a question needs something from the filesystem, a tool, or the web, go get it rather than asking me. A running lookup blocks only the questions downstream of it, so ask the rest of the round now.

**Read before asking.** If the answer is sitting in a file I've already written — my root instructions file, a skills or connections index, a reference doc, the relevant project folder's own notes, or a decisions log — read it instead of asking me to repeat myself.

**Push back when warranted.** If I say something that contradicts an earlier decision, a file in this repo, or basic reality, name it. Don't pretend I'm consistent when I'm not. Don't ask leading questions — ask the real one.

**Capture as we go.** When I lock an answer, repeat it back in plain English so I can confirm. Don't move on until I've signed off on that branch.

## When to stop

You're done when:

- Every open question in the plan has a locked answer.
- You've asked me to say the plan back, and I did it in 2-3 sentences without any "I'm not sure" hedges.
- The next action (build it / send it / commit it / hand it to `/skill-builder`) is obvious.

If we hit a question that needs outside input — a vendor's pricing page, a tool's docs, my calendar — pause the interview, fetch the info, then resume.

If the grilling reveals the plan is wrong and I need to start over, say so. Don't keep grilling a broken plan to look productive.

## Output

At the end of the grill, summarize:

1. **What we decided** — one line per locked decision.
2. **Open items** — anything we deliberately parked (with the reason).
3. **Next action** — the single concrete thing to do next.

If the grill produced enough material for a real plan document, ask whether to write it to a plan file in the relevant project folder, following whatever convention my repo uses for that. If it produced a decision worth keeping, offer to log it wherever I keep decisions, if I keep one (newest at top).
