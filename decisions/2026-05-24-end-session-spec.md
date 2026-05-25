# /end-session spec
created: 05/24/26 - 14:30 EDT

Locked via `/grill-me` session on 2026-05-24. This is the design contract for the `/end-session` skill. The S8 plan item (build `/end-session`) implements against this spec. Do not re-litigate without re-grilling.

---

## 1. Purpose (one line)

`/end-session` is the **secretary** of the Snowball — the deferred organizational pass that fixes a known Claude weakness (poor in-session note-taking, inconsistent dating, drift between conversation and folder). The promise to the client: *"leave the folder cleaner than you found it, with every learning captured in the right place, every date refreshed, every registry in sync with reality."* It is the close, not the work.

---

## 2. Locked decisions

10 calls locked during the 2026-05-24 grill. Each is the contract S8 must honor.

### 2.1 Value frame: secretary, not gearbox

The skill's promise is **organizational housekeeping** — capture what was learned, propagate notes to the right files, date everything, regenerate registries from truth, prune rot, back up. It is **not** a "compounding gearbox" framing where TIME-SAVED is the headline. The TIME-SAVED tick is a side effect of doing the secretarial work well.

Priority stack:

1. **Full organizational pass** (the headline) — touched CLAUDE.md refreshed, registries regenerated, memory entries written for everything that passes the classifier, decisions logged when non-obvious choices got made, every file Claude writes gets a Decision-26 timestamp.
2. **Briefing for the next walk-in** — `.claude/last-session.md` so cold-start is painless.
3. **Anti-rot pruning** — single confirmation gate so memory stays clean over time.
4. **Backup** — commit + push so the organized state survives.
5. **TIME-SAVED tick** — number goes up, side effect not headline.

### 2.2 Trigger detection (explicit phrases + proactive wrap-up signal)

`/end-session` fires when:

**Explicit trigger phrases** (immediate fire, no confirmation):

- "stopping", "stopping for the day", "stopping now"
- "wrapping up", "wrap it up", "wrap this up"
- "done for the day", "done for now", "finished for now"
- "ending session", "end session", "close it out"
- "calling it", "calling it a day", "calling it for the night"
- "taking a break", "logging off"
- "/end-session" (typed slash command)

**Proactive wrap-up detection** (offer via `AskUserQuestion`, never auto-fire):

When the conversation drifts to social pleasantries with no new asks (client says "OK thanks" + nothing follows, long pause after a completed work unit, drift to chit-chat), surface ONE question:

> Looks like we might be wrapping up. Want me to run /end-session now? It'll organize everything we did today and save it.

`AskUserQuestion`:

1. **"Yes, wrap it up (Recommended)"** — fire `/end-session` immediately.
2. **"Not yet — I'm still working"** — drop it, don't ask again unless wrap-up signals fire again 15+ minutes later.

**Why not auto-fire on wrap-up signal:** false positives are expensive. If client said "OK thanks" because they're waiting for coffee, auto-firing a multi-minute ritual interrupts. Confirmation is cheap.

### 2.3 Phase 1 — Detect what changed

Run these in parallel (single tool-call batch where possible):

- `git status` and `git diff` — current uncommitted changes
- `git log <last-commit>..HEAD` where `<last-commit>` comes from `.claude/.session-state.json` (the last-cleanup memory file — see § 2.12); if the file doesn't exist or this is the first run, default to `git log --since="24 hours ago"`
- `git rev-parse HEAD` — capture HEAD at the START of this run (gets written to `.session-state.json` in § 2.12)
- `hostname` — for the briefing + state file
- Read `.claude/.session-state.json` if present
- Read MEMORY.md from the Anthropic auto-memory directory (path discovered at runtime per § 2.6)
- Get the current local time: `date '+%m/%d/%y - %H:%M %Z'` per Decision 26(B) — bare `date`, NEVER override TZ (breaks on Windows MSYS2)

Build a working map in head (no temp file):

- **touched_files**: every file changed since the last cleanup (uncommitted + committed-since-state-file)
- **touched_folders**: closest CLAUDE.md ancestor for each touched file
- **per_folder_summary**: what changed and why (synthesize from conversation + diff — the conversation has the *why*)
- **candidate_memories**: things learned this session that pass the § 2.6 classifier
- **decision_candidates**: non-obvious choices made this session that warrant a `decisions/<date>-<topic>.md` entry (§ 2.7)
- **org_gaps**: structural gaps detected from conversation (e.g., "AcmeCorp" mentioned heavily but no `clients/acme/` exists) — surfaced in § 2.8
- **prune_candidates**: stale or duplicate memory entries (§ 2.9)

