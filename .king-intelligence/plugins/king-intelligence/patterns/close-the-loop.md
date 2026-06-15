---
id: close-the-loop
title: Close the loop, prove it works
applies-to: claude-md-rule
since: 0.11.0
---

## What this is

A rule that bans "looks done." Before starting any job with a checkable end state, Claude defines what passing looks like, then works, checks, and redoes until it actually passes, and shows you the evidence. You stop having to ask "did that really work?"

## Canonical content

### Close the loop

Any job with a checkable end state gets the loop treatment:

1. **Define the pass/fail check BEFORE starting.** A test that should pass, a live click that should work, a search that should come back empty, a number that should match. Write it down first.
2. **Work, check, redo** until the check passes. Never hand back "looks done" or "should work now."
3. **Show the evidence.** The passing test output, the screenshot, the matching number. The claim "it works" always comes with the proof attached.

If a check cannot be run (no access, needs a human step), say so plainly instead of pretending the loop closed.

## Merge guidance

Append as a new rule section to the client's CLAUDE.md. If they already have a verify-before-asserting rule, this complements it (verify covers claims about existing state; the loop covers work just produced): add it as its own section rather than merging into theirs.
