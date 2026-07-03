# Classifying skills: dual-primary, partial, or Claude-only

How the audit decides whether each of a repo's skills will work in Codex. Read each skill's `SKILL.md` and judge it by its dependencies, not its name.

## The three buckets

- **dual-primary:** self-contained. Reads/writes files, runs plain shell, drafts text, or uses tools Codex also has (its own MCP servers, web fetch). No Claude-only machinery. Works the same in both tools.
- **partial:** works but degraded. Leans on one thing Codex has a weaker or different version of, usually a claude.ai-hosted MCP (swap for Codex's own connector), the `gws` or another CLI, or light chaining to one other skill.
- **claude-only:** depends on Claude-Code-only machinery. It will partly fire in Codex and stall. Keep it in Claude Code.

## The Claude-only tells (look for these in the SKILL.md)

- **Chains other skills via the Skill tool** ("run /stop-slop", "calls /email", "invoke /speaker-id").
- **Spawns subagents via the Agent/Task tool** (parallel fan-out, "spawn a subagent", judge passes).
- **Writes or reads the Claude auto-memory system** (the per-project memory the tool manages itself).
- **Depends on a plugin** (a King Intelligence / Telegram / Pocock bundle, or `claude plugin` CLI).
- **Uses a claude.ai-hosted MCP with no Codex equivalent**, or Claude-only tools like TodoWrite.
- **Is a session ritual** wired into the tool's own lifecycle (begin/end session, checkpoint).

## The rule of thumb

If the skill's value is in **orchestrating other skills or the owner's memory**, it is Claude-best. If it is a **single self-contained job**, it is dual-primary. Anything in between, leaning on one hosted tool or CLI, is partial.

## Output

A table or short list: skill, verdict, the one dependency that pins it. That becomes the owner's parity ledger, the map of which tool to reach for. Run it again any time the skill set changes.
