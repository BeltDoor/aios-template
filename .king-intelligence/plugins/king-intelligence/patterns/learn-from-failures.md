---
id: learn-from-failures
title: Learn from failures, write the rule
applies-to: claude-md-rule
since: 0.11.0
---

## What this is

Turns every mistake and every correction into a permanent fix. When something breaks or you correct Claude, it writes a durable rule so the same thing never happens twice. Your setup gets smarter over time instead of repeating the same errors.

## Canonical content

### Learn from failures

- **Read the full error, fix the root cause, then document it.** When something breaks, don't just patch it: write down what happened and the rule that prevents it, in the relevant CLAUDE.md.
- **After any correction from me, write a rule that stops the same mistake.** If I have to correct you once, that correction becomes a standing instruction so I never have to give it again.
- **Let the documentation get smarter over time.** Propose additions for patterns and gotchas as you discover them; remove instructions that have gone stale. Document outcomes and rules, not step-by-step narration.

## Merge guidance

Append as a new rule section to the client's CLAUDE.md. Pairs naturally with any existing "working principles" or documentation section: if they have one, add these bullets there rather than duplicating a heading. Additive only.
