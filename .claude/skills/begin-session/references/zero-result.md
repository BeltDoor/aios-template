# Zero-result handling

When folder match + auto-memory + connector fallback all return nothing, Claude responds:

> I don't have anything on "<topic>" yet — first time you're mentioning them?

Then `AskUserQuestion` with three options:

### 1. "Yes, first time — create a folder for them" (Recommended)

Scaffold `clients/<slug>/` (kebab-case from topic) containing:

- `.gitkeep` (so empty folder commits)
- `CLAUDE.md` with this stub:

  ```markdown
  # <Topic name as the user gave it>

  **Created:** YYYY-MM-DD via `/begin-session`
  **Folder slug:** <slug>

  ## Status
  First mention — no context captured yet.

  ## Next steps
  Fill in as you work on this. `/skill-builder` can build automations specific to this topic.
  ```

Then brief from the just-created folder. Identity = topic name. All other sections empty (omitted per anti-fabrication rule).

### 2. "Let me search connectors more deeply"

Broader connector queries — full-text search beyond exact-phrase match. If still zero, loop back to this same `AskUserQuestion` with option 1 (scaffold) still available.

### 3. "I meant a different topic"

Re-prompt:

> What topic should I load instead?

Then run resolution from `SKILL.md § 1` against the new input.

## Why `clients/` by default for the scaffold branch

Topic-shaped names usually refer to people or companies — client-mode. If the user clarifies it's actually a project ("this is a project, not a client"), `/skill-builder` can move the folder later. v1.0 doesn't ask which folder upfront — picks `clients/` and moves on.

## Self-ping behavior

If the user picks option 3 ("I meant a different topic") and then provides a topic that does resolve, the briefing for that NEW topic does fire self-ping (it completed).

If the user cancels out of this `AskUserQuestion` entirely without proceeding, suppress self-ping — only count completed briefings.
