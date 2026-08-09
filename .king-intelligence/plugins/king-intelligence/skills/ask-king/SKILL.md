---
name: ask-king
description: >
  Show which King Intelligence skill fits your situation, and the exact command to type
  to run it. A plain-English guide over the skills you have installed. Type it when you
  are not sure which tool to reach for, when you forget what a skill is called, or when
  you want to see everything you can do in one place.
disable-model-invocation: true
allowed-tools: Read, Bash, Glob, AskUserQuestion
---

# Which skill fits my situation?

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

You do not have to remember every tool you have. Tell me what you are trying to get done and I will point you to the right one and give you the exact thing to type. Or run it with nothing and I will show you the whole menu, grouped by what you are trying to do.

## How to run this

1. Read the live list of the skills this person actually has. Do this first, every time (Step A).
2. If they described a situation, match it and hand them the best one (Step C).
3. If they gave nothing, show the grouped menu (Step B).

Never answer from memory, and never work from a list written into this file. Always read the live list first, so you only ever point at tools they really have and you automatically cover anything new that shipped.

## Step A: read the live list

Read from the FIRST source that exists, in this order.

1. The catalog file, if it is there. Check `$CLAUDE_PLUGIN_ROOT/catalog.json`. If that file exists, read it: its `skills` list is the best source. Each entry already has a plain `name`, a plain `description`, a `category`, and the exact `command` to type. Use those four fields, and hand the `command` to the person word for word.
2. If there is no catalog file, list the skill folders at `$CLAUDE_PLUGIN_ROOT/skills/*/SKILL.md`. Read only the top block of each (from the first `---` to the second `---`) for its `name` and `description`. The command to type is `/king-intelligence:` followed by the folder name.
3. If neither of those exists (you are on the author's own machine), list `.claude/skills/*/SKILL.md` the same way. The command to type is `/` followed by the folder name.

Reading the top block: the `description` is either one line, or it starts with `description: >` and continues on the indented lines below until the block ends. Read to the closing `---` and join those lines into one sentence. Do not read past the top block. You do not need the rest of the file.

If you find no skills at all, say this plainly and stop: "I could not find your installed skills right now. Type `/` to see your menu, or tell me what you are trying to get done and I will point you the right way." Do not guess at a list.

## Step B: show the grouped menu (when they gave no situation)

Group the skills you found and show them under plain headings.

- If you read the catalog (source 1), group by each skill's own `category`, and show the groups in this order: Set up, Think it through, Writing & content, Comms & meetings, Design & web, Build & automate, Media, Sessions & memory, Prove the value, then anything left over.
- **Set up** holds the one-time wiring runs (`install-…`). Show that group first, but keep it short: say plainly that these are run once each, and that someone who has already been set up can skip straight past them.
- If you fell back to reading folders (source 2 or 3), sort each skill into the first of these plain buckets that fits, by what it is for: Writing and content, Meetings and follow-ups, Business questions and money, Video and visuals, Getting organized, Building and planning. Anything that fits none goes under Other tools.

Leave out any group that has nothing in it. Never show an empty heading.

Under each heading, one line per skill, like this:

> **Email**: draft an email in your voice, checked before you see it.
> Type: `/king-intelligence:email`

Keep every line short and plain. No jargon. End the menu with one line: "Tell me what you are working on and I will narrow it to the one you want."

## Step C: match a situation (when they told you one)

If what they said is clear, pick the best fit.

- Return the single best skill, or up to three if a couple genuinely fit. Best one first.
- For each: the skill's plain name, one short line on why it fits, and the exact command on its own line.

> Best fit: **Debrief**. You just finished a meeting and want the notes, the follow-ups, and the to-dos handled for you.
> Type: `/king-intelligence:debrief`

If what they said is fuzzy (say "help me with a client," which could be writing something to send, or writing up a meeting, or pulling together what you already know on them), ask ONE short question first, then wait. One question at a time. For example: "Is this about writing something to send them, or pulling together what you already know on them?" Match only after they answer.

If nothing you found actually fits, say it straight: "None of your installed skills is built for that." If one is close, offer it and say it is the closest, not a perfect match. If they want a tool that does not exist, point them at the builder: "If you want, I can build you one. Type: `/king-intelligence:skill-builder`." Never make up a skill name or a command.

## Rules

- Only ever name skills you found in Step A. Nothing from memory.
- Give the exact command every time. If you read it from the catalog, copy it exactly. If you built it from a folder name, check the spelling.
- Plain English only. No jargon. Short sentences. No dashes joining clauses.
- One question at a time, never a batch.
- Never say a skill does something it does not, and never invent one.
