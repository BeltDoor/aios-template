# Stage 3 rubric: the second set of eyes

The single most important fix `/goal` is missing: the same AI does the work *and* decides it's done. That's grading your own homework, and it's where loops quietly fail. The fix is a separate Claude helper that judges the work against the done-checklist. Rule of thumb: it always runs on the strongest model.

## How it runs

- The judge is a **subagent** (spawned with the Agent tool), so the worker's context stays clean. Judgment work goes to a helper, not the main thread.
- It **always uses Opus 4.8** (`model: opus` on the Agent call). Free on the user's Claude subscription, no API key, no separate bill. It only draws on their usage window.
- It stays in-house (Claude judging Claude). No work gets sent to an outside vendor in this version.
- **Hard checks run first.** Only call the judge once the objective checks pass; don't spend a judge call on work that doesn't load or doesn't match the number.

## Reviewer vs judge: keep them separate

- A **reviewer** gives notes. Useful, but it can't declare anything done.
- A **judge** gives a verdict that gates the loop. A loop that "keeps going until it passes" needs a judge (or the user's signoff) as the thing that says "passed." Notes alone can't close a loop.

## What to hand the judge

Give it three things and nothing else it doesn't need:
1. The **done-checklist** from Stage 2, by name (the exact checks).
2. The **work** being judged (the draft, the page text, the artifact).
3. A request for **blocking issues, not general commentary.**

Keep the instruction short so the work, not the wrapper, fills its attention.

## The verdict format

Ask the judge to answer in this simple shape:

```
VERDICT: pass | needs work
BLOCKING ISSUES: (only if "needs work": the specific things to fix, one per line)
```

On "needs work", the worker fixes exactly the named issues and loops again, up to the revise-limit (Stage 4). If the judge can't give a clean verdict, treat it as "needs work" and look at why.

## When a hard check should replace the judge entirely

If a check can be settled objectively, don't ask an AI to opine on it. "The page loads with the new headline" is a hard check, not a judge call. Save the judge for the things only judgment can settle: voice, coverage, whether it actually feels right. Using a judge where a hard check exists is fake precision and burns the window for nothing.
