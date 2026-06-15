---
description: "Build a dense, paste-ready briefing for the next Claude window (real paths, IDs, kill-switches, an ordered phase map) and save a backup copy. No doc writes, no commits. Type it when your window is filling up and you need to carry the work forward."
argument-hint: "[next-session focus]"
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Grep, Glob
---

# handoff

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

Read the full workflow at `${CLAUDE_PLUGIN_ROOT}/skills/handoff/SKILL.md` and execute it exactly. Treat `$ARGUMENTS` as the optional focus for what the next session should pick up. Any files it points to (e.g. `templates/`) live under `${CLAUDE_PLUGIN_ROOT}/skills/handoff/` — read them by that absolute path.

Input: $ARGUMENTS
