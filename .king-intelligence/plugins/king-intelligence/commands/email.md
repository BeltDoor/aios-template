---
description: "Draft an email in your voice. Enforces your email voice rules (openers, sign-offs, banned phrases, structure by type) and runs a fabrication + anti-slop check before showing it. Never sends. Type it to draft an email."
argument-hint: "[recipient name or meeting context]"
disable-model-invocation: true
allowed-tools: Read, Bash, AskUserQuestion, Grep, Glob
---

# email

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## This client's wiring (read live from the persistent data folder)

The block below prints THIS client's saved wiring. Read the `skills["email"]` block for `voiceGuidePath`, `voiceDescription`, `signature`, `bannedPhrases`, and `emailTool`.

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/print-config.mjs" "${CLAUDE_PLUGIN_DATA}/config.json"`

## Run the workflow

Read the full workflow at `${CLAUDE_PLUGIN_ROOT}/skills/email/SKILL.md` and execute it exactly. Notes:

- Treat `$ARGUMENTS` as the recipient name or meeting context for the email.
- Use the wiring printed above — it is already loaded here, so ignore the duplicate config-read line inside that file.
- Any files it points to (e.g. `references/`) live under `${CLAUDE_PLUGIN_ROOT}/skills/email/` — read them by that absolute path.
- Never send. Draft only.

Input: $ARGUMENTS
