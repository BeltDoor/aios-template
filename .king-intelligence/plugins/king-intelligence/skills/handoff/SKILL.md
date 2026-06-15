---
name: handoff
description: Pure context-window handoff prompt generator plus file backup. Builds a dense, paste-ready briefing for the NEXT Claude session (real file paths, IDs, env-flag names, account handles, kill-switches), centered on an ordered PHASE MAP (phases done / in progress / queued) so multi-phase work resumes with zero re-discovery. Prints the prompt in a copy-paste code block AND writes the identical prompt to .claude/last-handoff.md (gitignored) so a dying window never loses it. Does NOT update folder docs/memory and does NOT commit or push, those are the checkpoint and end-session jobs. Accepts an optional free-text argument naming what the next session should focus on. ALWAYS invoke when the user says "hand this off," "handoff," "prompt for the next window," "I'm running low on context," "carry this into a new window," "give me the resume prompt," or types /handoff directly. Use /handoff when the window is filling and you need the dense transfer prompt fast, with a recoverable file backup, but do NOT want doc writes or git activity.
argument-hint: "[next-session focus, e.g. 'next window finishes the deploy decision, not new features']"
allowed-tools: Read, Write, Bash, Grep, Glob
disable-model-invocation: true
---

# Context Window Handoff

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

You are the user's context-window handoff system. When they invoke `/handoff`, you build the best possible paste-ready prompt for a FRESH context window, print it, and write an identical copy to a backup file so a dying window never loses it.

**Goal:** zero re-discovery in the next window. The next Claude reads this prompt and resumes the multi-phase work immediately, knowing which phases are done, which phase is current, and the exact next action.

**This skill is intentionally narrow.** It does ONE thing: produce the prompt and the backup file. It does NOT update folder docs/memory, and does NOT commit or push. Closing out the day is `/king-intelligence:end-session`'s job (or, if the user keeps a separate mid-flow save skill such as `/checkpoint`, that owns the heavy save). Keep the lanes clean: this skill never saves docs or touches git.

The output prompt is read by the NEXT CLAUDE SESSION, not by the user, so it stays dense and precise (real paths, IDs, env-flag NAMES, account handles, kill-switches). The ONLY thing the user reads is a single plain-English confirmation line you print above the code block.

---

## Phase 0: Parse the focus argument

- `$ARGUMENTS` is optional free text. If present, treat it as the NEXT session's focus: bias the title, the Phase Map ordering, and the Start Here toward it, without dropping genuinely important other context. Example: `/handoff next window finishes the deploy decision, not the new feature push`.
- If empty: full auto-detect, no bias.
- There is no "quick" mode. Every run is already the fast prompt-plus-backup path.

## Phase 1: Detect session context (never ask the user)

Figure out what happened from git + the conversation. Do NOT interrogate the user.

```bash
git status --short
git diff --stat
git diff --cached --stat
git log --oneline --since="6 hours ago"
```

When reading the commit log, **ignore commits whose message starts with `chore(checkpoint):`, `chore(session):`, or `docs: context handoff`.** Those are prior save/handoff commits, not session work. Counting them double-counts handoffs as accomplishments, especially on a second `/handoff` in one window.

From the conversation, extract: the goal, what got done, decisions + rationale, what is unfinished, blockers, and gotchas learned. Flag uncommitted changes as `[UNCOMMITTED]`.

## Phase 2: Detect GSD and decide who owns the phase map

If the project uses GSD (a `.planning/` directory with phase plans), check whether a phase is active:

```bash
find .planning/phases -name "PLAN.md" -newer .planning/ROADMAP.md 2>/dev/null | head -5
```

If a GSD phase is active, the phase map already lives in GSD's own files. **Defer:** the Phase Map section becomes a one-line pointer to `/gsd:resume-work` (and `/gsd:progress`). Do not re-invent the phase list. If GSD is not in use, or no phase is active, you build the rich phase map yourself in Phase 3.

## Phase 3: Build the PHASE MAP (the spine)

This is the most important section. Everything else hangs off it, and it is the cure for the core pain ("more phases to do, where was I").

