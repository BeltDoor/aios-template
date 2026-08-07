---
name: skill-builder
description: Compositional engine for growing new skills inside this second brain. Routes me to `/king-intelligence:grill-me` or `/king-intelligence:brainstorming`, captures how long the task takes me by hand, blocks on missing connections or missing voice profile, generates the SKILL.md, tests it once with real data, then ships an atomic commit. Use when the user says "build me a skill", "automate this", "I keep doing X by hand", "I want a skill for Y", "what should I automate next", or pastes a recurring task with any "turn this into a skill" framing.
---

# /skill-builder

The compositional engine that grows new skills inside this second brain. I route you to the right thinking partner (`/king-intelligence:grill-me` if there's a plan, `/king-intelligence:brainstorming` if there isn't), lock the spec, enforce prerequisites, generate the SKILL.md, test it once, and commit.

## What this skill is for

Building a new skill, end-to-end, in one session. The user has a recurring task they want automated. By the end, that task is a `/skill` they can invoke any time, the catalog reflects it, and TIME-SAVED.md starts tracking the minutes the user gets back.

## What this skill is NOT

- **Not for one-off scripts.** Skills are for recurring work. If the task happens once and never again, just do it manually.
- **Not a brainstorming partner.** If the user doesn't know what to build yet, route to `/king-intelligence:brainstorming` — it hands back to `/king-intelligence:grill-me` once a direction lands.

## Before you start — read these (always)

In this order:

1. [`SKILLS.md`](../../../SKILLS.md) — what already exists. So we don't build a duplicate.
2. [`CONNECTIONS.md`](../../../CONNECTIONS.md) — what tools are connected. So we don't propose something unhooked.
3. [`CLAUDE.md`](../../../CLAUDE.md) — voice rules, AskUserQuestion default, verify-before-asserting.

Read the matching [`/references/<topic>.md`](../../../references/) on demand — `git-and-backup.md` before commit, `api-keys.md` if a new key surfaces during the build.

## The workflow

One pass, in order. Don't skip steps. If a hard gate fires, stop and resolve before continuing.

### 1. Route

Read the opening message. Three cases:

- **Task in mind** ("build me a /follow-up-invoices skill", "automate my weekly recap"): skip the AskUserQuestion, route directly to `/king-intelligence:grill-me`.
- **No task in mind** ("what should I automate next", "I keep doing repetitive stuff but I don't know what to fix first"): route to `/king-intelligence:brainstorming`. It will hand back to `/king-intelligence:grill-me` once a direction lands.
- **Ambiguous** (bare "automate this" with no context): `AskUserQuestion`:
  - "I have a task in mind (Recommended if you already know what's repetitive)"
  - "I want to think through what to automate next"

Per CLAUDE.md § Voice: don't ask just to ask. When the opening clearly names a task, skip the question and route directly.

### 2. /king-intelligence:grill-me locks the spec

Run `/king-intelligence:grill-me` on the skill the user wants. The output is a tight spec: what triggers it, what data it reads, what it produces, what edge cases matter. Don't proceed without this — every skill that ships is grilled first.

### 3. Overlap check (BEFORE baseline capture)

Re-read [`SKILLS.md`](../../../SKILLS.md). Does the proposed skill overlap with something already there? Match on **trigger phrases** (any overlap counts) OR **domain + source + output triple** (e.g., both write a draft email to a customer based on an Otter transcript = overlap).

If overlap exists, `AskUserQuestion` with three options:

1. "Extend `/<existing-skill>` instead (Recommended if the overlap is real)" — branches to § Modify-existing flow below.
2. "Build the new skill anyway" — proceeds with the full build; both SKILL.md files get a one-line cross-reference note ("Related: `/<other-skill>` — they overlap on X; use this one when Y").
3. "Cancel — let me think" — exit cleanly. No files written. No commit.

If no overlap, keep going.

### 4. Manual-time baseline

Ask the user how long this task takes them by hand. `AskUserQuestion`:

- `<10 min`
- `10-20 min`
- `20-40 min`
- `40-60 min`

"Other" is auto-included for anything outside that band — when the user picks Other, ask for the exact number of minutes in plain chat ("Roughly how many minutes — give me a single number").

Store the midpoint as an integer `manual_time_minutes`:

- `<10 min` → 5
- `10-20 min` → 15
- `20-40 min` → 30
- `40-60 min` → 50
- Other → parse user's number directly

This integer is what gets baked into the generated skill's self-ping line (§ AIOS appends) and seeded into the new TIME-SAVED.md row.

### 5. Connector gap — HARD GATE

Identify every tool the new skill will need (Gmail, HubSpot, Otter, Stripe, anything else). Check [`CONNECTIONS.md`](../../../CONNECTIONS.md) § 1 (Connected).

If any required tool is **not** in § 1: **stop. Do not draft the SKILL.md.**

