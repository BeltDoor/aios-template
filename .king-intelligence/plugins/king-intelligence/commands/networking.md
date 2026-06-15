---
description: "Fill your calendar with tentative networking-event holds for the next ~60 days: your recurring anchors plus fresh local finds inside your travel radius, previewed inline first then added. Type it to refresh your networking calendar."
argument-hint: "[optional: '30 days' | '90 days' | 'AI only' | 'buyers only']"
disable-model-invocation: true
allowed-tools: Read, Bash, WebSearch, WebFetch
---

# networking

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## This client's wiring (read live from the persistent data folder)

The block below prints THIS client's saved wiring. Read the `skills["networking"]` block for `city`, `radius`, `calendarTool`, `selfEmail`, `recurringAnchors`, and `eventSources`.

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/print-config.mjs" "${CLAUDE_PLUGIN_DATA}/config.json"`

## Run the workflow

Read the full workflow at `${CLAUDE_PLUGIN_ROOT}/skills/networking/SKILL.md` and execute it exactly. Notes:

- Treat `$ARGUMENTS` as an optional scope (e.g. a time window or audience filter).
- Use the wiring printed above — it is already loaded here, so ignore the duplicate config-read line inside that file.
- Any files it points to (e.g. `references/`, `scripts/`) live under `${CLAUDE_PLUGIN_ROOT}/skills/networking/` — read or run them by that absolute path.

Input: $ARGUMENTS
