# AGENTS.md: Codex's version of CLAUDE.md

What AGENTS.md is and how it differs from CLAUDE.md, so the generated brief is correct. Verified against the official AGENTS.md guide, the Codex config reference, and Anthropic's memory docs.

## What it is

`AGENTS.md` is Codex's persistent-instructions file, the equivalent of `CLAUDE.md`. It is an open, cross-tool standard (now under the Linux Foundation, read by ~28 tools). Codex reads it at the start of a session.

## The differences that matter when generating it

- **No `@import`.** This is the big one. CLAUDE.md can pull in other files with `@path`. AGENTS.md cannot; it only concatenates whole files found from the repo root down to the working directory. So an AGENTS.md must be **self-contained**: any rules a CLAUDE.md imports have to be inlined into the AGENTS.md. (This is exactly what the sync script does.)
- **Nested files.** Codex reads `AGENTS.md` in subfolders too, like per-folder CLAUDE.md files, concatenated root-to-cwd, closest wins.
- **Size.** Soft cap around 32 KB combined; aim for ~150 lines. Shorter reads better.
- **Override file.** `AGENTS.override.md` (global or per-dir) wins over `AGENTS.md` at that level, a temporary-override mechanism.

## The bridge: do not duplicate

Claude Code reads `CLAUDE.md`, not `AGENTS.md` (confirmed in Anthropic's own docs). To keep one repo serving both without two drifting copies, the official options are:

- **Import (recommended if you want Claude to read the same brief):** put `@AGENTS.md` at the top of `CLAUDE.md`.
- **Symlink:** `ln -s AGENTS.md CLAUDE.md` (one is a link to the other).

For a repo whose `CLAUDE.md` is already rich and Claude-specific (skills, plugins, its own imports), do NOT collapse them. Keep `CLAUDE.md` as the source of truth and **generate** `AGENTS.md` from the same underlying rule files via the sync script. That is the no-drift pattern this skill ships.

## What goes in the generated AGENTS.md

The parts of CLAUDE.md that must survive without the skill machinery: who the owner is, the voice rules, security rules, tool/cost guardrails, a project map, and the shared operating rules inlined. Leave out anything that only makes sense with Claude-only features. Stamp it "generated, do not hand-edit" and run an em-dash check if the repo bans them.
