---
name: begin-session
description: Topic-loader for this second brain. When the user runs `/begin-session <topic>` or deeply engages a specific client, project, or initiative by name in their first message of the session, this skill resolves the topic to a folder under `clients/` or `projects/`, fans out in parallel across that folder plus auto-memory plus wired connectors (Gmail, Calendar, HubSpot, Otter, Notion, Drive — whichever appear in CONNECTIONS.md), and synthesizes a tight chat-only briefing of where things stand. Briefings stay under ~25 lines (client mode) or ~20 lines (project mode); empty sections get omitted entirely (no `[not found]` filler). Bare `/begin-session` surfaces a recent-folders menu. Zero-result topics offer to scaffold a fresh `clients/<slug>/` folder. Use when the user types `/begin-session`, says "load up Atlas Brewery for me", "get me up to speed on Q4 Pricing", "where are we with <client>", or opens with deep engagement on a named topic. Do NOT use for quick tasks or general questions — those don't need background context.
argument-hint: "<topic>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Agent
  - ToolSearch
disable-model-invocation: true
---

# /begin-session

Topic-loader. Resolve a topic to its folder, fan out across the folder + memory + wired connectors, hand back a tight briefing of where things stand. The "prepared briefer" pattern — not a session-open ritual.

## What this skill is for

Loading context on a named client, project, or initiative so the user can immediately do useful work on it. The briefing is the deliverable; everything else (memory, connectors, git history) is plumbing.

## What this skill is NOT

- **Not a session-open ritual.** Doesn't read `last-session.md`. Doesn't surface a TIME-SAVED nudge. Doesn't ask a 3-option resume/build/end menu. Those were dropped from the locked spec.
- **Not a place to fabricate.** If a section has no data, omit it entirely — never `[not found]`, `TBD`, or filler.

## Workflow

One pass, in order.

### 1. Resolve the topic

Three tiers — stop at the first confident match.

1. **Folder match.** Glob under `clients/*` and `projects/*`:
   - Exact kebab-case match (`atlas-brewery` → `clients/atlas-brewery/`)
   - Substring on slug (`atlas` → same)
   - Multi-token split (`Atlas Q4 Pricing` → `[atlas, q4, pricing]`; may hit a client AND a project — see hybrid mode in [`references/fan-out.md`](references/fan-out.md))
2. **Auto-memory scan.** If folder match is zero, search the user's auto-memory for the topic phrase. Surface matches as the briefing's primary signal.
3. **Connector fallback.** If memory is also zero, query connectors per [`CONNECTIONS.md`](../../../CONNECTIONS.md) — HubSpot search by name, Gmail search by phrase, Notion search by phrase, etc.

**Multiple folder matches.** `AskUserQuestion` listing each candidate; option 1 (Recommended) = most-recently-touched (`git log -1 --format=%cd -- <path>`).

**Zero matches across all three tiers.** See [`references/zero-result.md`](references/zero-result.md).

### 2. Detect mode (folder location is the only signal)

- Topic resolved to `clients/<x>/` → **client mode**
- Topic resolved to `projects/<x>/` → **project mode**
- Resolved to BOTH (multi-token match or shared slug) → **hybrid mode**

Do NOT infer mode from the topic-string shape ("Bob Smith" looks personal; "Q4 Pricing" looks project-y). Folder location is the only signal — `/skill-builder` can move folders later if the client wants a different home.

### 3. Fan out — parallel subagents, single message

Spawn every source in ONE message (multiple `Agent` tool calls in the same assistant message). Sequential dispatch defeats the purpose.

**Per-subagent budget:** 60 seconds. If a source hasn't returned by then, proceed with partial data and note the timeout in the briefing output: *"Calendar pull timed out — briefing proceeds without upcoming-events section."*

**Connector-availability discipline.** Before querying any connector, check [`CONNECTIONS.md`](../../../CONNECTIONS.md) § 1 Connected. Not listed → skip silently. At the end of the briefing, IF an obviously-useful unwired connector exists (e.g., client mode + HubSpot not wired), append ONE single-line upgrade hint: *"Heads up — HubSpot isn't connected yet. You'd get deal stage + engagement history here. See CONNECTIONS.md to set it up."* Once per briefing maximum.

