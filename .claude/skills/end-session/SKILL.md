---
name: end-session
description: The secretary of this Snowball — the deferred organizational pass that closes a session cleanly. Detects what changed, regenerates SKILLS.md + CONNECTIONS.md from truth, updates touched subfolder CLAUDE.md files, drafts memory entries with heavy dedup, prunes stale memory on a single confirmation, writes a briefing for next time, commits, pushes to GitHub. Use when the user says any of "stopping", "stopping for the day", "wrapping up", "wrap it up", "done for the day", "done for now", "finished for now", "ending session", "end session", "close it out", "calling it", "calling it a day", "calling it for the night", "taking a break", "logging off", or types "/end-session". Also surface as an AskUserQuestion offer (never auto-fire) when the conversation drifts to social pleasantries with no new asks (e.g., "OK thanks" with nothing following + a completed work unit). The promise to the user is: leave the folder cleaner than you found it, with every learning captured in the right place, every date refreshed, every registry in sync with reality. It is the close, not the work.
---

# /end-session

The secretary of this Snowball. Deferred organizational pass: capture what was learned, propagate it to the right files, date everything, regenerate registries from truth, prune rot, back up. Side effect: TIME-SAVED ticks up. The number is a byproduct, not the headline.

## Trigger detection

**Fire immediately, no confirmation, when the user says any of:**

- "stopping" / "stopping for the day" / "stopping now"
- "wrapping up" / "wrap it up" / "wrap this up"
- "done for the day" / "done for now" / "finished for now"
- "ending session" / "end session" / "close it out"
- "calling it" / "calling it a day" / "calling it for the night"
- "taking a break" / "logging off"
- "/end-session" (typed slash command)

**Proactive wrap-up offer (never auto-fire).** When the conversation drifts to pleasantries with no new asks — user says "OK thanks" with nothing following, long pause after a completed work unit, drift to chit-chat — surface ONE `AskUserQuestion`:

> Looks like we might be wrapping up. Want me to run /end-session now? It'll organize everything we did today and save it.

Options:

1. **"Yes, wrap it up" (Recommended)** — fire immediately.
2. **"Not yet — I'm still working"** — drop it. Don't ask again unless wrap-up signals fire again 15+ minutes later.

False positives are expensive (a multi-minute ritual interrupting a coffee break is worse than missing one wrap-up by a session). Confirmation is cheap.

## Phase 1 — Detect what changed

Run these in parallel where possible:

- `git status` and `git diff` — uncommitted changes
- `git log <last-commit>..HEAD` where `<last-commit>` = `last_run_commit` field in `snowball/.claude/.session-state.json`. If that file doesn't exist (first run), default to `git log --since="24 hours ago"`.
- `git rev-parse HEAD` — capture HEAD at the START of this run. This is the value that goes into the new state file in Phase 7.
- `hostname` — for the briefing + state file.
- `Read` `snowball/.claude/.session-state.json` if present.
- `Read` `MEMORY.md` from the Anthropic auto-memory directory (see § Memory file location).
- Current local time: `date '+%m/%d/%y - %H:%M %Z'`. Use bare `date` — **never** override with `TZ=...` (breaks on Windows MSYS2, silently returns GMT).

Build this working map in head — no temp files:

- **touched_files** — every file changed since last cleanup (uncommitted + committed-since-state-file).
- **touched_folders** — closest CLAUDE.md ancestor for each touched file.
- **per_folder_summary** — what changed and why, synthesized from the conversation + diff. The conversation has the *why*; the diff has the *what*.
- **candidate_memories** — things learned this session that pass the classifier in Phase 4.
- **decision_candidates** — non-obvious choices made this session (vendor, org, strategy) that warrant a `decisions/<date>-*.md` entry.
- **org_gaps** — entities mentioned heavily in chat without matching folder structure (e.g., "AcmeCorp" came up 6 times, no `clients/acme/` exists).
- **prune_candidates** — stale or duplicate MEMORY.md entries.

