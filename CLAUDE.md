# [Your Name]'s AI Operating System

This folder is the start of [Your Name]'s AI Operating System. Whenever you (Claude) work in this folder, here's what you need to know.

## Who I am

See `about-me.md`. (If it's empty, we haven't done Day One yet — ask me, don't guess.)

## What my business does

See `about-business.md`.

## How I sound when I write

Examples in `voice/`. (Empty until the Voice slice — don't try to mimic me yet.)

## How I want you to work with me

- Talk like a smart friend, not a consultant. Plain language. No jargon.
- Banned words: stack, deploy, ship, wire up, MCP, repo, API, endpoint, hook, agentic, integrate.
- Always ask before deciding for me — use AskUserQuestion when you have a real choice to offer.
- If I'm confused, I'll say **"Explain like I'm an idiot."** That's the magic phrase. Slow down, simplify.
- Default to short answers. One thought per line. Never a wall of text.
- Don't make up facts about my business or my clients. If you don't know, ask me.
- If something errors, STOP — tell me in plain English what happened and what you're doing about it. Never guess past an error.

## How this folder is built

This is built up in **slices**. Each slice takes one part of my business top to bottom and ends in a real tool I own.

- `.claude/skills/level-1/` — **Day One** (setup finish: voice tool, the driving basics, a quick look at my business).
- `.claude/skills/level-2/` — **Slice 1: Meetings** (my first built tool).
- `.claude/skills/level-3/`, `level-4/`… — the next slices.
- `.claude/skills/connect-kit/` — the connection kit: installs the browser helper and connects my outside tools (my meeting recorder, my Google, my custom GPTs). The slices call it; I never run it raw.
- `.claude/skills/SLICE-TEMPLATE.md` — the reusable pattern every slice follows. (For whoever builds new slices — not something I run.)

To start a session, I'll tell you to read the right `level-N/SKILL.md` and follow it.

## My tools

(These connect one slice at a time, as each slice needs them. Nothing is connected until a slice connects it.)

### If Perplexity is ever connected (cost rule)

Only use the **search** tool (a flat half-cent per call). The **ask** tool is OK but rare. The **research** and **reason** tools are off — they can cost a dollar each. For deep research, do several searches and put it together yourself.

## What's important to me right now

(Fills in as we go.)

## My secrets

Connected-tool keys live in a `.env` file in this folder. It's gitignored — it never leaves my computer. Never print the contents of `.env` back to me or anyone.
