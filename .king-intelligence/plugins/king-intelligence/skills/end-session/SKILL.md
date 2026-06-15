---
name: end-session
description: Run the session-closing ritual for this repo. Detects what changed in the session (git plus the conversation), updates folder CLAUDE.md files with status, next-steps, and blockers, drafts new memory entries (user, feedback, project, reference) using the repo's own memory rules, surfaces stale memory for pruning via a single confirmation gate, writes a RESUME briefing for the next session, closes out with a plain-English receipt of what the whole session accomplished and what got filed where, and commits plus pushes so the next session has full context. ALWAYS invoke when the user says any of "stopping for the day", "wrapping up", "ending session", "done for the day", "calling it", "calling it a day", "taking a break", "logging off", "finished for now", or types /king-intelligence:end-session directly. Also invoke when the user says they are about to step away or the session feels like it is wrapping up. The whole point is that they never have to explain how they want things organized. Be smart about detecting what was learned, what was done, and what belongs where.
---

# /end-session

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

You are running the session-closing ritual for this repo. The goal: the next session picks up with full context, no drift, no rot, no cold start.

## Mental model

You are the user's **secretary for their second brain**, and that second brain is the operational backbone of their work, so this close-out is the job that keeps the whole thing from drifting. Take meticulous notes on what the session covered, file every durable fact in its correct home (the right folder CLAUDE.md, memory, the knowledge graph if there is one, the registries if there are any), and leave the desk clean so tomorrow opens with full context and nothing lost. The user has spelled out their organizational rules in the repo's root CLAUDE.md and in their auto-memory system; apply those rules without making them repeat them. If you are tempted to ask "what did we work on?", re-read the transcript and the diff instead. That is the whole point of this skill.

And brief them the way a good secretary briefs a CEO: plain English, no jargon, lead with what happened. That voice lands hardest in the Phase 8 close-out receipt, but keep it in every gate and prompt along the way too. If a King Intelligence `caveman` skill is installed (`/king-intelligence:caveman`) or the user has their own terse-mode skill, you may use its voice for the close-out; if not, just write plainly and lead with the answer. Never depend on it.

The single confirmation gate is **memory pruning** (the only destructive action). Everything else just happens.

**Tailor it to this repo.** Which folders get a "Recent sessions" note, which registries you regenerate, and whether there is a knowledge graph are all DISCOVERED at runtime, not assumed. A client can make this skill their own by adding (or not adding) the files this skill looks for: a root CLAUDE.md, per-folder CLAUDE.md files, a `SKILLS.md` / `CONNECTIONS.md` / `TIME-SAVED.md` registry, a `knowledge/` folder. Touch what exists, skip what does not, never invent structure the repo does not have.

**AskUserQuestion discipline.** Any choice you present to the user (pruning options, conflict resolution, edge cases) goes through the AskUserQuestion tool, never free-text "pick A/B/C." Always include a "(Recommended)" option as the FIRST item, with a smart pick (one you would actually defend, not "first option safest").

## Phase 0: Locate the moving parts (runtime discovery)

Before anything else, find the two locations this skill depends on. Do NOT hardcode them.

**The repo root.** You are running inside a git repo. `git rev-parse --show-toplevel` gives its absolute path. Everything in-repo (folder CLAUDE.md files, registries, the knowledge folder, the RESUME briefing, the sentinel) lives under it.

**The default branch.** Detect it, do not assume `main`. Try `git symbolic-ref --quiet --short refs/remotes/origin/HEAD` (strip the `origin/` prefix); if that is empty, fall back to the branch `git rev-parse --abbrev-ref HEAD` reports, or `git remote show origin` and read "HEAD branch". Use the detected branch everywhere this skill says "the default branch" (Phase 2 ahead/behind check, Phase 7 push).

**The Anthropic auto-memory folder (discover it, never hardcode a path).** Claude Code keeps per-project auto-memory under the user's home `.claude/projects/` tree. Find this project's folder by matching the working directory to its slug:

1. Find the projects parent. On Mac/Linux it is `~/.claude/projects/` (`$HOME/.claude/projects`). On Windows it is `C:/Users/<user>/.claude/projects/` (`$USERPROFILE\.claude\projects`, which `$HOME` also resolves to under Git Bash/MSYS). List that directory.
2. Compute this project's slug from the repo root path: take the absolute working-directory path, drop the drive-letter colon if present, and replace every `/` and `\\` with `-`. Example: `C:/Users/sam/work/acme` becomes `c--Users-sam-work-acme`; `/Users/sam/work/acme` becomes `-Users-sam-work-acme`. Slugs are case-sensitive on disk, so if an exact match is not found, match case-insensitively.
3. The matched subfolder is this project's auto-memory home. The index is `<that subfolder>/memory/MEMORY.md`; individual entries are sibling `*.md` files in the same `memory/` folder.
4. If no matching subfolder or no `memory/MEMORY.md` exists, this repo has no auto-memory yet. Skip all memory steps (Phase 3 memory drafting, Phase 4 hygiene) silently and note it in the close-out ("no memory system on this repo, skipped"). Do NOT create one unprompted.

Hold the discovered repo root, default branch, and memory path in your working context for the rest of the run.

## Phase 1: Detect what changed

Run these in parallel:

- `git status` and `git diff` for current uncommitted changes
- `git log <last-commit>..HEAD` where `<last-commit>` comes from `.claude/.session-state.json` (under the repo root) if it exists; if the file does not exist or this is the first run, default to `git log --since="24 hours ago"`
- `git rev-parse HEAD` to capture the current HEAD hash at the START of this skill run (you will write it to the sentinel in Phase 6)
- `hostname` to capture the current machine name (for the sentinel plus the RESUME briefing)
- Read `.claude/.session-state.json` (repo root) if it exists, to find the last run's metadata
- Read the discovered `MEMORY.md` (from Phase 0) if it exists, needed for dedup (Phase 3) and pruning (Phase 4)
- Get the current local time for the timestamp on everything you write. Use the repo's own timezone convention if its root CLAUDE.md specifies one; otherwise the bare `date '+%m/%-d/%y - %H:%M %Z'` (do NOT force a `TZ=` override, it can break on some Windows shells)

Build a working map (in your head, no temp file):

- **touched_files**: every file changed since the last run (uncommitted plus committed-since-sentinel)
- **touched_folders**: for each touched file, the closest CLAUDE.md ancestor (walk up the tree). If the repo has no per-folder CLAUDE.md files at all, this set is empty and the folder-update step in Phase 3 is a no-op.
- **per_folder_summary**: per touched folder, what changed and why (synthesize from the conversation plus the diff, NOT just the diff: the conversation has the *why*)
- **candidate_memories**: things learned this session that pass the memory-write classifier (Phase 3), only if this repo has a memory folder
- **prune_candidates**: stale or duplicate memory entries to surface in Phase 4

If `--dry-run` was passed: do all detection plus classification, log what you would write, then stop. Write nothing. Useful for checking the skill before letting it run for real.

## Phase 2: Fetch and pull only if behind

Only if the repo has a remote (`git remote` is non-empty). If there is no remote, skip this whole phase and note in the close-out that there is no cloud backup configured.

Run `git fetch origin`, then `git rev-list --left-right --count HEAD...origin/<default-branch>` (the branch from Phase 0) to check ahead/behind status.

- If 0 behind (local is in sync or ahead): skip the pull entirely. No-op.
- If behind AND working tree is clean: `git pull --rebase`.
- If behind AND working tree has unstaged changes: `git stash push -u -m "/end-session auto-stash"`, then `git pull --rebase`, then `git stash pop`. If pop conflicts, halt and surface.
- If pull or stash-pop surfaces a conflict: halt, surface the exact conflict, AskUserQuestion how to proceed. Options: "Resolve manually now (Recommended)" / "Abort the /end-session run" / "Try a different strategy." Never auto-resolve.

Why this matters: an unconditional `git pull --rebase` errors out the moment there are any unstaged changes, which there almost always are during a session. Fetching first and gating on actual divergence avoids the failure mode entirely.

## Phase 3: Write to CLAUDE.md files plus draft memory entries

### Folder CLAUDE.md updates

For each entry in `touched_folders`, update that folder's `CLAUDE.md` under a `## Recent sessions` heading (create the section if it does not exist). Newest at top:

```markdown
## YYYY-MM-DD - HH:MM <TZ>
**Status:** <one line>
**Done this session:** <bullets>
**Next steps:** <bullets>
**Blockers:** <bullets, or "none">
```

