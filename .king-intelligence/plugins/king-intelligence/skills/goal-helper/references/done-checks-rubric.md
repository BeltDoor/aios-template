# Stage 2 rubric: define "done" as checks (the heart)

This is the stage that decides whether the loop works. The gap most people have is right here: they don't do a great job of defining the criteria for success. The principle behind every good loop is the same: the "is it good yet?" signal only works when it's **objective and comes from outside the worker.** So every part of the goal has to become a check, sorted into one of three buckets.

## The three buckets

**Hard check**: an objective pass/fail that doesn't need an opinion. Prefer these whenever one exists; they're free, instant, and can't be fudged.
- The page loads and shows the new headline.
- The number on the invoice matches the number in Stripe.
- A search for the old phrasing comes back empty (proves it's all replaced).
- Every card has a name field filled.

**Judge**: a second AI scores the work against a written rubric. Use this for quality a hard check can't catch: is the copy on-voice, does the plan cover every part of the goal, does the clip actually feel tight. The rubric has to be specific enough that a *different* AI would score it the same way. (Setup is Stage 3.)

**Your signoff**: the user is the authority. Use this for taste, a business call, a relationship judgment, or anything where their eyes are the real test. This is a real check, not a cop-out, but it means the loop pauses for them.

## The rules that keep checks honest

- **Get at least one hard check if the goal allows it.** A loop with zero objective checks is running on vibes, and vibes are exactly what the same-AI-grading-itself problem poisons. If you genuinely can't find one, say so out loud and make sure a judge or signoff carries the weight.
- **Check one thing at a time, and say what failure looks like.** "The headline leads with the reader's benefit" beats "the page is good."
- **Hard checks run before the judge.** No point asking an AI to grade work that doesn't even load or doesn't match the number.
- **Never let the worker grade its own work.** The whole point is outside eyes. The worker doing the job never also decides it passed.

## Anti-patterns (call these out)

- Every check is a judge or a signoff when a hard check was sitting right there.
- "No errors" as the only success test. That proves nothing broke, not that the goal was met.
- A judge rubric like "high quality" or "comprehensive" with no specifics, so two AIs would score it differently.
- A check that needs information the judge never gets handed.

## Worked example

**Goal:** rewrite the homepage hero so it leads with the reader's benefit, live on the site.

**Done-checklist:**
- *Hard check:* the live page shows the new headline (load it, confirm the text changed).
- *Hard check:* a search for the old headline text returns nothing on the page.
- *Judge:* the new headline leads with what the reader *gets*, not "I build X", and passes the stop-slop voice rules. (Scored against those exact two points.)
- *Your signoff:* the user likes it. Final taste call before it counts as done.

That checklist is what Stage 3's judge scores against and what the `/goal` line points at as its finish condition.
