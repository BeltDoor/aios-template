---
date: 2026-05-24
item: P1 (REBUILD-PLAN.md)
decision: Pocock skills import verdict — what to bring into Snowball, what to skip
source: github.com/mattpocock/skills (inventoried 2026-05-24)
---

# Pocock Skills Import — Verdict

## TL;DR

**18 skills inventoried. 17 skip. 1 candidate (`/handoff`) deferred to v1.1 backlog — not imported in v1.0.**

This matches the brief's expectation (per P1 Notes: "Pocock is coder-focused so most will be 'skip' — value is in finding the 2-3 that translate"). The actual yield is 1 candidate, and that one isn't strong enough to ship Day-1 — it's tracked as a v1.1 candidate triggered by mid-session-handoff pain that hasn't surfaced yet.

**P2 should be marked as a no-op** with one micro-deviation: if `/handoff` graduates from the v1.1 backlog later, it'd run through `/skill-builder` (S2), not a separate Pocock-import flow. Don't preserve P2 as an "import the one skill" item — it's cleaner to let `/skill-builder` build it from scratch when the trigger fires.

---

## Repo framing (Pocock's stated audience)

Pocock's repo is titled "**Skills For Real Engineers**" — explicitly coder-focused, used "to do real engineering, not vibe coding." The skills assume:

- The user is a software developer writing code in a repo
- There's an issue tracker (GitHub Issues, Linear, or local markdown convention)
- Tests, type checks, PRDs, ADRs, and a domain glossary (`CONTEXT.md`) exist
- The repo has commit history, branches, and a CI pipeline

Snowball's audience is the opposite: a **non-technical solo expert** (consultant, coach, advisor) running business workflows in a folder on their laptop. They don't write code, don't have issue trackers, don't run tests. That mismatch drives ~90% of the SKIP verdicts below.

---

## Verdicts

Legend: **SKIP** = not applicable / **ADAPT-THEN-APPLY** = useful with translation / **APPLY** = drop in as-is.

### Engineering bucket (10 skills) — all SKIP

| Skill | Verdict | Reason |
|---|---|---|
| `diagnose` | SKIP | Hard-bug diagnosis loop (reproduce → minimise → hypothesise → instrument → fix → regression-test). Pure coder discipline. Snowball clients aren't debugging code. |
| `grill-with-docs` | SKIP | Grill session that updates `CONTEXT.md` + ADRs inline. The grill mechanic is already covered by `/grill-me` (M1). The ADR-writing piece is already covered by `/skill-builder` (S2), whose spec says it "writes `decisions/<date>-skill-<name>.md` if a non-obvious choice was made." Importing this would duplicate work. |
| `improve-codebase-architecture` | SKIP | Surfaces "deepening opportunities" in code, turns shallow modules into deep ones. Pure architecture refactoring. Not applicable to a business-workflow folder. |
| `prototype` | SKIP | Build throwaway prototypes (terminal app for state/logic OR multi-variant UI). Coder skill. Snowball clients don't prototype code. |
| `setup-matt-pocock-skills` | SKIP | Scaffolds AGENTS.md/CLAUDE.md per-repo config for the other engineering skills. Since we're not importing the engineering bucket, the scaffold is irrelevant. |
| `tdd` | SKIP | Red-green-refactor test-driven development. Pure coder skill. |
| `to-issues` | SKIP | Break a plan into independently-grabbable issues on a GitHub-style issue tracker using vertical slices. Snowball clients don't have issue trackers and don't write engineering tickets. |
| `to-prd` | SKIP | Turn conversation into a Product Requirements Document, publish to issue tracker. Solo experts don't write PRDs. |
| `triage` | SKIP | Move issues through a state machine of triage roles (needs-triage, ready-for-afk, etc.). Issue-tracker-bound. SKIP. |
| `zoom-out` | SKIP | Tell agent to give a higher-level perspective on an unfamiliar section of code. Pure code-navigation. |

### Productivity bucket (4 skills) — 3 SKIP, 1 ADAPT-THEN-APPLY (deferred to v1.1)

| Skill | Verdict | Reason |
|---|---|---|
| `caveman` | SKIP | Ultra-compressed "smart caveman" voice (~75% token cut, drops articles/filler/pleasantries). **Directly contradicts Decision 16** (CEO voice: "no jargon without definition, no assumed knowledge of code/terminal/files, when teaching anything technical define in everyday analogies first"). Caveman would compress past the point where the CEO can follow the explanation. Anti-fit. |
| `grill-me` | SKIP | Identical mechanic to M1 (which was already adapted from Jacob's user-scope `grill-me`, itself derived from Pocock's). Already covered. |
| `handoff` | **ADAPT-THEN-APPLY (deferred to v1.1)** | Compacts the current conversation into a handoff doc for another agent to pick up mid-session. Could fit Snowball as a mid-session "step away and resume later" tool. **But:** `/end-session` (S8) already covers session-close handoff via `.claude/last-session.md`; the mid-session use case (e.g., context window filling, model switch) hasn't surfaced as a Snowball pain yet. Deferred to v1.1 — promote when a client says "I had to stop mid-something and lost context." Translation needs at that point: CEO voice / route output into `.claude/last-session.md` so `/begin-session` picks it up / self-ping line / Snowball-specific framing ("I'll write down where we are so next time I can pick up cleanly"). |
| `write-a-skill` | SKIP | Already covered by `/skill-builder` (S2), which is the AIOS purpose-built version with composition (`/grill-me` + `/brainstorm` routing), CEO-voice appends, self-ping bake-in, voice-profile check (Decision 21), and registry updates. S2 is more capable for the Snowball audience. |

