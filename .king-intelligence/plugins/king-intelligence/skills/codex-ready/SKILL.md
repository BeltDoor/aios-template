---
name: codex-ready
description: Make this Claude Code repo also run in OpenAI Codex (ChatGPT's coding agent), so the user can run both tools on the same repo or switch over. Use when the user says "can I use ChatGPT too", "set me up for Codex", "move me to ChatGPT", "make my repo work in Codex", "I want to try the other AI", "run this in ChatGPT", "do I need to pay for the $100 plan", or is weighing switching agents, even if they never say "codex-ready". Audits the whole repo, builds the Codex adapter (AGENTS.md, config, skills mirror, guard hooks) with a yes at every write, and coaches them through the switch in plain English.
---

# /codex-ready

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

Make a Claude Code repo run in OpenAI Codex too, without breaking anything in Claude Code. The principle is **same project knowledge, different adapter files**: Claude reads `CLAUDE.md` and `.claude/`, Codex reads `AGENTS.md` and `.codex/` plus `.agents/skills/`, and both read the same `knowledge/`, `references/`, and project files. Claude Code stays 100% intact. We add a Codex layer beside it.

This runs in three acts: **audit, build, coach.** The audit is always read-only and comes first. Every file write in the build is gated on the user's yes. The deep knowledge lives in `references/` (read them on demand); this file is the flow.

## Before you start

Confirm this is a Claude Code repo (it has a `CLAUDE.md` and a `.claude/` folder). If it does not, say so and stop, there is nothing to adapt. Skim [`references/agents-md-spec.md`](references/agents-md-spec.md) and [`references/dual-tool-structure.md`](references/dual-tool-structure.md) so you frame the work correctly.

## Act 1: Audit (read-only, always first)

Inventory the repo and classify each piece by how well it crosses to Codex. Use `find` / `ls` / `grep`, do not read every file.

- **CLAUDE.md files** (count them; note if the root uses `@import`, which AGENTS.md cannot do).
- **Skills** (`.claude/skills/*/SKILL.md`): same open standard Codex reads from `.agents/skills/`. Mostly portable.
- **Hooks** (`.claude/settings.json`, `.claude/hooks/`): Codex has hooks too, different format, convertible.
- **Subagents** (`.claude/agents/*.md`): Codex has subagents, different format (`.toml`), convertible.
- **MCP servers** (the user's MCP config): local ones re-register cleanly; hosted/claude.ai connectors map to Codex's own connectors.
- **Plugins**: Claude plugin bundles do not install in Codex, but the skills inside them do (via the mirror). Name the loss honestly.
- **Memory**: each tool keeps its own private memory; the shared brain is the in-repo `knowledge/` vault. See [`references/shared-memory.md`](references/shared-memory.md).

Produce a plain-English audit: what comes over cleanly, what is convertible, what stays Claude-only, and the headline. Classify the high-value skills dual-primary / partial / Claude-only using [`references/parity-method.md`](references/parity-method.md). Then show it and ask if they want to build the adapter. Do not write anything yet.

## Act 2: Build the adapter (gated, a yes at every write)

Work in this order. Confirm before each write. The how-to detail for each is in the references.

1. **`AGENTS.md`** at the repo root. Generate it from [`templates/AGENTS.preamble.template.md`](templates/AGENTS.preamble.template.md) filled in from the repo's own `CLAUDE.md` (their identity, voice, security, guardrails) plus their shared operating rules inlined, since AGENTS.md cannot `@import`. Keep it self-contained, ~150 lines, under 32 KB. Strip any preamble's own HTML comments and stamp a generated banner. Run an em-dash check if the repo bans them.
2. **Skills mirror.** Create `.agents/skills` as a symlink to `.claude/skills` (never a copy, skill folders can be large). Make sure `.agents/` is gitignored as a regenerable mirror. Drop in [`templates/sync-codex-adapter.template.mjs`](templates/sync-codex-adapter.template.mjs) as the repo's sync script and wire it into their session-close ritual if they have one, so the adapter never drifts.
3. **`.codex/config.toml`** (project-scoped, committed). Detect the user's local MCP servers and declare them with the exact syntax in [`references/config-and-hooks-recipes.md`](references/config-and-hooks-recipes.md). Never write the global `~/.codex/config.toml`, it is partly app-managed; the repo config is the safe place.
4. **`.codex/hooks.json`.** Port their guard hooks (cost guards, content guards) to Codex's hook format per [`references/config-and-hooks-recipes.md`](references/config-and-hooks-recipes.md). Tell them plainly that Codex's blocking is a softer guardrail than Claude's, so back it up with the instruction in AGENTS.md.
5. **Connectors.** Hand them [`references/connectors-map.md`](references/connectors-map.md): their hosted services (mail, calendar, drive, billing, deploys) mapped to Codex's own first-party connectors, with how to switch each on.

Verify the build: run the sync script and confirm it reports the skills mirror and AGENTS.md in sync; confirm `.agents/skills/<some-skill>/SKILL.md` resolves through the symlink.

## Act 3: Coach and hand off

Now the plain-English part, the reason a non-technical owner will actually switch. Walk them through:

- **Install + sign in.** The Codex VS Code extension (`openai.chatgpt`) and the `codex` terminal command (`npm i -g @openai/codex`), signed in with their ChatGPT account.
- **Which plan.** The $20 vs $100 call, grounded in [`references/pricing-and-plans.md`](references/pricing-and-plans.md). The short version: $20 already includes the top model; $100 only buys more usage.
- **What works, what is lost.** Their parity ledger from Act 1, so they know which tool to reach for.
- **Staying in sync.** `CLAUDE.md` and `.claude/` stay the source of truth; running the sync script keeps the Codex side current. Both tools can be primary; neither breaks the other.

## What stays Claude-only (say it straight)

Do not oversell parity. The honest gaps: Claude plugin bundles (the capability transfers through the skills mirror, the bundle does not), a single shared private memory across both tools (use the in-repo brain instead), deep Claude-Code-only frameworks, and a few hosted services that have no Codex connector yet (fall back to their CLIs/APIs). Detail in [`references/dual-tool-structure.md`](references/dual-tool-structure.md).

## References

- [`references/pricing-and-plans.md`](references/pricing-and-plans.md): $20 vs $100, models, limits, API vs subscription.
- [`references/agents-md-spec.md`](references/agents-md-spec.md): what AGENTS.md is, no-import rule, the CLAUDE.md bridge.
- [`references/dual-tool-structure.md`](references/dual-tool-structure.md): the three-layer adapter model, the conversion prompt, the hard ceilings.
- [`references/connectors-map.md`](references/connectors-map.md): hosted services to Codex connectors.
- [`references/config-and-hooks-recipes.md`](references/config-and-hooks-recipes.md): exact `.codex/config.toml` and `.codex/hooks.json` syntax.
- [`references/parity-method.md`](references/parity-method.md): how to classify a skill dual-primary / partial / Claude-only.
- [`references/shared-memory.md`](references/shared-memory.md): one in-repo brain both tools share, made to not fall over.
- [`references/gotchas.md`](references/gotchas.md): the traps learned building this the first time.
- [`templates/`](templates/): the generic AGENTS.md preamble and the sync script.
