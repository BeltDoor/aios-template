<!-- TEMPLATE. The codex-ready skill fills the {{PLACEHOLDERS}} from the repo's own CLAUDE.md, -->
<!-- then the sync script appends the shared operating rules below it and writes AGENTS.md. -->
<!-- Keep the result self-contained (AGENTS.md cannot @import), ~150 lines, under 32 KB. -->

# AGENTS.md ({{TOOL_OR_BUSINESS_NAME}} operating brief, for OpenAI Codex)

**This file is GENERATED. Do not hand-edit it.** Edit the preamble source or the rule files, then run the sync script. The canonical, fuller instructions live in `CLAUDE.md`; this is its Codex adapter.

**What this repo is:** {{ONE_PARAGRAPH_ON_WHAT_THE_REPO_IS_FOR: pulled from the top of CLAUDE.md. If it is a business hub rather than a software project, say so plainly, and say that operating the business is the job, not writing code.}}

## Who the owner is, and how to work with them

{{WHO_THE_OWNER_IS: role, technical level, how they want to be talked to. Pull from CLAUDE.md. If they are non-technical, say: plain language, no jargon, lead with the answer and the decision.}}

## Voice (hard rules)

{{VOICE_RULES: pull the hard ones from CLAUDE.md / the voice profile: tone, banned punctuation (e.g. no em-dashes), lead-with-the-answer, how to surface a real decision. Keep only the rules that must survive without the skill machinery.}}

## Before real work: read the brain

Before any real work that touches a known person, company, project, or past decision, read the relevant note(s) in the repo's knowledge base first ({{KNOWLEDGE_PATH, e.g. knowledge/}}). It is the shared long-term memory both Claude Code and Codex read. For live data (today's inbox, a balance, who paid), use the live tools, not the saved notes.

## Skills

This repo's skills live in `.agents/skills/` (a regenerated mirror of `.claude/skills/`, the master). Codex discovers and can run them. Self-contained skills work well. Skills that chain other skills, spawn subagents, or lean on plugins or the Claude memory system are Claude-Code-best; under Codex, do that work directly and carefully rather than assuming the full chain fires.

## Security

{{SECURITY_RULES: pull from CLAUDE.md: secrets handling, what must never be committed, what must never be public, credential masking. These are bright lines, keep them.}}

## Tooling and cost guardrails

{{TOOL_GUARDRAILS: pull any metered-tool bans/caps and tool-isolation rules from CLAUDE.md (e.g. which research calls are banned for cost, which browser profile to use for what). Money and outward actions: confirm before anything goes out or is hard to undo.}}

## Folder map and timestamps

- The live folder map is {{FOLDER_MAP_PATH}}. Read a folder's own `CLAUDE.md` before working in it.
- {{TIMESTAMP_RULE: the repo's convention for stamping new files, if it has one.}}

## Effort and delegation

Codex has a reasoning-effort setting (low / medium / high). Default low for routine work, raise for real builds, high only for genuinely hard problems, then drop back. Farm grunt work (file sweeps, web reading, bulk processing) to subagents to keep the main context clean.

---

## Universal operating rules

These are the behavioral spine, shared with Claude Code (the same source files `CLAUDE.md` imports). The sync script appends them below this line, so do not paste them here.
