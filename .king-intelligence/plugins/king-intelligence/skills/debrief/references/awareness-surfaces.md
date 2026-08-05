# Awareness Surfaces — for standalone / "handle this" mode

If your own setup keeps a full enumeration of every skill, MCP server, repo
capability, CLI tool, and primitive available to you (a capability index at
the root of your repo), **read it once per standalone run** before finalizing
the action list. It's the difference between "use a Skill that already
exists" and "fall back to `[manual]`" or "freelance a Bash script when a tool
exists."

This file holds only the standalone-triage guidance on top of that index.

---

## How to use the toolbox for standalone triage

When you've detected the actions in Phase 2, for each action ask:

1. **Is there a Skill that does this?** Skills encode discipline that took iterations
   to lock in (e.g., a video-polish skill encoding "RAW audio + 60fps + brand-spec
   end card" rules; `email` enforces voice rules + blacklist + fabrication check).
   Always prefer the Skill over freelancing the same task.
2. **Is there an MCP or API for the target system?** The CRM (via its CLI from your
   settings), Calendar, Gmail, Notion, Stripe (via Bash), etc. Use it instead of
   building API calls by hand.
3. **Is there a repo script?** A transcript puller, the content app pipeline,
   the SEO engine, etc.
4. **Can `gws` / `gh` / `git` / `node` Bash do it cleaner?** Often yes.
5. **Does it need a general-purpose primitive?** `Agent` (background research),
   `ScheduleWakeup` (reminders), `CronCreate` (recurring), `WebFetch` (single URL).

Only if **all** of the above come up empty should the action land in the gate as
`[manual]`.

---

## Common mistakes to avoid

- **Drafting prospect-facing email copy without invoking `email` first.** The user will
  catch this — the voice rules are not optional.
- **Building a PDF deliverable with Bash + LaTeX or a hand-rolled pipeline** when
  `document-skills:pdf` or a proven HTML→browser-automation pipeline (if your setup
  has one documented) is right there.
- **Freelancing ffmpeg cuts** when the video is going to the user's public site —
  a dedicated video-polish skill, if one exists in your setup, encodes rules that
  took real iteration to lock in.
- **Asking Perplexity to "research X"** with the `_research` or `_reason` tool
  variants. BANNED. Hook-blocked. Use `_search` only.
- **Sending a Telegram update** as part of a batch unless the conversation explicitly
  requested one. Telegram pages the user's phone.

---

## Perplexity rule (worth repeating)

`perplexity_research` and `perplexity_reason` are BANNED and hook-blocked. Use
`perplexity_search` only. For "deep" research, do multiple `_search` calls and
synthesize.
