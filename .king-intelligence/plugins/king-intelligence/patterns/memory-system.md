---
id: memory-system
title: Memory system, one fact per file with a lean index
applies-to: folder-structure
since: 0.11.0
---

## What this is

The way to give your setup a real memory that doesn't bloat. Facts get saved one per small file, with a single lean index that loads every session. The index stays short on purpose so it always fits, and older notes age out of it without being lost. This is the structure, not Jacob's specific notes.

## Canonical content

Set up a `memory/` folder at the repo root holding one fact per file, plus a `MEMORY.md` index that is loaded every session. Keep the index lean (one short line per memory) so it always loads in full; move detail into the per-fact files.

**`MEMORY.md` index template:**

```markdown
# Memory

> One line per memory, newest or most-pinned first. Keep this index short so it
> always loads in full. Detail lives in the linked file, never here. `[PIN]` = never ages out.

## [PIN] (date): <one-line hook> -> [slug.md](slug.md)
## (date): <one-line hook> -> [slug.md](slug.md)
```

**Each memory file** is one fact with simple frontmatter:

```markdown
---
name: <short-kebab-slug>
description: <one-line summary, used to judge relevance later>
type: user | feedback | project | reference
---

<the fact. Convert relative dates to absolute. Link related memories with [[their-slug]].>
```

**Types:** `user` (who you are, your preferences) · `feedback` (how you want Claude to work, with the why) · `project` (ongoing work and constraints not obvious from the files) · `reference` (pointers to external resources, links, logins by name).

**Keep it lean:** when the index grows past what loads comfortably, age the oldest non-pinned lines into a dated archive file (kept, just not auto-loaded), so the live index stays small. Before saving a new memory, check for an existing file that covers it and update that instead of duplicating. Delete memories that turn out to be wrong.

## Merge guidance

If the client has no `memory/` folder, create it with a starter `MEMORY.md` from the template above (empty of entries). If they already have a memory folder or index, do NOT overwrite it; only add what is missing (for example, the leanness/aging note or the frontmatter convention) and point it out. Never touch their actual saved memories. Additive only.
