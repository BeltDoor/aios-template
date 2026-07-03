---
name: wayfinder
description: Turn a big, foggy job into a clear game plan worked through step by step across sessions. Use when a project is too big to finish in one sitting and the path isn't visible yet. "This is huge, where do I even start", "help me plan this big project", "make a game plan for X", "chart this out", "wayfinder", or, on a job already mapped, "keep working the plan", "what's next on the map". Charts the job as a map of small tracked steps, works them one at a time, and logs every decision so any future session picks up exactly where the last one left off. NOT for small tasks (just do those) and NOT for open idea exploration with no goal yet (use brainstorming for that).
---

# Wayfinder

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

> Source: Matt Pocock's [wayfinder skill](https://github.com/mattpocock/skills) (MIT license, Copyright (c) 2026 Matt Pocock). Rewritten in plain business English: the engineering issue-tracker machinery is replaced with simple files, and the developer step types are replaced with business equivalents.

A big job has landed: too big to finish in one sitting, and wrapped in fog, because the route from here to done isn't visible yet. This skill charts it as a **map**: a small set of files that hold the plan, the open questions, and every decision made so far. Then it works the map one step at a time, session after session, until the way to the goal is clear and no steps remain.

The map is the shared memory. The owner can close the laptop for a week, come back, say "what's next on the map", and the work continues exactly where it stopped.

## Where the map lives

One folder per big job. Put it where that job's other files live; if the job has no home yet, create a top-level `game-plans/<job-name>/` folder.

```
<job folder>/
  MAP.md        the map: the whole job at a glance
  steps/        one small file per step, numbered
```

## The map file (MAP.md)

The map is an **index**, not a storage bin. It gists each decision in one line and links to the step file that holds the detail. A decision lives in exactly one place, its step file; the map never restates it.

```markdown
# Map: <job name>

## Notes

<what this job is, who's involved, standing preferences every session should honor>

## Open steps

- [ ] [<step name>](steps/01-<slug>.md) (research)
- [ ] [<step name>](steps/02-<slug>.md) (talk-through) blocked by: <step name>

## Decisions so far

- [<step name>](steps/01-<slug>.md): <one-line gist of the answer>

## Fog

<the parts of the job you can see coming but can't pin down yet; see Fog below>
```

A step is **up next** when it is open, not blocked, and not already in progress. Work those first, in order.

## Step files

Each step is one question, sized so one focused session can answer it.

```markdown
# <step name>

Type: research | test-run | talk-through | task
Status: open | in progress | done

## Question

<the decision or investigation this step resolves>

## Answer

<written when the step is resolved: the decision, and why>
```

## Step types

- **Research**: reading, looking things up, gathering facts from outside the job folder. Ends with a short written summary linked from the step.
- **Test-run**: make the conversation concrete with something cheap and rough to react to: an outline, a sample, a mock draft. Use when "what should this look like" is the real question.
- **Talk-through**: a working conversation to reach a decision. Run it with `/king-intelligence:grill-me`, one question at a time. This is the default type.
- **Task**: real-world work that must happen before the plan can move: signing up for a service, granting access, moving data. Automate what can be automated; otherwise hand the owner a precise checklist. The answer records what was done and any facts later steps depend on (where things live, new logins, counts).

## Fog

The map is deliberately incomplete: never chart what can't yet be seen. Beyond the listed steps lies fog, the dim view of questions that are clearly coming but can't be pinned down yet because they hang on decisions still open. Resolving a step clears the fog just ahead of it; whatever becomes clear graduates into fresh steps.

**Fog or step?** The test is whether the question can be stated sharply right now, not whether it can be answered right now.

- **Step** when the question is already sharp, even if it's blocked.
- **Fog** when it can't be phrased that sharply yet. Don't pre-slice fog into step-sized pieces; one patch of fog may become several steps, or none, once the work reaches it.

## Refer by name

In everything the owner reads (updates, the Decisions-so-far list, questions), refer to steps by their **name**, never a bare number or filename. "The pricing decision" reads at a glance; a wall of `03, 04, 05` does not. The link rides inside the name.

## Running it

Two modes. Either way, **never resolve more than one step per session.** That discipline is what keeps each answer sharp and the map trustworthy.

### Chart the map

The owner arrives with a loose idea.

1. Surface the open decisions in conversation: run `/king-intelligence:grill-me` (or `/king-intelligence:brainstorming` if the idea is still soft), one question at a time.
2. Create the job folder, MAP.md (Notes filled in, Decisions-so-far empty, Fog sketched), and a step file for every question that can be stated sharply now. Mark which steps block which.
3. Stop. Charting the map is a full session's work; do not also start resolving steps.

### Work the map

The owner returns to a mapped job, with or without naming a step.

1. Load MAP.md, the low-resolution view. Don't read every step file, only the ones the work touches.
2. Choose the step. If the owner named one, use it; otherwise take the first up-next step. Mark it "in progress" in its file before starting.
3. Resolve it, zooming into related step files as needed and honoring whatever the map's Notes ask of every session.
4. Record the resolution: write the Answer in the step file, set its Status to done, tick it off in Open steps, and add the one-line gist to Decisions so far.
5. Update the horizon: add any newly visible steps, graduate fog that just became sharp (removing it from the Fog section, it now lives as its step), and fix or delete any steps the new decision invalidated.

Then report to the owner in plain language: what was decided, what it unlocked, and what's up next.
