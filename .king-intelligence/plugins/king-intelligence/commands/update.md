---
description: Pull Jacob's newer skills AND sync his latest ways of working into your setup. Proposes each missing piece for your yes; never overwrites what you've personalized.
argument-hint: [optional-scope]
disable-model-invocation: true
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Update the King Intelligence setup

Two parts: pull the latest shipped skills, then offer Jacob's newest operating patterns (his ways of working, and how he structures memory and references) into THIS client's own files. The client's saved wiring is never touched, and nothing about their setup changes without their yes.

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
2. Tell the user, in plain non-technical language, what changed and that they need to restart Claude Code for a new VERSION to fully take effect. Reassure them their saved settings were not touched.

(Note: if Part 1 just pulled a brand-new version, the very latest patterns and this command's own newest instructions only load after a restart. That's normal: re-run `/king-intelligence:update` after restarting to sync against the newest set.)

## Part 2: Sync Jacob's operating patterns into this client's setup

Gather everything in one shot. This prints the plugin version, the config path to write to, the client's current pattern state, every shipped pattern in full, which patterns are still unseen, and the paths to the client's own files:

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/patterns-context.mjs" "${CLAUDE_PLUGIN_ROOT}" "${CLAUDE_PLUGIN_DATA}" "${CLAUDE_PROJECT_DIR}"`

Then:

1. **If the unseen-ids list is empty, say so in one plain line and stop here** ("You're current on Jacob's ways of working, nothing new."). Do not nag.
2. For each **unseen** pattern (skip any id already in `adopted` or `declined`): read the client's own relevant files from the paths printed above (their `CLAUDE.md` for `claude-md-rule` patterns; their memory and references folders for `folder-structure` patterns). If a probed path comes back `missing`, do a quick search of the repo for an equivalent first (the client may keep their rules file or folders under a different name or location) before concluding they lack it. **Judge semantically whether the client already has this pattern in ANY wording**, since they will have personalized things. If they already have an equivalent, treat it as adopted (record it, see step 5) and do NOT offer a duplicate.
3. For each genuine GAP, propose it to the client **one at a time**, in plain non-technical language: use the pattern's "What this is" line to explain it, then show exactly what you would add (the rule text, or the folder/file you'd create). Ask a simple yes/no.
4. **On yes:** apply the pattern's own "Merge guidance." Additive ONLY:
   - `claude-md-rule` → append a new section to their `CLAUDE.md`. Never rewrite or delete their existing wording.
   - `folder-structure` / `file-template` → create the folder/template only if missing; if it exists, add just the missing convention and tell them. Never touch their actual saved content (their real memories, their real reference files).
   Confirm in one plain line what you added and where.
   **On no:** add the id to `declined` so it is never re-offered.
5. **Record state** in the config file at the printed `CONFIG_PATH`. Read the current config, and under a `patterns` key set `adopted` (ids the client said yes to OR already had) and `declined` (ids they said no to), and set `lastSyncedVersion` to the `PLUGIN_VERSION` printed at the top of the gather output. **Leave the `skills` wiring object and everything else in the config exactly as it was.** Run `mkdir -p` on the folder part of CONFIG_PATH first, then Write the merged JSON.
6. Close with a plain receipt: what you added, what they passed on, nothing between the lines.

**Hard rules for Part 2:** never edit anything under the plugin code folder (`CLAUDE_PLUGIN_ROOT`). The only files you write are the client's own CLAUDE.md / memory / references (additively, on a yes) and their `config.json` (only the `patterns` key). Never overwrite a personalization. Mask any secret as `xxxx` if one ever appears.
