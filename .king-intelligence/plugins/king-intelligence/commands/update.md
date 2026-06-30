---
description: Pull Jacob's newer skills, then audit your setup and show you a plain pick list of what changed (new and improved ways of working, missing connections, duplicate skills) so you choose what to pull in. Never overwrites what you've personalized.
argument-hint: [optional-scope]
disable-model-invocation: true
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Update the King Intelligence setup

Four parts: pull the latest shipped skills, run any one-time setup migrations this repo still needs, then AUDIT the client's whole setup (folders, Claude Code config, connections, skills), and from that audit show them a plain pick list of what changed since their last sync so they choose what to pull in. The client's saved wiring is never touched, and nothing about their setup changes without their yes.

## Part 0: Do you have your key yet? (gate — run this FIRST)

Updates are the part that stays personal to a paying client. Before pulling anything, check how this toolkit is installed:

```!
echo "--- installed ---"; claude plugin list 2>/dev/null | grep -i "king-intelligence@" || echo "(none)"
echo "--- marketplaces ---"; claude plugin marketplace list 2>/dev/null | grep -iB1 -A2 "king-intelligence" || echo "(none)"
```

Read the result and decide:

- **If the King Intelligence plugin is installed from `king-intelligence-starter`** (the free starter toolkit that ships inside the clone) **AND there is no marketplace whose source is the GitHub repo `BeltDoor/king-intelligence-marketplace`**, then this person is on the free starter and does **not** have their personal key yet. **Stop here.** Do not pull, do not error, do not touch anything. Say it plainly, no jargon:

  > You're on the free starter toolkit. That's a snapshot of Jacob's skills from when you set up, and it works great. What it doesn't do yet is grow on its own. To switch on live updates, so your tools keep getting better every time Jacob ships something new, you need your own personal key. Message Jacob and he'll send you two quick setup lines. Paste those in, reopen, then run /king-intelligence:update again and it'll pull everything current.

  Then stop. Nothing else runs.

