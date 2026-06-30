---
id: gotcha-capture
title: Log gotchas the moment they happen
applies-to: claude-md-rule
since: 0.16.0
---

## What this is

A habit that stops your setup from re-hitting the same wall twice. The moment Claude trips over an error, a blocker, or a dead-end that took more than one try to solve, it jots one line in a small scratchpad file right then, before moving on. At the end of the session, `/king-intelligence:end-session` files each of those lines into its permanent home so a future session never re-discovers the same problem. Without this, lessons only get captured at session-end, which loses whatever tripped Claude up early in a long session.

## Canonical content

### Log gotchas the moment they happen

When you hit an error, blocker, or dead-end that took more than one attempt to resolve, OR that a future session could plausibly repeat, append a one-line `[GOTCHA]` to the session scratchpad (`.claude/session-scratch.md`) BEFORE continuing. It is a fast capture buffer: one line, no decision yet about where the lesson ultimately belongs.

`/king-intelligence:end-session` harvests each line into its permanent home (the relevant folder's `## Gotchas` section, the tool's reference file, or memory) and resets the scratchpad to empty. It starts every session empty.

This exists because capturing failures only at session-end loses the thing that tripped you up early in a long session, so the next session re-hits the same wall.

## Merge guidance

Append as a new rule section to the client's CLAUDE.md (find a sensible spot among their existing rules; their file may use numbered sections like `## 1`, `## 2` — add it as its own section or fold it into a "working principles" / "how to work" section, whatever matches their structure, and confirm where you put it). The scratchpad file itself (`.claude/session-scratch.md`) is created by the org/gotcha migration; if it is not present yet, note that running `/king-intelligence:update`'s migration will create it. Additive only: never rewrite their existing rules.
