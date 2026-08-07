# /begin-session spec
2026-05-24

Locked via `/grill-me` session on 2026-05-24. This is the design contract for the `/begin-session` skill. The S6 plan item (build `/begin-session`) implements against this spec. Do not re-litigate without re-grilling.

---

## 1. Purpose (one line)

`/begin-session` is a **topic-loader**. The client says `/begin-session Atlas Brewery` (or mentions the topic in their first message), and Claude reads `CLAUDE.md` + `SKILLS.md` + `CONNECTIONS.md` for self-awareness, then fans out across the matched folder + relevant auto-memory + wired connectors to synthesize a tight briefing — so the client can immediately do useful work on that topic. It is the "prepared briefer" pattern, not a session-open ritual.

---

## 2. Locked decisions

10 calls locked during the 2026-05-24 grill. Each is the contract S6 must honor.

### 2.1 Scope: topic-loader ONLY (not a session-open ritual)

The original S5 brief listed four jobs: read SKILLS.md/CONNECTIONS.md/CLAUDE.md, surface `last-session.md`, surface a TIME-SAVED nudge, offer a 3-option "resume / build new / end" AskUserQuestion. **This grill dropped jobs 2-4.** `/begin-session` v1.0 does NOT touch `.claude/last-session.md`, does NOT surface a TIME-SAVED nudge, and does NOT present a 3-option session-ritual menu.

Reasoning: those jobs are session-open-ritual concerns, not topic-loader concerns. Bundling them confused the skill's purpose. v1.0 keeps `/begin-session` narrowly focused: load context on a named topic so the client can dive in. The Day-2 cadence / habit-layer open-by-design item now has no v1.0 landing in this skill — it falls entirely to V4 (the deferred weekly-email-nudge version). See § 4 Deviations.

### 2.2 Trigger: judgment-based via CLAUDE.md contract + explicit slash command

`/begin-session` fires two ways:

1. **Explicit invocation:** client types `/begin-session <topic>` (or `/begin-session` bare — see § 2.6).
2. **Judgment-based auto-fire** via `CLAUDE.md` contract. Verbatim addition to CLAUDE.md (this is a § 4 deviation — F6 needs a content edit):

   > **Topic-loading.** When the user's first message engages deeply with a specific topic by name (a client, project, or initiative — the focus of their work this session), run `/begin-session` on that topic BEFORE doing anything else. When the message is a quick task or question that doesn't need background context, just do the work. Use judgment.

The intent is the "smart EA" pattern. A good executive assistant reads the room — they hand the CEO a brief when the CEO says "let me think through Atlas Brewery," and they just answer when the CEO says "what time is my next meeting?" Claude does the same.

**Tradeoff accepted:** Claude will sometimes misfire (brief when not needed, skip when wanted). Mitigation: briefings are tight (§ 2.5 length caps), and the explicit `/begin-session <topic>` command is always available as the override. Both client and Claude have escape hatches.

### 2.3 Topic resolution priority (folder → memory → connector)

When a topic is provided, Claude tries each source in order and stops at the first confident match:

1. **Folder name match.** Glob for matches under `clients/` and `projects/`:
   - Exact kebab-case match (`atlas-brewery` → `clients/atlas-brewery/`)
   - Substring match on the folder slug (`atlas` → same)
   - Multi-token match (e.g., `Atlas Q4 Pricing` splits to `[atlas, q4, pricing]` → could hit both `clients/atlas-brewery/` AND `projects/q4-pricing/`)

2. **Auto-memory scan.** If folder match returns zero, search the user's Anthropic auto-memory for the topic phrase. (Auto-memory location: outside the second brain folder, project-keyed by Anthropic harness. Claude has read access at runtime.) If any memory entries match, surface their content as the briefing's primary signal.

3. **Connector fallback.** If memory also returns zero, query whichever connectors are wired per `CONNECTIONS.md` (HubSpot search by company/contact name, Gmail search by phrase, Notion search by phrase, etc.) — bounded to results matching the topic phrase.

4. **Still zero matches** → § 2.4 (zero-result handling).

### 2.4 Zero-result handling