- **If the plugin is installed from the `king-intelligence` marketplace whose source is the GitHub repo** (they've pasted their personal key), they're a current client. Continue to Part 1.

## Part 1: Pull the latest version

1. Refresh the catalog and update the plugin:
   - `claude plugin marketplace update king-intelligence`
   - `claude plugin update king-intelligence@king-intelligence`
2. If this repo already has the local maintenance scripts (a sign the org migration has run), refresh them to the current plugin version so they never drift. This is a no-op for a client who hasn't run the migration yet:

   !`[ -d "${CLAUDE_PROJECT_DIR}/.claude/scripts" ] && cp -f "${CLAUDE_PLUGIN_ROOT}/scripts/org-check.mjs" "${CLAUDE_PLUGIN_ROOT}/scripts/memory-conveyor.mjs" "${CLAUDE_PROJECT_DIR}/.claude/scripts/" 2>/dev/null && echo "refreshed local maintenance scripts" || echo "no local maintenance scripts yet (the org setup migration installs them)"`

3. Tell the user, in plain non-technical language, what changed and that they need to restart Claude Code for a new VERSION to fully take effect. Reassure them their saved settings were not touched.

(Note: if Part 1 just pulled a brand-new version, the very latest patterns and this command's own newest instructions only load after a restart. That's normal: re-run `/king-intelligence:update` after restarting to sync against the newest set.)

## Part 2: One-time setup migrations (run before the audit)

Some upgrades need a one-time setup of THIS repo (new conventions your existing files predate), not just a new skill. Gather what's outstanding in one shot:

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/migration.mjs" status "${CLAUDE_PLUGIN_ROOT}" "${CLAUDE_PROJECT_DIR}" "${CLAUDE_PLUGIN_DATA}"`

This prints the resolved `PLUGIN_ROOT` / `PROJECT_DIR` / `PLUGIN_DATA` paths (use these real paths in the brief's commands), the ledger, every shipped migration with its state (done / in-progress / absent), the outstanding ids in order, and the full brief for each outstanding one.

1. **If the outstanding list is empty, skip this part in one line** ("Your setup is fully migrated, nothing to set up.") and go to Part 3.
2. For each outstanding migration, in the printed order:
   - **If it is flagged `breaking=true`, STOP and get explicit go first:** explain in plain words what it changes and that it is bigger than the usual additive setup, and do not touch anything until the client clearly says go. Non-breaking migrations flow normally.
   - Give the client the **one plain-English heads-up** from the brief's "In plain words" section and ask once (yes / no / skip a part). This is the only consent gate; nothing in the repo changes before the yes.
   - **On yes:** follow the brief's "Apply" steps exactly, in order. The brief marks itself in-progress in the ledger BEFORE any edits and done only AFTER the receipt, and every step carries its own "already done?" check, so a stop-and-resume or a re-run never duplicates anything. Apply additively only; never overwrite a value or file the client already has.
   - **On no:** leave it. The ledger stays as-is and it is re-offered next `/king-intelligence:update`.
   - Show the brief's plain-English **receipt** of what changed.

**This part runs ONLY from `/king-intelligence:update`, never from the session-start auto-update.** The session-start auto-update applies newer TOOLS on its own (skills, commands) and tells you what landed, but it never edits this repo or anything you've set up yourself. So a migration, or any change to your own files, can only ever happen here, after you have explained it and the client has said yes.

## Part 3: Audit the setup, show what changed, let them pick

This is the part Josh asked for: instead of pulling quietly and leaving the client to hunt for what's new, it reads across their whole setup, tells them plainly what changed since they last synced, and lets them CHOOSE what to pull in. It never changes anything they've personalized.

Gather everything in one read-only shot. This inspects four things (their folders, their Claude Code config, their connections, their skills), works out what's new or changed since their last sync, and prints one JSON report:

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/audit.mjs" "${CLAUDE_PLUGIN_ROOT}" "${CLAUDE_PLUGIN_DATA}" "${CLAUDE_PROJECT_DIR}"`

The report has: `version` (installed vs last-synced), `changelog` (what shipped since), `pillars` (folders / config / connections / skills, all read-only), `rules` (unseen + changed operating rules), `actionable` (exactly what to offer), and `migrations.outstanding`. The config path to write to is `${CLAUDE_PLUGIN_DATA}/config.json`.

### 3a. Decide what's genuinely worth offering

1. **Read the client's own `CLAUDE.md` once** (`${CLAUDE_PROJECT_DIR}/CLAUDE.md`). For each rule in `actionable.rules` with `kind: "new"`, judge SEMANTICALLY whether the client already has it in ANY wording (they will have personalized things). If they already have an equivalent, treat it as already-adopted (add its id to the silent-adopt list in 3d) and DROP it from the offer. This stops you offering a duplicate of something they wrote themselves.
2. **Changed rules (`kind: "changed"`) stay in the offer.** These are rules they adopted before that Jacob has since improved; on a yes you add only the NEW parts (3c), never rewrite theirs.
3. **Migration-owned rules:** if `migrations.outstanding` still contains `v1-org-gotcha`, DROP `folder-org` and `gotcha-capture` from the offer (they need the machinery the Part 2 migration installs; Part 2 re-offers them). Never offer them piecemeal here.
4. What remains = the rules to offer, plus `actionable.connections` (a skill needs a connection they lack) and `actionable.duplicates` (a real local skill that duplicates a plugin one).

### 3b. Show what changed, then the pick list

First, in plain non-technical language, tell them what came in on its own from the pull, using `changelog`: "Since you last synced (vX to vY), Jacob shipped: ..." Make clear the new skills and fixes are already in place (Part 1's pull applied them). Keep it tight.

Then, if there is anything to offer (rules + connections + duplicates), ask with ONE `AskUserQuestion`, `multiSelect: true`, one option per offered item, plain English, no jargon, no em-dashes:
- a rule → label = the rule's plain title; description = its "what this is", plus "(adds a rule to your setup; never changes your own notes)".
- a connection gap → label = "Set up <server>"; description = the gap's `why`, plus "the new <skill> needs it."
- a duplicate → label = "Remove the duplicate <name>"; description = "You have your own copy of <name> that duplicates the one the plugin gives you. I'll archive yours, not delete it; the plugin one stays."

If there is NOTHING to offer, say so in one plain line ("You're fully current, nothing to decide"), show the brief read-only summary (3e), and stop. Do not nag.

### 3c. Apply what they picked (additive only, never overwrite)

- **A picked rule:** apply the rule file's own "Merge guidance" (the rule text + its merge note are in the plugin's `patterns/<id>.md`). For a `new` rule, append it as a new section to their `CLAUDE.md`. For a `changed` rule, read their existing version and add ONLY the sub-points the new version adds; never rewrite their wording. Confirm in one line what you added and where.
- **A picked connection:** run the install command from the gap's `install` field (for example `/king-intelligence:install-playwright`). If there is no install command, tell them in plain words what to set up.
- **A picked duplicate:** MOVE the local skill folder to `${CLAUDE_PROJECT_DIR}/.claude/skills/_archive-<YYYY-MM-DD>/<name>/` (archive, NEVER delete). Confirm it's archived and the plugin's version still works.

### 3d. Record state (safe writer, never hand-edit the JSON)

Use `patterns-record.mjs`, which touches ONLY the `patterns` key and deep-preserves the client's `skills` wiring and everything else:

`node "${CLAUDE_PLUGIN_ROOT}/scripts/patterns-record.mjs" "${CLAUDE_PLUGIN_DATA}/config.json" --adopt <ids: every rule they picked PLUS every rule you silently adopted in 3a> --decline <ids: rules you offered that they did NOT pick> --version <the installed version from the report>`

Recording the version updates `lastSyncedVersion`, so next time only genuinely-newer changes surface. Omit `--adopt`/`--decline` if that list is empty. Connections and duplicates are NOT patterns and are not recorded here.

### 3e. Receipt (always, plain English, nothing between the lines)

- **Came in on its own:** vX to vY, and the new skills/fixes from the changelog (one line).
- **You chose to add:** each picked rule and where it landed, each connection set up, each duplicate archived.
- **You passed on:** anything offered and declined (so they can change their mind next time).
- **I looked at but left alone:** a one-line read of the deep audit (folder health from `pillars.folders`, the connections they have from `pillars.connections.servers`, config status from `pillars.config`), and any duplicate that was just a display quirk rather than a real file.
- **Safety:** "Nothing of yours was overwritten. Your cloud backup is your undo."

## Pausing updates (rare)

If you ever want to stop updates for a while, run `claude plugin disable king-intelligence@king-intelligence` — that pauses the whole toolkit and its background updates. Turn it back on with `claude plugin enable king-intelligence@king-intelligence`. You shouldn't normally need this: if anything ever ships wrong, Jacob fixes it at the source and your setup quietly heals itself the next time you open Claude Code.

**Hard rules for Part 3:** never edit anything under the plugin code folder (`CLAUDE_PLUGIN_ROOT`). The only things you write are the client's own `CLAUDE.md` (additively, on a yes), their `config.json` (only via `patterns-record.mjs`), and the skill-archive MOVE (never a delete). Never overwrite a personalization. Mask any secret as `xxxx` if one appears. The audit is read-only; if any pillar comes back unavailable, say so plainly and continue. (If a Part 2 migration already adopted `gotcha-capture` or `folder-org`, they're already in `patterns.adopted` and the audit won't surface them.)
