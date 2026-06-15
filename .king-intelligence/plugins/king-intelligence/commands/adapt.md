---
description: Wire a King Intelligence skill to THIS client's own tools by writing per-client config to the plugin data folder. Never edits skill files.
argument-hint: [skill-name]
disable-model-invocation: true
allowed-tools: Bash, Read, Write, Glob, Grep
---

# Adapt a skill to this client

You are wiring a generic King Intelligence skill to THIS client's specific tools. You write CONFIG only. You NEVER edit any file under the plugin code folder (`CLAUDE_PLUGIN_ROOT`) — those are the shipped skills and they are overwritten on the next update. The only file you ever write is this client's config in the data folder.

Skill the user wants to wire: **$ARGUMENTS**

## Environment, current wiring, and every skill's swap-points

The block below runs first. It prints the absolute config path you must write to, this client's current saved wiring (if any), and the swap-point manifest for every shipped skill.

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/adapt-context.mjs" "${CLAUDE_PLUGIN_ROOT}" "${CLAUDE_PLUGIN_DATA}"`

## Steps

1. From the output above, find the swap-point manifest whose `skill` matches **$ARGUMENTS**. If nothing matches, list the available skill names and ask the user which they meant. Stop until resolved.
2. Ask the user ONE question at a time, in plain language, for each swap-point, using its `prompt`. For non-required points that have a `default`, offer the default. Skip non-required points the user clearly does not need.
3. Take the CURRENT CONFIG object exactly as printed. Merge the user's answers under `skills["<skill>"]`, leaving every OTHER skill's wiring untouched. Set top-level `"_status": "CONFIGURED"`. If `"client"` is null, ask for a short label for who this client is and set it.
4. Ensure the data folder exists, then save the merged JSON to the printed CONFIG_PATH. This is the ONLY file you write.
   - Run `mkdir -p` on the folder part of CONFIG_PATH via Bash, then use Write to save the JSON to CONFIG_PATH.
5. Confirm, in plain non-technical language, exactly what got wired for this skill. Mask any secret (token/key/password) as `xxxx` when you echo it back — never print a secret in full.
