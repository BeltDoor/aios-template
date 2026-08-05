---
name: goal-helper
description: Design a loop worth running before firing a /goal. A loop-design coach that quizzes you, sharpens the goal, nails down what "done" actually means, lines up a second set of eyes, and sets guardrails so the run can't burn time or go sideways. Use when you type /goal-helper, say "design a loop", "set this up to run itself", "keep working on X until it's done", "grind on this overnight", "before I run /goal", "make this run on its own", "loop on this", and proactively offer it (one line, never forced) when you hand over a big, long-running, or step-away job whose definition of done isn't crisp yet. Use even without saying "goal-helper". For open exploration with no plan yet, route to /brainstorming. For stress-testing a plan that isn't loop-shaped, that's /grill-me.
argument-hint: "[what you want to work on]"
---

# /goal-helper

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

A loop is just "do work, check it, fix it, repeat until it's right." The thing that makes a loop *work* instead of burn time is one idea:

> **The "is it good yet?" signal has to come from something objective and outside the worker, and you stop when that signal stops improving or a guard trips.**

`/goal` on its own keeps a session grinding, but it takes any vague goal, it lets the same AI grade its own homework, and it leaves nothing reusable behind. `/goal-helper` is the design step *before* `/goal`: it fixes all three, then hands `/goal` something actually worth running. This is the [`close-the-loop`](${CLAUDE_PLUGIN_ROOT}/patterns/close-the-loop.md) pattern, turned into a tool.

## When to use it

- Before any `/goal` or "keep working until it's done" job, especially a big, overnight, or step-away one.
- When the win is fuzzy ("work on my website", "clean up the CRM") and needs a sharp finish line before anything runs.

**Not for:** a one-shot task (just do it), or "I don't know what to do yet" (route to [`/brainstorming`](../brainstorming/SKILL.md)). A plain plan that isn't a repeat-until-right loop belongs in [`/grill-me`](../grill-me/SKILL.md). A run that should have no finish line at all ("never stop until I say stop") isn't a fit for this skill either.

## First: size the job, then pick the depth

Say which mode you're running in one line and let the user overrule:

- **Small / quick** → fast pass: just Stage 1 (goal), one main check from Stage 2, and the stop-rule from Stage 4. Skip the diagram. Hand off.
- **Big / overnight / high-stakes** → the full six stages below.

When unsure, ask which. Don't run a heavy six-stage interview on a ten-minute job, that's the fastest way to make the user stop using this.

## How to interview

Run it like [`/grill-me`](../grill-me/SKILL.md): **one question at a time, never bundled**, each with a recommended answer first (use `AskUserQuestion`, recommendation suffixed "(Recommended)", tradeoff in each description). **Read before asking**: check any project notes and any existing docs on the person/project first, so you never ask what's already written down. Repeat each locked answer back in plain English before moving on.

## The six stages

Load the matching rubric only when you enter that stage (keeps this lean).

1. **Sharpen the goal** → [`references/goal-rubric.md`](references/goal-rubric.md). Turn "work on my website" into a concrete outcome with a target result and a scope line (what's in, what's out). Kill goals that can never be called "done."
2. **Define "done" as checks** → [`references/done-checks-rubric.md`](references/done-checks-rubric.md). *This is the heart.* Sort every success test into a **hard check** (objective pass/fail, preferred), a **judge** (the second-eyes AI scores a written rubric), or **your signoff** (taste / business call). Push for at least one hard check; warn loudly if it's all vibes.
3. **Set the second set of eyes** → [`references/second-eyes-rubric.md`](references/second-eyes-rubric.md). A separate Claude helper reviews the work against the done-checklist. It runs as a subagent **always on Opus 4.8** (`model: opus`), free on the user's Claude subscription. Hard checks run first and settle pass/fail before the judge is asked.
4. **Set the guardrails** → [`references/guardrails-rubric.md`](references/guardrails-rubric.md). Revise-limit per round (default ≤3), a stop-after-N-turns cap, stop-if-stuck (same blocker twice → stop), a rough time budget, which folder it may touch, and whether any *outward* action (sending an email, posting, deploying) needs the user's OK first.
5. **Confirm with a diagram** (full mode only). Show the loop shape as a plain text preview (see the shape in [`templates/LOOP.md`](templates/LOOP.md)) so the user can eyeball it before anything runs.
6. **Hand off.** Produce three things:
   - the **ready-to-paste `/goal` line**, with the stop-rule baked in (e.g. `/goal <sharpened goal + the checklist condition>, or stop after 20 turns`);
   - the **done-checklist + guardrails** in plain English;
   - a saved **`LOOP.md`** (from [`templates/LOOP.md`](templates/LOOP.md)) written into the relevant project folder so the loop is reusable and editable. Save it by default; tell the user the path.

   Then offer to run it right now in this session.

## Running it in this session

If the user says go, *you* become the worker. Follow the saved `LOOP.md`:

1. Do a round of the work.
2. Run the **hard checks first**: actually run them this session, don't claim a pass you didn't watch (this is [`verify-before-asserting`](${CLAUDE_PLUGIN_ROOT}/patterns/verify-before-asserting.md)). A failed hard check means revise, no judge needed yet.
3. When hard checks pass, spawn the **Opus 4.8 judge subagent** with the done-checklist as its rubric; it returns "pass" or "needs work + the blocking issues."
4. On "needs work", fix the named issues and loop, up to the revise-limit.
5. Stop the moment any guard trips: checklist all green, turn cap hit, same blocker twice, budget blown, or an outward action needs the user's OK.
6. Show the evidence at the end: the check results and the judge's verdict, not just "done."

To keep the worker's context clean, the judge always runs as a subagent, not in the main thread. Don't fire a Workflow (UltraCode) unless it's specifically asked for.
