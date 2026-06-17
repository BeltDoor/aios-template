# Awareness Surfaces — for `/handle-it` and `/debrief`

The full enumeration of every skill, MCP server, repo capability, CLI tool, and primitive available lives in your repo's toolbox reference (typically `references/toolbox.md` at the repo root). **Read that file once per `/handle-it` run** before finalizing the action list. It's the difference between "use a Skill that already exists" and "fall back to `[manual]`" or "freelance a Bash script when a tool exists."

This file holds only the `/handle-it`-specific guidance on top of the toolbox.

---

## How `/handle-it` should use the toolbox

When you've detected the actions in Phase B, for each action ask:

1. **Is there a Skill that does this?** Skills encode discipline that took iterations to lock in (e.g., `email` enforces voice rules + blacklist + fabrication check). Always prefer the Skill over freelancing the same task.
2. **Is there an MCP or API for the target system?** CRM (REST, references/trello-api.md or equivalent), Calendar, Gmail, Stripe (via Bash), etc. Use it instead of building API calls by hand.
3. **Is there a repo script?** `scripts/otter-pull.mjs`, the content app pipeline, the SEO engine, etc.
4. **Can `gws` / `gh` / `git` / `node` Bash do it cleaner?** Often yes.
5. **Does it need a general-purpose primitive?** `Agent` (background research), `ScheduleWakeup` (reminders), `CronCreate` (recurring), `WebFetch` (single URL).

Only if **all** of the above come up empty should the action land in the gate as `[manual]`.

---

## Common mistakes to avoid

- **Drafting prospect-facing email copy without invoking `email` first.** The voice guide rules are not optional.
- **Building a PDF deliverable with a hand-rolled pipeline** when a proven HTML→Playwright pipeline or existing skill handles it correctly.
- **Asking Perplexity to "research X"** with the `_research` or `_reason` tool variants. BANNED. Hook-blocked. Use `_search` only.
- **Sending a Telegram update** as part of a batch unless the conversation explicitly requested one. Telegram pages the user's phone.

---

## Perplexity rule (worth repeating)

`perplexity_research` and `perplexity_reason` are BANNED and hook-blocked. Use `perplexity_search` only. For "deep" research, do multiple `_search` calls and synthesize.
