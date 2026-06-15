---
id: burn-discipline
title: Spend discipline, right gear for the job
applies-to: claude-md-rule
since: 0.11.0
---

## What this is

Stops Claude from burning through your usage running maximum effort on everything. Use a light, cheap setting for routine work, gear up only for genuinely hard jobs, and hand grunt work to helper agents so the main conversation stays lean. Same quality where it matters, far less of your plan spent.

## Canonical content

### Spend discipline

**Default to a light gear.** Routine work (email, scheduling, lookups, simple drafts, quick edits) runs fine on a fast, low-effort setting. That is home base. Don't run heavy effort on easy work.

**Gear up only when the task earns it.** Match the setting to the job:
- Routine ops, quick answers: the light default. Say nothing, just work.
- Serious work (real deliverables, tricky multi-step jobs): step the effort up.
- Genuinely hard work (gnarly debugging, architecture, high-stakes): step it up further.
After a big job, drop back to the light default.

**Farm grunt work to helper agents (the real saver).** Work that just reads a lot (file sweeps, repo searches, web reading, bulk processing, transcript summarizing) should run in a subagent, not the main conversation, because everything the main conversation reads stays in its memory and gets paid for again on every later turn. Keep the main thread for judgment and decisions. Always review what a helper brings back; re-run weak results.

## Merge guidance

Append as a new section to the client's CLAUDE.md. This is principle-level and tool-agnostic on purpose (no specific model names or effort numbers) so it fits whatever plan the client is on. If they already track usage or model choice, add only the missing principles. Additive only.
