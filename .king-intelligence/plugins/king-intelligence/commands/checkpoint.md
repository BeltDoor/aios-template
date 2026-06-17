---
description: "Mid-flow session save: write down what was learned, update project notes, commit + push, and drop an insurance prompt — all without closing the session. Type it when you want a real save but are not done working."
disable-model-invocation: true
argument-hint: "[checkpoint note]"
allowed-tools: Read, Write, Bash, Grep, Glob
---

# checkpoint

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

Read the full workflow at `${CLAUDE_PLUGIN_ROOT}/skills/checkpoint/SKILL.md` and execute it exactly. Any sub-files the skill references live under `${CLAUDE_PLUGIN_ROOT}/skills/checkpoint/`. Treat `$ARGUMENTS` as an optional note about what this checkpoint is for (used in the commit message summary and the RESUME briefing).

$ARGUMENTS
