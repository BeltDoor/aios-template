# Stage 4 rubric: guardrails (so it can't run away)

A loop with no stop-rule is the thing both sources warn about: it burns time and money grinding on something it'll never finish. Every loop gets guardrails before it runs. None of these are optional.

## The required guards

- **Revise-limit per round.** How many times the worker may try to fix the same gate before it stops and surfaces. Default **3**. Past that, something deeper is wrong, so stop and tell the user rather than polishing forever.
- **A turn / round cap.** The hard backstop that ends the run no matter what. This is what bakes into the `/goal` line as ", or stop after N turns." Default **20** for a step-away job; fewer for a small one.
- **Stop-if-stuck.** If the same blocker shows up twice, or a round produces no real change, stop. Going in circles is not progress, and it's the most expensive way to discover the goal was wrong.
- **A rough budget.** A sense of how long or how much effort is reasonable. If it blows past that, stop and report.

## The boundaries

- **What it may touch.** Name the folder or files the loop is allowed to change. A loop pointed at "the whole repo" is a loop that can break things it was never asked to.
- **Outward actions need an OK first.** Anything that leaves the user's machine and can't be taken back, like sending an email, posting to social, deploying a site, charging a card, or deleting files, pauses for their approval before it fires. The loop can draft and stage these, but it does not send them on its own unless the user explicitly said it could for this run.

## Fail safe, not silent

- When any cap trips, **stop immediately** and say which one and where things stand. Don't quietly keep going.
- Show what happened: the last check result, the judge's verdict, what's still open. A loop that stops with no explanation is as bad as one that never stops.
- A stopped loop should leave its `LOOP.md` and any partial work in place so it can be picked back up.

## Anti-patterns (call these out)

- No turn cap. The loop can run until the usage window is gone.
- No stop-if-stuck. It circles the same blocker twenty times.
- A budget mentioned out loud but not actually baked into the stop-rules.
- An outward action (email, post, deploy, charge) wired to fire with no approval gate.
- "Stop when it's good enough" as the only stop-rule. That's the worker grading its own homework again, which is exactly what Stage 3 exists to prevent.
