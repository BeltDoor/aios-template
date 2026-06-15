---
description: Turn any raw input (an idea, story, topic, transcript chunk, half-formed thought) into one finished, on-voice social post using Hormozi's Hook/Retain/Reward framework, cleaned of AI tells before it's shown. Type it to run on whatever you paste.
argument-hint: "[raw idea, story, topic, or pasted text]"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, AskUserQuestion, Skill
---

# content-unit

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## This client's voice wiring (read live from the persistent data folder)

The block below prints THIS client's saved wiring. Read the `skills["content-unit"]` block for `voiceProfilePath`, `voiceDescription`, and `defaultPlatform`.

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/print-config.mjs" "${CLAUDE_PLUGIN_DATA}/config.json"`

## Run the workflow

Read the full content-unit workflow at `${CLAUDE_PLUGIN_ROOT}/skills/content-unit/SKILL.md` and execute it exactly, start to finish. Notes:

- Treat everything in `$ARGUMENTS` as the raw input to shape into one content unit.
- Use the voice wiring printed above — it is already loaded here, so ignore the duplicate config-read line inside that file.
- The workflow points to supporting files as `references/...`; read them at `${CLAUDE_PLUGIN_ROOT}/skills/content-unit/references/` (e.g. `${CLAUDE_PLUGIN_ROOT}/skills/content-unit/references/hook.md`).
- Never skip the Phase 7 anti-slop gate before showing the user anything.

Input: $ARGUMENTS
