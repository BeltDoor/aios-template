# Executor Examples

**Not a catalog. Not a switch statement.** Use this only as a sanity check that you picked a reasonable tool for the action you detected. If your action isn't here, that's fine — figure out the right tool from `awareness-surfaces.md` and use it.

Format: `Action intent` -> `executor candidate` -> `why / gotchas`

---

## Communication

**Send the Gmail draft `/debrief` parked.**
- `Bash: gws gmail users drafts send --id <draft_id>`
- Why: `/debrief` Phase 3C already created the draft. We just hit send.
- Gotcha: Draft ID must match what's actually in Gmail — if the user edited or deleted the draft, this fails. Surface the failure in the closing report, don't silently retry.

**Send a PDF attachment to a specific recipient.**
- `Bash: gws gmail users drafts create` with `--attachment <path>` (see `references/client-deliverable-pipeline-5-13-26` memory for the auth.mjs workaround), then `gws gmail users drafts send --id <new_draft_id>`.
- Why: `gws --upload` sends as `application/octet-stream` which Gmail rejects. Use the auth.mjs path.

**Draft an intro email (don't send).**
- `Bash: gws gmail users drafts create` with both prospective parties in To, neither in Cc.
- Why: Intros need the user's eyes before they go out. Always drafts only.

**Send a Telegram update.**
- `mcp__plugin_telegram_telegram__reply` with `chat_id` (from the original Telegram message context) and `text`.
- Why: Pages the user's phone — only do this when the conversation explicitly asked for one.

**Write the user's voice for any prospect-facing email FIRST.**
- `Skill: email`
- Why: Encodes their voice-guide rules, blacklist, fabrication check. Never freelance prospect email copy.

---

## CRM (whatever CRM is configured in your settings)

The CRM is the `crm` from your settings, reachable at the `crmBoardUrl` from your settings. All reads and writes go through the CLI at `crmApi` (`find` / `get` / `create` / `touch` / `move` / `archive`). **Only write to the CRM configured in your settings** — never fall back to a different or historical tool.

**Move a card between columns (the only "stage change").**
- `<crmApi> move <card-id> <column>`
- Gotcha: `get <card-id>` first to read its CURRENT column; passed-in/CLAUDE.md state goes stale.
- A column move should not, by itself, fire any downstream job unless your setup specifically wires one up.

**Create a new card (prospect onboarding).**
- Dedup first: `<crmApi> find "<name>"` (try person AND company name; ideally it also covers email and archived cards).
- `<crmApi> create '{"name":"First Last","company":"...","email":"...","phone":"...","tags":["AIOS"],"notes":"title + context line","column":"<crmList.newPerson>"}'`
- Name is the person ONLY, company is its own field. Tag when the offer fit is clear. No due dates unless your board wants them.

**Log a meeting on a card.**
- `<crmApi> touch <card-id> "<date>: met re X, summary path, next step" debrief`
- This bumps the card's last-activity, which is what drives any staleness view on the board.
- Note: `/debrief` Phase 4E does this automatically (housekeeping, no gate).

---

## Scheduling

**Create + send a calendar invite for the next meeting.**
- `Bash: gws calendar events create` with attendees + start/end + summary + location/conferencing.
- Why: A calendar MCP that's OAuth-only for authentication often doesn't expose real event creation. If yours doesn't, use the `gws calendar` CLI (or your `calendarTool` from settings) for actual event creation.
- Default: send invite to attendees, include video link or location from the call.
- Gotcha: TZ. Build datetimes with an explicit timezone (e.g. `America/New_York`) rather than trusting the local default.

**Schedule a self-reminder ("follow up Friday if no reply").**
- `ScheduleWakeup` (one-off) or `CronCreate` (recurring)
- Why: ScheduleWakeup hands the user a notification at the right time with the right context.

---

## Payments

**Create a Stripe draft invoice.**
- `Bash` + `STRIPE_API_KEY` (env var, see `references/stripe-api.md` if your setup has one)
- Default: draft only, don't finalize/send.
- Critical gotchas:
  - Stripe `send_invoice` auto-emails ONLY `customer.email`. Verify the email is the A/P contact, not the primary contact.
  - `due_date` is un-editable on non-draft invoices. If we need to set/change it, do it BEFORE finalize.
- Output: surface the `hosted_invoice_url` in the closing report so the user can paste it into a Gmail reply if they want to bypass Stripe's email.

---

## Research / browsing

**Kick off background research the user owes the client.**
- `Agent` with `subagent_type: general-purpose` (or `claude-code-guide` for Claude Code specifics) and `run_in_background: true`
- Why: Doesn't block the gate close. The user keeps moving. Notification arrives when done.
- Prompt the agent self-contained: it doesn't see this conversation. Include the topic, what's already known, what specifically to find, and the desired output format/length.

**Quick web lookup (e.g., to verify a meeting venue address).**
- `mcp__perplexity__perplexity_search` (sonar, $0.005)
- NEVER `_research` or `_reason` — banned + hook-blocked.

**Read a live website mid-execution.**
- `mcp__playwright__browser_navigate` -> `browser_snapshot` (or `WebFetch` for static pages)
- Why: Some pages need JS to render. Playwright handles that.

**Watch a YouTube link the conversation referenced.**
- `Skill: playwatch`
- Why: Native video understanding via Gemini, not Playwright screenshots.

---

## Publishing / repo

**Publish a page to your public site.**
- `Write` to `docs/<slug>/index.html`, then `Bash: git add docs/<slug>/index.html && git commit -m "feat(site): <description>" && git push`
- Why: GitHub Pages serves `docs/` on a custom domain automatically, if that's how your site is set up. Live within ~1 min of push.

**Update a client's CLAUDE.md (e.g., to add a new commitment).**
- `Edit` directly. (Read first — that's an existing skill rule.)

**Update your auto-memory.**
- `Write` to your memory folder's per-topic file AND add a 1-line pointer to its index.
- See your own root CLAUDE.md memory section for the full memory rules.

**Queue a social post.**
- `mcp__blotato__blotato_create_post` (direct API), or whatever `socialPublishTool` is configured in your settings.
- Or: drop content into your own content pipeline, if you have one.

---

## Pulling more data

**Pull the latest transcripts.**
- `Bash: node scripts/otter-pull.mjs`
- Why: Idempotent. Won't restage anything already in `state/processed.json`.
- This is the same script `/debrief` Phase 0 now calls automatically — standalone mode mostly won't need to do this, but it's available.

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

Label `[manual]` in the gate. Examples: "drive to the meeting," "sign the paper contract," "hand someone a USB drive in person." Rare. Always check `awareness-surfaces.md` first.