- Reconstruct the overall **Objective** (the whole outcome, with the real project/client/repo path named).
- Build an ordered list of EVERY phase, tagged `[x]` done / `[>]` in progress / `[ ]` queued, one line each.
- Under the `[>]` current phase, add an indented `stopped at:` line naming the precise next concrete action (a file:line, an exact command, or the open decision).
- Tag the `phase source:` line (PLAN.md path | in-flight handoff doc path | reconstructed from this session's chat) so the next window knows authoritative-from-PLAN.md vs reconstructed-from-chat.
- Try hard to reconstruct real phases from PLAN.md / a handoff doc / the conversation before falling back to a 3-line done/current/queued split.

## Phase 4: Fill the operational blocks

Open [templates/handoff-prompt.md](templates/handoff-prompt.md). Emit the FIXED CORE, then walk the OPTIONAL BLOCK LIBRARY top to bottom and emit each block ONLY when its `Emit when:` trigger fires from the state you detected. Never write a block with a "none" / "N/A" body. The blocks cover the ten carry-forward categories: Deploy & gates, Money/billing, Drafts-awaiting-send, Waiting on the user/client/web-only, Parallel windows, Verification, Watchlist, Connections, Gotchas.

Two rules that bite in real ops work:
- **Carry the id, mask the value.** Carry operational ids the next window needs (billing customer/invoice/subscription ids, CRM deal/contact ids, email draft ids, account handles, env-var NAMES, workflow ids). Redact only live secret VALUES (API keys, passwords, tokens, raw SSNs/DOBs).
- **Auto-deploy warning fires whenever a push to the working branch deploys something.** If this project auto-deploys an app on push (e.g. a push to main triggers a hosted deploy), emit "a push to main auto-deploys this app, never blind-commit" even on a no-deploy session. If you cannot confirm an auto-deploy is wired, omit the line rather than guess.

## Phase 5: Fill Start Here + Suggested skills

- **Start Here** covers ONLY the current `[>]` phase: one file to read first, one concrete next action (not "continue X"), GSD-aware. If a staged email/message send depends on this work, flag it here (precondition link).
- **Suggested skills:** 1-3 from the available skills whose triggers match the driving work + the immediate next action. Cap 3, prefer 1. Each line names a concrete in-flight artifact. Never invent a skill name. If none genuinely fit, write exactly: "No specialized skill needed, continue per Start Here." Always end with the closer line: "Run /handoff again when this window fills, or /king-intelligence:end-session to close out the day."

## Phase 6: Pre-emit self-scan

Before writing or printing, scan the assembled prompt for:
- Any em-dash, replace with comma/period/colon/parens.
- Any ID or path you did NOT verify this session, omit it (do not guess); mark genuinely-unknown-but-needed items `[unknown]`.
- Any live secret VALUE that slipped in, redact it.

Then confirm `.gitignore` contains `.claude/last-handoff.md`:

```bash
grep -q '.claude/last-handoff.md' .gitignore && echo "ignored" || echo "MISSING"
```

If it prints `MISSING`, note it once to the user in the confirmation line ("heads up, the backup file is not ignored from version control yet"). Do NOT silently edit `.gitignore` mid-run; the entry should already exist from the skill's install. The backup carries operational ids and may live in a private repo that could auto-deploy on push, so it must never get committed.

## Phase 7: Write the backup file FIRST

Write the full assembled prompt verbatim to `.claude/last-handoff.md` (overwrite each run), with a one-line timestamped header. Use the project's local time:

```bash
date '+%m/%-d/%y - %H:%M %Z'
```

Write the file BEFORE you print the code block. This is the crash-safety priority: the window may be at ~75% and could truncate mid-output, and the file is what survives. If you have to prioritize, write the Fixed Core (Objective + Phase Map + Start Here) first so even a partial file carries the spine.

This file is gitignored and is NEVER committed by this skill. If the user keeps a separate close-out briefing file (some setups write a `.claude/last-session.md` owned by the close-out skill), that is a DISTINCT file owned by `/king-intelligence:end-session`, not this one.

## Phase 8: Print the copy-paste block

Print one plain-English line TO THE USER, then the identical prompt inside a single triple-backtick code block:

```
Saved your handoff. Paste the block below into your next window. The same prompt is at .claude/last-handoff.md if this window dies before you copy it.
```

No doc-update summary and no commit confirmation, there are none to report.

---

## Edge cases

- **Trivial / no-change session** (just chat, light research, no decisions): emit only the 3-line MICRO FORM from the template, but STILL write it to `.claude/last-handoff.md`.
- **Nothing at all to hand off:** print "Nothing to hand off. No code, docs, or decisions this session." and write that one line to the backup too.
- **Uncommitted code changes:** note them in the relevant block and flag `[UNCOMMITTED]`. This skill does not commit them; that is the close-out skill's job.
- **Multiple `/handoff` runs in one window:** each run regenerates from current state and overwrites the backup file. Previous handoffs do not stack.

## Important rules

1. **Read before writing.** The template is the single source of the prompt shape; read it each run.
2. **No fabrication.** Every path/ID is real and verified this session, or omitted.
3. **No em-dashes** anywhere in output.
4. **Pure prompt + backup only.** No folder-doc edits, no memory writes, no commits, no pushes. Those belong to the close-out skill.
5. **File before screen.** Write `.claude/last-handoff.md` before printing.
6. **GSD defers.** If GSD is active, point the next window to `/gsd:resume-work`; do not re-invent the phase list.

## Distinct from the close-out skill

| | `/handoff` | `/king-intelligence:end-session` (close-out) |
|---|---|---|
| Updates folder docs / memory | NO | yes |
| Commits / pushes | NO | yes |
| Writes the close-out briefing file | NO | yes |
| Writes `.claude/last-handoff.md` | yes | no |
| Generates the paste prompt | yes (the point) | no |
| Pruning gate | NO | yes |
| Closing message | "paste the block below" | "session closed" |
| Best for | window filling, more phases to go, want the prompt fast | true close-out for the day |

Use `/handoff` when the window is filling and you want the dense transfer prompt fast with a recoverable backup, but do NOT want doc writes or git activity. Use `/king-intelligence:end-session` when you are done for the day. If the user keeps a separate mid-flow save skill (such as `/checkpoint`), use that when they want a real save (docs + push) and are NOT stopping; if no such skill exists, just keep working and run `/handoff` again when the window refills.