## Phase 2 — Fetch and pull only if behind

Run `git fetch origin`, then `git rev-list --left-right --count HEAD...origin/main` to check ahead/behind.

- **0 behind** (in sync or ahead): skip pull entirely.
- **Behind, working tree clean:** `git pull --rebase`.
- **Behind, working tree has unstaged changes:** `git stash push -u -m "/end-session auto-stash"` → `git pull --rebase` → `git stash pop`. If pop conflicts, halt and surface per Phase 8's push-failure flow.
- **Pull or stash-pop conflict:** halt. Plain-English error. `AskUserQuestion`: *"Walk me through fixing this now (Recommended)"* / *"Leave it for next session"* / *"Show me the raw git error"*.

Never auto-resolve. Never force-push.

## Phase 3 — Regenerate SKILLS.md and CONNECTIONS.md from truth

Both files are **regenerated**, not appended-to. Drift-proof.

### SKILLS.md regeneration

1. Scan `snowball/.claude/skills/` for every subfolder containing a `SKILL.md`.
2. For each skill: parse YAML frontmatter `name:` and `description:`. Trigger phrases live inside the natural-language `description:` field per Anthropic's skill format.
3. Reconstruct SKILLS.md from scratch matching the existing template: header note (*"Auto-regenerated by `/end-session`. Read this before responding to my first message in any session."*) + status legend + one entry per skill (purpose paragraph + "Invoke when I say" bullet list extracted from the description). Mark each as `[live]` since presence on disk = live.
4. Overwrite the file entirely. The file's own header says it's auto-regenerated — clients shouldn't be hand-editing it. If a hand-edit is detected (size jump between sessions), gently flag it in the Phase 6 briefing: *"Looks like SKILLS.md was edited by hand — I regenerated it; let me know if I lost something."*
5. Add Decision-26 `updated: MM/DD/YY - HH:MM TZ` line at the top, using the time captured in Phase 1.

### CONNECTIONS.md regeneration

1. **Section 1 — Connected:** run `claude mcp list` (parse: tool name + auth status). Also probe PATH for known business CLIs: `gws`, `m365`, `gh`, `stripe`, `firecrawl-mcp`. For each found, write a row `| Tool | Auth | Reference | Status |` with Reference linking to `references/<tool>-api.md` if present. If `claude mcp list` returns nothing or errors, show *"(none yet — connect tools via claude.ai → Connectors panel)"*; don't fail the run.
2. **Section 2 — Recommended for solo experts:** preserve from the F7 template. Do not touch.
3. **Section 3 — API keys captured:** preserve existing rows + append. If a new env var was captured during the session (conversation shows the user pasted a key + `setx` ran), add a row. Never trash existing rows.
4. Add Decision-26 `updated:` line at top.

## Phase 4 — Update CLAUDE.md files + draft memory entries

### CLAUDE.md updates

- **Root `snowball/CLAUDE.md` stays tight.** Don't append session logs. Only refresh `updated:` if the Identity paragraph or a fillable field was changed. Decision 15 says ~100 lines; respect that.
- **Subfolder CLAUDE.md files** (when the user has created `clients/<name>/CLAUDE.md`, `projects/<name>/CLAUDE.md`, etc.): for each touched subfolder, append a session-log block under `## Recent sessions`, newest at top:

  ```markdown
  ### MM/DD/YY - HH:MM TZ — <one-line summary>
  **Status:** <one line>
  **Done this session:** <bullets>
  **Next steps:** <bullets>
  **Blockers:** <bullets, or "none">
  ```

  If `## Recent sessions` doesn't exist, create it at the bottom of the file. Use the local time from Phase 1.

### Memory entries — 7-step classifier

For every "thing learned this session" (extracted from conversation, not just the diff):