When all three resolution tiers return nothing, Claude responds:

> I don't have anything on "<topic>" yet — first time you're mentioning them?

Then `AskUserQuestion` with three options:

1. **(Recommended) "Yes, first time — create a folder for them"** → Claude scaffolds `clients/<slug>/` (kebab-case from topic) containing:
   - `.gitkeep` (so empty folder commits)
   - `CLAUDE.md` with this stub content:
     ```
     # <Topic name as the client gave it>

     **Created:** 2026-XX-XX via `/begin-session`
     **Folder slug:** <slug>

     ## Status
     First mention — no context captured yet.

     ## Next steps
     Fill in as you work on this. `/skill-builder` can build automations specific to this topic.
     ```
   - Then briefs from the (now-just-created) folder: identity = topic name, all other sections empty (omitted per anti-fabrication rule § 2.5).

2. **"Let me search connectors more deeply"** → broader connector queries (full-text search beyond exact-phrase match). If still zero, loop back to this AskUserQuestion with option 1 still available.

3. **"I meant a different topic"** → re-prompt: "What topic should I load instead?"

**Why "clients/" by default for the create-folder branch:** topic-shaped names in second brain usually refer to people or companies, which are client-mode. If the client clarifies it's actually a project ("this is a project, not a client"), `/skill-builder` can move the folder later. v1.0 doesn't ask which folder — picks `clients/` and moves on.

### 2.5 Source fan-out by folder location

After a folder is matched (or scaffolded), Claude detects the mode and fans out accordingly. Modes are determined by folder location, NOT by topic-string heuristics.

**Client mode** — topic resolved to `clients/<x>/`:
- Read `clients/<x>/CLAUDE.md` verbatim
- Scan recent files in the folder (top 3 by modification time)
- Grep auto-memory for the topic name (first + last name tokens if person-shaped, full phrase otherwise)
- Query wired connectors per `CONNECTIONS.md`:
  - **Gmail** (if wired): list threads from last 90 days where contact email or name appears in subject/from/to. Return top 5-10 sorted by recency: subject, last date, last sender, 1-line snippet.
  - **Calendar** (if wired): events from last 60 days through next 30 days where the contact appears or title contains the name. Return event title + date + duration.
  - **HubSpot** (if wired): contact ID, associated deals (dealstage, dealname, amount, close date), most recent 5 engagements (type, date, summary).
  - **Otter** (if wired): staged transcripts where attendee or title matches the topic. Capture title + date + Otter URL.

**Project mode** — topic resolved to `projects/<x>/`:
- Read `projects/<x>/CLAUDE.md` verbatim
- Scan recent files in the folder (top 3 by modification time)
- Grep auto-memory for the project name
- `git log -10 --pretty=format:'%h %ad %s' --date=short -- projects/<x>/` (last 10 commits scoped to folder)
- Query wired connectors per `CONNECTIONS.md`:
  - **Otter** (if wired): staged transcripts where title or attendees match the project name
  - **Notion** (if wired): page search for the project name
  - **Drive** (if wired): file search for the project name

**Hybrid mode** — topic resolved to BOTH `clients/<x>/` AND `projects/<y>/` (rare, only when multi-token match hits both, or when client AND project folder share the slug). Fan out is the UNION of client-mode + project-mode sources, PLUS one extra step:

- **Intersection scan:** grep both folders' CLAUDE.md for cross-references (the other party's name). Surface 3-5 most relevant cross-mentions with context in the briefing's intro paragraph.

**Connector-availability discipline.** Before querying any connector, check `CONNECTIONS.md` § 1 "Connected" table. If the connector isn't listed as connected, skip it silently. At the end of the briefing, IF an obviously-useful unwired connector exists (e.g., client mode + HubSpot not wired), append a single one-liner: *"Heads up — HubSpot isn't connected yet. You'd get deal stage + engagement history here if it were. See CONNECTIONS.md to set it up."* Once per briefing maximum, not for every missing connector.

**Subagent dispatch.** All fan-out sources spawn as parallel subagents in a SINGLE message (multiple `Agent` tool uses in one batch). Sequential dispatch defeats the purpose.

