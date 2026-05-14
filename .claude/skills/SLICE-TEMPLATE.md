# SLICE-TEMPLATE — how to build a new slice

This is the reusable pattern for a vertical slice. `level-2` (Slice 1: Meetings) is the
first filled-in instance. To build Slice 2, 3, 4… copy this shape into a new
`level-N/SKILL.md` and fill in the `{{placeholders}}`.

**This file is for whoever builds the program — not for a client to run.** It is not a
skill itself (no frontmatter on purpose).

---

## What a slice is

One bucket of the business, taken top to bottom, ending in a built skill the user owns.
Seven beats. Same shape every time. The sameness is the point — once a user has done one
slice, every other slice feels familiar.

The seven buckets, in rough recommended order after Meetings:
**Meetings** (Slice 1) → **Customers** → **Communication** → **Revenue** → **Operations**
→ **Calendar** → **Knowledge**. Re-order to the client's actual pain — but Meetings stays
first (lightest connection, universal win).

---

## The seven beats

### Kickoff
- Silently check the connection kit's install state:
  `cat .claude/skills/connect-kit/state/install.json` — note if it's `done`.
- Welcome them back. Name what this slice is and what they'll walk out with: *a built thing*.
- End with: type **next**.

### Beat 1 — Map the bucket
- One broad ramble prompt. *"Talk to me about {{bucket}}. {{2-4 specific things to touch on}}. Ramble — don't be polished."*
- Wait for the full answer. Probe lightly, one follow-up at a time. Never interrogate.
- One-line recap. Ask "anything else about {{bucket}}?"

### Beat 2 — Pin the tools
- Tighten Beat 1 into a clean list: where this bucket *lives* — what apps, folders, tools.
- Reflect it back as a short list. Let them correct it.
- Note clearly **which tool this slice will connect** in Beat 4.

### Beat 3 — Verify and time the tasks
- Reflect back the recurring tasks you heard. Ask "what did I miss?"
- Then: rough hours-per-week on each. Capture every number. Total it. *"That's your starting line."*
- Name what you see: the lowest-hanging fruit, and **the big one** — the task that, handled, changes their week most. Confirm what you'll build.

### Beat 4 — Connect the tool
- Verify the install: `node .claude/skills/connect-kit/scripts/verify.mjs --check install`. If not done, STOP and finish it.
- Run the connector this slice needs (see connect-kit/SKILL.md). Fork gracefully if the user's on a different tool.
- Verify the connection. **Never guess past a connection error** — the kit fails loudly with a next step; follow it.
- Don't leave Beat 4 until the skill-to-build has real data to work from (connected, pasted, or dropped in a file).

### Beat 5 — Build the skill (the win)
- Build a real `{{skill-name}}` skill in `.claude/skills/{{skill-name}}/SKILL.md`, with the user, explaining as you go.
- Create any folder it writes to.
- **Run it live, on the user's real data.** This is the win — they watch their own AI do the thing they hate.
- Update `tasks.md`: write this bucket's real tasks under its header with hours; set the now-handled task to Score 2; fill the Day 0 score-history row.

### Close
- Show the map: what they now have (tasks captured + hours, tool connected, skill built and running).
- Name the pattern: every slice works this way.
- Point at the next slice with the exact paste-this prompt.

---

## Rules that hold for every slice

- Voice rules: 2nd-grade language, no coder words, one thought per line, never a wall of text.
- One topic per turn. Ramble prompts, not 20 questions.
- YOU drive — you write files, you build the skill. The user talks.
- **If the clock runs short, protect Beat 5.** A slice that ends without a built skill failed. Beats 1-3 can be tightened; Beat 5 cannot be cut.
- **If anything errors, STOP.** Plain-English explanation, clear next step, never a guess.
- Progress block after every beat — one line for the slice, one for the journey.

---

## Placeholders to fill per slice

| Placeholder | Meaning |
|---|---|
| `{{bucket}}` | Revenue / Customers / Communication / Operations / Calendar / Knowledge |
| `{{ramble prompt}}` | The Beat 1 broad prompt + 2-4 things to touch on |
| `{{connection}}` | What Beat 4 connects (the recording tool, Google via gws, the CRM, etc.) |
| `{{skill-name}}` | The skill built in Beat 5 (e.g. `post-meeting`, `follow-up`, `weekly-report`) |
| `{{skill job}}` | The one job that skill does, in one plain sentence |
| `{{next slice}}` | What Slice N+1 is, named in the close |