**Per-mode source list and connector calls:** see [`references/fan-out.md`](references/fan-out.md).

### 4. Synthesize the briefing

Mode templates: see [`references/templates.md`](references/templates.md). The briefing is written directly to chat — no file is created in v1.0.

**Anti-fabrication.** A section with no data → omit the section entirely. A quiet topic gets a short briefing. That's the right answer.

**CEO voice.** Translate plumbing terms before they hit chat — "recent commits" → "recent changes," "engagements" → "activity," "git log" → "history." Underlying mechanism stays the same; user-facing language stays plain.

**Length caps (soft).** Client mode ≤25 lines, project mode ≤20 lines, hybrid ≤50 lines. Brevity is a feature — CEOs scan briefings, they don't read them.

### 5. Smart referral (signal-based, single line, optional)

After the briefing, append AT MOST ONE single-line referral to another skill — only IF a real signal fires.

Signals (v1.0 starter skills only):

- **Topic folder is empty or stub** (just-scaffolded or never filled out) → *"Want to run `/skill-builder` to start capturing context for this?"*
- **Calendar entry within next 7 days** mentioning this person → *"Want help prepping or drafting something for the upcoming meeting?"* (lands on `/skill-builder`)
- **Unaddressed Gmail thread** (last sender = the contact, > 48 hours stale) → *"Want help drafting a reply?"* (lands on `/skill-builder`)

Discipline: one max per briefing. Most time-sensitive wins (calendar > Gmail > empty-folder). No signal → no referral. Never recommend a skill that doesn't exist yet.

### 6. Bare invocation (no topic argument)

When the user types `/begin-session` with no argument:

> Which topic? Pick a recent one or type new.

`AskUserQuestion` with up to 4 options:

1. The single most-recently-touched folder under `clients/` + `projects/` — labeled **(Recommended)**.
2-3. The next two most-recently-touched folders.
4. **"Type a different topic"** → re-prompt for the topic name, then run resolution per § 1.

If `clients/` and `projects/` are both empty (fresh post-`/day-one` client), skip the menu:

> No topics yet — type the name of a client, project, or initiative you're working on, and I'll get oriented.

### 7. Refusals

- **Too broad** (`/begin-session everything`): *"Too broad — give me a specific client, project, or initiative."*
- **Multi-topic** (`/begin-session Atlas, Bob's BBQ`): *"One topic at a time — which one first?"*
- **Missing setup files** (`CLAUDE.md` / `SKILLS.md` / `CONNECTIONS.md` not at `second brain/` root): *"Something's missing from your second brain setup — run `/day-one` again or check with whoever set this up."*

## Out of scope (parked, not v1.0)

- **Session-open ritual.** `last-session.md`, TIME-SAVED nudge, 3-option menu — falls to V4 or a v1.1 skill.
- **Topic-shape heuristics.** No detecting "person-shaped" vs "project-shaped" from the string alone.
- **Multi-topic load.** One topic per invocation.
- **`--save` flag.** Briefing is chat-only; file output deferred.
- **Re-running in same session.** No state tracking — every `/begin-session` is treated independently.
- **Cross-language briefings.** English only.

## Self-ping (do this at the end of every completed briefing)

Before you finish, increment my row in [`TIME-SAVED.md`](../../../TIME-SAVED.md):

- Skill: `/begin-session`
- Manual time per use: 15 min (replaces ~5 min Gmail scan + ~3 min calendar scroll + ~5 min CRM check + ~2 min memory rummaging — conservative)
- Increment "Total uses" by 1
- Recompute "Total saved (cumulative)" as `Total uses × 15 min`
- Update "Last used" to today's date

If `/begin-session` doesn't have a row yet, add one with the same fields.

**Skip self-ping if** the briefing aborted before completing (user cancelled out of the zero-result `AskUserQuestion`, refused topic, etc.). Only count completed briefings.