**Subagent timeout.** Per-subagent 60-second budget. If any source hasn't returned, proceed with partial data. Note the timeout in the briefing output: *"Calendar pull timed out — briefing proceeds without upcoming-events section."* Don't fail the whole briefing on one slow source.

### 2.6 Bare invocation (no topic argument)

When the client types `/begin-session` with no argument, Claude responds:

> Which topic? Pick a recent one or type new.

`AskUserQuestion` with up to 4 options:

1-3. The 3 most-recently-touched folders under `clients/` + `projects/` (sorted by `git log -1 --format=%cd -- <path>`). Option 1 is "(Recommended)" — the single most-recently-touched.
4. **"Type a different topic"** → re-prompt for the topic name, then run resolution per § 2.3.

If `clients/` and `projects/` are both empty (fresh post-/day-one client), skip the menu and just say:

> No topics yet — type the name of a client, project, or initiative you're working on, and I'll get oriented.

### 2.7 Briefing output structure

Output is written directly to chat. **No file is created** (no `--save` flag in v1.0). Structure depends on detected mode.

**Anti-fabrication rule (applies to all modes):** if a section has no data, OMIT it entirely. Do not write `[not found]`, `TBD`, or pad with generic content. A quiet topic with no recent activity gets a short briefing — that's the right answer.

**CEO voice rule (applies to all modes):** never use jargon. Translation: "recent commits" → "recent changes," "engagements" → "activity," "git log" → "history." Underlying mechanism stays the same; user-facing language stays plain.

#### Client mode output

```markdown
# <Name> — briefing as of <EST date>

## Identity
<2-4 lines: title, company, location, role — from CLAUDE.md + HubSpot>

## Relationship state
<1-2 sentences: where things stand from CLAUDE.md + HubSpot deal stage>

## Last touchpoint
- **Email:** <subject + date + last sender>
- **Calendar:** <most recent event + date>
- **HubSpot:** <most recent activity type + date + summary>

## Open threads
<bullets — anything in flight per CLAUDE.md "Next Steps" + Gmail threads where last sender is the contact (awaiting client's reply)>

## Watch items
<bullets — scheduled follow-ups, pending decisions, deadlines from CLAUDE.md>

## Upcoming
<bullets — calendar entries in the next 30 days>
```

#### Project mode output

```markdown
# <Project> — briefing as of <EST date>

## State
<1 line — pull from CLAUDE.md "Status:" or most recent activity>

## Last shipped
<most recent change + 1-2 line summary of what changed>

## In flight
<bullets — from CLAUDE.md Next Steps + uncommitted work signals from git status>

## Blockers
<from CLAUDE.md Blockers section + any "BLOCKED" / "PENDING" markers in recent commits>

## Memory rules in play
<bullets — auto-memory hits for this project>

## Next concrete step
<one line — derived from CLAUDE.md, recent activity, memory>
```

#### Hybrid mode output

```markdown
# <Topic> — briefing as of <EST date>

## How they intersect
<1-paragraph synthesis — e.g., "Atlas Brewery is the client driving the Q4 Pricing Project. Conference 6/19/26. Last touchpoint was the 5/9/26 walkthrough email + Loom recording. Waiting on their reply.">

<Person section — full client-mode template>

<Project section — full project-mode template>
```

**Length cap (soft):** briefings stay under ~25 lines for client mode, ~20 lines for project mode, ~50 lines for hybrid. Brevity is a feature — non-tech CEOs scan briefings, they don't read them.

### 2.8 Smart referral at end (single-line, signal-based only)

After the briefing, Claude MAY append ONE single-line referral to another skill if a real signal exists. Otherwise, omit entirely — don't force a referral just to fill space.

**Signals worth referring on (v1.0 starter-skill kit only):**

- **Topic folder is empty or stub** (just-scaffolded from § 2.4 or never filled out) → *"Want to run `/skill-builder` to start capturing context for this?"*
- **Calendar entry within next 7 days mentioning this person** → *"Want to draft something or prep for the upcoming meeting?"* — landing skill is `/skill-builder` if no prep-specific skill exists yet
- **Topic has an unaddressed Gmail thread (last sender = contact, > 48 hours stale)** → *"Want help drafting a reply?"* — landing skill is `/skill-builder`
- **Topic has a staged Otter transcript** → at v1.0 there's no `/debrief` in the starter kit, so omit; v1.1 candidate