1. Derivable from code or git history alone? → **Skip.**
2. Status / next-step / blocker for a specific project? → Already covered in folder CLAUDE.md above. **Skip memory.**
3. User identity / role / preference? → Memory, `type: user`.
4. Correction or validated approach? → Memory, `type: feedback`. **Must** include `**Why:**` and `**How to apply:**` lines.
5. Project state not derivable from code (deadline, stakeholder ask, in-flight initiative)? → Memory, `type: project`. Include Why + How to apply.
6. Pointer to external system (dashboard, vendor docs, support channel)? → Memory, `type: reference`.
7. About this in-progress task only? → **Skip memory.** Goes in the briefing instead.

**Heavy dedup (the discipline that fights rot).** For every candidate: fuzzy-match topic against existing MEMORY.md entries. If a decent match exists, **update the existing entry** instead of creating a new one. Bias hard toward update.

**Soft cap ~3 new entries per session.** If the classifier finds 8 candidates: prefer updating 3 existing entries over creating 8 new ones. Over 6 months this gives ~30-50 dense entries, not 300 sparse ones — MEMORY.md stays under the truncation cliff.

### Memory file location (auto-memory, discovered at runtime)

- Mac: `~/.claude/projects/<cwd-slug>/memory/`
- Windows: `C:\Users\<user>\.claude\projects\<cwd-slug>\memory\`

Discovery: list the `projects/` parent, find the subfolder slug matching the current working directory (Anthropic encodes cwd as a slug). Memory lives there, **not** in the Snowball folder. The harness loads memory automatically on every future session.

### Memory file format

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

Add a one-line pointer to MEMORY.md at the same path, inserted near the top:

```markdown
## <CRITICAL: prefix only when warranted>: <headline> (MM/DD/YY)
- See [<filename>.md](<filename>.md) — <one-line hook under ~150 chars>
```

Existing YAML frontmatter is the accepted timestamp form for memory entries (Decision 26(B)) — no extra plain-text stamp needed.

## Phase 5 — Conditional gate: decisions-log writes

If the **decision_candidates** map has entries (non-obvious choices detected from chat — vendor, org, strategy), surface ONE `AskUserQuestion` per detected decision:

> I noticed you decided: "<decision summary>". Want me to log it to `decisions/` so future-you remembers WHY?

Options:

1. **"Yes — log it" (Recommended)** — write `snowball/decisions/<YYYY-MM-DD>-<short-topic>.md` with `created: MM/DD/YY - HH:MM TZ` at the top and the synthesized rationale.
2. **"No — skip this one"** — drop the candidate.
3. **"Show me what you'd write first"** — preview the file content, then ask again.

Bias toward consent. A decision-log entry is permanent and dated.

If no decisions detected, skip this phase entirely.

## Phase 6 — Conditional gate: org-surgery detection

If the **org_gaps** map has entries (entity mentioned heavily without a matching folder, file dropped in the wrong location), note each in the briefing AND surface ONE `AskUserQuestion`:

> I noticed a few organizational gaps this session:
>
> - "AcmeCorp" came up several times — no `clients/acme/` folder exists yet
> - `meeting-notes-acme.md` got dropped at the folder root — looks like it belongs in `clients/acme/`
>
> Want me to handle these now?

Options:

1. **"Yes — walk me through each one" (Recommended)** — per-item AskUserQuestion (create / skip / move).
2. **"Skip — I'll handle later"** — note them in the briefing; don't act.
3. **"Show me everything you noticed first"** — print the full list, then ask again.

Bias toward consent. File moves and folder scaffolding are surgical. Never auto-create or auto-move.

If no org gaps detected, skip this phase.

## Phase 7 — Conditional gate: memory pruning

Scan MEMORY.md for prune candidates:

- **Stale** — references closed phases / completed milestones / past deadlines, >60 days old AND no reference in current session.
- **Duplicates** — high topical overlap with another MEMORY.md entry (catches existing duplicates; Phase 4 dedup catches new ones).
- **Bloat** — index lines pushing past MEMORY.md's truncation cutoff (~200 lines / 200KB). These get **moved** to a topic file with full detail, NOT deleted.

If candidates exist, present one `AskUserQuestion`. Recommended option adapts:

- **"Show me each candidate"** — Recommended if any candidate is ambiguous OR total count > 5.
- **"Trust your judgment — prune the obvious ones"** — Recommended if every candidate is high-confidence (clear duplicates + clearly-closed phases).
- **"Skip pruning this time"** — Recommended if candidate count < 3 OR the last pruning ran < 24h ago.
- **"Show me a summary first"** — diagnostic, never Recommended.

If "Show me each candidate", loop per candidate with another AskUserQuestion (Keep / Prune / Edit). For Edit: capture the rewrite, apply, re-confirm.

If no candidates, skip this phase.

## Phase 8 — TIME-SAVED tick + total recompute

- **Skill:** `/end-session`
- **Manual time per use:** 30 min (review session, update notes, write briefing, commit, push — without a Snowball).
- Increment "Total uses" by 1.
- Recompute "Total saved (cumulative)" as `Total uses × 30 min`.
- Update "Last used" to today's date (`MM/DD/YY`).
- Add a row if `/end-session` doesn't have one yet.

**Total recompute.** Sum `Total uses × Manual time per use` across all rows. Update the bottom line: `**Total time saved to date:** X hours Y minutes`. Refresh the Decision-26 `updated:` line at the top of `snowball/TIME-SAVED.md`.

## Phase 9 — Write the briefing and state file, then commit + push

### .claude/last-session.md

Five sections, max ~20 lines, `created: MM/DD/YY - HH:MM TZ` at the top:

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

### .claude/.session-state.json

Tiny state file, written **after** successful commit:

```json
{
  "last_run_at": "<ISO 8601 UTC of when Phase 1 started>",
  "last_run_commit": "<HEAD hash captured at the START of Phase 1>",
  "last_run_laptop": "<hostname>"
}
```

The start-of-run hash records what was *processed*, so the next `/end-session` knows what to diff against.

### Commit + push

**Stage SPECIFIC files only.** Never `git add -A` or `git add .`. Stage:

- Every subfolder CLAUDE.md updated in Phase 4
- Regenerated `snowball/SKILLS.md` and `snowball/CONNECTIONS.md`
- Any new `snowball/decisions/<date>-*.md` written in Phase 5
- Any new/moved folder from Phase 6
- `snowball/TIME-SAVED.md`
- `snowball/.claude/last-session.md`
- `snowball/.claude/.session-state.json`
- Any other files the user explicitly worked on this session that aren't gitignored

**Memory files are NOT in this commit** — they live at `~/.claude/projects/<slug>/memory/`, outside the Snowball folder. Git can't see them. They're already on disk from Phase 4.

**Commit message** (HEREDOC):

```
chore(snowball-session): MM/DD/YY - <one-line summary>

