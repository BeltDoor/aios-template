# Executor Examples

**Not a catalog. Not a switch statement.** Use this only as a sanity check that you picked a reasonable tool for the action you detected. If your action isn't here, figure out the right tool from whatever is connected for this client and use it. The general rule of thumb when dispatching:

1. **Is there a skill that does this?** Skills encode discipline that took iterations to lock in (voice rules, anti-slop checks, brand specs). Prefer the skill over freelancing the same task.
2. **Is there a connected MCP / tool for the target system?** The configured CRM, calendar, email, payments, notes/wiki, etc. Use it instead of building API calls by hand.
3. **Can a simple CLI / script do it cleaner?** Often yes.
4. **Does it need a general-purpose primitive?** An Agent (background research), a scheduled reminder, a recurring job, `WebFetch` (single URL).
5. **Only if all of the above come up empty** should the action land as `[manual]`.

Format below: `Action intent` -> `executor candidate` -> `why / gotchas`. The named tools are **examples**; substitute whatever is configured for this client.

---

## Communication

**Create the follow-up email draft.**
- `Skill: king-intelligence:email` if available (it enforces the user's voice + anti-slop + signature), else draft inline per [follow-up-email.md](follow-up-email.md) and create the draft in the configured `emailTool`.
- Drafts only — the user sends manually.

**Draft an intro email (don't send).**
- Create a draft with both prospective parties in To, neither in Cc.
- Why: intros need the user's eyes before they go out. Always drafts only.

**Run any prose through anti-slop before showing it.**
- `Skill: king-intelligence:stop-slop` if available, else self-check against the hard rules in [follow-up-email.md](follow-up-email.md).

---

## CRM

**Move a deal stage.**
- Use the configured `crm`'s update tool with the new stage.
- Gotchas: re-query the live pipeline before trusting a stored stage (it goes stale); categorize the meeting outcome into the right stage bucket before moving.

**Create a new contact + company + deal (prospect onboarding).**
- Run the configured `crm`'s create flow end-to-end (dedup, full confirmation, execute, associations, engagement note). Don't skip the dedup step or you'll create dupes.

**Log a meeting engagement on an existing deal.**
- Use the `crm`'s create-engagement tool, type MEETING, including the meeting date, summary path, top 3 action items, duration estimate. (Phase 4E does this automatically when a CRM is configured.)

When `crm` is `none`/unset, surface CRM-shaped actions as flagged items, don't fabricate records.

---

## Scheduling

**Create + send a calendar invite for the next meeting.**
- Use the configured `calendarTool` with attendees + start/end + summary + location/conferencing.
- Gotcha: time zones. Build datetimes with an explicit TZ (the user's local TZ by default).

**Schedule a self-reminder ("follow up Friday if no reply").**
- A one-off scheduled reminder, or a recurring job for repeating nudges.

---

## Payments

**Create a draft invoice / payment link.**
- Use the configured `paymentsTool`. Default: draft/finalize only, don't trigger the tool's own send (the user's email is the delivery).
- Gotchas: the billing email must be the A/P contact, not just the primary contact; set the due date BEFORE finalizing if the tool locks it after.
- When no `paymentsTool` is configured, flag that money is owed; never invent a link.

---

## Research / browsing

**Kick off background research the user owes the contact.**
- An Agent (general-purpose), run in the background so it doesn't block the debrief.
- Prompt it self-contained: it doesn't see this conversation. Include the topic, what's known, what to find, and the desired output format/length.

**Quick web lookup (verify a venue address, a fact).**
- `perplexity_search`. NEVER `perplexity_research` or `perplexity_reason`.

**Read a live website mid-execution.**
- `WebFetch` for static pages; a browser tool for pages that need JS to render.

**Watch a YouTube/video link the conversation referenced.**
- A video-understanding skill if one is available (native video understanding beats screenshots).

---

## Publishing / docs

**Update the contact's notes file (add a new commitment).**
- Edit directly. (Read first.)

**Update the persistent memory.**
- Append to the user's memory/notes system if one is in use; add a one-line pointer where the index lives.

**Queue a social post.**
- The configured posting tool or the user's content pipeline. (The branded social-post phase lives in the full version of this skill.)

---

## When the action genuinely doesn't fit a tool

Label it `[manual]`. Examples: "drive to the meeting," "sign the paper contract," "hand them the USB drive." Rare.