Use the local time you captured in Phase 1. If the repo keeps no per-folder CLAUDE.md files, skip this step.

If new top-level folders were created since the last run AND the repo maintains a folder-layout map (look for one the root CLAUDE.md points to, e.g. `references/operating/folder-layout.md`, or a folder tree inside the root CLAUDE.md itself), update that map. Only update the map that actually exists; do not create one if the repo does not have it.

### Memory entries — the 7-step classifier

Only if Phase 0 found a memory folder. For every "thing learned this session" (extracted from the conversation, not the diff), apply this classifier. If the repo's root CLAUDE.md states its own memory rules, those win; apply them verbatim. Otherwise use this default:

1. **Derivable from code or git history alone?** Skip. Do not write. *(This includes prior `chore(session):` commits made by `/end-session` itself: those are pure git-history bookkeeping and should never be re-processed.)*
2. **Status / next-step / blocker for a specific project?** Already covered in folder CLAUDE.md (above). Do not duplicate to memory.
3. **User identity / role / preference?** Memory, type=`user`.
4. **Correction or validated approach?** Memory, type=`feedback`. MUST include `**Why:**` and `**How to apply:**` lines per the format spec.
5. **Project state not derivable from code (deadline, stakeholder ask, in-flight initiative)?** Memory, type=`project`. Include Why plus How to apply.
6. **Pointer to external system (a board, a dashboard, a shared doc)?** Memory, type=`reference`.
7. **About this in-progress task only?** Skip memory. It goes in the RESUME briefing instead (Phase 5).

### Dedup before write

Before writing any new memory entry, fuzzy-match the topic against existing MEMORY.md entries. **High topical overlap means update the existing entry** instead of adding a new one. This is the single most important rule for fighting memory rot: most index bloat is variations on the same theme accumulating instead of merging.

**One line in, one line stays.** Every entry you write is ONE `## headline` plus ONE `- See <file> — hook` line. Detail lives in the topic file (memory) or the in-repo folder (engineering / project state), never inline in the index. Engineering and commit-by-commit detail is git-derivable (classifier rule 1): it never enters memory at all; it lives in the project folder. This is what Phase 4 enforces retroactively, but writing it right the first time is how the index stays small.

### Memory file format

For each new memory entry, write a file in the discovered memory folder at:
`<memory-folder>/<type>_<topic-slug>_<MM_DD_YY>.md`

```markdown
---
name: <short title>
description: <one-line description used to decide relevance in future conversations, be specific>
type: <user|feedback|project|reference>
---

<For feedback/project: lead with the rule/fact, then **Why:** and **How to apply:** lines.>
<For user/reference: just the content, well-organized.>
```

Then add a pointer line to MEMORY.md (the index, at the same path), inserted at the top under `# Auto Memory`:

```markdown
## <CRITICAL: prefix only if applicable>: <headline> (MM/DD/YY)
- See `memory/<filename>.md` — <one-line hook under ~150 chars>
```

### Knowledge layer updates (optional, only if the repo has a `knowledge/` folder)

If this repo carries a `knowledge/` folder (a wikilinked Obsidian-style knowledge graph, usually with its own `knowledge/CLAUDE.md` spec), it must **compound**: every session that surfaces a new entity or materially updates one feeds it. For each "thing learned this session," also check:

- **New or materially-changed person, company, concept, playbook, project, tool, or decision?** Create or update the matching note in the right `knowledge/` subfolder, following that repo's `knowledge/CLAUDE.md` frontmatter spec.
- **Dedup first.** Search `knowledge/` for an existing note on the entity; prefer updating it over a near-duplicate (same anti-rot rule as memory).
- **Link it.** Add `[[wikilinks]]` to related notes and a `source:` provenance path back to the repo/memory file the update came from. No fabrication: every claim traces to `source:`.
- This is in-repo (unlike memory), so these files DO get committed in Phase 7.

If the repo has no `knowledge/` folder, skip this entire step silently. Do not create one. Even when a `knowledge/` folder exists, skip if the session was purely operational and surfaced no new durable entities; do not force it.

## Phase 3.5: Regenerate registries from truth (only the ones that exist)

