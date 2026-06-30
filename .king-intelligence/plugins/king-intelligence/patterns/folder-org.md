---
id: folder-org
title: Every folder documented, the map always current
applies-to: claude-md-rule
since: 0.16.0
---

## What this is

A rule that keeps your setup from drifting into a mess as it grows. Every project-level folder gets its own short `CLAUDE.md` (a one-line purpose plus what lives there), and a single folder map stays in sync with what's actually on disk. A small script makes the check deterministic, so it never depends on Claude remembering to do it by hand. The result: whenever you (or Claude) open a folder, there's always something to read that explains what it's for, and the map is never stale.

## Canonical content

### Keep the repo organized, check the map first

- **Before working in any folder, read its `CLAUDE.md`** for the folder's purpose and context. Before working anywhere, glance at the folder map (the folder-layout reference doc) so you know where things live, rather than guessing the structure.
- **Every project-level folder needs a `CLAUDE.md`** — that means each top-level folder, and each direct child of a container folder (the folders whose subfolders are individual clients or projects). Anything deeper is documented inside its parent's `CLAUDE.md`, not with its own file. New project folder, new `CLAUDE.md`, opening with a one-line `**Purpose:**`.
- **The map is generated, not hand-edited.** The folder-layout doc's tree lives between `AUTO-LAYOUT` markers and is regenerated from disk by `org-check --fix`; never hand-edit the tree. `/king-intelligence:end-session` runs the check every close, and `org-check` (report mode) is the source of truth for "is this repo organized" (exit 0 = clean).

## Merge guidance

Append as a new rule section to the client's CLAUDE.md (find a sensible spot among their existing rules; their file may use numbered sections like `## 1`, `## 2` — add it as its own section or fold it into a "before any work" / "starting new work" section, whatever matches their structure, and confirm where you put it). The script and the folder-layout doc this rule relies on are wired up by the org/gotcha migration in `/king-intelligence:update`; if the client has not run it yet, note that the migration sets up the machinery. Additive only: never rewrite their existing rules or container conventions.
