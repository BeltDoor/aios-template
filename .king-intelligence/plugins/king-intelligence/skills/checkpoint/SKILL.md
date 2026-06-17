---
name: checkpoint
description: >
  Mid-flow session save without closing out. Runs the "write things down + organize + commit + push"
  mechanics from /end-session WITHOUT the pruning gate and WITHOUT signaling end-of-session, so the
  chat continues normally afterward. Detects changes from git + conversation, updates affected folder
  CLAUDE.md files with status/next-steps/blockers, drafts memory entries using the 7-step classifier,
  writes a RESUME briefing at .claude/last-session.md as insurance, updates the sentinel, commits with
  prefix `chore(checkpoint):`, pushes, and appends a /handoff-style copy-paste prompt to chat in case
  context dies right after. Invoke when the user says "checkpoint this," "save what we've got,"
  "write this down but keep going," "let's save progress," "save progress," "let me save where we are,"
  "save the state," or types /checkpoint directly. Distinct from /end-session (true close-out + pruning)
  and from /handoff (pure prompt generator, no doc updates and no commit). Use this when the user wants
  insurance + organized notes but is NOT done working.
argument-hint: "[--dry-run]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
disable-model-invocation: true
---

# /checkpoint
*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

You are running a mid-flow session save. The user wants what has been learned written down + organized + committed + pushed, with an insurance prompt at the end in case context dies — but they are NOT done working. The chat keeps going after this skill runs.

## Mental model

Think of `/checkpoint` as `/end-session` minus the close-out semantics. ~80% of the mechanics are identical — same detection, same folder CLAUDE.md updates, same memory classifier, same dedup-before-write, same commit+push security rules. What's different: **no pruning gate** (don't interrupt mid-flow with destructive ops), **distinct commit prefix** (`chore(checkpoint):` not `chore(session):`), and a **different closing message** that doesn't signal end-of-session.

The point isn't ending. The point is: write down what was learned + organize it + back it up + give the user insurance if context dies in the next 5 minutes.

**AskUserQuestion discipline.** Any user choice (e.g., push conflict recovery) goes through AskUserQuestion with a "(Recommended)" first option that is a genuinely smart pick (one you would defend, not "first option safest"). One genuine choice per question; put the tradeoff in each option's description.

**Reference point.** The shared Phase 1-7 mechanics mirror the `/end-session` SKILL.md line-for-line on intent. A maintainer comparing the two skills should see /checkpoint = /end-session minus pruning + plus handoff prompt + different closing semantics. Both skills are self-contained — no imports — but reading them side-by-side should make the relationship clear.

## Phase 1: Detect what changed

Run these in parallel:

- `git status` and `git diff` — current uncommitted changes
- `git log <last-commit>..HEAD` where `<last-commit>` comes from `.claude/.session-state.json` if it exists; if not, default to `git log --since="24 hours ago"`
- `git rev-parse HEAD` — capture HEAD hash at the START of this run (for sentinel in Phase 6)
- `hostname` (informational for sentinel + RESUME briefing)
- Read `.claude/.session-state.json` if it exists
- Read the project's MEMORY.md (needed for memory dedup in Phase 3). The path depends on your repo — check the auto-memory path configured in your root CLAUDE.md or in `~/.claude/projects/`.
- Get current local time: `date '+%m/%-d/%y - %H:%M %Z'` (use the bare `date` command; do NOT apply TZ overrides that can silently return UTC on some platforms)

Build a working map (in your head, no temp file):

- **touched_files** — every file changed since the last sentinel commit (uncommitted + committed-since)
- **touched_folders** — for each touched file, the closest CLAUDE.md ancestor
- **per_folder_summary** — what changed in each folder + why (synthesize from conversation, not just diff)
- **candidate_memories** — things learned this session passing the memory-write classifier (Phase 3)

**Important: exclude meta-bookkeeping commits.** When computing delta commits since the last sentinel, skip any commit whose message starts with `chore(checkpoint):`, `chore(session):`, or `docs: context handoff`. Those are already-processed save commits — re-processing them creates churn.

If `--dry-run` flag was passed: do all detection, log what you would write, then stop. Write nothing.

## Phase 2: Fetch and pull only if behind

Run `git fetch origin`, then `git rev-list --left-right --count HEAD...origin/main`.

- 0 behind → skip pull entirely
- Behind + clean working tree → `git pull --rebase`
- Behind + dirty working tree → `git stash push -u -m "/checkpoint auto-stash"` → `git pull --rebase` → `git stash pop`. If pop conflicts, halt.
- On pull or stash-pop conflict → halt, AskUserQuestion how to proceed: "Resolve manually now (Recommended)" / "Abort this /checkpoint run" / "Try a different strategy." Never auto-resolve.

## Phase 3: Write to CLAUDE.md files + draft memory entries

### Folder CLAUDE.md updates

For each `touched_folders` entry, append (or update) a "## Recent sessions" entry — newest at top:

```markdown
## YYYY-MM-DD - HH:MM (timezone) (checkpoint)
**Status:** <one line>
**Done since last save:** <bullets>
**Next steps:** <bullets>
**Blockers:** <bullets, or "none">
```

Note the `(checkpoint)` suffix on the header — makes it clear in git history this is a mid-flow save, not an end-session entry.

Use the local time you captured in Phase 1.

If new top-level folders were created since the last save, update the folder structure tree in root CLAUDE.md.

### Memory entries — the 7-step classifier

For every "thing learned this session" (from the conversation, not the diff), run this classifier — same rules as `/end-session`, encoded in your root CLAUDE.md's auto-memory section:

1. **Derivable from code or git history alone?** → Skip. (This includes prior `chore(checkpoint):` and `chore(session):` commits — they're meta-bookkeeping.)
2. **Status / next-step / blocker for a specific project?** → Already covered in folder CLAUDE.md above. Don't duplicate.
3. **User identity / role / preference?** → Memory, type=`user`.
4. **Correction or validated approach?** → Memory, type=`feedback` (with `**Why:**` + `**How to apply:**` lines).
5. **Project state not derivable from code (deadline, stakeholder ask, in-flight initiative)?** → Memory, type=`project` (with Why + How to apply).
6. **Pointer to external system (Linear, Slack, dashboard)?** → Memory, type=`reference`.
7. **About this in-progress task only?** → Skip memory. Belongs in the RESUME briefing instead (Phase 5).

### Dedup before write

Before writing any new memory entry, fuzzy-match against existing MEMORY.md entries. High topical overlap → update the existing entry instead of adding a new one. This is the single most important rule for fighting rot.

### Memory file format

Write each new memory at the auto-memory path configured in your root CLAUDE.md (typically inside `~/.claude/projects/<hashed-repo-name>/memory/`) with frontmatter (`name`, `description`, `type`) + the content body. Then add a pointer line to MEMORY.md at the top under `# Auto Memory`.

## Phase 4: NO pruning gate

This is the key delta from `/end-session`. **Do not scan MEMORY.md for stale/duplicate/bloat entries. Do not present a pruning AskUserQuestion.**

Why: pruning is destructive AND interrupts flow. The user is mid-task — interrupting them to confirm deletions is exactly the wrong move. Pruning belongs to true close-out via `/end-session`.

If you find an exceptionally obvious duplicate during the Phase 3 dedup-before-write step, you can still merge it (update existing entry instead of adding new). That's not pruning — that's preventing rot at write time. The distinction: dedup-before-write merges new+existing without deleting; pruning removes existing entries based on retrospective review. Only the second one is forbidden here.

## Phase 5: Write RESUME briefing

Write `.claude/last-session.md` (committed to the repo so it's in git history). This briefing is **insurance** — if the user's context dies in the next 5 minutes, the next session reads this and picks up where things left off.

Format:

```markdown
# Last session — YYYY-MM-DD, HH:MM (timezone) (laptop: <hostname>) [checkpoint]

## What we just did
<3-5 bullets, synthesized from conversation + git diff>

## In flight (per project)
- **<project path>:** <status one-liner + next concrete step>

## Do this first next session
<the single most-pressing thing — be specific>

## Open blockers
<bullets, or "none">

## Files left dirty (uncommitted on purpose)
<list, or "none">

## Watchlist
<pending replies, scheduled tasks, expiring tokens, follow-ups>
```

The `[checkpoint]` tag in the header distinguishes from `/end-session`'s RESUME briefing (which doesn't have a tag, signaling "session ended cleanly"). The Starting Point Protocol in root CLAUDE.md treats both the same way (presents resume gate at session open), but the tag is useful for any reader scanning the file.

## Phase 6: Update sentinel

Write `.claude/.session-state.json`:

```json
{
  "last_run_at": "<ISO 8601 UTC>",
  "last_run_commit": "<HEAD hash captured at the START of Phase 1>",
  "last_run_laptop": "<hostname>"
}
```

Records what state was processed. The next `/checkpoint` or `/end-session` reads this for delta computation. The classifier in both skills (Phase 1) excludes `chore(checkpoint):` / `chore(session):` commits when computing the delta, so meta-bookkeeping doesn't double-count.

## Phase 7: Commit + push

Stage SPECIFIC files only (NEVER `git add -A` or `git add .` — a standard security rule to avoid accidentally staging secrets):

- Each folder CLAUDE.md you updated in Phase 3
- Root CLAUDE.md (only if folder structure changed)
- `.claude/last-session.md`
- `.claude/.session-state.json`
- Any other files the user explicitly worked on this checkpoint that aren't on the do-not-commit list

**Memory files are NOT in this commit.** They live in the user-scope auto-memory path outside this repo. Don't try to stage them.

Commit message (note the `chore(checkpoint):` prefix, NOT `chore(session):`):

```
chore(checkpoint): YYYY-MM-DD HH:MM - <one-line summary>

- N folder CLAUDE.md updated
- M memory entries added (Q updated, P pruned: 0)
- RESUME briefing refreshed
- Handoff prompt appended in chat (insurance)
```

Pass via HEREDOC per standard commit conventions. Always include `P pruned: 0` so the line is consistent with `/end-session`'s message format — `/checkpoint` never prunes.

Push: `git push origin main`. On failure, AskUserQuestion for manual recovery:

- "Try `git pull --rebase` then push again (Recommended if push failed due to non-fast-forward)"
- "Defer push — leave the commit local for now"
- "Abort"

NEVER auto-resolve conflicts. NEVER force-push without explicit per-incident approval.

## Phase 8: Generate handoff prompt (insurance)

Read the handoff skill's prompt template at `${CLAUDE_PLUGIN_ROOT}/skills/handoff/templates/handoff-prompt.md` to get the prompt SHAPE (the FIXED CORE phase map + the optional blocks that apply). Generate a copy-paste prompt for the next context window, populated from the session detection in Phase 1 + the briefing in Phase 5. Borrow only the prompt structure: ignore the template's "write to `.claude/last-handoff.md` first" instruction (that file is `/handoff`'s responsibility; the RESUME briefing was already written to `.claude/last-session.md` in Phase 5). This prompt is chat-only bonus output.

Output it to chat inside a single triple-backtick markdown code block so the user can copy with one click. Lead with a short line explaining what it is:

```
If your context dies in the next few minutes, here's a copy-paste prompt for a fresh window:
```

Then the code block with the full handoff prompt.

This is **bonus output** — not the point. The point is the saves above. The handoff prompt is just available in case context becomes a problem right after.

## Phase 9: Confirm to the user

Print a short summary AFTER the handoff prompt:

```
✓ Checkpoint saved. Still going — what's next?
- N folder CLAUDE.md updated: <list>
- M memory entries added: <list>
- 0 pruned (pruning is /end-session's job)
- RESUME briefing refreshed
- Pushed: <commit short hash>
- Handoff prompt above is insurance — ignore unless context dies
```

The closing sentence `Still going — what's next?` is the key semantic difference from `/end-session`. It explicitly invites continuation. Do NOT print "Session closed" or "Have a good break" — the user isn't stopping.

## Failure modes

| Mode | Behavior |
|------|----------|
| No changes detected since last save | Exit clean: `Nothing to write since last save on <date>. You're already up to date.` Skip Phases 3-9. |
| Mid-run interruption | Per-file writes are atomic. Sentinel only updates after successful commit. Rerun is safe. |
| `--dry-run` flag passed | Log everything you would do, write nothing. Useful for verifying. |
| Pull conflict (Phase 2) | Halt, surface, AskUserQuestion for recovery. Never auto-rebase. |
| Push conflict (Phase 7) | Same — halt, surface, AskUserQuestion. Never force-push. |
| MEMORY.md or root CLAUDE.md unreadable | Halt, surface error, ask the user to investigate. Don't recover with partial data. |
| Handoff template missing | Skip Phase 8 entirely. The handoff prompt is bonus output — the save mechanics are the point. |

## Distinct from /handoff and /end-session

| | `/handoff` | `/checkpoint` | `/end-session` |
|---|---|---|---|
| Updates folder docs / memory | NO | yes | yes |
| Commits / pushes | NO | yes | yes |
| Writes `.claude/last-session.md` (RESUME briefing) | NO | yes | yes |
| Writes `.claude/last-handoff.md` (gitignored backup) | yes | no | no |
| Generates chat prompt | yes (the point) | yes (bonus) | NO |
| Pruning gate | NO | NO | YES |
| Closing message | "paste the block below" | "still going" | "session closed" |
| Commit prefix | n/a (no commit) | `chore(checkpoint):` | `chore(session):` |
| Best for | window filling, want the prompt fast + backup | mid-flow save w/ backup | true close-out |

Use `/handoff` when context is dying and you want a fast prompt-plus-backup transfer with no git activity. Use `/checkpoint` when you want a real save (docs + push + RESUME briefing) but are NOT stopping work. Use `/end-session` when you are actually done for the day.

## Anti-patterns to avoid

- **Don't print "Session closed."** This is explicitly NOT a close-out. The chat continues. The closing line must invite continuation.
- **Don't run the pruning gate.** Pruning is destructive and interrupts flow. It belongs to `/end-session` only.
- **Don't skip the RESUME briefing.** Even though the user isn't stopping, the briefing is insurance if context dies in the next few minutes.
- **Don't auto-rebase or force-push on conflicts.** Halt every time.
- **Don't commit memory files.** They live outside this repo in user-scope storage.
- **Don't commit do-not-commit files** (CSVs with PII, `.env`, `.claude.json`, real passwords). Stage explicitly.

## When NOT to invoke

- About to type `/end-session` anyway → use that. It handles close-out + the pruning gate.
- Switching to a fresh context window deliberately → `/handoff` is the lighter path (chat-only, no commit, no push).
- Haven't done meaningful work since last save → skill exits clean. Nothing to write.
- Critical inner loop → `/checkpoint` still does file I/O + git ops (~15s). Don't run during a moment where every second matters.
