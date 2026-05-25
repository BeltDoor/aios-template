#!/usr/bin/env node
// perplexity-guard.js
// PreToolUse hook on mcp__perplexity__perplexity_research and mcp__perplexity__perplexity_reason.
// BLOCKS both outright. They route to sonar-deep-research / sonar-reasoning-pro, which can
// run $0.30-$1.00 per call. perplexity_research with reasoning_effort=high burned $15.99
// across 26 calls in 24h on 2026-05-13.
//
// Installed: 2026-05-13 (lifted into AIOS template 2026-05-24)
//
// Rule (applies to Jacob AND to AIOS clients we set up with Perplexity):
//   - perplexity_research  -> BANNED
//   - perplexity_reason    -> BANNED
//   - perplexity_ask       -> rarely (not hooked — judgment call documented in references/perplexity-api.md)
//   - perplexity_search    -> default ($0.005 flat per call, /search endpoint)
//
// ROLLBACK (any of these fully disables this hook):
//   1. Remove the entry in .claude/settings.json under hooks.PreToolUse that references this file
//   2. Or: rm .claude/hooks/perplexity-guard.js
//   3. Or: set env var DISABLE_PERPLEXITY_GUARD=1 to bypass without removing
//
// How it works:
//   - Claude Code sends a JSON payload via stdin: { tool_name, tool_input, ... }
//   - We check if tool_name matches a banned Perplexity tool
//   - On hit: exit 2 (blocks the tool call, stderr surfaces to the model)
//   - Otherwise: exit 0

const BANNED_TOOLS = new Set([
  'mcp__perplexity__perplexity_research',
  'mcp__perplexity__perplexity_reason',
]);

const ALT_GUIDANCE =
  'Use mcp__perplexity__perplexity_search instead ($0.005/call flat, /search endpoint). ' +
  'If you genuinely need an LLM-synthesized answer with citations, use mcp__perplexity__perplexity_ask ' +
  '(sonar-pro, ~$0.02-$0.05/call) — but only when search results alone are insufficient. ' +
  'For deep multi-source research, do multiple perplexity_search calls and synthesize yourself.';

if (process.env.DISABLE_PERPLEXITY_GUARD === '1') {
  process.exit(0);
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(input || '{}');
  } catch (e) {
    process.exit(0);
  }

  const tool = payload.tool_name;
  if (!BANNED_TOOLS.has(tool)) {
    process.exit(0);
  }

  const shortName = tool.replace('mcp__perplexity__', '');
  const modelHit = shortName === 'perplexity_research' ? 'sonar-deep-research' : 'sonar-reasoning-pro';
  const msg =
    `BLOCKED: ${shortName} is banned per Jacob's 2026-05-13 rule. ` +
    `It routes to ${modelHit} on /chat/completions and can run $0.30-$1.00/call. ` +
    ALT_GUIDANCE;

  process.stderr.write(msg + '\n');
  process.exit(2);
});
