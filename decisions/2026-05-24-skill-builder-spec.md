# /skill-builder spec
2026-05-24

Locked via `/grill-me` session on 2026-05-24. This is the design contract for the `/skill-builder` skill. The S2 plan item (build `/skill-builder`) implements against this spec. Do not re-litigate without re-grilling.

---

## 1. Purpose (one line)

`/skill-builder` is the compositional engine that grows new skills inside this Snowball. It routes the user to `/grill-me` or `/brainstorm`, captures a manual-time baseline, enforces connector + voice prerequisites, generates a SKILL.md using a Pocock-style chassis, tests it once with real data, and ships an atomic commit.

---

## 2. Locked decisions

13 calls locked during the 2026-05-24 grill. Each is the contract S2 must honor.

### 2.1 Chassis
Pocock's `write-a-skill` workflow (gather requirements → draft → review-with-user) is the spine. Three patterns from Anthropic's `skill-creator` are layered on top:

- **Description-for-triggering format.** First sentence: what the skill does. Second sentence: "Use when [specific trigger phrases / contexts]." Pushy phrasing OK to combat undertriggering.
- **Progressive disclosure.** SKILL.md stays lean. When content grows beyond the cap (see § 2.2), push detail into `<skill>/references/*.md` files referenced from SKILL.md.
- **"Explain the why" voice.** Prefer reasoning over bare `ALWAYS` / `NEVER` capitalized rules. Tell Claude *why* a constraint exists so it can judge edge cases.

Eval infrastructure from Anthropic skill-creator (test prompts → benchmark.json → viewer.py → iterate) is **not** used. The single test-with-real-data step in § 2.9 replaces it.

### 2.2 Length caps
- **Generated skills** (what `/skill-builder` produces for the user): soft cap **100 lines** in SKILL.md. If pushing 150+, that's a signal to split into two skills.
- **`/skill-builder` itself**: soft cap **250 lines** in SKILL.md, with deeper content in `.claude/skills/skill-builder/references/*.md` per progressive disclosure.

### 2.3 Pre-read (always, before responding to user's first message)
1. `SKILLS.md` — what already exists, so we don't build a duplicate
2. `CONNECTIONS.md` — what tools are connected, so we don't propose something unhooked
3. `CLAUDE.md` — voice rules, AskUserQuestion default, verify-before-asserting, behavioral spine

The matching `/references/<topic>.md` gets read on demand when relevant (e.g., `git-and-backup.md` before commit, `api-keys.md` if a new API key surfaces during the build).

### 2.4 Routing logic
- **Task in mind** (opening like "build me a /follow-up-invoices skill" or "automate my weekly recap") → route directly to `/grill-me` to lock the skill spec.
- **No task in mind** (opening like "what should I automate next" or "I keep doing repetitive stuff but I don't know what to fix first") → route to `/brainstorm`; `/brainstorm` will hand back to `/grill-me` once a direction lands.
- **Ambiguous opening** (e.g., bare "automate this" with no context) → `AskUserQuestion` with two options: "I have a task in mind (Recommended if you already know what's repetitive)" / "I want to think through what to automate next."

Per CLAUDE.md voice rule: don't ask just to ask. When the opening clearly names a task, skip the AskUserQuestion and route directly.

### 2.5 Manual-time baseline capture
After the routing step, before writing any draft, `/skill-builder` asks the user how long this task takes them by hand.

`AskUserQuestion` with 6 ranges:
- `<5 min`
- `5-15 min`
- `15-30 min`
- `30-60 min`
- `1-2 hr`
- `2-4 hr`
- `>4 hr`

Recommended pick is **NOT** a default — the user picks deliberately. Store the midpoint as a single integer `manual_time_minutes` for TIME-SAVED math (e.g., "15-30 min" → 22; ">4 hr" → 300 by convention). The integer is what gets baked into the generated skill's self-ping line (§ 2.8) and seeded into the TIME-SAVED row (§ 2.12).

### 2.6 Connector gap — HARD GATE
After the spec is locked (via `/grill-me`) but BEFORE writing the SKILL.md draft, `/skill-builder` checks what tools the new skill will need. If any required tool is not present in `CONNECTIONS.md` § 1 (Connected):

**Pause `/skill-builder`. Do not proceed to draft.**

