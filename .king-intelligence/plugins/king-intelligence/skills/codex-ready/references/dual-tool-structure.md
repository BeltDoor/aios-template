# The dual-tool structure (and the honest ceilings)

How one repo serves both Claude Code and OpenAI Codex at full power. The principle is **same project knowledge, different adapter files.** Demonstrated in the community walkthrough "How to Use Your Claude Code Projects in Codex in 5 Mins" and confirmed against official docs.

## The three layers

| Layer | Claude Code | Codex | Rule |
|---|---|---|---|
| Shared knowledge | `knowledge/`, `references/`, project docs | the same files | Read by both. Never duplicate. |
| Workflows (skills) | `.claude/skills/` | `.agents/skills/` | Same `SKILL.md` open standard. Mirror with a symlink, never copy. |
| Tool config | `.claude/` (`settings.json`, `agents/*.md`) | `.codex/` (`config.toml`, `agents/*.toml`) + `AGENTS.md` | Different formats. Convert per tool, do not merge. |

Claude Code stays completely intact. The Codex layer sits beside it. Either tool can be primary.

## What Codex has (more than you would guess)

Codex now has its own skills (same `.agents/skills/` open standard, originally Anthropic's), MCP, hooks, subagents, memory, and a large library of first-party connectors. So most of a repo crosses over.

## The conversion shortcut

You can hand Codex this prompt and let it draft its own adapter, then review:

> I built this project in Claude Code and want it to also work well in Codex. Inspect the project and create a Codex adapter: create AGENTS.md at the root using CLAUDE.md as the source of knowledge (do not duplicate long sections, explain it is the Codex adapter, include a project map); create .codex/config.toml (minimal, no secrets); set up .agents/skills mirroring the important skills from .claude/skills; create .codex/agents for any important Claude agents (Claude agents are .md, Codex agents are .toml, convert the instructions); update .gitignore for local overrides and secrets. Show me the files before writing.

## The honest ceilings (state these plainly)

- **Plugin bundles do not transfer.** A Claude plugin is an install bundle Codex cannot install. But the skills inside it do transfer through the mirror, so the capability survives even though the wrapper does not.
- **No single shared private memory.** Each tool keeps its own memory store. The fix is one in-repo markdown brain both read and write; see [`shared-memory.md`](shared-memory.md).
- **Deep single-tool frameworks** (project-management systems built entirely on one tool's hooks/commands/agents) are not worth converting. Leave them where they are.
- **A few services** may have no Codex connector yet; fall back to their CLI/API.
- **Guard hooks are softer in Codex.** Its tool-blocking is a guardrail, not a hard boundary, so back guards with prose in AGENTS.md.

Plan on roughly 90% functional parity. The thing that makes it last is not drifting, which is why the sync script is the centerpiece, not an afterthought.