- N subfolder CLAUDE.md updated
- M memory entries added (P pruned, Q updated)
- Registries regenerated (SKILLS.md, CONNECTIONS.md)
- Briefing refreshed
```

**Push:** `git push origin main`.

### On push failure — diagnose + plain-English + AskUserQuestion

Classify the failure:

- **Auth expired** (`fatal: Authentication failed`) → *"GitHub doesn't recognize you right now — looks like your sign-in expired. We can fix that in 30 seconds."*
- **Conflict with remote** (`! [rejected] main -> main (fetch first)`) → *"Someone else (or another machine) pushed changes to your GitHub repo since you last synced. We need to pull those down before pushing yours up."*
- **Network down** (`Could not resolve host`) → *"Looks like your internet's flaky right now. Your work is saved on this laptop — we can push later."*
- **Other** → *"Push didn't work. Here's the raw error if you want to see it."* (then show 1-2 lines of the actual error)

Then `AskUserQuestion`:

1. **"Walk me through fixing it now" (Recommended for auth/conflict)** — for auth: walk through re-auth via VS Code's GitHub integration. For conflict: `git pull --rebase` then push again; escalate if conflict. For network: offer to retry in 30 sec.
2. **"Leave the work saved locally for now — I'll push next session"** — defer. Note in the briefing that push is deferred.
3. **"Show me the raw error"** — print the verbatim git output for support / their guide.

Auto-fix **nothing destructive**. The commit succeeded — work is safe on disk either way. Never force-push. Never auto-resolve a conflict.

## Confirm to user (terminal output, no AskUserQuestion)

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

Don't ask "anything else?" — the user is stopping. Close out cleanly.

## Decision 26 enforcement (timestamps on every file you write)

- **New files you create:** add `created: MM/DD/YY - HH:MM TZ` under the H1 (or as first lines if no H1). Applies to `decisions/<date>-*.md`, `.claude/last-session.md`, new memory entries (their YAML frontmatter counts).
- **Files you regenerate:** add or refresh `updated: MM/DD/YY - HH:MM TZ` at the top. Applies to `SKILLS.md`, `CONNECTIONS.md`, `TIME-SAVED.md`.
- **Append-only logs:** use `### MM/DD/YY - HH:MM TZ — <summary>` per entry. Applies to subfolder CLAUDE.md `## Recent sessions` blocks.