Walk the user through connecting it: claude.ai → Settings → Connectors → search the tool → Connect → sign in. Then verify the new MCP server is reachable by running `claude mcp list` (per CLAUDE.md § Verify before asserting — don't claim it's connected without checking). Update [`CONNECTIONS.md`](../../../CONNECTIONS.md) § 1 by hand for now; `/king-intelligence:end-session` will re-confirm on session close.

Resume only after every required tool is verified connected. No "ship with TODO." No "ship with hard gate inside the skill." Every skill that ships works on first invocation.

### 6. Voice profile — HARD GATE (draft-related skills only)

**What "draft-related" means.** The skill PRODUCES text the user sends or posts AS THEMSELVES. Includes: emails, social posts, SMS, Slack messages, blog posts, video scripts, customer-facing copy. **Excludes:** internal summaries, action-item lists, meeting minutes, time audits, status snapshots — anything the user reads but doesn't send as-them.

If the skill is draft-related AND [`/onboarding/voice-profile.md`](../../../onboarding/voice-profile.md) does not exist: **stop. Do not draft the SKILL.md.**

Tell the user, in plain words:

> "This skill writes things you'll send as yourself. You need a voice profile first. The `/capture-voice` skill builds one — it's a quick interview plus a few writing samples. To add it, paste this exact line: `pull /capture-voice from BeltDoor/aios-template main and install it`. I'll wait."

