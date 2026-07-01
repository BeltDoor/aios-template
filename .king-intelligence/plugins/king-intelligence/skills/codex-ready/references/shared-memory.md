# Shared memory across both tools, made to not fall over

A common worry: if both tools keep their own memory, do they not drift and clobber each other? They would, if you used each tool's private store as the brain. The fix is one brain, not two.

## The trap

Each tool has its own private, hidden auto-memory: different store, different format, different location. Treat those as the source of truth and they diverge the moment both tools run. There is no supported way to merge two tools' private memory stores.

## The design that holds

Use a single, plain-markdown brain that lives **in the repo** (the knowledge base plus any memory notes), tracked in git:

1. **One folder, in the repo, in version control.** Every change is versioned, so any conflict is visible and recoverable. Git is the safety net.
2. **Both tools are told to use it.** The generated `AGENTS.md` instructs Codex to read and write that folder; the repo's `CLAUDE.md` already does the same for Claude Code.
3. **Point the tool's own auto-memory at the repo folder where possible.** Claude Code supports an `autoMemoryDirectory` setting that can target an in-repo path, so its automatic notes land in the shared brain instead of a hidden machine-local store.
4. **Neither tool keeps a private brain as the source of truth.** They share the repo brain.

## What you cannot do

You cannot fuse the two tools' built-in private memory features into one live store. That is fine: you do not want a hidden store as the brain anyway. The shared, durable, inspectable memory is the in-repo one. Say this plainly to the owner so they do not expect a magic single memory toggle.
