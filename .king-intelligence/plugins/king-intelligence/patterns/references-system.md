---
id: references-system
title: References system, an operating manual built as you go
applies-to: folder-structure
since: 0.11.0
---

## What this is

A place for the "how to use this tool" knowledge your setup builds up over time, so Claude looks it up instead of re-deriving it every time. One file per tool, written the first time you figure something out, read on demand later. Keeps your main rules file short and your hard-won fixes from getting lost.

## Canonical content

Set up a `references/` folder at the repo root: lookup material that Claude reads on demand, NOT loaded every session. Keep the main `CLAUDE.md` lean (the rules that must always be true) and push detail here.

- **One file per tool or topic.** The first time you work out how a tool behaves (its commands, its quirks, the fix for a recurring error), write it down as `references/<tool>.md`. Next time, Claude reads that instead of relearning.
- **An `references/operating/` subfolder** for behavioral manuals: the step-by-step procedures that are too long for CLAUDE.md but get read before doing that kind of work (for example a backup-and-restore procedure, a folder map).
- **Point to it from CLAUDE.md.** A short Pointers section in CLAUDE.md links the references so Claude knows what exists and reads the right one on demand.
- **Read on demand, write on discovery.** A reference file is only worth it if Claude actually reads it before the relevant work and adds to it whenever something non-obvious is learned.

## Merge guidance

If the client has no `references/` folder, create it with a short README explaining the "one file per tool, read on demand" idea, and add a Pointers line to their CLAUDE.md if one doesn't exist. If they already have a references folder, do NOT restructure it; only add the missing convention (for example the `operating/` subfolder idea or the write-on-discovery habit) and point it out. Additive only.