Time source: bare `date '+%m/%d/%y - %H:%M %Z'`. **Never** override TZ — breaks on Windows MSYS2.

## Failure modes

- **No changes detected since last cleanup:** print *"Nothing to write since last /end-session run on MM/DD/YY. Have a good break."* Don't commit. Skip Phases 2-9.
- **Mid-run interruption:** all writes are atomic per file. `.session-state.json` only updates after successful commit. Rerun is safe — picks up where it left off.
- **No conversation context (5-min session):** still detect git changes and write the briefing if anything was touched. For memory, skip if the classifier has nothing worth writing.
- **MEMORY.md unreadable:** halt, surface error, ask the user to investigate. Don't try to recover with partial data.
- **Auto-memory directory not found:** first /end-session run before the harness initialized the directory. Create it (`mkdir -p ~/.claude/projects/<slug>/memory/`), then proceed.
- **`claude mcp list` returns nothing or errors:** CONNECTIONS.md § 1 shows *"(none yet — connect tools via claude.ai → Connectors panel)"*. Don't fail the run.

## Out of scope (v1.0)

- **Multi-laptop conflict resolution** — surfaced on push failure per Phase 9, never auto-merged across laptops.
- **Knowledge-layer compounding** (Obsidian-style wikilinks) — not in v1.0; revisit in v1.1.
- **Streak tracking / habit nudges** — lightest landing is `/begin-session`'s greeting; full implementation is V4.
- **`/dream` semantic memory reorg** — parked in V2.
- **Auto-discovery of unknown CLIs** — CONNECTIONS.md scan only checks the known list (`gws`, `m365`, `gh`, `stripe`, `firecrawl-mcp`). Extend the list as new tools land in `references/`.
- **Cross-session pattern learning** — dedup catches duplicates within a session, not patterns across many. Revisit once volume justifies.

## Self-ping (do this at the end of every invocation)

Before you finish, increment my row in [`TIME-SAVED.md`](../../../TIME-SAVED.md):

- Skill: `/end-session`
- Manual time per use: 30 min (writing up what happened, updating notes, briefing next-time-me, committing, pushing — without a Snowball)
- Increment "Total uses" by 1
- Recompute "Total saved (cumulative)" as `Total uses × 30 min`
- Update "Last used" to today's date

If `/end-session` doesn't have a row yet, add one with the same fields. Then recompute the bottom line: `**Total time saved to date:** X hours Y minutes`.