**Discipline rules:**
- One referral max per briefing
- If multiple signals fire, pick the most time-sensitive (calendar > Gmail > empty-folder)
- If no signal, omit the referral section entirely
- Never recommend a skill that doesn't exist yet (no forward-referencing unbuilt skills)

### 2.9 Failure modes

| Mode | Behavior |
|------|----------|
| Multiple folder matches (e.g., `clients/atlas-brewery/` AND `clients/atlas-consulting/` both substring-match "atlas") | `AskUserQuestion` listing each candidate folder; option 1 (Recommended) = most-recently-touched. Option N+1 = "Other (specify)" |
| Topic resolves to zero matches | § 2.4 (zero-result handling) |
| External connector fails (Gmail/HubSpot/etc.) | Degrade gracefully; note the gap in the relevant briefing section: *"Couldn't reach HubSpot — briefing proceeds without deal data."* |
| No data found in a section | Omit that section entirely (anti-fabrication) |
| Subagent exceeds 60s | Kill, proceed with partial data, note timeout in output |
| Connector not wired per CONNECTIONS.md | Skip silently in fan-out; one soft upgrade-mention at end if obviously useful (§ 2.5) |
| `clients/` + `projects/` both empty (fresh post-/day-one client, bare invocation) | Plain prompt, no menu: *"No topics yet — type the name of..."* (§ 2.6) |
| Topic is the whole AIOS (`/begin-session everything`) | Refuse: *"Too broad — give me a specific client, project, or initiative."* |
| `CLAUDE.md`, `SKILLS.md`, or `CONNECTIONS.md` missing at session start | Should be impossible post-/day-one (F6/F8/F7 ensure existence). If missing, surface error: *"Something's missing from your second brain setup — run `/day-one` again or check with the person who set this up."* |

### 2.10 Self-ping at end (TIME-SAVED tracking)

After the briefing (and optional referral) lands, the absolute last action `/begin-session` takes is incrementing its row in `TIME-SAVED.md`:

- Skill: `/begin-session`
- Manual time per use: **15 min** (replaces ~5 min Gmail scan + ~3 min calendar scroll + ~5 min CRM check + ~2 min memory rummaging — conservative; under-claims rather than over-claims)
- Increment "Total uses" by 1
- Recompute "Total saved (cumulative)" as `Total uses × 15 min`
- Update "Last used" to today's date
- Add row if `/begin-session` doesn't have one yet

Use the same self-ping template `/skill-builder` bakes into generated skills (see `.claude/skills/skill-builder/SKILL.md` § AIOS append templates → Self-ping block).

**Suppress self-ping when:** briefing aborted before completing (e.g., client cancelled out of the zero-result AskUserQuestion). Only count completed briefings.

---

## 3. SKILL.md frontmatter contract

S6 (build) must emit `.claude/skills/begin-session/SKILL.md` with this frontmatter:

```yaml
---
name: begin-session
description: <CEO-voice description covering the topic-loader purpose + when it auto-fires per CLAUDE.md judgment contract + explicit /begin-session <topic> invocation. ~150-200 words.>
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
  - <plus connector MCP tools available per CONNECTIONS.md — gws, mcp__hubspot__*, mcp__claude_ai_Otter_ai__*, etc.>
disable-model-invocation: true
---
```

`disable-model-invocation: true` is critical — prevents the harness from auto-firing on conversational mentions. The judgment-based trigger from § 2.2 fires via CLAUDE.md instructions Claude reads, NOT via harness auto-invocation. This avoids false-positive fires.

**Soft length cap on SKILL.md body:** 100 lines (same as `/day-one`). If pushing 150+, push detail into `.claude/skills/begin-session/references/*.md` files.

---

## 4. Deviations from REBUILD-PROMPT.md / REBUILD-PLAN.md surfaced

Five scope changes locked in this grill that need formal capture via `ADD-ITEM-PROMPT.md` in a separate session:

### 4.1 `/begin-session` rescoped from session-ritual to topic-loader

**S5 brief** says: "Read SKILLS.md/CONNECTIONS.md/CLAUDE.md / surface 'where we left off' from `.claude/last-session.md` if recent / surface light TIME-SAVED nudge / offer next obvious move via AskUserQuestion."

**This grill locked:** topic-loader only. Drops `last-session.md` surfacing, TIME-SAVED nudge, and 3-option session-ritual AskUserQuestion entirely.

**REBUILD-PLAN.md updates needed:**
- **S5** Goal/Deliverable rewrite: "Lock the topic-loader spec." Drop bullet points about last-session.md, TIME-SAVED nudge, and the 3-option menu. Keep the SKILLS.md + CONNECTIONS.md + CLAUDE.md read (those happen for self-awareness, not surfacing).
- **S5** Depends-on stays the same (M1, F7, F8, F9).
- **S6** Goal/Deliverable rewrite: build the topic-loader per this spec.
- **S6** Success check rewrite: "End-to-end test: invoke `/begin-session <real-topic>`, get a briefing matching § 2.7 structure, signal-based referral fires correctly OR is omitted." Drop the TIME-SAVED nudge and per-mode menu checks.

### 4.2 Day-2 cadence / habit-layer open-by-design item has NO v1.0 landing in this skill

**REBUILD-PROMPT.md "Items the plan must resolve" item** says: "Day-2 cadence / habit layer. AIOS only compounds if used. Plan should produce one of: (a) email-based weekly nudge, (b) AIOS-side streak tracker in /begin-session greeting, (c) calendar-blocked weekly AIOS session. Pick the lightest one that works."

**This grill locked:** option (b) is dropped because `/begin-session` is no longer a session-ritual. Option (a) is V4 (deferred). Option (c) was never specced.

**Resolution:** the Day-2 cadence open-by-design item now has NO v1.0 in-product implementation. Falls entirely to V4 in the v1.1 backlog. Coverage Check in REBUILD-PLAN.md should be updated to reflect this (currently maps the item to S5/S6 + V4 — should be V4 only).

### 4.3 `CLAUDE.md` needs a new "Topic-loading" paragraph (judgment-based trigger contract)

**F6 spec** (already executed and marked `done`) does not include the topic-loading judgment-based trigger contract from § 2.2 of this spec.