So the root-level registries never drift from reality, refresh them every close. Check each file's existence first; if it is absent, skip it silently (this repo just does not keep that registry).

**`SKILLS.md` — full regenerate (if present).** Glob the repo's skills directory (e.g. `.claude/skills/*/SKILL.md`). For each, parse the frontmatter `name` plus `description` and rewrite that skill's block: `## /<name>`, **Status** `[live]`, **Purpose** (first sentence of the description), **Invoke when** (the trigger phrases from the "Use when…" part). Rewrite the skill blocks from the live set, do not append, so deleted skills drop out and new ones appear. Preserve any hand-maintained sections (e.g. a `## Plugins & platform tools` block, a `## Removed / status` block) that document things NOT in the skills directory; a frontmatter regenerate would wrongly wipe them. **Reflect cross-skill integrations:** where one skill calls, feeds, or draws from another, say so on BOTH entries so the wiring is discoverable from either side. Never leave an integration documented on only one side.

**`CONNECTIONS.md` — reconcile the status, preserve the rest (if present).** Run `claude mcp list`. Reconcile the connected-status column against what is actually connected; flag any drift (a row marked Active whose MCP is not listed, or a live MCP with no row). Do NOT clobber the curated sections (recommended context, the API-keys index, hard rules, read-vs-write). Only refresh the connected-status truth. If a new tool was connected this session, add its row and remind the user to capture its key per the repo's key procedure.

**`TIME-SAVED.md` — recompute totals (if present).** For each tracked time-saver row, recompute `Total saved = Total uses × Manual time per use` and confirm `Last used` reflects any invocation this session. Only the tracked rows get touched; do not add rows for skills that are not already tracked. If `TIME-SAVED.md` does not exist, skip.

## Phase 4: Memory hygiene — classify, transfer, prune (every run that has a memory folder)

Skip this whole phase if Phase 0 found no memory folder.

MEMORY.md is the always-loaded index. It rots by accretion: multi-paragraph blocks, superseded entries, and commit-history that just duplicates in-repo docs pile up until older memory falls past the load cutoff. **Actively keep it clean every close, do not wait for it to balloon.** You have enough context to judge what belongs; do the work, do not punt it.

**The size rule (non-negotiable).** Every MEMORY.md entry is ONE `## headline` line plus ONE `- See <file> — hook` line (≤ ~200 chars). If an entry is multiple paragraphs or bullets, its detail does NOT belong in the index. It belongs in its topic file or its in-repo folder, with only a pointer left in MEMORY.md.

**Classify every entry into one of four actions:**

