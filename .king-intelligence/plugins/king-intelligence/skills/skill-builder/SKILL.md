---
name: skill-builder
description: Build a new skill end-to-end inside your repo, or modify an existing one. Use when the user says "build me a skill", "automate this", "turn this into a skill", "I keep doing X by hand", "I want a skill for Y", "what should I automate next", or pastes a recurring task they want encoded, even if they never say the word "skill". Also use when extending, fixing, or re-triggering an existing skill.
---

# /skill-builder
*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

The compositional engine that grows new skills inside your repo. Routes to the right thinking partner (`/grill-me` if there's a plan, `/brainstorming` if there isn't), locks the spec, enforces prerequisites, generates the SKILL.md, tests it once, and commits.

## What this skill is for

Building a new skill, end-to-end, in one session. The user has a recurring task they want automated. By the end, that task is a `/skill` they can invoke any time, the catalog (`SKILLS.md`) reflects it, and if it's a real time-saver, `TIME-SAVED.md` starts tracking the minutes they get back.

## What this skill is NOT

- **Not for one-off scripts.** Skills are for recurring work. If the task happens once and never again, just do it manually.
- **Not a brainstorming partner.** If the user doesn't know what to build yet, route to `/brainstorming`.
- **Not a benchmark lab.** For a quantitative with-skill-vs-baseline benchmark on a high-value skill, that's a separate benchmarking workflow (see Out of scope). This skill tests once against one real record and ships.

## Before you start, read these (always)

In this order:

1. `SKILLS.md` in the repo root — what already exists. So we don't build a duplicate.
2. `CONNECTIONS.md` in the repo root — what tools are connected. So we don't propose something unhooked.
3. `CLAUDE.md` in the repo root — voice rules, AskUserQuestion default, verify-before-asserting, MCP credit guardrails.

Read the matching operating reference docs on demand before touching those domains.

## The workflow

One pass, in order. Don't skip steps. If a hard gate fires, stop and resolve before continuing.

### 1. Route

Read the opening message. Three cases:

- **Task in mind** ("build me a /follow-up-invoices skill", "automate my weekly recap"): skip the AskUserQuestion, route directly to `/grill-me`.
- **No task in mind** ("what should I automate next", "I keep doing repetitive stuff but don't know what to fix first"): route to `/brainstorming` to find the direction, then hand the approved design to `/grill-me` to lock the spec.
- **Ambiguous** (bare "automate this" with no context): `AskUserQuestion`:
  - "I have a task in mind (Recommended if you already know what's repetitive)"
  - "I want to think through what to automate next"

Per CLAUDE.md § Voice: don't ask just to ask. When the opening clearly names a task, skip the question and route directly.

### 2. /grill-me locks the spec

Run `/grill-me` on the skill the user wants. The output is a tight spec: what triggers it, what data it reads, what it produces, what edge cases matter. Don't proceed without this. Every skill that ships is grilled first.

### 3. Overlap check (BEFORE baseline capture)

Re-read `SKILLS.md`. Does the proposed skill overlap with something already there? Match on **trigger phrases** (any overlap counts) OR **domain + source + output triple** (e.g., both write a draft email to a customer based on a meeting transcript = overlap).

If overlap exists, `AskUserQuestion` with three options:

1. "Extend `/<existing-skill>` instead (Recommended if the overlap is real)" — branches to § Modify-existing flow below.
2. "Build the new skill anyway" — proceeds with the full build; both SKILL.md files get a one-line cross-reference note ("Related: `/<other-skill>` — they overlap on X; use this one when Y").
3. "Cancel, let me think" — exit cleanly. No files written. No commit.

If no overlap, keep going.

### 4. Manual-time baseline (time-savers only)

First, decide whether this skill is a **recurring real time-saver** or a **deep-dive / setup / one-shot tool**. Deep-dives (like `/grill-me`, `/brainstorming`) and setup/one-shot tools are **exempt** from TIME-SAVED tracking. If the skill is exempt, **skip this step and the self-ping append in § 8**: no baseline, no row, no footer.

If it IS a recurring time-saver, ask the user how long this task takes them by hand. `AskUserQuestion`:

- `<10 min`
- `10-20 min`
- `20-40 min`
- `40-60 min`