**REBUILD-PLAN.md update needed:** add a new F-item OR re-execute F6 to insert the topic-loading paragraph verbatim into `CLAUDE.md` § 4 "Before any work" (or a new § 4a, executor's call):

> **Topic-loading.** When the user's first message engages deeply with a specific topic by name (a client, project, or initiative — the focus of their work this session), run `/begin-session` on that topic BEFORE doing anything else. When the message is a quick task or question that doesn't need background context, just do the work. Use judgment.

### 4.4 `CLAUDE.md` needs a "Voice-tool re-prompt" paragraph (relocated from /begin-session)

**`/day-one` spec § 2.4** (already locked) says: if client skips voice tool, `onboarding/voice-unconfigured.md` is created; "/begin-session reads this on session open and re-prompts ONCE per session until either the file is deleted OR the client says 'stop reminding me' (then file rewrites to voice-declined-permanently.md)."

**This grill locked:** that re-prompt mechanism cannot live in `/begin-session` anymore (topic-loader doesn't fire reliably on session-open). Relocated to `CLAUDE.md` § 4 "Before any work" contract.

**REBUILD-PLAN.md update needed:** the same F6 re-execution from § 4.3 adds this paragraph verbatim:

> **Voice-tool re-prompt.** If `onboarding/voice-unconfigured.md` exists, mention voice tool ONCE in your first response of the session ("Quick reminder — you skipped the voice tool during Day 1. Want to set it up now? It's a big quality-of-life upgrade."), then never again that session. If `onboarding/voice-declined-permanently.md` exists, never mention voice tool at all. If client says "stop reminding me," rename `voice-unconfigured.md` → `voice-declined-permanently.md`.

The `/day-one` spec § 2.4 should be updated to point at this CLAUDE.md mechanism instead of `/begin-session`.

### 4.5 S6 build brief should NOT assume session-ritual sizing

**S6 brief** currently says: "Self-ping line (manual time = 15 min, 'thinking through what to work on without an AIOS that knows me')." That description matches a session-ritual, not a topic-loader. The 15-min number is correct (§ 2.10) but the description should be updated to: "Self-ping line (manual time = 15 min — replaces manual Gmail/calendar/CRM lookup time per topic)."

**REBUILD-PLAN.md update needed:** S6 brief description rewrite as above.

**Action:** Jacob runs `ADD-ITEM-PROMPT.md` in a separate session to formally update 4.1-4.5. Not blocking S6 (build /begin-session) — this spec is now the source-of-truth for the build, and the deviations are documented here.

---

## 5. Out of scope (parked, not v1.0)

- **Session-open ritual.** Showing `last-session.md`, TIME-SAVED nudge, 3-option menu. Falls to V4 (Day-2 cadence) or a new starter skill in v1.1 (would require updating Decision 9's "exactly 6 skills" lock).
- **Topic-shape heuristics.** No detection of "person-shaped" vs "project-shaped" topics from the string alone. Folder location is the only mode signal.
- **Multi-topic load.** `/begin-session Atlas, Bob's BBQ` is not supported. One topic per invocation.
- **`--save` flag.** Briefing is chat-only in v1.0. File output deferred.
- **Smart referral to skills that don't exist yet.** Only refer to skills in the v1.0 starter kit (/day-one, /begin-session, /end-session, /skill-builder, /grill-me, /brainstorm) or skills the client has built via /skill-builder.
- **Cross-language briefings.** English only. Multi-language is v1.1+ scope.
- **Connector-specific bug handling.** If Gmail returns malformed JSON, /begin-session degrades gracefully (logs warning, omits Gmail section) — doesn't try to fix the underlying connector.
- **Re-running /begin-session during the same session.** No different behavior than first invocation. Topic-loader doesn't track "is this the first /begin-session of the session?" state.

---

## 6. What S6 (build) must verify

Per Decision 23 (Verify before asserting), the S6 executing session must verify these in-session before claiming /begin-session is built:

1. `.claude/skills/grill-me/` exists (M1 done — required for /begin-session to recommend other skills that compose with /grill-me later).
2. `CLAUDE.md` exists and § 4 "Before any work" section is present (F6 done). If F4.3 and F4.4 deviations from this spec have NOT yet been applied (paragraphs for topic-loading trigger + voice re-prompt), surface this in the build session — the skill works without them but the judgment-based trigger won't fire silently from CLAUDE.md until they're added.
3. `SKILLS.md` exists with the `/begin-session` row in `[not yet built]` state (F8 set this up).
4. `CONNECTIONS.md` exists with the § 1 "Connected" table (F7 done — even if empty Day-1, the section structure must exist).
5. `TIME-SAVED.md` exists with the table header (F9 done).
6. `clients/` and `projects/` folders exist (F3 done at AIOS root, F18 relocated to second brain/).
7. End-to-end test: invoke `/begin-session <real-topic>` (Jacob picks a real test topic from his own AIOS dev clone — e.g., scaffold a `clients/test-atlas-brewery/` with a CLAUDE.md, then run /begin-session test-atlas-brewery). Verify:
   - Folder match resolves correctly
   - Client-mode template fires (since topic was under clients/)
   - Anti-fabrication holds (empty sections omitted)
   - Self-ping fires at end (check `TIME-SAVED.md` shows new row OR incremented count)
   - Cleanup test artifacts after pass.
8. Bare-invocation test: invoke `/begin-session` with no argument. Verify the recent-folders menu OR the empty-folder prompt fires (whichever the dev clone state matches).
9. Zero-result test: invoke `/begin-session NonexistentTopicXYZ`. Verify the 3-option AskUserQuestion fires per § 2.4. Pick option 3 ("specify different") to avoid scaffolding a junk folder.
10. `disable-model-invocation: true` frontmatter is set (per § 3) — prevents harness auto-firing on conversational mentions.

---

End of spec.
