# Auto-memory smoke test — VERIFIED

created: 05/24/26 - 19:57 EDT

Per REBUILD-PLAN.md item P7. Per Concern 5 (resolved). Confirms Anthropic auto-memory works on a fresh-clone Snowball on the target OS before any client hits it.

## Result

**PASS.** Cross-session recall works on Windows for a fresh Snowball clone. No quirks discovered. v1.0 ships with auto-memory as the persistence layer; no further work for v1.0.

## What was tested

| Field | Value |
|---|---|
| Sandbox path | `C:\Users\kings\aios-smoke\` |
| OS | Windows 11 Home 10.0.26200 |
| Source | Copied from `king-intelligence/ai-operating-system/snowball/` (the v1.0 template content) |
| Auto-memory path (project-keyed) | `C:\Users\kings\.claude\projects\c--Users-kings-aios-smoke\memory\` |
| Test memory | "remember that my test color is teal" |
| Recall prompt (after restart) | "what is my test color?" |
| Recall answer | "teal" (correct) |
| Time from sandbox open → first memory file on disk | ~1 minute |

## What happened mechanically

1. Sandbox folder copied — 6 skills, settings.json, all 5 folders, all 7 root files present.
2. Jacob opened VS Code at `C:\Users\kings\aios-smoke\`, started a fresh Claude Code chat (Session 1, jsonl id `8745ff58…`).
3. Sent: `remember that my test color is teal`.
4. The harness-injected `# auto memory` block on Session 1 was keyed to the sandbox CWD (`c--Users-kings-aios-smoke`). Claude wrote two files:
   - `C:\Users\kings\.claude\projects\c--Users-kings-aios-smoke\memory\test_color.md` — full memory entry with frontmatter (type: user, originSessionId on Session 1).
   - `C:\Users\kings\.claude\projects\c--Users-kings-aios-smoke\memory\MEMORY.md` — index pointing at `test_color.md`.
5. Jacob fully closed the VS Code window, reopened the same sandbox path, started a fresh chat (Session 2, jsonl id `fd444929…`).
6. Sent: `what is my test color?`.
7. Session 2's harness-injected context auto-loaded MEMORY.md from the sandbox-keyed memory dir. Claude answered "teal."

## Why this matters

Auto-memory is the foundation of the "your AI Chief of Staff that knows you" promise. Without verified cross-session persistence on Windows, every Snowball client demo would be a coin flip. This test rules out: (a) `bypassPermissions` mode breaking memory writes, (b) `.gitignore` accidentally covering the auto-memory dir, (c) the perplexity-guard hook interfering, (d) any Windows-specific path-encoding bug in CWD → project-key derivation.

## What was NOT tested

- **macOS.** Re-run when the first Mac Snowball client lands. Mechanism should be identical (project key derivation is CWD-based, Anthropic's harness handles platform differences), but verify before relying on it for a client kickoff.
- **Memory PRUNING across sessions.** `/end-session`'s memory-pruning gate (Decision 19c) regenerates the index — separate test that lives with S8's success check, not P7.
- **Memory load when MEMORY.md grows past the truncation limit** (~200 lines / 250KB). Not a Day-1 concern; clients won't hit this for weeks.
- **The `.claude/memory/` empty subdirectory** scaffolded by F5 inside the Snowball folder is unused — Anthropic auto-memory writes to the user-scope `~/.claude/projects/<key>/memory/` path, not the project-scope `.claude/memory/` directory. F5's empty `memory/` directory is dead weight. Not removing here (Surgical Changes — would need its own item) but flagging for cleanup if convenient later.

## Cleanup note

Sandbox at `C:\Users\kings\aios-smoke\` and its project key dir at `C:\Users\kings\.claude\projects\c--Users-kings-aios-smoke\` can be deleted any time. They're outside the secondbrain repo and outside the Snowball template — they served only this verification.