### 2.4 Phase 2 — Fetch and pull only if behind

Run `git fetch origin`, then `git rev-list --left-right --count HEAD...origin/main` to check ahead/behind status.

- 0 behind (in sync or ahead): skip pull entirely. No-op.
- Behind AND working tree clean: `git pull --rebase`.
- Behind AND working tree has unstaged changes: `git stash push -u -m "/end-session auto-stash"`, then `git pull --rebase`, then `git stash pop`. If pop conflicts, halt and surface to client per § 2.13 push-failure flow.
- Pull or stash-pop conflict: halt, surface exact conflict in plain English, `AskUserQuestion` how to proceed. Options: *"Walk me through fixing this now (Recommended)"* / *"Leave it for next session"* / *"Show me the raw git error."*

Never auto-resolve. Never force-push.

**Why this matters:** an unconditional `git pull --rebase` errors out the moment there are unstaged changes, which there almost always are mid-session. Fetching first and gating on actual divergence avoids that failure mode.

### 2.5 Phase 3 — Regenerate SKILLS.md and CONNECTIONS.md from truth

Per Decision 10, both files are **regenerated**, not appended-to. Drift-proof.

**SKILLS.md regeneration:**

1. Scan `snowball/.claude/skills/` for every subfolder containing a `SKILL.md`.
2. For each skill: parse YAML frontmatter `name:` and `description:`. The `description:` field carries the trigger phrases as natural language per Anthropic's skill format (e.g., *"…ALWAYS invoke when the client says any of 'stopping', 'wrapping up'…"*).
3. Reconstruct SKILLS.md from scratch using the F8 template (header note "Auto-regenerated by `/end-session`. Read this before responding to my first message in any session." + one entry per skill with purpose + trigger phrases extracted from description).
4. Overwrite the file entirely. Any user-added content in SKILLS.md is lost — the file's header explicitly says it's auto-regenerated, so the client shouldn't be hand-editing it. If hand-edits are detected (file size jumps unexpectedly between sessions), note it in the § 2.11 briefing as a gentle flag ("Looks like SKILLS.md was edited by hand — I regenerated it; let me know if I lost something").
5. Add Decision-26 `updated:` line at top: `updated: MM/DD/YY - HH:MM TZ`.

**CONNECTIONS.md regeneration:**

1. **Section 1 — Connected:** run `claude mcp list` (parse output: tool name + auth status). Also scan PATH for known business CLIs the AIOS might surface to: `gws` (Google Workspace), `m365` (Microsoft 365 PnP), `gh` (GitHub), `stripe`, `firecrawl-mcp` (if installed). For each tool found, write a row: `Tool | Auth | Reference | Status`. Reference = link to matching `references/<tool>-api.md` if present.
2. **Section 2 — Recommended for solo experts:** preserved from F7 template. Don't touch.
3. **Section 3 — API keys captured:** preserved + appended. If a new env var was captured during the session (detected from conversation — client said "here's my X API key" → /end-session sees the resulting `setx` ran), add a row. Don't trash existing rows.
4. Add Decision-26 `updated:` line at top.

### 2.6 Phase 4 — Update CLAUDE.md files + draft memory entries

**CLAUDE.md updates** (per the locked grill decision):

- **Root `snowball/CLAUDE.md` stays tight.** Don't append session logs. Only touch fields explicitly defined as fillable (e.g., § 1 Identity if `/day-one` set it as fillable, refresh any `updated:` timestamp at the top). Decision 15 says ~100 lines tight; this respects that.
- **Subfolder CLAUDE.md files** (when client has created `clients/<name>/CLAUDE.md`, `projects/<name>/CLAUDE.md`, etc.): for each touched subfolder, append a session-log block under `## Recent sessions`, newest at top:

  ```markdown
  ### MM/DD/YY - HH:MM TZ — <one-line summary>
  **Status:** <one line>
  **Done this session:** <bullets>
  **Next steps:** <bullets>
  **Blockers:** <bullets, or "none">
  ```

  Per Decision 26(C), append-only log entries use the inline timestamp pattern `### MM/DD/YY - HH:MM TZ — summary`. Use the local time captured in § 2.3.