"Other" is auto-included for anything outside that band. When the user picks Other, ask for the exact number of minutes in plain chat ("Roughly how many minutes, give me a single number").

Store the midpoint as an integer `manual_time_minutes`:

- `<10 min` → 5
- `10-20 min` → 15
- `20-40 min` → 30
- `40-60 min` → 50
- Other → parse user's number directly

This integer is what gets baked into the generated skill's self-ping line (§ AIOS appends) and seeded into the new TIME-SAVED.md row.

### 5. Connector gap — HARD GATE

Identify every tool the new skill will need (Gmail, CRM, meeting transcripts, billing, anything else). Check `CONNECTIONS.md` § 1 (Connected).

If any required tool is **not** in § 1: **stop. Do not draft the SKILL.md.**

Walk the user through connecting it: go to their Claude settings → Connectors → search the tool → Connect → sign in. Then verify the new MCP server is reachable by running `claude mcp list` (don't claim it's connected without checking). Update `CONNECTIONS.md` § 1 manually; `/end-session` will re-confirm on session close.

Resume only after every required tool is verified connected. No "ship with TODO." No "ship with hard gate inside the skill." Every skill that ships works on first invocation.

### 5.5. Cost surface — HARD GATE (metered tools only)

If the skill will call a metered or paid tool (any per-call API, vision API, scraping service, etc.), do three things before drafting:

1. **Name the spend per run out loud** ("each run burns ~61 credits", "~$0.12/image"). The user signs off on the cost shape, not just the behavior.
2. **Bake a guardrail into the generated skill**: a cap, a confirm-before-spend gate, OR an explicit banned-call list. The skill must make the expensive path hard to trigger by accident.
3. **Cross-check the MCP credit guardrails in CLAUDE.md** so the generated skill never proposes a banned or out-of-scope call.

This gate exists because the most expensive mistakes are metered-API mistakes: credits burning silently mid-batch, banned research calls racking up charges. A skill that quietly loops an expensive call is worse than no skill. Skip this gate only if the skill touches no paid API.

### 6. Voice profile — HARD GATE (draft-related skills only)

**What "draft-related" means.** The skill PRODUCES text the user sends or posts AS THEMSELVES. Includes: emails, social posts, SMS, Slack messages, blog posts, video scripts, customer-facing copy. **Excludes:** internal summaries, action-item lists, meeting minutes, time audits, status snapshots, anything the user reads but doesn't send as-them.

If the user has a voice profile in their repo (commonly at a `voice-profile/` folder), **read it before drafting** and bake the voice-read line (§ 8) into the generated skill so it reads it too.

Only if that profile is somehow missing: **stop, don't draft, and tell the user the voice profile is gone.** It's the source of truth for everything they send as themselves, and a draft-related skill can't ship without it.

### 7. Draft the SKILL.md

Use the Pocock `write-a-skill` chassis: gather requirements → draft → review-with-user. Layer in these rules:

- **Description = WHEN to trigger, not the workflow.** Open with one short clause naming what it does (for human scanning of SKILLS.md). Then the heavy lifting: pure "Use when…" triggers, seeded with the actual words the user used when they asked (pull synonyms from the `/grill-me` transcript), deliberately pushy, ending with "even if they don't say `<skill-name>`." **Never restate the skill's step-by-step or step count in the description.** Testing across reference sources shows the model will follow the description's workflow summary instead of reading the body. Pushy beats precise: undertriggering is worse than overtriggering.
- **Explain the why; treat caps as a yellow flag.** Prefer reasoning over bare rules. If you catch yourself writing ALWAYS / NEVER / MUST in caps, that's a yellow flag — reframe it as the reason behind the rule so the model can judge edge cases. Reserve hard imperatives for true bright lines: security, PII, fabrication, and metered-API spend.
- **Progressive disclosure.** Keep the SKILL.md lean. Split to `references/*.md` when SKILL.md passes ~100 lines, OR a section is advanced and rarely-needed, OR it's a long lookup table. Keep references exactly one level deep from SKILL.md (the model only partially reads files referenced from referenced files).
- **When to bundle a script.** Add a `scripts/` file when the op is deterministic, the same code would be regenerated every run, or errors need explicit handling. Deterministic, fewer tokens, fewer re-bugs than generated code.
- **Durability (don't let it rot).** Don't hardcode dates, current client lists, or "we currently use X" into a generated skill. Point at the live source (`CONNECTIONS.md`, `SKILLS.md`) so the skill stays true as the repo changes.

Length cap for generated skills: soft **100 lines**. Past 150 = split into two skills or push depth into `references/`.

### 8. AIOS appends

For a **time-saver** skill, end the generated SKILL.md with the **self-ping block**; for an **exempt** skill (§ 4), skip it. For a **draft-related** skill, open the body with the **voice-read line**.

See [`${CLAUDE_PLUGIN_ROOT}/skills/skill-builder/references/aios-appends.md`](references/aios-appends.md) for the exact paste text. Substitute `<skill-name>` and `<manual_time_minutes>` from the spec and the baseline.

Do **not** restate voice rules, AskUserQuestion default, or verify-before-asserting in the generated skill. Those live in CLAUDE.md and auto-load as project instructions. Restating bloats the skill past the 100-line cap.

### 9. Review with the user

Per Pocock: show the draft, ask "does this cover it? anything missing?". This is a content review, not a test. The user is reading the SKILL.md text, not running the skill.

Apply any structural edits the user calls out. Tight clarifications, not rewrites. If the user wants a fundamental redesign, that's a `/grill-me` redo signal: back up to Step 2.

### 9.5. Triggering spot-check (silent)

Before the real-data test, sanity-check that the description will actually fire. Silently generate 3 ways the user would naturally phrase this request (these SHOULD fire) and 2 near-misses that share keywords but should route elsewhere (these should NOT fire). Reason against the written description: does it catch all 3 and reject both near-misses?

If a real phrasing wouldn't fire, or a near-miss would wrongly fire, fix the description before shipping. Keep this silent. Only surface it if there's a problem to fix. The dominant real-world failure for a solo operator isn't a bad output — it's a skill that never fires or the wrong skill firing, because users describe tasks in their own words.

### 10. Test with one real record

Run the skill end-to-end, **once**, with one real input:

- **Reads from a connected system?** Pull one real record. Default picks: latest unread email (Gmail), most-recent meeting transcript (Otter/Zoom), most recently touched CRM card, today's first calendar event. User can override any default.
- **Takes user-pasted input?** User pastes one real example.
- **Creates output?** Show the output in chat (text), or print the file path with a one-line preview (docs / sheets / decks).

For a genuine **discipline / guardrail skill** (a gate, a refusal, a spend guard), add one pressure check: would the skill hold if the easy shortcut were available? Watch a bare attempt skip the rule, confirm the skill stops it. Most skills are not this type — skip it for them (see Out of scope).

User signs off in chat:

- "good" / "ship it" / "perfect" → proceed to commit (§ 12).
- "wrong: X is broken" / "tweak X" → enter the iterate loop (§ 11).

One pass, not a benchmark loop.

### 11. Iterate cap — 2 fix cycles, then ship-or-scrap

- **Cycle 1.** User names ONE specific issue. Fix that one thing. **Fix the class of problem, not the one record:** if a fix only makes sense for this exact test record, that's an overfit signal — generalize it or re-grill. The skill has to work on the next hundred inputs, not just this one. Re-run the test against the SAME real record from § 10. Show the new output.
- **Cycle 2.** Same loop. One more fix. One more re-run.
- **If the test run kept regenerating the same non-trivial code** (a scrape, a poll, a transform the model would obviously rewrite every invocation), bundle it as `scripts/<name>.{mjs,py}` now rather than leaving it as generated code.
- **After cycle 2**, `AskUserQuestion`:
  - "Ship as-is, I'll edit it manually if I need to (Recommended if it's 80% there)"
  - "Scrap and re-grill, the design has a fundamental issue, take me back to `/grill-me`"
  - "Hand it to me, write the SKILL.md to disk but skip the commit so I can edit before committing"

If iterate keeps needing more than 2 cycles, the skill's design has a flaw that more fix-passes can't paper over. Re-grill, don't keep patching.

### 12. Atomic commit

Stage and commit ONLY the files this build touched:

- `.claude/skills/<name>/SKILL.md` (new)
- `.claude/skills/<name>/references/*.md` (new, optional, only if progressive disclosure required it)
- `.claude/skills/<name>/scripts/*` (new, optional, only if § 11 bundled a script)
- `SKILLS.md` (modified, add row for the new skill: status `[live]`, purpose line, trigger phrases)
- `TIME-SAVED.md` (modified, ONLY for time-saver skills: add row with skill name, `manual_time_minutes`, Total uses = 1, Total saved = `manual_time_minutes`, Last used = today)
- `decisions/log.md` (modified, new entry at top, optional, see § 13)

Commit message format:

```
skill: build /<name> — manual time <X> min

<2-3 line summary of what the skill does and what real-data record it was tested against>
```

No `--no-verify`. No amends. No bulk `git add .`. Stage by path.

### 12.5. Pre-commit checklist

One 10-second eyeball pass before staging:

- [ ] Description triggers correctly (passed the § 9.5 near-miss check) and doesn't restate the workflow
- [ ] Under ~100 lines, or split to `references/` (one level deep)
- [ ] No restated CLAUDE.md rules (voice, AskUserQuestion, verify-before-asserting)
- [ ] No time-sensitive info that will rot (points at live sources instead)
- [ ] Connector + voice + cost-surface gates cleared
- [ ] If it calls a metered tool, a spend guardrail is baked in
- [ ] SKILLS.md row written; TIME-SAVED row written (time-savers only)

### 13. decisions/log.md entry (optional, only on non-obvious calls)

Append a dated entry to the top of `decisions/log.md` ONLY when a non-obvious architectural choice was made during the build. Examples that DO warrant an entry:

- Scope tradeoff: "Built draft-only mode; auto-send deferred because user wanted an approval gate."
- Tool choice: "Used scraping over a direct API because the target is a portal without a public API."
- Workaround: "Caches results to avoid API rate-limit on every invocation."

Examples that do NOT warrant an entry:

- "Built /follow-up-invoices. Uses Gmail. Manual time 30 min." (run-of-the-mill build)
- Anything the SKILL.md itself already explains in its body.

Reserve the log for calls future-Claude or the user would want to know about when revisiting the skill.

## Modify-existing flow (compressed)

When Step 3's overlap check routes to "Extend existing" instead of new build:

1. Read the existing SKILL.md.
2. Run `/grill-me` on the specific change the user wants, not the whole skill, just the delta.
3. Apply edits to SKILL.md. Re-bake AIOS appends if missing.
4. Skip the connector gap check (Step 5) UNLESS the modification adds a new tool dependency.
5. Skip the cost-surface gate (Step 5.5) UNLESS the modification adds a metered-tool call.
6. Skip the voice-profile gate (Step 6) UNLESS the modification turns a non-draft skill into a draft-related one.
7. If the change touches the description or triggers, re-run the § 9.5 triggering spot-check.
8. Run Step 10 test with one real record. Apply Step 11 iterate cap.
9. Commit with message: `skill: extend /<name> — <one-line summary of change>`. No new `SKILLS.md` row (the row exists; only update if trigger phrases changed). No new `TIME-SAVED.md` row.
10. `decisions/log.md` entry per Step 13, same threshold.

## Out of scope (parked, not v1.0)

- **Heavyweight benchmarking.** For a quantitative with-skill-vs-baseline benchmark on a high-value skill (graded assertions, mean ± stddev over runs, an HTML viewer, an automated description optimizer), use a dedicated benchmarking workflow. skill-builder deliberately does NOT re-implement that machinery.
- **Full TDD / pressure-testing for every skill.** The § 10 single pressure check covers the rare guardrail skill; the full loop is parked for most builds.
- **Periodic revalidation / rot detection.** A skill can silently break when a connector or vendor UI changes underneath it. Catching that is a separate health-check concern, not part of authoring.
- **Cross-session resume.** If /skill-builder is interrupted mid-build, expect re-invocation from scratch.
- **Self-build.** Bootstrap exception: this SKILL.md was authored by hand and should not be rebuilt by itself.
- **Semantic-embedding overlap detection.** Step 3 is keyword + structural. Embedding-based is a later idea.
- **Bulk build.** One skill per invocation.

> Note: `/skill-builder` does NOT self-ping. It's a build/meta tool, exempt from TIME-SAVED tracking. The value it creates is tracked downstream, in the self-pings of the time-saver skills it builds.
