# Gotchas (traps learned building this the first time)

Hard-won lessons from the first real migration. Each one cost a step to discover; do not re-discover them.

- **Mirror skills with a symlink, never a copy.** A skills folder can be tens of megabytes (assets, references). Copying doubles the repo and creates a sync chore. `ln -s ../.claude/skills .agents/skills` gives Codex the exact same files with zero duplication. The `.agents/` mirror should be gitignored as regenerable; many repos already have that line.

- **Do not touch the global `~/.codex/config.toml`.** It is partly managed by the Codex app (computer-use, bundled plugins, desktop settings). Put all repo work in the project's `.codex/config.toml`. Writing the global file risks breaking the app's own setup.

- **Never put secrets in `.codex/config.toml`.** It gets committed. Forward API keys from the shell with `env_vars = ["KEY_NAME"]`, and first confirm the key is actually exported in the user's shell profile, or the forward finds nothing.

- **Existing Claude guard hooks usually port as-is.** Codex passes the same flattened stdin JSON (`tool_name`, `tool_input.command` at the root), uses the same `mcp__server__tool` naming, and treats exit code 2 as a block. So point `.codex/hooks.json` at the same `.claude/hooks/*` scripts rather than rewriting them. Test by piping a sample JSON payload to the script and checking the exit code.

- **Codex tool-blocking is a softer guardrail.** Its shell interception is incomplete (pipes, heredocs, subshells may slip through), web search is not hookable at all, and a hook that errors fails OPEN (allows). So state every cost/safety rule in prose in AGENTS.md too; do not rely on the hook alone.

- **The project must be trusted** before Codex loads its `.codex/` layer (config, hooks, rules). The first-open prompt writes the trust entry; run `/hooks` once to trust project hooks specifically. "My hook is not firing" is usually an untrusted project.

- **Strip a preamble's own maintainer comments when generating AGENTS.md,** and stamp a single "generated, do not hand-edit" banner. Otherwise the preamble's internal notes leak into the published brief.

- **Run an em-dash (and house-style) check on the generated AGENTS.md** if the repo bans them. Generation can reintroduce punctuation the repo forbids.

- **Verify connector recipes live before quoting them.** Codex connectors move fast and third-party guides hallucinate package names (a fake `npx @github/github-mcp-server` was caught this way). Confirm the plugin name or MCP URL against the official page in the same session.

- **Install the CLI with `npm i -g @openai/codex`;** check sign-in with `codex login status`; list servers with `codex mcp list`. The CLI and the VS Code extension share `~/.codex/config.toml`, so configure once.