**Memory entries — 7-step classifier (inherited from Jacob's repo-root CLAUDE.md memory-system rules, AIOS-adapted):**

For every "thing learned this session" (extracted from conversation, NOT just the diff), apply this classifier:

1. **Derivable from code or git history alone?** → Skip.
2. **Status / next-step / blocker for a specific project?** → Already covered in folder CLAUDE.md (above). Don't duplicate to memory.
3. **Client identity / role / preference?** → Memory, type=`user`.
4. **Correction or validated approach?** → Memory, type=`feedback`. MUST include `**Why:**` and `**How to apply:**` lines.
5. **Project state not derivable from code (deadline, stakeholder ask, in-flight initiative)?** → Memory, type=`project`. Include Why + How to apply.
6. **Pointer to external system (Linear, Slack, dashboard, vendor docs)?** → Memory, type=`reference`.
7. **About this in-progress task only?** → Skip memory. Goes into the § 2.11 briefing instead.

**Heavy dedup (the discipline that fights rot):**

- For every candidate memory: fuzzy-match topic against existing MEMORY.md entries.
- **Decent match exists → UPDATE the existing entry** instead of creating a new one. Bias hard toward update.
- Only create a new entry if the topic is genuinely novel (no nearby existing entry).

**Soft cap ~3 new entries per session:**

- If the classifier finds 8 candidates: prefer to update 3 existing entries over creating 8 new ones. Discipline the skill carries, not a hard cap enforced by code.
- Effect over 6 months: ~30-50 dense entries, not 300 sparse ones. MEMORY.md stays under the truncation cliff.

**Memory file location (Anthropic auto-memory, discovered at runtime):**

- Path: `~/.claude/projects/<cwd-slug>/memory/` on Mac, `C:\Users\<user>\.claude\projects\<cwd-slug>\memory\` on Windows.
- Discovery: at runtime, list `~/.claude/projects/`, find the subfolder slug matching the current working directory (Anthropic encodes cwd as a slug). Memory lives there. NOT in the AIOS folder.
- Per Decision 19, AIOS clients get auto-memory automatically — it's harness behavior, not AIOS code. /end-session writes entries; the harness loads them on every future session.

**Memory file format:**

```markdown
---
name: <short-kebab-case-slug>
description: <one-line description used to decide relevance in future conversations — be specific>
metadata:
  type: <user|feedback|project|reference>
---

<For feedback/project: lead with the rule/fact, then **Why:** and **How to apply:** lines.>
<For user/reference: just the content, well-organized.>
```

Then add a pointer line to MEMORY.md (the index, at the same path), inserted at the top under `# Auto Memory`:

```markdown
## <CRITICAL: prefix only if applicable>: <headline> (MM/DD/YY)
- See [<filename>.md](<filename>.md) — <one-line hook under ~150 chars>
```

Per Decision 26, auto-memory entries use the existing YAML frontmatter (acceptable exception to the plain-text rule).

### 2.7 Conditional gate — decisions log writes

If § 2.3's `decision_candidates` map has entries (non-obvious choices detected from chat — e.g., "I'm organizing clients by industry not alphabet", "We're using Stripe Atlas not LegalZoom"), surface ONE `AskUserQuestion` per detected decision:

> I noticed you decided: "<decision summary>". Want me to log it to `decisions/` so future-you remembers WHY?
>
> 1. **Yes — log it (Recommended)** — write `decisions/MM-DD-YY-<topic>.md`
> 2. **No — skip this one** — drop the candidate
> 3. **Show me what you'd write first** — preview the file content, then ask again

If yes: write `snowball/decisions/<YYYY-MM-DD>-<short-topic>.md` with Decision-26 `created:` timestamp at top and the synthesized decision rationale.

**Bias toward consent.** A decision-log entry is permanent, dated, immutable. Permission required.

If no decisions detected: skip this gate entirely. Don't bother the client.

### 2.8 Conditional gate — org-surgery detection

If § 2.3's `org_gaps` map has entries (entities mentioned heavily in chat without matching folder structure, files dropped in wrong location, etc.), note each gap in the § 2.11 briefing AND surface ONE `AskUserQuestion` at the end of the run:

> I noticed a few organizational gaps this session:
>
> - "AcmeCorp" came up several times — no `clients/acme/` folder exists yet
> - `meeting-notes-acme.md` got dropped at the folder root — looks like it belongs in `clients/acme/`
>
> Want me to handle these now?
>
> 1. **Yes — walk me through each one (Recommended)** — per-item AskUserQuestion (create/skip/move)
> 2. **Skip — I'll handle later** — note them in the briefing, don't act
> 3. **Show me everything you noticed first**

**Bias toward consent.** File moves and folder scaffolding are surgical. Never auto-create or auto-move.

If no org gaps detected: skip this gate.

### 2.9 Conditional gate — memory pruning

Scan MEMORY.md for prune candidates:

- **Stale:** references closed phases / completed milestones / past deadlines, >60 days old AND no recent reference in current session, bugs whose fix commit appears in `git log`
- **Duplicates:** high topical overlap with another MEMORY.md entry (catches existing duplicates — § 2.6 dedup catches new ones)
- **Bloat:** entries whose index lines are pushing past MEMORY.md's truncation cutoff (~200 lines / 200KB). These get **moved** to a topic file with full detail, NOT deleted.

If candidates exist, present a single `AskUserQuestion`. Recommended logic adapts:

- **"Show me each candidate"** — Recommended if any candidate is ambiguous or count > 5
- **"Trust your judgment — prune the obvious ones"** — Recommended if all candidates are high-confidence (clear duplicates + clearly-dated/closed-phase staleness)
- **"Skip pruning this time"** — Recommended if candidate count < 3 OR last sentinel timestamp < 24h ago (just pruned)
- **"Show me a summary first"** — diagnostic, never default

If "Show me each candidate": loop one at a time with another AskUserQuestion per candidate (Keep / Prune / Edit). For Edit, ask the client to describe the rewrite, then apply.

If no candidates: skip this phase entirely.

### 2.10 Phase 5 — TIME-SAVED tick + total recompute

**Self-ping for /end-session:**

- Skill: `/end-session`
- Manual time per use: **20 min** (the cost of doing this organizational pass by hand without /end-session — review session, update notes, write briefing, commit, push)
- Increment "Total uses" by 1
- Recompute "Total saved (cumulative)" as `Total uses × 20 min`
- Update "Last used" to today's date (MM/DD/YY)
- Add row if `/end-session` doesn't have one yet

**Total recompute (per F9 success check):**

- Sum across all rows: `Total uses × Manual time per use` for each skill
- Update the bottom line: `**Total time saved to date:** X hours Y minutes`
- Add Decision-26 `updated:` line at top of TIME-SAVED.md

### 2.11 Phase 6 — Write .claude/last-session.md briefing

5 sections, max ~20 lines, Decision-26 `created:` timestamp at top:

```markdown
# Last session — MM/DD/YY, HH:MM TZ (laptop: <hostname>)
created: MM/DD/YY - HH:MM TZ

## What we did this session
<3-5 bullets, synthesized from conversation + git diff>

## Do this first next session
<the single most-pressing thing — be specific. "Reply to AcmeCorp follow-up email" not "follow up on clients">

## Open blockers
<bullets, or "none">

## Anything left dirty (uncommitted on purpose)
<list, or "none">
```

Match length to session size. A 5-min session gets a 5-bullet briefing, not a 20-bullet one.

**Dropped from Jacob's secondbrain version:** "In flight per project" (collapses into "What we did" for AIOS clients with 1-3 active things), "Watchlist" (premature for first-month clients — no pending replies / expiring tokens).

### 2.12 Phase 7 — Update .claude/.session-state.json

The "last cleanup memory file." Tiny state, JSON shape:

```json
{
  "last_run_at": "<ISO 8601 UTC of when § 2.3 started>",
  "last_run_commit": "<HEAD hash captured at the START of § 2.3>",
  "last_run_laptop": "<hostname>"
}
```

Why start-of-run hash and not post-commit hash: the state file records what was *processed*, so the next /end-session knows what to diff against. The commit /end-session creates is part of "what's new since last cleanup," which is exactly right.

### 2.13 Phase 8 — Commit + push (with plain-English failure handling)

**Stage SPECIFIC files only.** NEVER `git add -A` or `git add .`.

Stage:

- Each subfolder CLAUDE.md updated in § 2.6
- Regenerated `SKILLS.md` and `CONNECTIONS.md` (§ 2.5)
- Any new `decisions/<date>-*.md` written in § 2.7
- Any new/moved folder created via § 2.8 org-surgery gate
- `TIME-SAVED.md` (§ 2.10)
- `.claude/last-session.md` (§ 2.11)
- `.claude/.session-state.json` (§ 2.12)
- Any other files the client explicitly worked on this session that aren't on the do-not-commit list (`.env`, `.playwright-profile/`, anything matching `.gitignore`)

**Memory files are NOT in this commit.** Memory entries live at `~/.claude/projects/<slug>/memory/` — outside the AIOS folder. Git can't see them. They're written to disk during § 2.6 and that's where they live.

**Commit message** (HEREDOC per the repo conventions):

```
chore(snowball-session): MM/DD/YY - <one-line summary>

- N subfolder CLAUDE.md updated
- M memory entries added (P pruned, Q updated)
- Registries regenerated (SKILLS.md, CONNECTIONS.md)
- Briefing refreshed
```

**Push:** `git push origin main`.

**On failure — diagnose + plain-English explanation + AskUserQuestion** (per the locked grill decision):

1. Auto-classify the failure:
   - Auth expired (`fatal: Authentication failed`) → "GitHub doesn't recognize you right now — looks like your sign-in expired. We can fix that in 30 seconds."
   - Conflict with remote (`! [rejected] main -> main (fetch first)`) → "Someone else (or another machine) pushed changes to your GitHub repo since you last synced. We need to pull those down before pushing yours up."
   - Network down (`Could not resolve host`) → "Looks like your internet's flaky right now. Your work is saved on this laptop — we can push later."
   - Other → "Push didn't work. Here's the raw error if you want to see it." (then show 1-2 lines of the actual error)
2. `AskUserQuestion`:
   - **"Walk me through fixing it now (Recommended)"** — for auth/conflict: walk client through the fix (re-auth via VS Code's GitHub integration; for conflict, run `git pull --rebase` then push again, escalate if conflict). For network: offer to retry in 30 sec.
   - **"Leave the work saved locally for now — I'll push next session"** — defer. Note in the briefing that push is deferred.
   - **"Show me the raw error"** — print the verbatim git output for client to share with support / their guide.
3. Auto-fix NOTHING destructive. The commit succeeded — work is safe on disk either way.

NEVER force-push. NEVER auto-resolve a conflict.

### 2.14 Phase 9 — Confirm to client (terminal output, no AskUserQuestion)

Print a short summary:

```
✓ Session closed
- N subfolder CLAUDE.md updated: <list>
- M memory entries added: <list>
- P pruned: <list of names if any>
- K decisions logged: <list>
- Briefing: .claude/last-session.md
- Pushed: <commit short hash>
```

Don't ask "anything else?" — the client is stopping. Close out cleanly.

### 2.15 Up to 4 conditional gates — silent when not triggered

`/end-session` can surface up to 4 `AskUserQuestion` confirmations per run, each conditional on the session having triggering content:

1. **Decisions log gate** (§ 2.7) — fires only if non-obvious decisions detected
2. **Org-surgery gate** (§ 2.8) — fires only if org gaps detected
3. **Memory-pruning gate** (§ 2.9) — fires only if prune candidates exist
4. **Push-failure gate** (§ 2.13) — fires only if push fails

A clean session (no decisions / no org gaps / no prune candidates / push succeeds) runs end-to-end with **zero confirmations**. The intent is that gates are rare and consequential, not procedural friction.

---

## 3. Decision 26 enforcement (timestamps on every file /end-session writes)

`/end-session` is the enforcer of Decision 26 for the files it touches. Specifically:

- **New files /end-session creates:** add `created: MM/DD/YY - HH:MM TZ` line under the H1 (or as first lines if no H1). Applies to: `decisions/<date>-*.md`, `.claude/last-session.md`, new memory entries.
- **Files /end-session regenerates:** add or refresh `updated: MM/DD/YY - HH:MM TZ` line at top. Applies to: `SKILLS.md`, `CONNECTIONS.md`, `TIME-SAVED.md`.
- **Append-only logs:** use the per-entry inline pattern `### MM/DD/YY - HH:MM TZ — <summary>` per Decision 26(C). Applies to: subfolder CLAUDE.md `## Recent sessions` blocks.
- **Memory entries:** existing YAML frontmatter is acceptable per Decision 26(B) — no plain-text timestamp needed.

Time source: bare `date '+%m/%d/%y - %H:%M %Z'` per Decision 26(B). NEVER override TZ — breaks on Windows MSYS2.

---

## 4. Output file structure (everything /end-session may touch)

After a typical run, these files may have been written/updated:

| Path | Action | Condition |
|---|---|---|
| `snowball/SKILLS.md` | Regenerated from `.claude/skills/` scan | Every run |
| `snowball/CONNECTIONS.md` | Regenerated from `claude mcp list` + PATH scan | Every run |
| `snowball/TIME-SAVED.md` | Self-ping row + total recompute | Every run |
| `snowball/<subfolder>/CLAUDE.md` | Session-log appended | If subfolder was touched this session |
| `snowball/decisions/<date>-<topic>.md` | New decision log entry | If decision detected AND client approved |
| `snowball/clients/<name>/` or `snowball/projects/<name>/` | New scaffolded folder | If org-surgery gate fired AND client approved |
| `snowball/.claude/last-session.md` | Rewritten | Every run |
| `snowball/.claude/.session-state.json` | Updated | Every run (after successful commit) |
| `~/.claude/projects/<slug>/memory/<type>_<topic>_<MM_DD_YY>.md` | New memory entry | Per classifier in § 2.6 |
| `~/.claude/projects/<slug>/memory/MEMORY.md` | Pointer line added/updated | Per § 2.6 |

Never touched by /end-session:

- `snowball/CLAUDE.md` (root) — Decision 15 says tight, no growth
- `snowball/README.md` — preloaded template content, not user state
- `snowball/onboarding/*` — `/day-one`'s territory
- `snowball/references/*` — preloaded reference content
- `snowball/.env` — gitignored, never touched
- `snowball/.playwright-profile/` — gitignored

---

## 5. Failure modes

- **No changes detected since last cleanup:** print *"Nothing to write since last /end-session run on MM/DD/YY. Have a good break."* Don't commit. Skip § 2.4-2.13.
- **Mid-run interruption:** all writes are atomic per file. `.session-state.json` only updates after successful commit (§ 2.12). Rerun is safe — picks up where it left off.
- **`--dry-run` flag passed:** log everything that would be done, write nothing. Useful for verifying behavior before letting it run for real.
- **Pull or push conflict:** halt, surface plain-English error per § 2.13. Never auto-rebase, never force-push.
- **No conversation context (e.g., 5-min session):** still detect git changes and write the briefing if anything was touched. For memory, skip if classifier has nothing worth writing. Skill is useful on tiny sessions.
- **MEMORY.md unreadable:** halt, surface error, ask the client to investigate. Don't try to recover with partial data.
- **Anthropic auto-memory directory not found:** the session is the first time /end-session runs and the harness hasn't initialized the directory yet. Create it (`mkdir -p ~/.claude/projects/<slug>/memory/`), then proceed.
- **`claude mcp list` returns nothing or errors:** CONNECTIONS.md § 1 (Connected) shows "(none yet — connect tools via claude.ai → Connectors panel)". Don't fail the whole run.

---

## 6. Out of scope (parked, not v1.0)

- **Multi-laptop conflict resolution.** Decision 4 / S3 spec already locks the GitHub backup story. /end-session pushes; conflicts are surfaced per § 2.13. Auto-merge across laptops is out of scope.
- **Knowledge-layer compounding (Obsidian-style wikilinked notes).** Jacob's secondbrain has a `knowledge/` folder; the AIOS doesn't. If clients eventually want a knowledge graph, that's a v1.1 conversation.
- **Streak tracking / habit nudges.** Open-by-design Day-2 cadence — lightest landing in `/begin-session` (S5/S6 spec), full implementation in V4 (v1.1 backlog).
- **`/dream` semantic memory reorganization.** Parked in V2 per Decision 19d.
- **Auto-discovery of unknown CLIs.** CONNECTIONS.md scan only checks for the known list (`gws`, `m365`, `gh`, `stripe`, `firecrawl-mcp`). A new CLI the client installed but isn't on the list won't appear. Extend the list as new tools land in `references/`.
- **Public docs site republish.** Jacob's secondbrain has a `docs/` site that auto-deploys via GitHub Pages. AIOS clients don't have a public docs site by default. If one is ever added (e.g., `docs/levelup`), it's the client's concern, not /end-session's.
- **Cross-session learning consolidation.** If the same lesson surfaces across 5 sessions, /end-session won't notice — the dedup-on-write rule catches duplicates per session, not patterns across many. Worth revisiting once volume justifies.

---

## 7. Deviations from REBUILD-PROMPT.md surfaced

Two scope expansions locked in this grill that need REBUILD-PROMPT.md / REBUILD-PLAN.md updates in a separate `ADD-ITEM-PROMPT.md` session:

### 7.1 Decisions-log writes added to /end-session scope

**Original scope** (S7 brief): /end-session detects changes, regenerates registries, updates CLAUDE.md, writes memory, prunes, briefs, commits, pushes. No decisions-log writing.

**This spec adds:** /end-session detects non-obvious decisions from conversation (vendor choice, org choice, strategic call), surfaces a conditional `AskUserQuestion` gate per detected decision, writes `decisions/<date>-<topic>.md` on consent.

**Why:** the secretary frame includes "important lessons and decisions get written down and remembered." Decisions-log writing was previously /skill-builder's territory only (per S2 spec — writes decisions when building a skill). This extends it: any non-obvious decision deserves a log entry, not just skill-building ones.

**REBUILD-PLAN.md update needed:** S7 brief should add "detect non-obvious decisions + log via conditional AskUserQuestion gate" to the deliverable bullet list.

### 7.2 Org-surgery detection added to /end-session scope

**Original scope** (S7 brief): /end-session organizes within the existing folder structure. No structural-gap detection.

**This spec adds:** /end-session detects organizational gaps from conversation (entity mentioned heavily but no folder, file dropped in wrong location), surfaces them in the briefing AND offers a conditional `AskUserQuestion` gate to scaffold/move on consent.

**Why:** the secretary frame includes "full organizational pass." A secretary doesn't just update notes within the existing filing cabinet — they notice when something needs a new folder.

**REBUILD-PLAN.md update needed:** S7 brief should add "detect org gaps + offer scaffolding via conditional AskUserQuestion gate" to the deliverable bullet list.

**Action:** Jacob runs `ADD-ITEM-PROMPT.md` in a separate session to formally update REBUILD-PROMPT.md (Decision 27?) and the S7 brief. Not blocking S8 (build) — this spec is now the source-of-truth for the build, and the deviations are documented here.

---

## 8. What S8 (build) must verify

Per Decision 23 (Verify before asserting), the S8 executing session must verify these in-session before claiming /end-session is built:

1. `snowball/.claude/skills/end-session/SKILL.md` written and ≤ ~200 lines (length cap proportional to complexity — /day-one's spec was ~100; /end-session is heavier).
2. `snowball/SKILLS.md` has an `/end-session` row populated (no longer `[not yet built]`).
3. End-to-end dry run on Jacob's actual AIOS folder (or a sandbox clone for fresh-state test):
   - Make a small change (touch a file, edit a CLAUDE.md).
   - Invoke `/end-session`.
   - Verify all 9 phases ran:
     - § 2.3 detection produced a sane `touched_files` map
     - § 2.4 fetch + (no-op) pull worked
     - § 2.5 `SKILLS.md` and `CONNECTIONS.md` regenerated from live scans (compare file contents before/after)
     - § 2.6 CLAUDE.md updates applied to touched subfolders only (root unchanged)
     - § 2.6 memory classifier ran; dedup'd vs existing entries; soft cap honored
     - Conditional gates (§ 2.7-2.9) only fired when triggering content existed
     - § 2.10 TIME-SAVED row added/incremented + total recomputed
     - § 2.11 `.claude/last-session.md` written (5 sections, max ~20 lines, Decision-26 timestamp)
     - § 2.12 `.claude/.session-state.json` updated
     - § 2.13 commit + push succeeded (or surfaced plain-English failure if remote unavailable)
4. Decision 26 enforcement: every file /end-session wrote has a `created:` or `updated:` timestamp in the right place. No TZ override anywhere.
5. Memory-pruning gate: trigger it artificially (add a fake stale entry to MEMORY.md, run /end-session, verify the gate surfaces with sensible Recommended).
6. Push-failure gate: trigger artificially (e.g., temporarily break auth or unset remote), verify plain-English message + AskUserQuestion appear.
7. Trigger detection: paste each of the 7 explicit phrases in test sessions, verify /end-session fires for each. Test the proactive wrap-up signal (long pause + "OK thanks") — verify AskUserQuestion surfaces, not auto-fire.
8. Skill description (frontmatter) reads naturally for the AIOS client (CEO voice, no jargon). Trigger phrases in description are comprehensive.
9. Self-ping at end fires and updates TIME-SAVED.md with `/end-session` row showing `manual_time=20min`.

---

End of spec.
