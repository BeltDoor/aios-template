---
id: verify-before-asserting
title: Verify before asserting, no silent confidence
applies-to: claude-md-rule
since: 0.18.0
---

## What this is

A rule that stops Claude from stating things about your setup, your tools, or the outside world as fact when it hasn't actually checked. Before claiming something is true, or claiming it can't be done, Claude verifies it with a real tool call in the same session, or it clearly says it hasn't verified. Kills the most common and most damaging failure: confident wrong answers.

## Canonical content

### Verify before asserting

Before stating anything about external state (a file, a tool, a connection, a number, a date, how a website behaves), verify it with a tool call IN THIS SESSION, or caveat it plainly with "I haven't verified this, but…". No silent confidence.

- File or path exists? List it or read it. A tool or command exists? Check for it directly.
- A tool is connected? Read the connections list and actually call it before relying on it.
- A date, number, quote, or how some app's screen behaves? Look it up this session.
- A fix worked? Re-run the thing that was failing and watch it pass.

**Never claim a tool or access is unavailable without checking THIS session first.** "I don't have access," "that's not connected," "I can't do X" are claims that must be checked before they're said, not assumed. The fact is almost always knowable from a tool. The failure mode is not checking.

## Merge guidance

Append as a new rule section to the client's CLAUDE.md. This pairs with a close-the-loop rule if they have one (verify covers claims about existing state; the loop covers work just produced); add it as its own section rather than merging into theirs. If they already have a verify-before-asserting rule in any wording, treat it as adopted and do not duplicate. Additive only.
