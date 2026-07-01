# Codex config.toml and hooks.json recipes (verified)

Exact syntax for wiring a repo's tools and guards into Codex. Verified against `developers.openai.com/codex/config-reference` and `developers.openai.com/codex/hooks`. An adversarial pass corrected the precedence order and the hook block-shapes; the corrected versions are below.

## Where config lives, and the trust gate

- **Project config:** `<repo>/.codex/config.toml`. Commit it. Loads ONLY when the project is trusted.
- **Global config:** `~/.codex/config.toml`. Personal, partly app-managed (computer-use, bundled plugins). Do NOT hand-write or commit it; never clobber it.
- **Trust** is recorded in global config as `[projects."/abs/path"] trust_level = "trusted"`, written when you first open the repo and confirm trust. Until trusted, Codex ignores the whole project `.codex/` layer (config, hooks, rules).
- Precedence, high to low: managed requirements > managed defaults > CLI `-c` flags > project `.codex/config.toml` > profile > user `~/.codex/config.toml` > system `/etc/codex` > built-in. Project config cannot override security/identity keys (`model_provider`, `notify`, `profiles`, etc.); Codex ignores those in project config and warns.

## MCP servers in config.toml

**Local (stdio) server:**
```toml
[mcp_servers.perplexity]
command = "npx"
args = ["-y", "@perplexity-ai/mcp-server"]
env_vars = ["PERPLEXITY_API_KEY"]   # forward a secret from the shell, never write the value here
# enabled = true / required = false / startup_timeout_sec = 10 / tool_timeout_sec = 60  (all optional)

[mcp_servers.n8n.env]                # literal NON-secret values go in an env sub-table
MCP_MODE = "stdio"
```

- `env` (sub-table) = literal name="value" pairs. Non-secrets only.
- `env_vars` (array of names) = forward those vars from Codex's own shell environment. **This is how you keep API keys out of the committed file.** Confirm the keys are exported in the user's shell (`~/.zshrc` etc.) first.

**Remote (HTTP) server:**
```toml
[mcp_servers.vercel]
url = "https://mcp.vercel.com"
bearer_token_env_var = "VERCEL_TOKEN"   # optional; Codex sends Authorization: Bearer <value>
```
Or via CLI: `codex mcp add vercel --url https://mcp.vercel.com`. List with `codex mcp list`.

## Hooks in hooks.json

- **Project hooks:** `<repo>/.codex/hooks.json` (or inline `[hooks]` in config.toml, never both in one layer). Loads only when the project is trusted; run `/hooks` once in the Codex CLI to trust them.
- **Events:** `SessionStart`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `UserPromptSubmit`, `Stop`, `SubagentStart/Stop`, `PreCompact/PostCompact`.
- **Stdin to a command hook:** one JSON object, snake_case, fields at the ROOT (no `payload` wrapper): `tool_name`, `tool_input` (e.g. `tool_input.command` for Bash), `cwd`, `session_id`, etc. This matches Claude Code's shape closely enough that **most existing Claude guard scripts that read `tool_name` and `tool_input.command` and exit 2 to block work in Codex unchanged.**
- **MCP tool names:** `mcp__<server>__<tool>` (same as Claude). The `matcher` field is a regex, e.g. `mcp__perplexity__perplexity_(reason|research)`. Bash is matched as `^Bash$`.
- **How to block:** simplest is **exit code 2 + reason on stderr** (works on PreToolUse). Or print a JSON deny on stdout and exit 0. The deny SHAPE differs by event:
  - PreToolUse: `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"..."}}`
  - PermissionRequest: `{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"deny","message":"..."}}}`

**Reusing existing Claude guards (the clean move):** point the hook at the same script the repo already uses.
```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "mcp__perplexity__perplexity_(reason|research)",
        "hooks": [{ "type": "command", "command": "node \"$(git rev-parse --show-toplevel)/.claude/hooks/perplexity-guard.js\"", "timeout": 10 }] },
      { "matcher": "^Bash$",
        "hooks": [{ "type": "command", "command": "node \"$(git rev-parse --show-toplevel)/.claude/hooks/email-blacklist-guard.js\"", "timeout": 10 }] }
    ]
  }
}
```

## Honest reliability caveats (tell the user)

Codex's own docs say so: tool-blocking is a guardrail, not a hard boundary. Shell interception is incomplete (pipes, subshells, heredocs may not fire PreToolUse). WebSearch is not hookable at all. Only `type:"command"` handlers run (`prompt`/`agent` are skipped, `async:true` is skipped entirely). And a hook that errors with empty stdout and exit 0 fails OPEN (allows). So back every guard up with the same rule stated in prose in AGENTS.md, do not rely on the hook alone for anything that costs money or sends mail.
