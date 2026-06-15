---
name: example-adapt-demo
description: Demonstration skill that proves the King Intelligence adapt/config wiring works end to end. Reading it shows whether this client has been wired and reports their saved settings. Safe to keep or delete; it touches nothing real.
disable-model-invocation: true
allowed-tools: Bash, Read
---

# Example: prove the adapt/config wiring

This skill exists only to prove that a generic shipped skill can read THIS client's personalized wiring at runtime. If it reports your saved values correctly, the whole King Intelligence adapt/update machine works.

## This client's wiring (read live from the persistent data folder)

The block below runs in the shell before you read this skill. `${CLAUDE_PLUGIN_DATA}` expands to this client's persistent data folder, which survives plugin updates. The JSON is THIS client's own saved wiring, not anything shipped in the plugin, and it is never overwritten by `/king-intelligence:update`.

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/print-config.mjs" "${CLAUDE_PLUGIN_DATA}/config.json"`

## What to do

1. If the JSON above shows `"_status":"NOT_CONFIGURED"` (or has no `skills["example-adapt-demo"]`), tell the user, in plain language, to run `/king-intelligence:adapt example-adapt-demo` first, then stop.
2. Otherwise read `skills["example-adapt-demo"]` from the JSON and report the saved values back in plain language (for example: "You're wired as **<displayName>**, favorite tool **<favoriteTool>**.").
3. State plainly that this confirms the wiring works: a generic skill that everyone shares just read settings unique to this client, from a folder that updates never touch.
