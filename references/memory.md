# Memory

How Claude remembers you across sessions, what to save, and what NOT to save.

## What memory is

Memory is a small set of notes Claude writes about *you* — your role, your preferences, what's going on in your work, where things live — that persist across every conversation. The notes live **outside** this second brain folder, on your laptop, and are keyed to this folder. So every time you open a new chat here, Claude already knows you.

This is different from the second brain folder itself. The folder is the long-term record of your work — your clients, your projects, your skills. Memory is the short, fast-recall layer Claude uses to stay coherent without re-asking you the same questions.

You don't manage this directly. Claude does — by reading the memory at the start of each session and writing or updating notes as it learns. Your job is to correct Claude when a note is wrong, and to say "remember this" or "forget that" when you want it explicit.

## The four types of memory

Every memory note is one of these four types. Knowing which is which keeps the system clean.

### 1. User

What Claude knows about *you* — your role, your goals, your responsibilities, what you already understand, what you don't.

**When to save:** Claude saves a user memory any time it learns something about you that will change how it should work with you in the future. Your title, your industry, your skill level with a particular tool, the kind of client you serve.

**Example trigger:** You say "I'm a benefits consultant — most of my clients are 50-500 employees." Claude saves: *Jacob is a benefits consultant. ICP is 50-500 employee companies.*

### 2. Feedback

Guidance you've given Claude about *how* to work with you — things to do, things to stop doing.

**When to save:** Any time you correct Claude ("don't do that," "stop summarizing") OR confirm that something Claude did was the right call ("yes, exactly that"). Both directions matter — if Claude only learns from corrections, it'll grow overly cautious. The reasoning matters too: "don't email customers from a draft, I always want to review first" is a stronger rule than just "don't email customers."

**Example trigger:** You say "Stop ending every response with 'let me know if you need anything else' — it's filler." Claude saves: *Skip closing-line filler. Jacob considers it noise.*

### 3. Project

What's going on in your work right now — who's doing what, why, by when.

**When to save:** When Claude learns about an in-flight project, a deadline, a stakeholder ask, a reason behind a decision. Project memories age fast (a deadline next Tuesday becomes irrelevant by Wednesday) so Claude should store the *why* alongside the *what* — that lets future-Claude judge whether the note is still useful.

**Example trigger:** You say "I'm replacing our quoting tool because the current one can't handle UBA partner firms." Claude saves: *Quoting tool replacement is driven by UBA partner support requirement, not general modernization.*

### 4. Reference

Pointers to where information lives outside this folder — a tool, a dashboard, a system, a channel.

**When to save:** When you mention an external system Claude should know about. "Our deals live in HubSpot." "Customer feedback comes through the king-intelligence.com contact form." "I track expenses in QuickBooks."

**Example trigger:** You say "All my call transcripts are in Otter, just so you know." Claude saves: *Call transcripts live in Otter. Use the Otter connector when Jacob references a meeting.*

## When NOT to save a memory

Just as important as what to save. Memory is small and fast; bloating it makes it slow and wrong.

Don't save:

- **Anything that's already in a file.** Your client list is in the `clients/` folder. Your skills are in `SKILLS.md`. Your connected tools are in `CONNECTIONS.md`. Don't duplicate.
- **Today's task details.** What you're working on *right now* in this conversation isn't memory — it's current context. When you say "I'm drafting an email to Mark," that's not a memory; it's the task.
- **One-off facts that won't matter next session.** "The temperature is 72 degrees" isn't memory. "I always work outside in the morning when it's under 75" — that's a feedback memory.
- **Code, file paths, or system structure.** Claude can read those directly from the folder. Memory is for the things the folder *can't* tell Claude.

When in doubt: ask Claude "is this memory-worthy or should I just say it again next time?" Claude's default should be to keep memory small.

## How a memory gets saved

Two steps happen behind the scenes — you don't do this, Claude does. But here's the shape so you can read a memory note and know what you're looking at.

**Step 1.** Claude writes a small file. The top of that file has a header block (called *frontmatter* — a small block of metadata at the top of the file, between two lines of three dashes) that lists the note's short name, a one-line summary of what's in it, and which of the four types it is. Below that is the actual memory.

```
---
name: short-hyphenated-name
description: One-line summary so future-Claude can decide if this note is relevant.
metadata:
  type: user  (or feedback, project, reference)
---

The actual memory content goes here.
```

**Step 2.** Claude adds a single line — a pointer to that file — into a master index called `MEMORY.md`. The index is what Claude reads first at the start of every session. It's the table of contents.

You'll never need to write this format yourself. If you say "remember that I prefer X" or "save this note," Claude does the file-writing. If you want to see what Claude has saved about you, ask "show me my memory."

## How Claude uses memory

At the start of every session, Claude reads `MEMORY.md` and pulls in the relevant notes. When you ask a question, Claude checks whether any memory applies before responding. If a memory does apply, Claude uses it — without making you repeat yourself.

**One important rule before Claude acts on a memory:** verify it's still true. Memories age. A project memory written three months ago might describe work that's already shipped. A reference memory pointing at a tool you no longer use is just noise. So before Claude recommends anything based on memory, it should re-check the underlying fact — by reading the relevant file, calling the tool, or asking you.

If Claude finds a memory that conflicts with what's actually true now, Claude should update or remove the memory rather than acting on it. You shouldn't need to babysit this.

## How to correct memory

If Claude says "you mentioned you prefer X" and you no longer prefer X, just say "update that — I prefer Y now." Claude will rewrite the note.

If Claude is acting on a memory that's flat wrong, say "forget that" or "that memory is wrong — here's what's actually true." Claude removes the bad memory and writes the right one.

If you want to see everything Claude has saved, say "show me my memory." Claude lists the notes, grouped by type, so you can scan and prune anything stale.

## `/dream` — coming later

Over time, your memory file collects a lot of small notes. Some of them overlap. Some of them are no longer relevant. Some of them could be combined into one cleaner note.

A future skill called `/dream` will reorganize accumulated memory — merging duplicates, retiring stale notes, surfacing patterns. It's not built yet. The current second brain uses lighter tools (`/king-intelligence:end-session` already has a one-step memory-prune confirmation that catches stale notes one at a time).

Until `/dream` exists, the system works the way it works above: small notes, written as Claude learns, pruned by `/king-intelligence:end-session` when something goes stale.