After `/capture-voice` is installed and run, `voice-profile.md` exists. The user re-invokes `/skill-builder` from scratch (cross-session resume isn't a v1.0 thing). On the re-invocation, this gate passes and we proceed.

No "ship without voice profile" sub-option. No reminder-only mode. Draft-related skills ship with real voice from day one.

### 7. Draft the SKILL.md

Use the Pocock `write-a-skill` chassis: gather requirements → draft → review-with-user. Layer in three patterns:

- **Description-for-triggering format.** First sentence in the frontmatter `description:` field is what the skill does. Second sentence is `Use when [specific trigger phrases / contexts]`. Pushy phrasing is fine — undertriggering is worse than overtriggering.
- **Progressive disclosure.** Keep the SKILL.md lean. If it's pushing past 100 lines, that's a signal the skill should be split or the deeper content should move to `.claude/skills/<name>/references/*.md` files referenced from SKILL.md.
- **Explain the why.** Prefer reasoning over bare `ALWAYS` / `NEVER`. Tell Claude *why* a constraint exists so it can judge edge cases.

Length cap for generated skills: soft **100 lines**. Past 150 = split into two skills.

### 8. AIOS appends

Every generated SKILL.md ends with the **self-ping block** (always) and, for draft-related skills, opens with the **voice-read line** at the top of the body.

See § AIOS append templates below for the exact text to paste. Substitute `<skill-name>` and `<manual_time_minutes>` from the spec and the baseline.

Do **not** restate CEO voice rules, AskUserQuestion default, or verify-before-asserting in the generated skill. Those live in CLAUDE.md and auto-load as project instructions for every session. Restating bloats the skill past the 100-line cap.

### 9. Review with the user

Per Pocock: show the draft, ask "does this cover it? anything missing?". This is a content review, not a test — the user is reading the SKILL.md text, not running the skill.

Apply any structural edits the user calls out. Tight clarifications, not rewrites. If the user wants a fundamental redesign, that's a `/king-intelligence:grill-me` redo signal — back up to Step 2.

### 10. Test with one real record

Run the skill end-to-end, **once**, with one real input:

- **Reads from a connected system?** Pull one real record. Default picks: latest unread email (Gmail), most-recent meeting transcript (Otter), last contact created (HubSpot), today's first calendar event (Calendar). User can override any default.
- **Takes user-pasted input?** User pastes one real example.
- **Creates output?** Show the output in chat (text), or print the file path with a one-line preview (docs / sheets / decks).

User signs off in chat:

- "good" / "ship it" / "perfect" → proceed to commit (§ 12).
- "wrong: X is broken" / "tweak X" → enter the iterate loop (§ 11).

One pass, not a benchmark loop.

### 11. Iterate cap — 2 fix cycles, then ship-or-scrap

- **Cycle 1.** User names ONE specific issue. Fix that one thing. Re-run the test against the SAME real record from § 10. Show the new output. User signs off or names a new issue.
- **Cycle 2.** Same loop. One more fix. One more re-run.
- **After cycle 2**, `AskUserQuestion`:
  - "Ship as-is — I'll edit it manually if I need to (Recommended if it's 80% there)"
  - "Scrap and re-grill — the design has a fundamental issue, take me back to `/king-intelligence:grill-me`"
  - "Hand it to me — write the SKILL.md to disk but skip the commit so I can edit before committing"

If iterate keeps needing more than 2 cycles, the skill's design has a flaw that more fix-passes can't paper over. Re-grill, don't keep patching.

### 12. Atomic commit

Stage and commit ONLY the files this build touched:

- `.claude/skills/<name>/SKILL.md` (new)
- `.claude/skills/<name>/references/*.md` (new, optional — only if progressive disclosure required it)
- [`SKILLS.md`](../../../SKILLS.md) (modified — add row for the new skill: status `[live]`, purpose line, trigger phrases)
- [`TIME-SAVED.md`](../../../TIME-SAVED.md) (modified — add row: skill name, `manual_time_minutes`, Total uses = 1, Total saved = `manual_time_minutes`, Last used = today)
- `/decisions/2026-XX-XX-skill-<name>.md` (new, optional — see § 13)

Commit message format:

```
aios(skill): build /<name> — manual time <X> min

<2-3 line summary of what the skill does and what real-data record it was tested against>
```

No `--no-verify`. No amends. No bulk `git add .` — stage by path.

### 13. /decisions/ log entry (optional, only on non-obvious calls)

Write `/decisions/2026-XX-XX-skill-<name>.md` ONLY when a non-obvious architectural choice was made during the build. Examples that DO warrant an entry:

- Scope tradeoff: "Built draft-only mode; auto-send deferred because user wanted an approval gate."
- Tool choice: "Used Apify scrape over Firecrawl because target is LinkedIn."
- Workaround: "Caches results to avoid Otter API rate-limit on every invocation."

Examples that do NOT warrant an entry:

- "Built /follow-up-invoices. Uses Gmail. Manual time 30 min." (run-of-the-mill build)
- Anything the SKILL.md itself already explains in its body.

Reserve the log for calls future-Claude or future-Jacob would want to know about when revisiting the skill. Run-of-the-mill builds don't earn entries.

### 14. Self-ping `/skill-builder` itself

After commit, increment `/skill-builder`'s own row in [`TIME-SAVED.md`](../../../TIME-SAVED.md). See the "Self-ping" block at the bottom of this file. Manual time per use = **90 min** (the rough cost of designing + writing a skill by hand without `/skill-builder`).

## Modify-existing flow (compressed)

When Step 3's overlap check routes to "Extend existing" instead of new build:

1. Read the existing SKILL.md.
2. Run `/king-intelligence:grill-me` on the specific change the user wants — not the whole skill, just the delta.
3. Apply edits to SKILL.md. Re-bake AIOS appends if missing.
4. Skip the connector gap check (Step 5) UNLESS the modification adds a new tool dependency.
5. Skip the voice-profile gate (Step 6) UNLESS the modification turns a non-draft skill into a draft-related one.
6. Run Step 10 test with one real record.
7. Apply Step 11 iterate cap.
8. Commit with message: `aios(skill): extend /<name> — <one-line summary of change>`. No new [`SKILLS.md`](../../../SKILLS.md) row (the row exists; only update if trigger phrases changed). No new [`TIME-SAVED.md`](../../../TIME-SAVED.md) row.
9. `/decisions/` entry per Step 13 — same threshold.

## AIOS append templates

### Self-ping block (always, every generated skill)

Paste at the bottom of the generated SKILL.md, substituting `<skill-name>` and `<manual_time_minutes>`:

```markdown
## Self-ping (do this at the end of every invocation)

Before you finish, increment my row in [`TIME-SAVED.md`](../../../TIME-SAVED.md):

- Skill: `/<skill-name>`
- Manual time per use: <manual_time_minutes> min
- Increment "Total uses" by 1
- Recompute "Total saved (cumulative)" as `Total uses × <manual_time_minutes> min`
- Update "Last used" to today's date

If `/<skill-name>` doesn't have a row yet, add one with the same fields.
```

### Voice-read line (only for draft-related skills)

Paste at the top of the generated SKILL.md body (right under the H1 and any 1-line purpose):

```markdown
> Before drafting, read [`/onboarding/voice-profile.md`](../../../onboarding/voice-profile.md). The output must match the voice captured there.
```

## Out of scope (parked, not v1.0)

- **Cross-session resume.** If /skill-builder is interrupted mid-build (context compaction, user steps away for a day), v1.0 expects re-invocation from scratch.
- **Self-build.** Bootstrap exception — this SKILL.md was hand-written from the locked spec at [`/decisions/2026-05-24-skill-builder-spec.md`](../../../decisions/2026-05-24-skill-builder-spec.md).
- **Semantic-embedding overlap detection.** Step 3 is keyword + structural. Embedding-based is a v1.1 idea.
- **Bulk build.** One skill per invocation.

## Self-ping (do this at the end of every invocation)

Before you finish, increment my row in [`TIME-SAVED.md`](../../../TIME-SAVED.md):

- Skill: `/skill-builder`
- Manual time per use: 90 min (the rough cost of designing + writing a skill by hand without me)
- Increment "Total uses" by 1
- Recompute "Total saved (cumulative)" as `Total uses × 90 min`
- Update "Last used" to today's date

If `/skill-builder` doesn't have a row yet, add one with the same fields.
