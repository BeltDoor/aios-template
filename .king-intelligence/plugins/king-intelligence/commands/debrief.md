---
description: "Post-meeting debrief + action engine: pull the transcript, detect every signal, write the summary + follow-up email, log to your CRM, and triage every action into do-now / send / queued-prompt lanes. Type it after a meeting, or on a pasted thread."
argument-hint: "[contact-name] | 'this' for a pasted thread"
disable-model-invocation: true
allowed-tools: "*"
---

# debrief

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## This client's wiring (read live from the persistent data folder)

The block below prints THIS client's saved wiring. Read the `skills["debrief"]` block for `transcriptSource`, `crm`, `paymentsTool`, `calendarTool`, `emailTool`, `clientFolderConvention`, and `voiceGuidePath`.

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/print-config.mjs" "${CLAUDE_PLUGIN_DATA}/config.json"`

## Run the workflow

Read the full workflow at `${CLAUDE_PLUGIN_ROOT}/skills/debrief/SKILL.md` and execute it exactly, start to finish. Notes:

- Treat `$ARGUMENTS` as the contact name, or `this` / a path for a pasted thread.
- Use the wiring printed above — it is already loaded here, so ignore the duplicate config-read line inside that file.
- Any files it points to (e.g. `references/`, `templates/`) live under `${CLAUDE_PLUGIN_ROOT}/skills/debrief/` — read them by that absolute path.

Input: $ARGUMENTS
