---
id: v1-org-gotcha
title: Folder organization + gotcha capture + portable memory
since: 0.16.0
breaking: false
---

## In plain words (use this for the one heads-up)

Jacob shipped a way to keep this setup from drifting as it grows, and to stop it re-hitting the same wall twice. Three things, all additive, none of it touches or moves anything you've already got:

1. Every project folder gets a short note saying what it's for, and a folder map that stays in sync on its own.
2. A little scratchpad so Claude jots down anything that trips it up mid-session, and files the lesson away at close so it never bites twice.
3. Your memory and organization helpers get set to update themselves automatically, so they stay current without you doing anything.

It's a one-time setup. Your own files, notes, and settings are never overwritten, only added to. Your cloud backup is the undo. Want me to set it up? (yes / no, or tell me which parts to skip.)

## Paths

The `migration.mjs status` command that printed this brief also printed three real paths at the top of its output: `PLUGIN_ROOT=...`, `PROJECT_DIR=...`, and `PLUGIN_DATA=...`. Wherever the commands below say `PLUGIN_ROOT`, `PROJECT_DIR`, or `PLUGIN_DATA`, use those exact absolute paths. (A skill's shell call does not expand `${CLAUDE_PLUGIN_ROOT}`, so always use the printed absolute path, never the token.)

## Apply (only after the client says yes)

**1. Do the deterministic backfill in one tested step.** This marks the migration in-progress (before any edits), merges the new config keys (additive, never overwrites a value the client set), copies the maintenance scripts into the repo at `.claude/scripts/` so the close-out skill can run them, scaffolds a starter note for every project folder that lacks one, builds/refreshes the folder map, and creates the gotcha scratchpad. Every step inside it has its own "already done?" check, so a re-run after a stop is safe:

```
node PLUGIN_ROOT/scripts/migration.mjs apply PLUGIN_ROOT PROJECT_DIR v1-org-gotcha
```

Read the JSON it prints. The `config-merge` step reports how many keys it added; the `org-check-fix` output names how many folder notes were scaffolded. After this, the `## org-check` `containers` key holds the default `clients, projects` — if the client's container folders (the ones whose subfolders are individual clients/projects) are named differently, set `containers` in `PROJECT_DIR/references/king-intelligence-config.md` to their real names and tell them; if they have none, set it blank. That one value is worth a glance; the rest is plumbing.

**2. Give the scaffolded notes a real purpose (judgment).** Run the report to see which folders are still on a `TODO` purpose line:

```
node PLUGIN_ROOT/scripts/org-check.mjs --root PROJECT_DIR
```

For each folder whose note was just scaffolded, write a real one-line `**Purpose:**` from what's actually in the folder (fan out to subagents if there are many). Then re-run `node PLUGIN_ROOT/scripts/org-check.mjs --fix --root PROJECT_DIR` so the map picks up the real purpose lines. Skip folders you genuinely can't determine; leave their `TODO` and list them in the receipt.

**3. Fold the two new rules into THEIR CLAUDE.md (judgment).** Read `PLUGIN_ROOT/patterns/gotcha-capture.md` and `PLUGIN_ROOT/patterns/folder-org.md`. For each, FIRST judge semantically whether the client already states this rule in any wording. If they already have it, skip the edit. Otherwise apply its "Merge guidance": add it as its own section at a sensible spot in their CLAUDE.md (their file may use numbered sections; integrate it cleanly and confirm where you put it). Never rewrite their existing wording.

**4. Record both rules as adopted (so the pattern sync never re-offers them) — use the safe writer, never hand-edit the JSON:**

```
node PLUGIN_ROOT/scripts/patterns-record.mjs PLUGIN_DATA/config.json --adopt gotcha-capture,folder-org
```

`patterns-record.mjs` sets only the `patterns` fields and preserves the client's `skills` wiring and everything else, so it can never clobber their setup. Do NOT edit that JSON by hand.

**5. Mark the migration done (AFTER the receipt).**

```
node PLUGIN_ROOT/scripts/migration.mjs done PROJECT_DIR v1-org-gotcha
```

Only run this once every step above succeeded. If the client asked to skip a part, leave it undone: do NOT run `done` (the ledger stays `in-progress`), apply only the parts they accepted, and tell them the rest will be re-offered next `/king-intelligence:update`. The idempotent checks mean the accepted parts won't be redone.

## Receipt (show the client, plain English)

- Folders documented: created N new folder notes; M still need a real one-line purpose (list them).
- Folder map: built / refreshed at their folder-layout doc.
- Gotcha scratchpad: created (or already present).
- New rules added to your CLAUDE.md: which, and where you put them (or "you already had these").
- Settings wired: the config keys added; the maintenance scripts now live in your repo and refresh on each update.
- Nothing of yours was overwritten; your cloud backup is the undo.
