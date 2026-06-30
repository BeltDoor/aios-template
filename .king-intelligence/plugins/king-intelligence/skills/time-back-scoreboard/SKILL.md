---
name: time-back-scoreboard
description: Show the owner a clean, honest count of the real work their AI system has done for them — tasks it ran and hours it saved — as a single number they can trust. Use when the owner asks "how much time have you saved me", "what has the system actually done", "show me the scoreboard", "time back", "is this worth it", "prove it's working", "where's my time going back to", or any moment that calls for proof the system is doing real work (it is the core of the $297 Setup proof run and what the First-Workflow Guarantee points at). Lean toward firing whenever the owner wants evidence of value, even if they never say "scoreboard".
---

# /time-back-scoreboard

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

The proof that the system buys time back. It turns the work the system has already done into one number the owner trusts: hours saved, across the tasks it has run. This is the anchor the guarantee rides on, so the number has to be honest before it is impressive.

**What it proves:** time back (the system DOES the work, here's the count) and the manual grind handed off (each repeating task is now a skill that runs it). These are two of the nine make-or-break wins.

## The one rule: the number is honest or it is nothing

A non-technical owner trusts this number only if every piece of it is real and they can see where it came from. So:

- **Never invent or estimate up.** The only source is `TIME-SAVED.md` at the brain's root. Every row there is a task the system actually completed, times a per-task minute figure the owner set themselves. The scoreboard sums what is already there. It does not guess.
- **Zero is zero.** A brand-new brain has done no tracked work yet, so the honest answer on day one is "nothing counted yet, it starts climbing the moment your first task runs." Show that, never a placeholder number. The number being small-but-real is the proof, not a number being big.
- **The math is visible.** The artifact lists every task, how many times it ran, and the owner's own minutes-each, so the headline is auditable, not a black box.
- **It is a floor, not a ceiling.** Only tracked time-saver tasks count; setup and one-off work is not counted. Say so. The real figure is at least this.

## Run it

The engine is [`scripts/scoreboard.mjs`](scripts/scoreboard.mjs) — it does the deterministic parse + sum + render so the count is identical every time. Do not hand-compute the total.

1. **Get today's date** so growth-over-time is stamped honestly (never guess it):
   `date '+%m/%d/%y'`
2. **Run from the brain's root** (where `TIME-SAVED.md` lives), passing the date and the business name:
   `node "$CLAUDE_PLUGIN_ROOT/skills/time-back-scoreboard/scripts/scoreboard.mjs" --business "<Business Name>" --date <today>`
   It writes `scoreboard.html` to the brain root, records a dated snapshot under `.claude/scoreboard/history.json` so the number can be shown climbing on the next run, and prints a JSON summary with the `headline`.

3. **Show the owner the result, in their language:**
   - Lead with the `headline` (e.g. "Your system has done 140 tasks and saved you 27 hours 44 minutes so far.").
   - Open `scoreboard.html` for them so they see the breakdown (`open scoreboard.html` on Mac, `start scoreboard.html` on Windows). That file IS the proof artifact, hand them the path.
   - If a prior snapshot exists, point at the growth line ("up 4 hours since last week").
   - One plain sentence on the method: every row is a task it really finished, your own minutes-each, nothing padded.

## In the $297 Setup (the proof run)

The Setup proves the nine wins on the prospect's OWN business. The scoreboard is the close: after the other proof-skills have run a real task or two on their business, run this so the number is no longer zero, it is *their* first real time-back, live. If they are brand-new and the count is still zero, that is honest and fine: show the empty board and the one task you just queued, and tell them this is the meter that now runs on its own. Do not stage a fake number to make the Setup look better, the honesty IS the sell.

## Notes

- The script has no dependencies and writes only `scoreboard.html` + `.claude/scoreboard/history.json`. It reads only `TIME-SAVED.md`.
- If `TIME-SAVED.md` is missing, the owner has no tracked skills yet, walk them to building their first one (that is `/skill-builder`), then this lights up.
- This skill is read-out-and-prove, so it is exempt from self-ping (it does not get its own `TIME-SAVED.md` row).
