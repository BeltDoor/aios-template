---
description: "Post-meeting debrief + action engine: pull the transcript, detect every signal, write the summary + follow-up email, log to your CRM, and triage every action into do-now / send / queued-prompt lanes. Type it after a meeting, or on a pasted thread."
disable-model-invocation: true
argument-hint: "[contact-name] | 'this' for a pasted thread"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, mcp__claude_ai_Gmail__*, mcp__claude_ai_Google_Calendar__*, mcp__blotato__*, mcp__n8n__*, mcp__perplexity__perplexity_search, mcp__claude_ai_Otter_ai__*, mcp__claude_ai_Zoom_for_Claude__*, mcp__supabase__*, WebFetch, WebSearch, SendMessage
---

# debrief

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

Read the full workflow at `${CLAUDE_PLUGIN_ROOT}/skills/debrief/SKILL.md` and execute it exactly. Any sub-files it references live under `${CLAUDE_PLUGIN_ROOT}/skills/debrief/`.

$ARGUMENTS