1. **KEEP** — a durable cross-session fact (user/feedback/project/reference) already in one-line form. Leave it.
2. **CONSOLIDATE** — two-plus entries on the same person/project/topic. Fold the durable facts into the most-current entry (add a one-line lineage note: "supersedes the 5/4 plus 5/15 framings"), then DELETE the older ones.
3. **TRANSFER (non-destructive, do it automatically, no gate needed).** Durable detail that belongs in the repo, not the index. Find its home in the repo (the right folder's `CLAUDE.md` or doc, or `references/` for API/reference blocks), confirm the detail is there (append it if genuinely missing), then collapse the MEMORY.md entry to a one-line pointer at that in-repo path. This is the DEFAULT for: shipped-project engineering logs, commit-by-commit history, test-account/credential dumps, run-by-run pipeline history, and API-reference blocks. These are git-derivable and must never live in the index.
4. **DELETE (destructive, needs the gate).** Superseded ("supersedes X" / "CORRECTION"), closed campaigns, past-dated events, bugs whose fix is in `git log`, leftover "(PRUNED …)" tombstone markers.

**The single gate.** Present ONE AskUserQuestion summarizing the plan: "Transfer N to folders, consolidate M, delete K." Transfers and consolidations are non-destructive (content preserved in-repo); state that you are doing them. The gate really just approves the DELETES. Options adapt to delete confidence:

- **"Do it all — transfer, consolidate, delete (Recommended)"** when the deletes are high-confidence (clearly superseded / closed / past-dated).
- **"Transfer plus consolidate only, skip the deletes"** when any delete is ambiguous.
- **"Show me the deletes first"** for a large count or when unsure; then loop the DELETES only.
- **"Skip memory hygiene this run"** when nothing qualifies.

For a big backlog, batch the candidates by category and offer **multiSelect** (e.g. "superseded", "closed/past-dated", "consolidate dupes", "transfer megablocks") rather than 40 one-at-a-time gates.

**Mechanical bulk edits.** To collapse or drop many sections at once, a fence-aware section splitter is far safer than hand-editing huge blocks: read MEMORY.md, split on top-level `## ` headers (tracking ``` code-fence state so a `##` inside a fence does not false-split), map each header to keep / collapse-to-stub / drop, rejoin, write back. Print a before/after line plus byte count.

If MEMORY.md is already clean (every entry one line, no dupes, no stale), say so in one line and move on.

## Phase 5: Write RESUME briefing

Write `.claude/last-session.md` under the repo root (committed so it is in git history, even though the next session reads it directly from disk):

```markdown
# Last session — YYYY-MM-DD, HH:MM <TZ> (machine: <hostname>)

## What we just did
<3-5 bullets, synthesized from conversation plus git diff>

## In flight (per project)
- **<project path>:** <status one-liner plus next concrete step>
- (one bullet per project touched)

## Do this first next session
<the single most-pressing thing, be specific. "Reply to Matt's email if it landed" not "follow up on the deal">

## Open blockers
<bullets, or "none">

## Files left dirty (uncommitted on purpose)
<list, or "none">

## Watchlist
<pending replies, scheduled tasks, expiring tokens, follow-ups that do not have a clear owner yet>
```

Match the briefing length to the session. A 30-minute session does not need a 10-bullet RESUME.

## Phase 6: Update sentinel

Write `.claude/.session-state.json` under the repo root:

```json
{
  "last_run_at": "<ISO 8601 UTC of when Phase 1 started>",
  "last_run_commit": "<HEAD hash captured at the START of Phase 1>",
  "last_run_machine": "<hostname>"
}
```

Why the start-of-run hash and not the post-commit hash: the sentinel records what state was *processed*, so the next `/end-session` run knows what to diff against. The commit this skill creates is part of "what is new since the sentinel," which is exactly right.

## Phase 7: Commit plus push

Stage SPECIFIC files only (NEVER `git add -A` or `git add .`): name each path you touched. The set is:

- Each folder CLAUDE.md you updated in Phase 3
- The root CLAUDE.md (only if root-level rules were edited)
- The folder-layout map (only if it exists AND the folder tree changed)
- `SKILLS.md` and `CONNECTIONS.md` (only the ones that exist AND Phase 3.5 changed)
- `TIME-SAVED.md` (only if it exists and totals changed)
- Any new or updated `knowledge/` notes (only if the repo has a `knowledge/` folder)
- `.claude/last-session.md`
- `.claude/.session-state.json`
- Any other files the user explicitly worked on this session that are not on a do-not-commit list (anything with personal data, secrets/`.env`, real passwords, or config files the repo's root CLAUDE.md security section marks off-limits)

**Memory files are NOT in this commit.** Memory entries live in the Anthropic auto-memory folder under the user's home (`~/.claude/...`), which is OUTSIDE this repo. Git cannot stage them. They are written to disk during Phase 3 and that is where they live. Do not try to add them to this commit.

Commit message (keep the `chore(session):` convention):

```
chore(session): YYYY-MM-DD - <one-line summary>

- N folder CLAUDE.md updated
- M memory entries added (P pruned, Q updated)
- registries refreshed (only the ones this repo has)
- RESUME briefing refreshed
```

Pass the message via a HEREDOC. Push to the DEFAULT BRANCH you detected in Phase 0 (`git push origin <default-branch>`), not a hardcoded `main`. If the repo has no remote, skip the push and say so in the close-out ("saved on your computer; no cloud backup is set up on this repo").

On push failure, AskUserQuestion for manual recovery:

- "Try `git pull --rebase` then push again (Recommended if push failed due to non-fast-forward)"
- "Defer push — leave the commit local for now"
- "Abort"

NEVER auto-resolve. NEVER force-push without explicit per-incident approval.

## Phase 8: Close-out — two receipts

This is the moment the user sees their whole day at a glance, so deliver it plainly: lead with the answer, plain CEO English, no jargon, one short line per action, any failure or skip on its own line. No wall of text. If a `/king-intelligence:caveman` (or the user's own terse-mode) skill is installed, you may borrow its voice; do not depend on it.

Print TWO receipts, in order (terminal output, no AskUserQuestion). The first is the one that is easy to forget and the one the user cares about most: **what the session was worth.**

**Receipt 1 — What we got done this session.** The actual work, reconstructed from the conversation AND the git diff, not just the housekeeping. One plain line per real thing accomplished, with where it lives or its status. Anything involving money, anything sent out, and anything still owed gets its own clearly-flagged line. Match the length to the session: a 30-minute session is a few lines, not twenty.

```
Here's everything we got done today:
- <real accomplishment>: <where it lives / status>
- <real accomplishment>: <where it lives / status>
- Money: <invoice / charge / payment, on its own line if any>
- Sent: <anything that went out, on its own line if any>
- Owed: <anything still owed, on its own line if any>
- Still open: <anything left unfinished, on its own line>
```

**Receipt 2 — What I filed away (what /end-session itself did).** The close-out housekeeping, so the user can see their secretary did the job rather than just trust it. Translate the jargon: "backed up to the cloud," not "pushed"; "next-session briefing," not "RESUME .md."

```
And here's what I filed so nothing's lost:
- Updated N folder notes: <list>
- Memory: M added, P pruned, Q merged: <names if any>   (or "no memory system on this repo")
- Registries refreshed: <only the ones this repo has, or "none kept here">
- Next-session briefing saved: .claude/last-session.md
- Backed up to the cloud: <commit short hash>   (or "saved on your computer, cloud backup still open" if the push didn't run, or "saved on your computer; no cloud backup set up" if there's no remote)
```

Do not ask "anything else?" The user is stopping. Close out cleanly.

## Failure modes

- **No changes detected since last run:** print "Nothing to write since last /end-session run on `<date>`. Have a good break." Do not commit. Skip Phases 3-7.
- **Mid-run interruption:** all writes are atomic per file. The sentinel only updates after a successful commit. Rerun is safe; pick up where you left off.
- **`--dry-run` flag passed:** log everything you would do, write nothing.
- **Push or pull conflict:** halt, surface the exact error, AskUserQuestion for manual recovery. Never auto-rebase, never force-push.
- **No conversation context (e.g. a 5-minute session):** still detect git changes and write the RESUME if anything was touched. For memory, just skip if there is nothing classifier-worthy. The skill should be useful even on tiny sessions.
- **No memory folder found in Phase 0:** skip all memory steps silently; note it once in the close-out.
- **No remote configured:** skip fetch/pull/push; the close-out says the work is saved locally only.
- **MEMORY.md or root CLAUDE.md unreadable:** halt, surface the error, ask the user to investigate. Do not try to recover with partial data.

## Anti-patterns to avoid

- **Don't ask the user what to write down.** That is the whole point of this skill. Detect from git plus conversation. If you are tempted to ask "what did we work on?", go re-read the transcript and the diff.
- **Don't commit do-not-commit files.** Anything with personal data, secrets/`.env`, real passwords, or config the repo marks off-limits. Stage explicitly, never `add -A`.
- **Don't dump every detail to memory.** Apply the classifier ruthlessly. Today's task goes to the RESUME briefing. Code patterns / file paths / git history get skipped entirely. A new rule from a correction goes to memory.
- **Don't write a 10-bullet RESUME for a 3-bullet session.** Match the length to the session.
- **Don't skip the dedup check.** Updating an existing memory entry is almost always better than adding a new one. Memory rot is mostly accretion, not absence.
- **Don't auto-rebase or force-push.** On any conflict, halt and ask.
- **Don't invent structure.** No memory folder, no registries, no knowledge graph, no remote? Skip those steps. Do not create scaffolding the repo never asked for.
- **Don't run /end-session mid-task.** This skill is for closing OUT a session.

## When NOT to invoke this skill

- Mid-task, when the user is still working. /end-session is for closing out, not summarizing in the middle.
- "Save this for later" / "remember this" goes directly to memory via the existing memory rules, not via /end-session.
- "Commit these changes" is a regular commit, not the full ritual. /end-session does its own commit at the end of the closing flow.
- A pure read-only session where nothing was changed AND nothing was learned: there is nothing to write, no need to invoke.