Walk the user through claude.ai → Settings → Connectors → search the tool → Connect → sign in. Verify the connection landed by running `claude mcp list` and confirming the new MCP server is present. Update `CONNECTIONS.md` § 1 by hand for now (`/end-session` will re-confirm on session close).

Then resume `/skill-builder` at the draft step.

No "ship with hard gate inside SKILL.md" option. No "ship with TODO." Every skill that ships works on first invocation.

### 2.7 Voice profile (draft-related skills) — HARD GATE

**Definition of "draft-related":** the skill PRODUCES text the user sends or posts AS THEMSELVES. Includes: emails, social posts, SMS, Slack messages, blog posts, video scripts, customer-facing copy. **Excludes:** internal summaries, action-item lists, meeting minutes, time audits, status snapshots, anything that's read by the user but not sent as-them.

If the skill is draft-related AND `/onboarding/voice-profile.md` does not exist:

**Pause `/skill-builder`. Do not proceed to draft.**

Tell the user: "This skill writes things you'll send as yourself. You need a voice profile first. The `/capture-voice` skill builds one — it's a quick interview plus a few writing samples. To add it, paste: `pull /capture-voice from BeltDoor/aios-template main and install it`. I'll wait."

Once `/capture-voice` is installed (Decision 20 trigger model) and run, `/onboarding/voice-profile.md` exists. User re-invokes `/skill-builder` from scratch (cross-session resume isn't supported in v1.0). `/skill-builder` re-checks, voice-profile.md is now present, proceeds.

No "ship without voice profile" sub-option. No reminder-only mode. Every draft-related skill ships with real voice from day one.

### 2.8 AIOS-specific appends (what gets baked into every generated SKILL.md)

Minimal set. Pocock's template provides the bones; `/skill-builder` adds:

- **Self-ping block at the end** (always, every generated skill):

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

- **Voice-read line at the top of the body** (only for draft-related skills):

  ```markdown
  > Before drafting, read [`/onboarding/voice-profile.md`](../../../onboarding/voice-profile.md). The output must match the voice captured there.
  ```

**Not appended.** CEO voice rules, AskUserQuestion default, verify-before-asserting — these all live in `CLAUDE.md` and are auto-loaded as project instructions. Every skill inherits them WITHOUT needing to restate them. Restating would bloat skills past the 100-line cap and violate DRY.

### 2.9 Test-with-real-data (single pass before commit)
After draft is written and AIOS appends are baked in, run the skill end-to-end **once** with one real input:

- **If the skill reads from a connected system** (Gmail, HubSpot, Otter, Calendar, Drive, Notion): pull one real record. Default picks: latest unread email, most-recent meeting transcript, last contact created, today's first calendar event. User can override.
- **If the skill takes user-pasted input** (e.g., "draft a reply to this email"): user pastes one real example.
- **If the skill creates output**: show the output in chat (for text) or print the file path with a one-line preview (for docs / sheets / decks).

User signs off in chat:
- `"good"` / `"ship it"` / `"perfect"` → proceed to commit
- `"wrong: the X is broken"` / `"tweak X"` → enter iterate loop (§ 2.10)

This is a single pass — not Anthropic's iterate-3-times benchmark loop.

### 2.10 Iterate cap (2 fix cycles, then ship-or-scrap)
- **Cycle 1.** User names ONE specific issue. `/skill-builder` fixes that one thing in SKILL.md (or whatever artifact is wrong), re-runs the test with the SAME real record from § 2.9, shows the new output, user signs off or names a new issue.
- **Cycle 2.** Same loop. One more fix, one more re-run.
- **After cycle 2**, `/skill-builder` MUST present `AskUserQuestion` with three options:
  - "Ship as-is — I'll edit it manually if I need to (Recommended if it's 80% there)"
  - "Scrap and re-grill — the design has a fundamental issue, take me back to `/grill-me`"
  - "Hand it to me — write the SKILL.md to disk but skip the commit so I can edit before committing"

If iterate keeps needing more than 2 cycles, the skill's design has a flaw that more fix-passes can't paper over. The right move is `/grill-me` redo, not more iteration.

### 2.11 Overlap with existing skill
`/skill-builder` reads SKILLS.md at start (§ 2.3). If the proposed skill semantically overlaps with an existing entry (same trigger phrases / same domain / same data source + same output), surface it before locking the spec:

`AskUserQuestion` with three options:
1. **"Extend `/<existing-skill>` instead (Recommended if the overlap is real)."** `/skill-builder` opens the existing SKILL.md, proposes specific edits, treats as modification not new skill. Skips § 2.5 (baseline already captured). Skips § 2.12 (no new SKILLS.md row, no new TIME-SAVED row — just an edit to the existing files if anything changes).
2. **"Build the new skill anyway."** Proceeds with the full build flow. Both SKILL.md files get a one-line cross-reference note ("Related: `/<other-skill>` — they overlap on X; use this one when Y").
3. **"Cancel — let me think."** Exits cleanly. No files written. No commit.

Detection rule for "semantic overlap": match on declared trigger phrases (any overlap) OR domain+source+output triple (e.g., both write a draft email to a customer based on Otter transcript = overlap).

### 2.12 Atomic commit shape
One commit. Stage and commit only the files this build touched:

- `.claude/skills/<name>/SKILL.md` (new)
- `.claude/skills/<name>/references/*.md` (new, optional — only if progressive disclosure required it)
- `SKILLS.md` (modified — add row for new skill with status `[live]`, purpose line, trigger phrases)
- `TIME-SAVED.md` (modified — add row: skill name, `manual_time_minutes`, total uses = 1, total saved = `manual_time_minutes`, last used = today)
- `/decisions/2026-XX-XX-skill-<name>.md` (new, optional — see § 2.13)

Commit message format:

```
aios(skill): build /<name> — manual time <X> min

<2-3 line summary of what the skill does and what real-data record it was tested against>
```

No `--no-verify`. No amends. Standard git workflow.

### 2.13 /decisions/ log entry trigger
Write `/decisions/2026-XX-XX-skill-<name>.md` ONLY when a non-obvious architectural choice was made during the build. Examples that DO warrant an entry:

- Scope tradeoff: "Built draft-only mode; auto-send deferred because user wanted approval gate."
- Tool choice: "Used Apify scrape over Firecrawl because target is LinkedIn."
- Workaround: "Caches results to avoid Otter API rate-limit on every invocation."

Examples that do NOT warrant an entry:
- "Built /follow-up-invoices. Uses Gmail. Manual time 30 min." (run-of-the-mill build)
- Anything that the SKILL.md itself already explains in its body

The log is reserved for calls future-Claude or future-Jacob would want to know about when revisiting the skill. Run-of-the-mill builds don't earn entries — keeps /decisions/ signal-rich.

---

## 3. The /skill-builder workflow (end-to-end, in order)

1. **Pre-read.** Read SKILLS.md, CONNECTIONS.md, CLAUDE.md (per § 2.3).
2. **Route.** Apply § 2.4. If task in mind → `/grill-me`. If no task → `/brainstorm` (which hands back to `/grill-me`). If ambiguous → AskUserQuestion → route accordingly.
3. **Overlap check.** After `/grill-me` returns a draft spec, run § 2.11. If user chose "Extend existing", branch to modify-existing flow. If "Cancel", stop. If "Build new", continue.
4. **Baseline capture.** Run § 2.5. Lock `manual_time_minutes`.
5. **Connector gap check.** Identify tools the spec needs. Run § 2.6 hard gate. Block until all required tools are connected and verified.
6. **Voice-profile check.** If draft-related per § 2.7 definition, run § 2.7 hard gate. Block until voice-profile.md exists.
7. **Draft.** Use Pocock chassis (gather → draft) plus the 3 Anthropic patterns from § 2.1. Stay under the length cap per § 2.2.
8. **AIOS appends.** Bake in § 2.8 appends. Self-ping always; voice-read line for draft-related skills.
9. **Review-with-user.** Per Pocock: show the draft, ask "does this cover it? anything missing?". This is a content review, not a test run — user is reviewing the SKILL.md text.
10. **Test.** Run § 2.9. One real record, sign off in chat.
11. **Iterate (if needed).** Apply § 2.10 cap. Max 2 fix cycles, then ship-or-scrap.
12. **Commit.** Apply § 2.12. Atomic, single commit, conventional message.
13. **Optional /decisions/ entry.** Apply § 2.13. Only on non-obvious calls.
14. **Self-ping `/skill-builder` itself.** Increment `/skill-builder`'s row in TIME-SAVED.md. Manual time per use = 90 min (rough cost of designing + writing a skill by hand without `/skill-builder`).

---

## 4. Modify-existing flow (compressed)

When § 2.11 routes to "Extend existing" instead of new build, the flow is shorter:

1. Read the existing SKILL.md.
2. `/grill-me` on the specific change the user wants (not the whole skill — just the delta).
3. Apply edits to SKILL.md. Re-bake AIOS appends if missing.
4. Skip the connector gap check unless the modification introduces a new tool dependency.
5. Skip the voice-profile gate unless the modification makes a non-draft skill into a draft-related one.
6. Run § 2.9 test with one real record.
7. Iterate per § 2.10.
8. Commit: `aios(skill): extend /<name> — <one-line summary of change>`. No new SKILLS.md row (the row already exists; only update if trigger phrases changed). No new TIME-SAVED row.
9. /decisions/ entry per § 2.13 — same threshold.

---

## 5. Out of scope (deliberately parked)

- **Cross-session resume.** If `/skill-builder` is interrupted mid-build (context compaction, user steps away for a day), v1.0 expects the user to re-invoke from scratch. State-saving across sessions is a v1.1 concern.
- **`/skill-builder` building itself.** Bootstrap exception — S2 writes the `/skill-builder` SKILL.md by hand from this spec. `/skill-builder` cannot meta-build itself.
- **Auto-detection of overlap by semantic embedding.** Detection rule in § 2.11 is keyword + structural (trigger overlap, domain+source+output match). A future skill could improve this with embeddings against existing SKILL.md content. v1.0 keeps it simple.
- **Bulk build mode.** v1.0 builds one skill per invocation. "Build me 5 skills at once" not supported.

---

## 6. S2 acceptance criteria (so the build session knows when it's done)

S2 produces `.claude/skills/skill-builder/SKILL.md` plus optional `.claude/skills/skill-builder/references/*.md` files. The build is complete when:

1. **Pre-read** of SKILLS.md + CONNECTIONS.md + CLAUDE.md is documented in the SKILL.md as the first step.
2. **Routing logic** (§ 2.4) is implemented including the "infer-then-ask" pattern.
3. **Baseline capture** (§ 2.5) uses AskUserQuestion with the 6 exact ranges and stores `manual_time_minutes` as an integer (midpoint).
4. **Connector gap hard gate** (§ 2.6) is implemented including the `claude mcp list` verify step.
5. **Voice profile hard gate** (§ 2.7) is implemented with the exact "draft-related" definition. The opt-in trigger phrase is included verbatim.
6. **AIOS appends** (§ 2.8) — the self-ping block template is in SKILL.md (or a referenced file), AND the voice-read line template is included for the draft-related branch.
7. **Test step** (§ 2.9) accepts the real-record default-pick rules per system.
8. **Iterate cap** (§ 2.10) enforces 2 fix cycles then ship-or-scrap AskUserQuestion.
9. **Overlap detection** (§ 2.11) runs BEFORE baseline capture (§ 2.5).
10. **Atomic commit** (§ 2.12) stages only the files this build touched.
11. **/decisions/ trigger** (§ 2.13) is honored — no entry on routine builds.
12. **Modify-existing flow** (§ 4) is implemented as a documented branch.
13. **End-to-end test of S2.** Pick one real recurring task from the user's life (Jacob's pilot test should use something like "draft post-meeting customer follow-up email" since that's the canonical first skill). Invoke `/skill-builder`, complete the full flow including a real-record test, end up with a working SKILL.md + SKILLS.md row + TIME-SAVED row + a clean commit. The new skill must have the self-ping line baked in.

When all 13 criteria pass, S2's status flips to `done` in REBUILD-PLAN.md.

---

## 7. Cross-references

- Decision 13 (REBUILD-PROMPT.md) — `/skill-builder` compositional
- Decision 20 — Template update propagation via ad-hoc trigger (validated by § 2.7's `/capture-voice` opt-in)
- Decision 21 — Voice profile lazy + opt-in via `/capture-voice` (encoded in § 2.7)
- Decision 22 — AskUserQuestion-with-Recommended default (encoded throughout §§ 2.4-2.11)
- Decision 23 — Verify-before-asserting (encoded in § 2.6 via `claude mcp list` verify, § 2.9 via real-record signoff)
- Decision 25 — Folder organization (this spec lives at `snowball/decisions/`; paths in §§ 2.6-2.13 are relative to snowball root)
- Pocock `write-a-skill` SKILL.md — the chassis spine
- Anthropic `skill-creator` SKILL.md — three patterns layered on (description format, progressive disclosure, "explain the why")