### Misc bucket (4 skills) — all SKIP

| Skill | Verdict | Reason |
|---|---|---|
| `git-guardrails-claude-code` | SKIP | Sets up PreToolUse hook to block `git push --force`, `git reset --hard`, `git clean -f`, etc. Useful safety net — **but contradicts Decision 17's minimalism** (settings.json has `bypassPermissions` + the single perplexity-guard hook, "no allow list, no deny list"). Snowball clients use git only through skills (mostly `/end-session`'s commit + push), not direct command-line — so the destructive surface area is already controlled by skill code. If a real client incident surfaces (someone wipes their AIOS via raw git), revisit. |
| `migrate-to-shoehorn` | SKIP | TypeScript test migration helper. Pure coder, project-specific to Pocock's stack. |
| `scaffold-exercises` | SKIP | Scaffolds AI Hero course exercise directory structures. Completely irrelevant to Snowball. |
| `setup-pre-commit` | SKIP | Set up Husky + lint-staged + Prettier + typecheck + tests as pre-commit hooks. Pure coder workflow. Snowball has no test suite or linter to gate. |

### `.out-of-scope/` directory — informational, not skills

Three design notes Pocock parks for context, not skills:

- `mainstream-issue-trackers-only.md` — why the engineering bucket only supports GitHub/Linear/local-markdown (not Jira/Asana).
- `question-limits.md` — design rationale for capping grill questions.
- `setup-skill-verify-mode.md` — notes on a setup verification mode.

Informational only. Not import candidates.

---

## Recommendation for P2

**Mark P2 as a no-op.** Plan brief already anticipates this: "If P1 finds zero AIOS-applicable skills, this item is a no-op — note as 'P2 skipped, no Pocock skills applied' in the decisions log."

Strictly speaking, P1 found one candidate (`/handoff`) — but it's a v1.1 backlog candidate, not a v1.0 import. So P2 ships as no-op with a single-line decisions entry: "P2 skipped per P1 verdict — only `/handoff` qualified, deferred to v1.1."

If `/handoff` is later promoted from v1.1, the cleanest path is to build it via `/skill-builder` (S2) from scratch in the Snowball voice, not re-import Pocock's coder-flavored version. So P2 has no future role — it can be permanently closed once D2 ships.

---

## v1.1 backlog addition

Add to REBUILD-PLAN.md v1.1 backlog (as **V8** to preserve stable IDs):

> ### V8 — `/handoff` skill (mid-session conversation compaction)
> - **Why deferred:** P1 verdict — Pocock's `/handoff` was the only useful pattern from the inventory, but the mid-session-handoff use case hasn't surfaced as a Snowball client pain yet. `/end-session` (S8) covers the session-close case. Promote when a client surfaces "I had to stop mid-something and lost context" or context-window pressure becomes recurring. Build via `/skill-builder` (S2) from scratch in Snowball CEO voice — don't re-import Pocock's coder version.

(Not adding V8 in this commit — that's a separate ADD-ITEM-PROMPT.md action. Surfaced in Step 13 of EXECUTE-ITEM-PROMPT.md per the deviation-into-new-Decision/Item rule.)

---

## P2 execution log

### 05/24/26 - 19:36 EDT — P2 closed as no-op

P2 executed per REBUILD-PLAN.md item brief (Notes: "If P1 finds zero AIOS-applicable skills, this item is a no-op — note as 'P2 skipped, no Pocock skills applied' in the decisions log.").

P1 inventoried 18 Pocock skills. Verdicts: 17 SKIP, 1 ADAPT-THEN-APPLY (`/handoff`, deferred to v1.1 backlog as V8 candidate). Zero skills cleared the v1.0 bar.

**Outcome:** No `.claude/skills/<name>/SKILL.md` files written. No `SKILLS.md` rows added. No connector changes. P2 status flipped to `done` in REBUILD-PLAN.md.

**Follow-up (NOT part of this commit):** add V8 (`/handoff` mid-session conversation compaction) to REBUILD-PLAN.md v1.1 backlog via `ADD-ITEM-PROMPT.md` in a separate session. Wording drafted in § "v1.1 backlog addition" above.
