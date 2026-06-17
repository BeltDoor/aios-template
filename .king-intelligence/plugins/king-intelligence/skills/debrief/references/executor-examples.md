# Executor Examples

**Not a catalog. Not a switch statement.** Use this only as a sanity check that you picked a reasonable tool for the action you detected. If your action isn't here, that's fine — figure out the right tool from `awareness-surfaces.md` and use it.

Format: `Action intent` -> `executor candidate` -> `why / gotchas`

---

## Communication

**Send the Gmail draft `/debrief` parked.**
- `Bash: gws gmail users drafts send --id <draft_id>`
- Why: `/debrief` Phase 3C already created the draft. We just hit send.
- Gotcha: Draft ID must match what's actually in Gmail — if the user edited or deleted the draft, this fails. Surface the failure in Phase E, don't silently retry.

**Send a PDF attachment to a specific recipient.**
- `Bash: gws gmail users drafts create` with `--attachment <path>`, then `gws gmail users drafts send --id <new_draft_id>`.
- Why: `gws --upload` may send as `application/octet-stream` which Gmail rejects. Test the method in your environment first.

**Draft an intro email (don't send).**
- `Bash: gws gmail users drafts create` with both prospective parties in To, neither in Cc.
- Why: Intros need the user's eyes before they go out. Always drafts only.

**Send a Telegram update.**
- `mcp__plugin_telegram_telegram__reply` with `chat_id` (from the original Telegram message context) and `text`.
- Why: Pages the user's phone — only do this when the conversation explicitly asked for one.

**Write prospect-facing email body first.**
- `Skill: email`
- Why: Encodes voice guide rules, blacklist, fabrication check. Never freelance prospect email copy.

---

## CRM

Use the CRM tool and board from your settings (the `crm` and `crmBoardId` fields). Full mechanics: `references/trello-api.md` in your repo root references (for Trello), or the equivalent for your configured CRM.

**Move a card between lists (the only "stage change").**
- `PUT /1/cards/<cardId>?idList=<newListId>` — resolve list ids live from the board, never hardcode.
- Gotcha: GET the card's current list first; state in CLAUDE.md goes stale.

**Create a new card (prospect onboarding).**
- Dedup first: search by person AND company name in your CRM.
- `POST /1/cards` with name `First Last - Company`, desc = title/company/email/phone + one context line, right list per Phase 4E, label if the offer fit is clear. No due dates (board rule).

**Log a meeting on a card.**
- `POST /1/cards/<cardId>/actions/comments` with a dated note (date, summary path, top 3 actions).
- Note: `/debrief` Phase 4E does this automatically now (housekeeping, no gate).

---

## Scheduling

**Create + send a calendar invite for the next meeting.**
- `Bash: gws calendar events create` with attendees + start/end + summary + location/conferencing.
- Why: The `mcp__claude_ai_Google_Calendar__*` server only exposes `__authenticate` and `__complete_authentication` — it's OAuth-only. Use the `gws calendar` CLI for actual event creation.
- Default: send invite to attendees, include video link or location from the call.
- Gotcha: TZ. Build datetimes with explicit TZ (e.g., `America/New_York`) matching the user's local timezone.

**Schedule a self-reminder ("follow up Friday if no reply").**
- `ScheduleWakeup` (one-off) or `CronCreate` (recurring)
- Why: ScheduleWakeup hands the user a notification at the right time with the right context.

---

## Payments

**Create a draft invoice.**
- `Bash` + payment tool API key from your env vars (see `paymentsTool` from your settings + its references file)
- Default: draft only, don't finalize/send.
- Critical gotchas:
  - Stripe `send_invoice` auto-emails ONLY `customer.email`. Verify the email is the A/P contact, not just the primary contact.
  - `due_date` is un-editable on non-draft invoices. Set it BEFORE finalize.
- Output: surface the `hosted_invoice_url` in Phase E so the user can paste it into a Gmail reply if they want to bypass the tool's own send.

---

## Research / browsing

**Kick off background research the user owes the client.**
- `Agent` with `subagent_type: general-purpose` and `run_in_background: true`
- Why: Doesn't block the gate close. The user keeps moving. Notification arrives when done.
- Prompt the agent self-contained: it doesn't see this conversation. Include the topic, what's already known, what specifically to find, and the desired output format/length.

**Quick web lookup (e.g., to verify a meeting venue address).**
- `mcp__perplexity__perplexity_search` (sonar)
- NEVER `_research` or `_reason` — banned + hook-blocked.

**Read a live website mid-execution.**
- `mcp__playwright__browser_navigate` -> `browser_snapshot` (or `WebFetch` for static pages)
- Why: Some pages need JS to render. Playwright handles that.

**Watch a YouTube link the conversation referenced.**
- `Skill: playwatch`
- Why: Native video understanding via Gemini, not Playwright screenshots.

---

## Publishing / repo

**Publish a page to the user's website.**
- `Write` to `docs/<slug>/index.html`, then `Bash: git add docs/<slug>/index.html && git commit -m "feat(site): <description>" && git push`
- Why: GitHub Pages serves `docs/` automatically. Live within ~1 min of push.
- Pattern: see existing `docs/` pages in your repo for prior examples.

**Update a client's CLAUDE.md (e.g., to add a new commitment).**
- `Edit` directly. (Read first — existing skill rule.)

**Update auto-memory.**
- `Write` to the memory file for the active repo (path from your settings) AND add a 1-line pointer to `MEMORY.md`.
- See root CLAUDE.md memory section for the full memory rules.

**Queue a social post.**
- `mcp__blotato__blotato_create_post` (for direct API) or invoke the appropriate content skill.
- Or: drop content into the content-app pipeline if one is configured.

---

## Pulling more data

**Pull the latest Otter transcripts.**
- `Bash: node scripts/otter-pull.mjs`
- Why: Idempotent. Won't restage anything already in `state/processed.json`.
- This is the same script `/debrief` Phase 0 now calls automatically — `/handle-it` mostly won't need to do this, but it's available.

**Look up something in Notion.**
- `mcp__claude_ai_Notion__notion-search` or `notion-fetch`.

---

## Workflow automation

**Modify or trigger an n8n workflow.**
- `mcp__n8n__*` — `n8n_get_workflow`, `n8n_update_partial_workflow`, `n8n_test_workflow`, `n8n_executions`.
- Gotcha: For any n8n changes, validate via `mcp__n8n__n8n_validate_workflow` BEFORE deploy.

**Add a permission rule or settings change.**
- `Skill: update-config`
- Why: Encodes the settings.json structure correctly, scoped to user/project/local.

---

## When the action genuinely doesn't fit a tool

Label `[manual]` in the gate. Examples: "drive to the meeting," "sign the paper contract," "hand Mark the USB drive." Rare. Always check `awareness-surfaces.md` first.
