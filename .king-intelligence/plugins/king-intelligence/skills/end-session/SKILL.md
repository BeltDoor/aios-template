---
name: end-session
description: Run the session-closing ritual for your repo — detect what the session did and file everything into its permanent homes so the next session starts with full context. Use this when the user says any of "stopping for the day", "wrapping up", "ending session", "done for the day", "calling it", "calling it a day", "taking a break", "logging off", "finished for now", or types /end-session directly. Also use it when the user says they're about to step away or the session feels like it's wrapping up. Not for a mid-task commit or a mid-session summary. If this setup has its own tailored version of this skill, prefer that one.
---

# /end-session

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

You are running the session-closing ritual for the user's repo. The goal: the next session picks up with full context — no drift, no rot, no cold start.

## Step 0 — load your settings

Before anything else, read your per-user settings so this skill adapts to whoever is running it. Use the Read tool on `references/king-intelligence-config.md` (a path relative to the repo root — the session's working directory IS the repo root, so read it as `references/king-intelligence-config.md`).

Find the `## end-session` section and parse its `- key: value` lines. The keys this skill uses:

- **registries** — comma-separated list of root-level registry files to refresh in Phase 3.5 (example: `SKILLS.md, CONNECTIONS.md, TIME-SAVED.md`).
- **registryPreserveSections** — comma-separated list of hand-maintained `## ` section headings inside `SKILLS.md` that must be preserved, never regenerated (example: `## Plugins & platform tools, ## Removed / status`).
- **knowledgeGraph** — the in-repo knowledge-graph folder path for the Phase 3 knowledge-layer step (example: `knowledge/`).
- **conveyorScript** — the memory-conveyor script path run in Phase 4 (example: `scripts/memory-conveyor.mjs`). If this script doesn't exist on disk, skip the conveyor call and use the manual hygiene fallback noted in Phase 4.
- **orgCheckScript** — the organization checker run in Phase 3.6 (example: `scripts/org-check.mjs`). It scaffolds a `CLAUDE.md` for any project-level folder still missing one and regenerates the folder map from disk truth. If it doesn't exist on disk, skip the org sweep and note it in the close-out.
- **scratchpadFile** — the in-session gotcha buffer harvested in Phase 3 (example: `.claude/session-scratch.md`). Claude logs errors/blockers/dead-ends here the moment they happen; this skill files each into its permanent home and resets the file. If not configured or absent, skip the harvest (still do the Phase 1 backup scan for unlogged gotchas).
- **folderLayoutDoc** — the folder-layout map that the orgCheckScript regenerates in Phase 3.6 (example: `references/operating/folder-layout.md`). The map's tree lives between `AUTO-LAYOUT` markers and is owned by the script, so never hand-edit the tree.
- **memoryIndexFormat** — how the memory index is shaped in Phase 3/4 (example: `pin-band` — a `[PIN]` band at the top, fresh entries newest-first below).
- **timeSavedSyncScript** — the deterministic time-saved core run in Phase 3.55 (default: `${CLAUDE_PLUGIN_ROOT}/scripts/time-saved-sync.mjs`). It measures the session from the machine's own record of it, folds that into the durable ledger (silently, no confirm question) and phones the totals up to the members portal. **Opt-in: if this key isn't set OR the script isn't on disk, skip Phase 3.55 entirely and silently.**
- **timeSavedState** — the local time-saved ledger file the Phase 3.55 review writes + Phase 7 commits (example: `.claude/time-saved/state.json`).

Throughout the phases below, wherever it says "the `<key>` from your settings," use the value you parsed here.

**If the file or the `## end-session` section is missing:** tell the user in one plain line to create `references/king-intelligence-config.md` with an `## end-session` section (you may scaffold a starter from the keys above), then continue with safe generic fallbacks: `registries` → none (skip Phase 3.5 registry refresh), `registryPreserveSections` → preserve any `## ` section that isn't a per-skill block, `knowledgeGraph` → skip the knowledge-layer step, `conveyorScript` → use the manual hygiene fallback in Phase 4, `orgCheckScript` → skip the Phase 3.6 org sweep (still create a CLAUDE.md for any new folder you worked in), `scratchpadFile` → skip the gotcha harvest (still do the Phase 1 backup scan), `folderLayoutDoc` → skip the folder-map update, `memoryIndexFormat` → a plain newest-first index.

The **memory folder path and the default git branch are NOT in config** — they are auto-discovered at runtime in Phase 0 below. That discovery is the source of truth; never hardcode either one.

## Phase 0: Locate the moving parts (runtime discovery)

Before the change-detection in Phase 1, discover the two locations this skill depends on. Do NOT hardcode them.

**Does a cloud backup even exist?** Run `git remote get-url origin` first. If it errors (no remote configured), this repo is local-only: set that fact aside as NO-REMOTE and SKIP every fetch/pull/push step in this skill (Phase 2 ahead/behind, Phase 7 push) — commit locally only, never error, and say it once in the close-out receipt in plain words: "saved on this computer; no cloud backup is set up for this folder." Do not treat a missing remote as a failure and do not try to create one.

**The default branch.** Detect it, don't assume `main`. Try `git symbolic-ref --quiet --short refs/remotes/origin/HEAD` (strip the `origin/` prefix); if that's empty, fall back to the branch `git rev-parse --abbrev-ref HEAD` reports, or `git remote show origin` and read "HEAD branch" (with NO-REMOTE, just use `git rev-parse --abbrev-ref HEAD`). Use the detected branch everywhere this skill says "the default branch" (Phase 2 ahead/behind check, Phase 7 push).

**The auto-memory folder.** Claude Code keeps per-project auto-memory under the user's home `.claude/projects/` tree. Find this project's folder by matching the working directory to its slug:

1. List the projects parent. On a Mac it's `~/.claude/projects/` (`$HOME/.claude/projects`). On Windows it's `C:/Users/<user>/.claude/projects/` (`$USERPROFILE\.claude\projects`, which `$HOME` also resolves to under Git Bash/MSYS).
2. Compute this project's slug from the repo root path: take the absolute working-directory path, drop the drive-letter colon if present, and replace every `/` and `\` with `-`. Example: `/Users/sam/myrepo` becomes `-Users-sam-myrepo`; `C:/Users/riley/Documents/myrepo` becomes `c--Users-riley-Documents-myrepo`. Slugs are case-sensitive on disk, so if no exact match is found, match case-insensitively.
3. The matched subfolder is this project's auto-memory home. The index is `<that subfolder>/memory/MEMORY.md`; individual entries are sibling `*.md` files in the same `memory/` folder.
4. If no matching subfolder or no `memory/MEMORY.md` exists, this repo has no auto-memory yet — skip the memory steps (Phase 3 memory drafting, Phase 4 conveyor) and note it once in the close-out. Don't create one unprompted.

Hold the discovered default branch and memory path in your working context for the rest of the run.

## Mental model

You are the user's **secretary for the second brain**, and the second brain is the operational backbone of their business — so this close-out is the job that keeps the whole thing from drifting. Take meticulous notes on what the session covered, file every durable fact in its correct home (the right folder CLAUDE.md, memory, the knowledge graph, the registries), and leave the desk clean so tomorrow opens with full context and nothing lost. The user has spelled out their organizational rules in the root CLAUDE.md and in their auto-memory system; apply those rules without making them repeat them. If you're tempted to ask "what did we work on?" — re-read the transcript and the diff instead. That's the whole point of this skill.

And brief them the way a good secretary briefs a CEO: plain English, no jargon, lead with what happened. That voice lands hardest in the Phase 8 close-out receipt, but keep it in every gate and prompt along the way too.

**Nothing in this skill is destructive, so nothing needs a confirmation gate.** Memory hygiene is now a one-command automatic conveyor (Phase 4) that only ever MOVES overflow notes into a dated archive — it never deletes. The old flow asked "prune now or defer?" every close and it never happened, so that question is gone. The only thing that ever stops the run is a hard failure (a conservation check, a push conflict), surfaced as one plain line, not a choice.

**AskUserQuestion discipline.** On the rare occasion you must present a real choice (a push conflict, a genuine ambiguity), it goes through the AskUserQuestion tool, never free-text "pick A/B/C." Always include a "(Recommended)" option as the FIRST item, with a smart pick (one you'd actually defend, not "first option safest").

## Phase 1: Detect what changed

Run these in parallel:

- `git status` and `git diff` — current uncommitted changes
- `git log <last-commit>..HEAD` where `<last-commit>` comes from `.claude/.session-state.json` if it exists; if the file doesn't exist or this is the first run, default to `git log --since="24 hours ago"`
- `git rev-parse HEAD` — capture the current HEAD hash at the START of this skill run (you'll write it to the sentinel in Phase 6)
- `hostname` — capture the current laptop name (for sentinel + RESUME briefing)
- Read `.claude/.session-state.json` if it exists, to find the last run's metadata
- Read the `MEMORY.md` at the memory path you discovered in Phase 0 — needed for dedup (Phase 3); the conveyor (Phase 4) handles sizing
- Read the **scratchpadFile from your settings** (example: `.claude/session-scratch.md`) if it exists — its `[GOTCHA]` / `[OPEN]` / `[NOTE]` / `[WIN]` lines are this session's logged captures, harvested in Phase 3 (gotchas/open/note) and Phase 3.55 (wins). Hold the `[WIN]` lines in working context NOW, because Phase 3 resets the scratchpad before Phase 3.55 runs.
- Get the current EST time: `date '+%m/%-d/%y - %H:%M %Z'` (per the root CLAUDE.md timezone rule — do NOT use `TZ='America/New_York'`, MSYS2 breaks it)

Build a working map (in your head, no temp file):

- **touched_files**: every file changed since the last run (uncommitted + committed-since-sentinel)
- **touched_folders**: for each touched file, the **project-level folder that owns it** — the nearest ancestor that is a top-level folder OR a direct child of a container (`clients/`, `king-intelligence/`, `personal/`). That's the folder whose CLAUDE.md gets this session's note, and the folder that must HAVE a CLAUDE.md (Phase 3A creates it if missing). Don't stop at a deeper subfolder that doesn't carry its own CLAUDE.md, and don't roll a brand-new project folder up into its parent just because it has no CLAUDE.md yet.
- **per_folder_summary**: per touched folder, what changed and why (synthesize from conversation + diff, NOT just the diff — the conversation has the *why*)
- **candidate_memories**: things learned this session that pass the memory-write classifier (Phase 3)
- **candidate_gotchas**: the lessons to file in Phase 3 — every `[GOTCHA]`/`[OPEN]`/`[NOTE]` line already in the scratchpad, PLUS a backup scan of the conversation for any error/blocker/dead-end you hit and resolved but never logged (the early-session stumble you forgot). Don't double-count one already in the scratchpad.
- **candidate_wins**: every `[WIN]` line in the scratchpad (a standout time-saving moment the user flagged), each parsed into `{text, minutes?}`. These are NOT gotchas — they're consumed by the Phase 3.55 Time-Back review, so hold them now and don't route them through the gotcha harvest.

If `--dry-run` flag was passed: do all detection + classification, log what you would write, then stop. Write nothing. Useful for checking the skill before letting it run for real.

## Phase 2: Fetch and pull only if behind

With NO-REMOTE (Phase 0): skip this entire phase — there is nothing to fetch from.

Run `git fetch origin`, then `git rev-list --left-right --count HEAD...origin/main` to check ahead/behind status.

- If 0 behind (local is in sync or ahead): skip the pull entirely. No-op.
- If behind AND working tree is clean: `git pull --rebase`.
- If behind AND working tree has unstaged changes: `git stash push -u -m "/end-session auto-stash"`, then `git pull --rebase`, then `git stash pop`. If pop conflicts, halt and surface.
- If pull or stash-pop surfaces a conflict: halt, surface the exact conflict, AskUserQuestion how to proceed. Options: "Resolve manually now (Recommended)" / "Abort the /end-session run / Try a different strategy." Never auto-resolve.

Why this matters: an unconditional `git pull --rebase` errors out the moment there are any unstaged changes, which there almost always are during a session. Fetching first and gating on actual divergence avoids the failure mode entirely.

## Phase 3: Write to CLAUDE.md files + draft memory entries

### Folder CLAUDE.md updates

For each entry in `touched_folders`, do two things:

**1. Make sure the folder HAS a CLAUDE.md.** If it doesn't (a folder you created or first worked in this session), create one now — you have the session's context, so write a real one, not a stub. Every project-level folder must have a CLAUDE.md so the next person to open it has something to read:

```markdown
# <Folder title>

_created: <EST time> _

**Purpose:** <one tight, factual sentence — what this folder is for. This is the line that feeds the folder map in Phase 3.6, so make it descriptive.>

**What lives here:** <the key files/subfolders and what they're for.>

## Recent sessions
```

**2. Append this session's note** under that folder's `## Recent sessions` heading (create the heading if it doesn't exist). Newest at top:

```markdown
## YYYY-MM-DD - HH:MM EST
**Status:** <one line>
**Done this session:** <bullets>
**Next steps:** <bullets>
**Blockers:** <bullets, or "none">
```

Use the EST time you captured in Phase 1.

**Don't hand-edit the folder map here.** The folder tree in the **folderLayoutDoc from your settings** (example: `references/operating/folder-layout.md`) is regenerated deterministically by the orgCheckScript in Phase 3.6 — new folders, deletions, renames, and changed `**Purpose:**` lines all get picked up there. The tree lives in the folder-layout doc, NOT in root CLAUDE.md (CLAUDE.md is the lean behavioral spine and only points to it).

### Gotcha harvest — file the session's lessons so they never repeat

Take `candidate_gotchas` (the scratchpad lines plus the backup-scan finds) and file each one where a FUTURE session will re-encounter it on its own. This is the whole point: a lesson dumped somewhere I won't re-read is wasted, so route by what the lesson is ABOUT:

- **Folder-specific trap** (how a particular project/client folder works) → a `## Gotchas` section in that folder's `CLAUDE.md` (create the section if absent; it's a non-dated, accumulating list, separate from `## Recent sessions`). A folder's CLAUDE.md gets read before working in it, so the trap surfaces automatically.
- **Tool / API trap** (a quirk of Stripe, Trello, pdf parsing, Playwright, etc.) → that tool's `references/<tool>-api.md` under its gotchas/incidents section. Surfaces when that tool's guide is next consulted.
- **Global behavior lesson** (an "always/never do X" not tied to one folder or tool) → a memory entry, type `feedback`, with `**Why:**` and `**How to apply:**` (it runs through the dedup + classifier below).
- **`[OPEN]` unfinished thread** → the RESUME briefing (Phase 5), under "In flight" / "Do this first."
- **`[NOTE]`** → route by the same memory/knowledge classifier below (folder vs memory vs knowledge).

Dedup first (same anti-rot rule as memory): if the lesson is already in its target home, strengthen that entry instead of adding a near-duplicate. After filing every line, **reset the scratchpadFile to its empty header template** — keep the header, the format guide, and the `<!-- entries below -->` marker; drop the harvested lines. The scratchpad must start the next session empty. (The `[WIN]` lines are already held in `candidate_wins` from Phase 1 and consumed by Phase 3.55, so dropping them here is intended — don't route them through the gotcha homes above.)

### Memory entries — the 7-step classifier

For every "thing learned this session" (extracted from the conversation, not the diff), apply this classifier. The rules come from the user's root CLAUDE.md auto-memory section — apply them verbatim, don't reinvent:

1. **Derivable from code or git history alone?** → Skip. Don't write. *(This includes prior `chore(session):` commits made by `/end-session` itself — those are pure git-history bookkeeping and should never be re-processed.)*
2. **Status / next-step / blocker for a specific project?** → Already covered in folder CLAUDE.md (above). Don't duplicate to memory.
3. **User identity / role / preference?** → Memory, type=`user`.
4. **Correction or validated approach?** → Memory, type=`feedback`. MUST include `**Why:**` and `**How to apply:**` lines per the format spec.
5. **Project state not derivable from code (deadline, stakeholder ask, in-flight initiative)?** → Memory, type=`project`. Include Why + How to apply.
6. **Pointer to external system (Linear, Slack, dashboard)?** → Memory, type=`reference`.
7. **About this in-progress task only?** → Skip memory. It goes in the RESUME briefing instead (Phase 5).

### Dedup before write

Before writing any new memory entry, fuzzy-match the topic against existing MEMORY.md entries. **High topical overlap → update the existing entry** instead of adding a new one. This is the single most important rule for fighting memory rot — most of MEMORY.md's bloat is variations on the same theme accumulating instead of merging.

**One line in. Decide the pin at birth.** Every index entry you write is a SINGLE line — a `## ` heading that ends with a pointer to its topic file. No second line, no paragraph. Detail lives in the topic file, never inline in the index — if you catch yourself writing a second sentence into the index, stop and put it in the topic file. Engineering / commit-by-commit detail is git-derivable (classifier rule 1) and never enters memory at all; it lives in the project folder.

Decide PINNED-or-not as you write it (don't defer — deferring is what created the old 353-entry pile):
- **Pin it** (`## [PIN] …`) if it's a durable hard-rule / security / voice convention NOT already in the root CLAUDE.md, an active client, or an in-flight project. Pins never age out of the loaded index.
- **Leave it fresh** (no marker) for everything else — recent learnings, gotchas, references. Fresh entries ride the conveyor newest-first and age out into the archive when the budget fills. This is the default.

The conveyor (Phase 4) normalizes format and sizing automatically, so getting the line shape exactly right matters less than getting the pin decision and the dedup right.

### Memory file format

For each new memory entry, write a file in the memory folder you discovered in Phase 0:
`<memory-folder>/<type>_<topic-slug>_<MM_DD_YY>.md`

```markdown
---
name: <short-kebab-case-slug>
description: <one-line description used to decide relevance in future conversations — be specific>
metadata:
  node_type: memory
  type: <user|feedback|project|reference>
---

<For feedback/project: lead with the rule/fact, then **Why:** and **How to apply:** lines.>
<For user/reference: just the content, well-organized.>
```

Then add a SINGLE pointer line to MEMORY.md (the index, at the same path), shaped by the **memoryIndexFormat from your settings**. For the `pin-band` format: the index has a `[PIN]` band at the very top (after the `# Auto Memory` header + the one-line conveyor note), then the fresh entries newest-first — insert a fresh entry at the top of the fresh band; insert a pin at the top of the `[PIN]` band. (If memoryIndexFormat is a plain newest-first index instead, just insert every new entry at the top under the `# Auto Memory` header.)

```markdown
## <[PIN] if pinned> <headline incl (MM/DD/YY)> -> [<filename>.md](<filename>.md)
```

One line, no `- See` second line. The headline carries the gist; the pointer goes to the topic file that holds the full detail. (The conveyor in Phase 4 will normalize spacing/length and age out the oldest non-pinned entries, so don't fuss over exact byte length — just keep it to one line and make the pin call.)

### Knowledge layer updates

If a **knowledgeGraph from your settings** is configured (example: `knowledge/`), that folder is the wikilinked Obsidian knowledge graph over the repo (see its own `CLAUDE.md` for the full spec). It must **compound** — every session that surfaces a new
entity or materially updates one feeds it. For each "thing learned this session," also check:

- **New or materially-changed person, company, concept, playbook, project, tool, or decision?**
  → Create or update the matching note in the right subfolder of the knowledgeGraph folder, following its
  `CLAUDE.md` frontmatter spec (`type`, `created`, `tags`, `related`, `source`).
- **A changed FACT counts as a material update, not just a new entity.** If this session changed a fact
  that an existing note carries — a price, an offer shape, a person's status (prospect→client, churned),
  a project's state (shipped, archived), an MRR-ish figure — refresh that note NOW. A note carrying last
  month's price misleads every future `/recall`; this is the #1 way the graph rots (learned 7/2/26: the
  AIOS notes sat 48 days with dead pricing because only *new* entities triggered writes).
- **Hub rule** — project and company notes are HUBS: when a person newly belongs to a product/project
  (a new trial, a discovery, a signed client), add their `[[link]]` to that project note's People section
  (and the person's note links back). Clicking a project must show its people.
- **Dedup first** — search the knowledgeGraph folder for an existing note on the entity; prefer updating it
  over creating a near-duplicate (same anti-rot rule as memory).
- **Link it** — add `[[wikilinks]]` to related knowledge notes and a `source:` provenance path
  back to the repo/memory file the update came from. No fabrication — every claim traces to `source:`.
- **Keep the parity config current** (only if `knowledge/.parity.json` exists): a person newly on a
  product roster → add them to that hub's `roster` list; a business-wide fact changed (e.g. a price
  raise) → move the OLD value into `deadFacts` and the NEW one into `requiredFacts`. That's what makes
  the next drift machine-detectable in Phase 3.7 instead of silent.
- This is in-repo (unlike memory), so these files DO get committed in Phase 7.

Skip this entire step if no knowledgeGraph is configured, or if the session was purely operational and surfaced no new durable entities AND changed no fact a note carries — don't force it.

## Phase 3.5: Regenerate registries from truth

So the root-level registries never drift from reality, refresh them every close. Refresh ONLY the files named in the **registries from your settings** (example: `SKILLS.md`, `CONNECTIONS.md`, `TIME-SAVED.md`); check each one exists first, and skip any that aren't configured. The per-registry instructions below apply to whichever of those files you actually have.

**`SKILLS.md` + `SKILLS-DETAIL.md` — regenerate as a TWO-FILE pair (if SKILLS.md is in your registries).** Glob `.claude/skills/*/SKILL.md` and parse each frontmatter `name` + `description` + `disable-model-invocation`, then regenerate from the live set (deleted skills drop out, new ones appear).

**The rule that keeps `SKILLS.md` small (7/24/26 context-engineering audit — do not undo this):** Claude Code already auto-loads the `name` + `description` of every skill and every installed plugin into the session. Those descriptions already carry the trigger phrases AND the "NOT for X, use Y instead" disambiguation, so re-listing them in `SKILLS.md` is a second copy of the same index — it cost ~27KB of every session and bought nothing. So:

- `SKILLS.md` regenerates **ONE section only**: `## User-invoked only`, containing a bullet for each skill whose frontmatter has `disable-model-invocation: true`. Those are the only skills whose descriptions do NOT load, so they are the only ones Claude can't see. Format: `- **/<name> [⏱️ if time-tracked]** — <trigger phrases from the description>`. **Never add a bullet for a skill without that flag** — it already advertises itself.
  - **Parse the frontmatter VALUE, not a plain grep.** Read only the `---` block and require the value to be exactly `true`. Many skills set it to `false` (they DO auto-load), and the phrase also appears in prose inside this skill and `pocock-writing-great-skills`, so a bare `grep -l disable-model-invocation` returns 21 false positives against the real 10. Caught 7/24/26.
- `SKILLS-DETAIL.md` (full, on-demand — this one stays comprehensive): the rich block per skill — `### /<name>`, **Status** `[live]`, **Purpose** (first sentence of the description), **Invoke when** (full trigger phrases), **Integrates** (cross-skill wiring). Keep its header note pointing back at the thin index.

**PRESERVE, do not regenerate or delete, the hand-maintained sections named in the registryPreserveSections from your settings.** They cover overrides on skills the user doesn't own, non-invocable shared modules, removed/status history, and parked items — none of which have frontmatter to regenerate from, so a frontmatter regenerate would wrongly wipe them (same preserve-the-curated-block rule as CONNECTIONS.md §1). If a plugin was installed or removed this session, update those preserved sections' facts by hand.

**Retiring a skill:** move the whole folder out of `.claude/skills/` (example archive: `references/_archive/retired-skills/<name>`) and note it under `## Removed / status`. Never leave a retired skill in place with a "do not invoke" note — its description still auto-loads and advertises itself, directly contradicting the note, and Claude pays to resolve that conflict every session.

**Reflect new skills AND cross-skill integrations.** Any skill added or removed this session MUST be picked up (regenerating from the live `.claude/skills/` dir is what guarantees this). Beyond the per-skill block, capture how skills connect: where one skill calls, feeds, or draws from another, say so on BOTH entries so the integration is discoverable from either side — e.g. `/email` runs a `/stop-slop` structural anti-slop pass (and `/stop-slop` is the source it draws from), `/debrief` calls `/handle-it`, `/skill-builder` routes to `/grill-me`. Never leave an integration documented on only one side. When a session explicitly wires skill A into skill B, that wiring belongs in SKILLS-DETAIL.md (the Integrates lines), not just in the skills' own files.

**`CONNECTIONS.md` — reconcile § 1, preserve the rest (if it's in your registries).** Run `claude mcp list`. Reconcile the § Tier-1 / Tier-2 **Status** column against what's actually connected; flag any drift (a row marked Active whose MCP isn't listed, or a live MCP with no row). Do NOT clobber the curated sections (Recommended starter context, the **API keys captured** index, Hard rules, Read-vs-write) — only refresh the connected-status truth. If a new tool was connected this session, add its row + remind to capture its key per [`references/operating/api-keys.md`](../../../references/operating/api-keys.md).

**`TIME-SAVED.md` — recompute totals (if it's in your registries).** For each of the tracked time-saver rows, recompute `Total saved = Total uses × Manual time per use` and confirm `Last used` reflects any invocation this session. Only the tracked time-saver skills have rows; deep-dives and setup tools are exempt (per root CLAUDE.md / Decision 12/27) — never add rows for them. If `TIME-SAVED.md` doesn't exist yet, skip (it's created out-of-band, not by this skill).

## Phase 3.55: Time-Back capture (opt-in)

**Gate:** only run this phase if a **timeSavedSyncScript from your settings** is configured AND the script exists on disk. If not, skip the whole phase silently (no mention in the close-out).

**You do not estimate anything here any more.** The old version of this phase asked you to judge how long the session's work would have taken a competent person by hand, then apply a calibration to the guess. That whole approach is retired. The time saved is now MEASURED from the machine's own record of every session: how long it genuinely worked, which documents it created and changed, what it drafted. A figure you write by hand can no longer raise or lower it, and passing one is simply ignored.

So this phase is one command:

```bash
node <timeSavedSyncScript> record --send
```

It measures this session, folds it into the durable ledger, and posts the totals to the members portal. It always exits 0: offline, or a setup with no portal token, just keeps the number local until next time. It never blocks the close.

Read the JSON it prints and carry `totalHours` and whether the send landed into the Phase 8 Receipt 1 line. That single receipt line is the only place this phase ever surfaces to the owner.

**Never ask about a dollar rate.** Hours alone is a complete, honest number, and the rate lives on the owner's own members page.

## Phase 3.6: Organization sweep — every folder documented, the map current (automatic, EVERY run)

So the repo never drifts out of organization, run the **orgCheckScript from your settings** (example: `scripts/org-check.mjs`). **First check the script exists on disk; only run it if it does.**

```bash
node <orgCheckScript> --fix
```

It does two deterministic things, both of which used to depend on you remembering to do them by hand (which is why they drifted):

1. **Scaffolds a starter `CLAUDE.md` for any project-level folder still missing one.** The folders you touched this session already got real ones in Phase 3A; this is the safety net for any other gap.
2. **Regenerates the folder map** in the folderLayoutDoc from live disk truth — picking up new folders, deleted folders, renames, and changed `**Purpose:**` lines automatically. It only rewrites the `AUTO-LAYOUT` block; the human-curated prose around it is never touched.

Then run the report once to catch anything left:

```bash
node <orgCheckScript>
```

If it still flags a folder missing a CLAUDE.md (the script left a `TODO` stub because nothing this session gave it real context), note those in the RESUME briefing (Phase 5) under "folders needing a real Purpose line" and mention it once in the close-out. Don't block on it.

**Scope:** this phase auto-CREATES missing CLAUDE.md files and auto-SYNCS the map — that's safe and deterministic. It does NOT reorganize (move files, merge folders, rename) — that needs judgment, so if you spot a folder that should be moved or merged, surface it in the RESUME, don't do it here.

If no orgCheckScript is configured or the file is missing, skip this phase and note in the close-out that the org sweep wasn't available (at minimum, you still created a CLAUDE.md for any new folder you worked in, per Phase 3A).

**Then rebuild the operating spine (only if `scripts/build-spine.mjs` exists on disk).** `CLAUDE.md` imports ONE generated file, `references/operating/rules/_spine.md`, instead of importing each rule file raw. The rule files have to carry client-install packaging ("What this is" / "Merge guidance") for the publish rail, and loading that packaging into every session just to ignore it wasted ~4,600 characters a session. This script strips it. Run it once:

```bash
node scripts/build-spine.mjs
```

If a rule file's `## Canonical content` heading was renamed or deleted, the script fails loudly — fix the rule file, don't hand-edit `_spine.md` (it's generated and gets overwritten).

**Then keep the Codex adapter in sync (only if `scripts/sync-codex-adapter.mjs` exists on disk).** The repo runs on both Claude Code and OpenAI Codex; this script regenerates `AGENTS.md` from the same rule set (it imports `SPINE` from `build-spine.mjs`, so the two sides cannot drift) and refreshes the `.agents/skills` mirror. Run it once, always AFTER the spine build:

```bash
node scripts/sync-codex-adapter.mjs
```

It prints a short status and flags any subagent or hook still out of sync (informational, not blocking). If the script is missing, skip and move on. `AGENTS.md` is committed in Phase 7; the `.agents/` mirror is gitignored and regenerable.

## Phase 3.65: Shared-skill publish drift check (automatic, silent when clean)

Clients auto-pull the published skill library daily, but it only moves when a publish actually runs — an edited shared master that never gets published silently strands every client on the old version. Close that gap here.

**Only if `.claude/skills/publish-skills/scripts/publish.mjs` exists on disk** (skip silently otherwise), run from the repo root:

```bash
node .claude/skills/publish-skills/scripts/publish.mjs detect
```

Count the entries in `changed`, `scripts.changed`, `rules.changed`, and `removed`. If ALL are empty, say nothing and move on. If anything changed, add ONE plain line to the close-out receipt: "N shared skill(s) changed since the last publish, so clients don't have the latest yet. Run /publish-skills when ready." Never auto-publish from here — publishing is its own gated ritual.

## Phase 3.7: Knowledge graph tidy-up — keep the map clean (automatic, EVERY run)

The compounding in Phase 3 GROWS the graph; this keeps it HONEST. So the wikilinked map never rots, run the graph health check and clear what it finds, in ONE bounded pass. Only do this if a **knowledgeGraph from your settings** is configured (example: `knowledge/`) and `scripts/wiki-health.mjs` exists on disk.

```bash
node scripts/wiki-health.mjs
```

It reports broken `[[wikilinks]]`, orphans, dead-ends, missing `source:`, and duplicate slugs. Resolve what it flags, routing by what each one actually is — and **NO FABRICATION**; the cardinal rule of the whole graph applies hardest here because this runs unattended:

- **Broken link that's a typo or nickname for an existing note** (check it against the real slug list) → repoint the link to the real note. Use the alias form `[[real-slug|the words as written]]` so the sentence still reads naturally (e.g. `[[aios]]` → `[[ai-operating-system|AIOS]]`).
- **Broken link to a genuine entity you can SOURCE from the repo** (a real person, company, tool, concept with actual content in a client folder / reference / memory) → create a short note per [`knowledge/CLAUDE.md`](../../../knowledge/CLAUDE.md): frontmatter (`type`, `created`, `tags`, `related`, `source`), an atomic body of ONLY sourced facts, `[[wikilinks]]` to notes that already exist. Cite the `source:` file for every claim.
- **Broken link to a memory entry, a script, a test artifact, or anything that isn't a real knowledge entity** → de-link it: drop the `[[ ]]` brackets, leave the words as plain readable text.
- **Can't source it at all?** Leave it as a deliberate stub (a `[[link]]` to a not-yet-written note is allowed by the graph spec) or de-link it — but **NEVER invent a note's contents to make the number go down.** A flagged stub is honest; a fabricated note corrupts the brain.
- **An orphan or dead-end among THIS session's own new notes** → wire it in with a `[[link]]`. Pre-existing orphans you didn't create: note them once in the RESUME (Phase 5), don't force-fix.

Then re-run `node scripts/wiki-health.mjs` to confirm broken links are back near zero. **Do exactly ONE pass** — resolving gaps can create a few new stub links from the notes you just wrote, and those are fine as deliberate stubs; do not chase them in a loop. These notes are in-repo, so they get committed in Phase 7.

The report also flags `bad source fmt` / `bad status` / `bad date` (frontmatter drift from the spec) — fix those the same bounded pass, matching the `knowledge/CLAUDE.md` frontmatter spec. Finally run `node scripts/wiki-health.mjs --fix-home` to refresh HOME.md's note count + "as of" date from disk truth, so the home page never goes stale. (Commit HOME.md in Phase 7 if it changed.)

**Parity check (only if `scripts/vault-parity.mjs` exists on disk):** wiki-health keeps the graph structurally honest; this keeps it COMPLETE and CURRENT against the operational repo. Run:

```bash
node scripts/vault-parity.mjs
```

It reports client folders with no note (coverage), roster people missing from the AIOS index note set, hub notes that don't link their people, notes missing from their Map of Content, and dead/required facts (config: `knowledge/.parity.json`). Clear what it flags in the same ONE bounded pass, same no-fabrication bar: create/update only what you can source, add the missing `[[links]]` to hubs and MOCs, fix stale facts from their source files. A brand-new client folder from THIS session with no note yet is exactly what this catches. Re-run until it exits clean or you hit something that genuinely needs the user; then note it in the RESUME instead of guessing.

Fold a one-line tidy receipt into the Phase 8 close-out (e.g. "Map tidy: 3 gaps filled, 2 links fixed, 1 de-linked, broken links 6 → 0"). If `wiki-health.mjs` isn't present or no knowledgeGraph is configured, skip this phase silently.

## Phase 4: Memory conveyor — automatic, no prompt (EVERY run)

Memory is a cache, not a vault. `MEMORY.md` is the always-loaded index, but Claude Code only loads the first **200 lines OR 25KB, whichever comes first** (verified: code.claude.com/docs/en/memory.md). The index used to be ~252KB / 353 entries, so ~90% never loaded. Now it's kept under a 24KB safety budget by a **conveyor**: pinned entries stay, fresh entries ride newest-first, and the oldest non-pinned overflow ages out into a dated `ARCHIVE-YYYY-MM.md` (same folder, NOT auto-loaded — a deliberate non-CLAUDE.md filename so it never reloads the bloat). **Nothing is ever deleted, so nothing needs the user's approval.**

After writing this session's new entries (Phase 3), run the conveyor once — using the **conveyorScript from your settings** (example: `scripts/memory-conveyor.mjs`). **First check the configured script actually exists on disk; only run it if it does.** If no conveyorScript is configured or the file is missing, fall back to manual hygiene: trim the index to one line per entry, keep it under the load budget by hand, and note in the close-out that the automatic conveyor wasn't available.

```bash
node <conveyorScript> --enforce
```

It normalizes entries to one line, re-detects `[PIN]` / fresh / dead-marker (CORRECTION/PRUNED/DEPRECATED) classification, moves overflow + dead-marked entries into the dated archive (**topic files stay on disk untouched**), verifies conservation (every note still lives in MEMORY ∪ archive), atomically rewrites `MEMORY.md`, and prints a one-line receipt.

**This runs silently — no AskUserQuestion, no "prune now or defer."** The only thing that ever stops it is a hard failure:

- If the script exits non-zero (a conservation check failed), it has **written nothing** — MEMORY.md is untouched. Surface the one-line error in the close-out receipt and leave memory as-is. Do NOT hand-edit to "fix" it; flag it for the user. (Rollback master, if ever needed: the byte-for-byte snapshots in `memory/_snapshots/`.)
- That is the whole gate. There is no other.

Fold the receipt into the Phase 8 "what I filed" block (e.g. "Memory: 4 new notes, kept N loading, aged M older ones into this month's archive — nothing deleted").

**Consolidation still matters, but it lives in Phase 3, not here.** The conveyor handles SIZE (bytes under budget); the Phase 3 dedup-before-write rule handles COUNT (fold two entries on the same person/project into one current entry instead of adding a near-duplicate). Keeping the entry count down is what keeps the conveyor from aging out useful notes too fast.

**To inspect without changing anything (when the conveyorScript exists):** `node <conveyorScript> --analyze` (read-only report of entries + the load cliff) or `--verify` (confirm MEMORY + archive still cover every note vs the latest `_snapshots/` baseline).

## Phase 5: Write RESUME briefing

Write `.claude/last-session.md` (committed to the repo so it's in git history, even though the next session will read it directly from disk):

```markdown
# Last session — YYYY-MM-DD, HH:MM EST (laptop: <hostname>)

## What we just did
<3-5 bullets, synthesized from conversation + git diff>

## In flight (per project)
- **<project path>:** <status one-liner + next concrete step>
- (one bullet per project touched)

## Do this first next session
<the single most-pressing thing — be specific. "Reply to Matt's email if it landed" not "follow up on UBA">

## Open blockers
<bullets, or "none">

## Files left dirty (uncommitted on purpose)
<list, or "none">

## Watchlist
<pending replies, scheduled tasks, expiring tokens, follow-ups that don't have a clear owner yet>
```

Match the briefing length to the session. A 30-minute session doesn't need a 10-bullet RESUME.

## Phase 6: Update sentinel

Write `.claude/.session-state.json`:

```json
{
  "last_run_at": "<ISO 8601 UTC of when Phase 1 started>",
  "last_run_commit": "<HEAD hash captured at the START of Phase 1>",
  "last_run_laptop": "<hostname>"
}
```

Why the start-of-run hash and not the post-commit hash: the sentinel records what state was *processed*, so the next `/end-session` run knows what to diff against. The commit this skill creates is part of "what's new since the sentinel," which is exactly right.

## Phase 7: Commit + push

Stage SPECIFIC files only (NEVER `git add -A` or `git add .` — root CLAUDE.md security rule):

- Each folder CLAUDE.md you created or updated in Phase 3 / 3.6 (the ones you wrote AND any the orgCheckScript scaffolded)
- Root CLAUDE.md (only if root-level behavioral rules were edited — the folder tree is NOT here anymore)
- The folderLayoutDoc from your settings (example: `references/operating/folder-layout.md`) — whenever Phase 3.6 regenerated its map
- Each registry from your settings that Phase 3.5 changed (example: `SKILLS.md`, `CONNECTIONS.md`, and `TIME-SAVED.md` if it exists and totals changed this session)
- Any new or updated notes under the knowledgeGraph from your settings (example: `knowledge/`) — the knowledge-layer compounding from Phase 3, only if a knowledgeGraph is configured
- `.claude/last-session.md`
- `.claude/.session-state.json`
- The scratchpadFile from your settings (example: `.claude/session-scratch.md`) — reset to empty in Phase 3 after harvesting
- The timeSavedState from your settings (example: `.claude/time-saved/state.json`) — only if Phase 3.55 ran and changed it (committing it backs the number up + keeps it consistent across laptops)
- Any other files the user explicitly worked on this session that aren't on the do-not-commit list (CSVs with PII, `.env`, `.claude.json`, real passwords — see root CLAUDE.md security section)

**Memory files are NOT in this commit.** Memory entries live in the auto-memory folder you discovered in Phase 0 (under the user's home `~/.claude/projects/…`) — that path is OUTSIDE the repo (user-scope, under `~/.claude/`). Git can't stage them. They're written to disk during Phase 3 and that's where they live. Don't try to add them to this commit.

Commit message:

```
chore(session): YYYY-MM-DD - <one-line summary>

- N folder CLAUDE.md updated
- M memory notes added, J aged into archive by the conveyor (none deleted)
- registries refreshed (the registries from your settings, as applicable)
- RESUME briefing refreshed
```

Pass via HEREDOC per the user's commit conventions.

With NO-REMOTE (Phase 0): stop after the commit — there is nowhere to push. The receipt says "saved on this computer; no cloud backup is set up for this folder" and that is the correct, complete outcome, not an error.

Push to the default branch you detected in Phase 0: `git push origin <default-branch>` (don't hardcode `main`). On failure, AskUserQuestion for manual recovery:

- "Try `git pull --rebase` then push again (Recommended if push failed due to non-fast-forward)"
- "Defer push — leave the commit local for now"
- "Abort"

NEVER auto-resolve. NEVER force-push without explicit per-incident approval.

## Phase 8: Caveman close-out — two receipts

This is the moment the user sees their whole day at a glance, so deliver it in the **`/caveman` voice** — that skill ([`../caveman/SKILL.md`](../caveman/SKILL.md)) is the source of truth for this format. Lead with the answer, plain CEO English, no jargon, one short line per action, any failure or skip on its own line. No wall of text.

Print TWO receipts, in order (terminal output, no AskUserQuestion). The first is the one that's easy to forget and the one the user actually cares about most: **what the session was worth.**

**Receipt 1 — What we got done this session.** The actual work, reconstructed from the conversation AND the git diff — not just the housekeeping. One plain line per real thing accomplished, with where it lives or its status. Anything involving money, anything sent out, and anything still owed gets its own clearly-flagged line (the caveman clarity rule). Match the length to the session: a 30-minute session is a few lines, not twenty.

```
Here's everything we got done today:
- <real accomplishment>: <where it lives / status>
- <real accomplishment>: <where it lives / status>
- Still open: <anything left unfinished, on its own line>
- Time saved today: <totalHours from Phase 3.55>h total (<adhocHours>h this session), <"saved to your members page" if send.sent, else "saved on your computer, syncs up next time">   (skip this line entirely if Phase 3.55 didn't run)
```

**Receipt 2 — What I filed away (what /end-session itself did).** The close-out housekeeping, so the user can see their secretary did the job rather than just trust it. Translate the jargon: "backed up to the cloud," not "pushed"; "next-session briefing," not "RESUME .md."

```
And here's what I filed so nothing's lost:
- Updated N folder notes: <list>
- Created K new folder notes (folders that had none): <list>   (skip this line if none were created)
- Folder map synced: <"added X, removed Y" or "no structural change">   (skip if the orgCheckScript wasn't available)
- Lessons filed so they don't repeat: <count + where they went, e.g. "2 into folder gotchas, 1 into the Stripe guide, 1 into memory">   (skip if no gotchas this session)
- Brain map tidied: <"N gaps filled, M links fixed, K de-linked, broken links X → 0" or "no drift">   (skip if the knowledge-graph tidy-up wasn't available)
- Memory: M new notes, kept K loading, aged J older ones into this month's archive (nothing deleted)
- Registries refreshed: <the registries from your settings that changed, as applicable, or "none kept here">
- Next-session briefing saved: .claude/last-session.md
- Backed up to the cloud: <commit short hash>   (or "saved on your computer, cloud backup still open" if the push didn't run; with NO-REMOTE: "saved on this computer; no cloud backup is set up for this folder")
```

Don't ask "anything else?" — the user is stopping. Close out cleanly.

## Failure modes

- **No changes detected since last run:** print "Nothing to write since last /end-session run on `<date>`. Have a good break." Don't commit. Skip Phases 3-7.
- **Mid-run interruption:** all writes are atomic per file. Sentinel only updates after successful commit. Rerun is safe — pick up where you left off.
- **No conversation context (e.g., 5-min session):** still detect git changes and write the RESUME if anything was touched. For memory, just skip if there's nothing classifier-worthy. The skill should be useful even on tiny sessions.
- **MEMORY.md or root CLAUDE.md unreadable:** halt, surface the error, ask the user to investigate. Don't try to recover with partial data.

## When NOT to invoke this skill

- Mid-task — the user is still working. /end-session is for closing out, not summarizing in the middle.
- "Save this for later" / "remember this" — those go directly to memory via the existing memory rules, not via /end-session.
- "Commit these changes" — that's a regular commit, not the full ritual. /end-session does its own commit at the end of the closing flow.
- A pure read-only session where nothing was changed AND nothing was learned — there's nothing to write, no need to invoke.
