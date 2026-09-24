---
description: Turn the "ask me with buttons" behavior on, off, or check its status. Use when the person says things like "stop the question buttons", "turn the buttons back on", "stop asking me with options", or asks whether it is on.
argument-hint: [on|off|status]
allowed-tools: Bash
---

# Question buttons

Every question this toolkit asks normally comes as clickable options instead of a typed question. This command turns that on, off, or reports which it is right now.

## Decide which one to run

- Person wants it OFF ("stop the question buttons", "stop asking me with options", "turn it off") -> run the `off` line below.
- Person wants it back ON ("turn the buttons back on", "turn it on") -> run the `on` line below.
- Person is asking whether it is on, or it is unclear which they want -> run the `status` line below, then ask with `AskUserQuestion` if a change is wanted.

## Run it

These are reference text, not auto-run: pick the ONE line that matches what the person asked for and run it yourself with the Bash tool. Each tries the copy in this folder first, then the toolkit's own data folder, then the toolkit folder this window opened on, so it works even right after an update.

**off:**

```
node "${CLAUDE_PROJECT_DIR}/.claude/scripts/ki-run.mjs" ask-question-gate.mjs off 2>/dev/null || node "${CLAUDE_PLUGIN_DATA}/scripts/ki-run.mjs" ask-question-gate.mjs off 2>/dev/null || node "${CLAUDE_PLUGIN_ROOT}/scripts/ki-run.mjs" ask-question-gate.mjs off 2>&1 || echo "KI_STEP_FAILED: no copy of the runner could be found in this folder, in the toolkit data folder, or in the toolkit folder this window opened on"
```

**on:**

```
node "${CLAUDE_PROJECT_DIR}/.claude/scripts/ki-run.mjs" ask-question-gate.mjs on 2>/dev/null || node "${CLAUDE_PLUGIN_DATA}/scripts/ki-run.mjs" ask-question-gate.mjs on 2>/dev/null || node "${CLAUDE_PLUGIN_ROOT}/scripts/ki-run.mjs" ask-question-gate.mjs on 2>&1 || echo "KI_STEP_FAILED: no copy of the runner could be found in this folder, in the toolkit data folder, or in the toolkit folder this window opened on"
```

**status:**

```
node "${CLAUDE_PROJECT_DIR}/.claude/scripts/ki-run.mjs" ask-question-gate.mjs status 2>/dev/null || node "${CLAUDE_PLUGIN_DATA}/scripts/ki-run.mjs" ask-question-gate.mjs status 2>/dev/null || node "${CLAUDE_PLUGIN_ROOT}/scripts/ki-run.mjs" ask-question-gate.mjs status 2>&1 || echo "KI_STEP_FAILED: no copy of the runner could be found in this folder, in the toolkit data folder, or in the toolkit folder this window opened on"
```

If the output starts with `KI_STEP_FAILED`, say in plain words that the toolkit updated itself while this window was open and nothing is wrong, then ask them to reload and try again.

Otherwise, confirm what happened in one plain sentence (for example: "Question buttons are off now. Say the word any time to turn them back on."). No jargon, no dates, no em dashes.
