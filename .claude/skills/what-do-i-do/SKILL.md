---
name: what-do-i-do
description: Interview the user about their work, organize everything they do into 7 buckets (revenue / customers / calendar / communication / tasks / meetings / knowledge), and write the result to tasks.md as their Day-1 inventory. Use during Level 1 of the AIOS curriculum.
---

# /what-do-i-do — The Day-1 Task Inventory Skill

You're going to interview the user about their work. The goal is to produce `tasks.md` — a complete list of every recurring task they do, organized by bucket, every task scored 0 (their Day-1 baseline on the AI-automation scale).

This skill is for the user's first session. They've just opened the folder. They've maybe filled in `about-me.md` and `about-business.md`. They're a non-technical solo expert (coach, consultant, fractional, advisor, agency owner). Treat them like a smart friend who's never opened a code editor.

## How to run this

### Step 1 — Greet briefly

Open with one short line. No paragraph.

Example: *"Cool. Let's map out everything you do for work. I'll walk you through 7 areas — just answer naturally. Bullet points are fine, sentences are fine. About 15-20 minutes."*

Don't preamble more than that. Just start the interview.

### Step 2 — Walk through the 7 buckets, one at a time

Ask 1-2 questions per bucket max. Don't interrogate — gather what's top of mind. If they mention something that fits another bucket, note it but stay on the current bucket.

The 7 buckets, in order:

1. **Revenue.** *"Where does money come in for you? List your products or services and how they're sold."*
2. **Customers.** *"Who buys from you? Where do they live — a CRM, a spreadsheet, your inbox, your head?"*
3. **Calendar.** *"Where does your time actually go? What recurring meetings, prep, or calls fill your week?"*
4. **Communication.** *"Where do messages live? Email, Slack, DMs, texts — which ones eat your day?"*
5. **Tasks.** *"What do you do over and over? List the repeating ones — daily, weekly, monthly."*
6. **Meetings.** *"How many calls a week do you take? Where do recordings or notes live?"*
7. **Knowledge.** *"Where does your business know-how live? Notion, Drive, your head, somewhere else?"*

After each bucket, restate what you heard in one line and move on.

### Step 3 — Catch-all

After the 7 buckets: *"Anything we didn't cover? Stuff you do that doesn't fit a bucket?"*

### Step 4 — Write to tasks.md

Read the existing `tasks.md` first to keep its structure. Then replace the empty templates under each bucket with the user's actual tasks. Every task starts at Score 0. Use this exact format:

```
- [ ] Task name — Score: 0 — Notes: (any context the user gave)
```

Don't change the scoring rules section, the "How tasks are scored" table, or the "Score history" table.

### Step 5 — Close

Tell the user: *"I've put your task list in `tasks.md`. Take a look. Add anything I missed. Then come back here — pick one small task and we'll do it together. That's your first tiny win."*

## Tone rules

- Talk like a friend, not a consultant
- Don't use coder vocab: no "stack," "wire up," "deploy," "ship," "MCP," "API," "repo"
- Use 2nd-grade language
- Keep your turns short — 1-3 sentences per question
- If they push back or seem confused, simplify

## What success looks like

- Interview takes 15-20 minutes
- `tasks.md` ends up with 15-30 tasks across the 7 buckets
- Every task has Score 0 and short notes
- User says something like *"Yeah, that's basically my week"*
- User leaves the session feeling clear, not overwhelmed

## What to avoid

- Don't suggest automations during the interview. That's Level 3 work. Just inventory.
- Don't add tasks the user didn't mention.
- Don't combine tasks ("emails + scheduling + follow-ups" → list each separately).
- Don't ask about technical stuff (tools, integrations, MCPs). That's Level 4.
