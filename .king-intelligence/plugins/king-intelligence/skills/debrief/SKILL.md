---
name: debrief
description: Post-meeting debrief + action engine. Pulls the transcript, detects everything worth acting on (tasks, imminent meetings + how to handle them, person-to-person connections, offer ideas, project work, money, intel owed), writes the summary + follow-up email, updates all docs, then triages every action into three lanes — does the safe stuff, stages outward stuff for you to send, and hands you research-loaded prompts for the heavy work. Finishes by offering to turn the meeting into an anonymized, on-brand LinkedIn post for your personal feed (drafted in your voice, previewed in the browser, posted only on your explicit go). Use after any client or prospect meeting, or on a pasted thread ("handle this," "do what we agreed to").
argument-hint: "[client-name] | 'this' for a pasted thread"
allowed-tools: "*"
disable-model-invocation: true
---

# Meeting Debrief

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## Step 0 — load your settings

Before anything else, read `references/king-intelligence-config.md` from the repo root (use the Read tool on that exact repo-relative path; the session CWD is the repo root). Parse the `## debrief` section: it's plain `- key: value` lines (and `- crmList.activeProspect: ...` style dotted keys). Hold these settings for the whole run, every place below that says "the `<key>` from your settings" reads from here:

- `transcriptSource` — where transcripts come from + how to fetch (Phase 0).
- `crm`, `crmBoardId`, `crmList.activeProspect`, `crmList.futureProspect`, `crmList.partner`, `crmList.client`, `crmLabels` — the CRM and its board/lists/labels (Phase 4E).
- `paymentsTool` — invoicing tool for money owed (Phase 3C).
- `calendarTool`, `emailTool`, `emailDraftMethod`, `senderEmail`, `signatureFilePath` — outward channels (Phase 3C, Phase 5).
- `voiceGuidePath` — the voice profile to read before writing (Phase 3C).
- `clientFolderRoot`, `clientFolderConvention`, `clientRollupFile` — where per-client work + the rollup live (Phases 1, 3, 4).
- `socialPublishTool`, `socialAccountId`, `socialIsPersonalFeed` — the LinkedIn-post phase (Phase 6, gated on `socialPublishTool`).
- `productResearchIndexPath` — the product/service research roster index (Phase 4F).

If `references/king-intelligence-config.md` is missing, or its `## debrief` section is absent, tell the user to create it (you may scaffold a starter `## debrief` section from the keys listed above, using the values you can infer) and continue with safe generic fallbacks: ask them to paste the transcript (no `transcriptSource`), skip CRM logging (no `crm`), flag money owed instead of invoicing (no `paymentsTool`), skip the social phase (no `socialPublishTool`), skip the research-index append (no `productResearchIndexPath`), and default per-client work to `clients/<name>/`. Tell the user once which settings were missing so they can fill them in.

---

You are the user's post-meeting processor AND their right hand for what happens next. After a meeting the user runs `/debrief [client]`. You auto-load the staged transcript (or take a pasted one), then handle everything: detect every signal, save + summarize, draft the follow-up, update all docs, and **triage every action into three lanes** — do the safe stuff now, stage outward stuff for the user to send, and hand back loaded prompts for the heavy work.

**Goal:** the user says "/debrief sam-rivera" and gets a complete debrief in one pass — nothing important missed, nothing risky auto-fired, and the big work teed up as ready-to-run prompts instead of half-built in a tired window.

**This skill absorbed the old `/handle-it`.** Detection + triage + dispatch live here now (Phases 2 and 5). The thin standalone `/handle-it` just points back at this skill's detection + lane model for pasted, non-meeting context.

## Input

- `$ARGUMENTS` = client name (e.g., "sam-rivera", "riley-acme"), or `this` / a path for a pasted thread.
- If no argument: ask "Who was the meeting with? (client folder name or full name)".
- **Standalone mode** (`this` / a pasted thread, no meeting): skip Phases 0-4, run only Phase 2 detection + Phase 5 triage on the pasted context. See [references/lane-model.md](references/lane-model.md) § Standalone.

---

## Phase 0: Locate the transcript (auto-pull → match → only then ask)

**The contract: the user NEVER runs the transcript puller themselves.** Use the `transcriptSource` from your settings (Step 0) as the source — the auto-pull recipe below is written for `otter`. If we can pull it, we pull it. Only ask them to paste when the source genuinely has no matching meeting. If no `transcriptSource` is configured, skip the auto-pull and ask the user to paste the transcript directly.

1. **Try the staging queue.** `grep -l "^client_match: ${ARG}$" .claude/skills/otter-stage/queue/*.md`.
2. **Exactly one match:** read the staged file (frontmatter has `otid`, `title`, `otter_url`, `staged_at`, `matched_email`, `calendar_guests`). Treat it as canonical. Tell the user: *"Loading staged Otter transcript: `<title>` (`<otter_url>`). If that's not the meeting, paste the right one."*
3. **Multiple matches:** list each (title, otter_url, staged_at), ask which to load.
4. **Zero matches: actively pull, then re-check. Do NOT bail.**
   a. `timeout 60 node scripts/otter-pull.mjs` (idempotent, dedups via `state/processed.json`).
   b. Re-grep the queue for `$ARGUMENTS`.
   c. Match now → load it.
   d. Still zero + the meeting was on Zoom (a PMR or video-conference link, or the user says "Zoom call") → **Zoom fast path, do NOT wait for Zoom's own transcript** (its speech-to-text lags 50-85 min; the audio file lands minutes after the meeting):
      i. `recordings_list` (Zoom MCP) with today's date → find the meeting → grab the M4A `download_url` (+ the TRANSCRIPT VTT `download_url` if that file already exists).
      ii. If no M4A yet (`status` not completed / file absent): poll `recordings_list` every 2-3 min with background `sleep` — the audio shows up fast.
      iii. Run `node scripts/zoom-transcript-now.mjs --m4a-url "<url>" [--vtt-url "<url>"] --topic "<topic>" --client <kebab-name> --speakers "<host name> (host), <other person + 1-line role>" --uuid "<uuid>" --date YYYY-MM-DD`. It stages a transcript file into this same queue (~1 min for a 1 hr meeting); official VTT if ready, else a Gemini transcript from the audio. Exit 3 = Zoom web session expired → `node scripts/zoom-web-login.mjs`, then retry.
      iv. Re-grep the queue and load the staged file. Gemini-mode timestamps are approximate; names come from the `--speakers` hint — attribute by content where they look off (Phase 2 does this anyway).
   e. Still zero + not a Zoom meeting + puller exit 0 → Otter has nothing matching. Tell the user to paste, or check the queue under a different client name.
   f. Puller failed/timed out → report the exit code + first stderr line, then try the Zoom fast path (d) before asking the user to paste.
5. **User pastes a transcript anyway:** the pasted version wins.
6. **After Phase 4 completes:** delete the staged file (`rm .claude/skills/otter-stage/queue/<file>.md`); the `otid` is already in `processed.json` so it won't re-stage.

If a staged file is >7 days old, flag it before processing (likely a queue-cleanup bug, not a fresh meeting).

---

## Phase 1: Resolve client

Per-client work lives under the `clientFolderRoot` from your settings (default `clients/`), following the `clientFolderConvention` from your settings (default `clients/<name>/` with `01-research/` and `02-conversations/`). The steps below assume that convention.

### Existing client
1. Kebab-case `$ARGUMENTS` → `<clientFolderRoot>/[name]/`.
2. Read the client's `CLAUDE.md` for relationship history.
3. File organization: if `01-research/` or `02-conversations/` exists, use `02-conversations/` for transcript + summary; legacy `transcripts/` + `summaries/` if present; else create `02-conversations/`.

### New prospect (no folder)
1. Propose `<clientFolderRoot>/[first-last]/`; confirm with the user.
2. Create `<clientFolderRoot>/[name]/`, `01-research/`, `02-conversations/`, and a `CLAUDE.md` (populated in Phase 4).

---

## Phase 2: Process transcript + DETECT SIGNALS

### Speaker diarization
1. Identify speaker labels; map the user's words to **the user**, the primary other speaker to the client.
2. **Otter scrambles labels** — attribute by content, not just the label. 3+ non-user speakers → ask the user to identify them. Note where diarization is unreliable (it matters for cross-client writes in Phase 5).
3. Clean Otter artifacts (mislabeled speakers, timestamp format). Keep raw content intact.

### Meeting type
Auto-detect per [references/meeting-types.md](references/meeting-types.md). If ambiguous, ask.

### Background enrichment (MANDATORY floor for prospects, not a ceiling)
Before writing anything, find real public background on the person + company. **Skip only if:** `01-research/` exists from a prior research run; OR `CLAUDE.md` already has a populated About + Quick Reference; OR the user said "skip research"; OR the meeting is non-prospect (internal/coaching/personal).
Otherwise run the full ladder: LinkedIn `WebFetch` if a URL exists → 2-3 parallel `mcp__perplexity__perplexity_search` queries → `WebFetch` the company site → directory lookup (BBB / state records) for trades/small-biz → email discovery (CLAUDE.md, `gws gmail` search, CRM card / same-company pattern, site contact page; mark `[not yet captured]` only after all four fail — NEVER fabricate). Synthesize `backgroundContext` (name, title, company, domain, address, phone, 3-6 positioning bullets). **Floor, not ceiling** — one empty query is not "no info found." Escalate to the user before creating a CRM card if you still have less than name+title+company+domain.

### >>> SIGNAL DETECTION (the breadth fix — do this BEFORE the summary) <<<
Scan the **raw transcript** for all seven signal types and build a **signal ledger**. This runs here, not at the end off the summary — that's why the old skill missed the soft stuff. Full taxonomy + method: **[references/detection-signals.md](references/detection-signals.md)**. The seven:

1. **Tasks & commitments** (owner + deadline)
2. **Imminent meetings + how to handle them** (capture ALL the how-to-sell coaching, not just "meeting Thursday")
3. **Person-to-person connections** ("I know that guy," intros — cross-ref both files)
4. **Offer / strategy / business-model ideas** (the client improving the user's offer/pricing — never phrased as a task)
5. **Project work** (stated or implied builds; recurring → skill candidate)
6. **Money** (price agreed, rate, invoice owed, barter)
7. **Intel owed / promised** (what either side will bring back)

Plus relationship/working-style intel. **A rich 2-3 hour session yields many signals across most types — if you only found tasks, you ran a verb scan and missed the point.** Re-read for types 2, 3, 4 specifically. The ledger feeds Phase 3B (summary) and Phase 5 (triage).

---

## Phase 2.5: Infrastructure blocker scan (build engagements only)

If the conversation involves the user building/installing anything on the client's hardware (AIOS, Claude Code, MCP, CLIs, n8n, cold email), verify the client's hardware/OS/network/account constraints BEFORE the follow-up email commits to deliverables. Skip for pure hand-over deliverables (contract, one-pager, PDF) and cloud SMM/UBA deliveries.

Extract hardware/OS, computing context, network + account constraints, skill level — from the transcript, the client's `CLAUDE.md`/`01-research/`, email headers. If unknown, STOP and ask before drafting. Then `perplexity_search`-verify the intended stack works on that hardware. Write findings to `<clientFolderRoot>/<name>/01-research/infrastructure-blockers.md` (the `clientFolderRoot` from your settings), surface in the summary's Risk Factors, and feed them into Phase 5 so the email + prompts avoid impossible promises. (Known matrix: standard ChromeOS kills Claude Desktop + Code; corporate-locked machines block installs + admin CLIs; old macOS <11 blocks Claude Desktop. Refresh if >60 days stale.)

---

## Phase 3: Create files

### 3A. Save transcript
`<clientFolderRoot>/[name]/02-conversations/YYYY-MM-DD-[type]-transcript.md` (the `clientFolderRoot` from your settings, or the folder's existing pattern). Template: [templates/transcript.md](templates/transcript.md). The full raw transcript with cleaned labels. **Transcript is sacred** — never summarize or truncate it. If Otter diarization is badly scrambled, save raw + add a header note that the summary is source of truth (don't hand-relabel 2000 lines).

### 3B. Create summary — FROM the signal ledger
`<clientFolderRoot>/[name]/02-conversations/YYYY-MM-DD-[type]-summary.md` (the `clientFolderRoot` from your settings). Template: [templates/summary.md](templates/summary.md). **Build it from the Phase 2 signal ledger** so nothing soft gets dropped.
- Lead with the verdict. Direct, factual prose, no fluff. Pull quotes that reveal intent/commitment.
- Capture specific numbers, names, dates, tools, pricing. Action items have an owner + are concrete.
- Give the soft signals real estate: a dedicated section each for meeting-prep coaching (type 2), connections (type 3), and offer ideas (type 4) when they exist — those are the ones that used to evaporate.
- No em dashes. Omit empty sections. Under ~200 lines, scaled to meeting length.

### 3C. Follow-up email — Lane 2, inline-built, draft only
This is a **Lane-2** outward item AND the razor's anchor (see Phase 5). **Write the email body by invoking the `/email` skill — mandatory, every time, never hand-write it** (it enforces the voice guide + the real stored signature). Build everything the email *needs* (research, facts, PDFs, a payment link for any money owed) **inline** and bake/attach it. **Always do BOTH: show the email inline in chat AND create the draft** in the `emailTool` from your settings — the user wants it sitting in their drafts every time, not gated on approval. Never SEND it (the user sends). **Reconcile first** — check for an existing draft/thread before composing.

If money was agreed, create the invoice in the `paymentsTool` from your settings: a **real invoice** with its hosted invoice link in the body — a real numbered invoice with a due date and a PDF, **NOT a bare payment link**. Flow (Stripe shape): find-or-create the customer by email → `create_invoice` with `days_until_due` (14 default) → `create_invoice_item` (reuse an existing price for the rate, or create product+price once) → `finalize_invoice` → put the returned hosted `url` in the email. Finalize only; never trigger the payments tool's own send. Don't just say "invoice coming." If no `paymentsTool` is configured, don't fabricate a link: flag in the closing report that money is owed and the user needs to send the payment request manually.

Drafting rules: [templates/follow-up-email.md](templates/follow-up-email.md). Draft + signature procedure: [references/gmail-draft.md](references/gmail-draft.md). Voice: read the `voiceGuidePath` from your settings.

---

## Phase 4: Update documentation (Lane 1 — do now)

These are mechanical, safe, reversible — just do them. They appear in the closing report under "Done."

- **4A. Client `CLAUDE.md`** — read first, then targeted updates only (Status, Next Steps, new info, Files). Build new-prospect files from the standard structure; never fabricate contact info (`[not mentioned]`).
- **4B. Rollup** the `clientRollupFile` from your settings — update the client's row (Status, Next Step), or add a row in the right status group for a new prospect.
- **4C. Auto-memory** — add/update the client's section in the user's auto-memory file (the path from your settings, or the standard `~/.claude/projects/<hash>/memory/MEMORY.md` for the active repo). Key decisions, time-sensitive info, relationship intel. Update, don't duplicate.
- **4D. Folder structure** in root `CLAUDE.md` if a new client folder was created.
- **4E. CRM — get everyone on the board, THEN log the meeting** (skip only for internal/personal meetings, never for a real outside person or company; skip CRM logging entirely if no `crm` is configured in your settings, and note it once). The CRM is the `crm` from your settings, board id = the `crmBoardId` from your settings. **Dedup-search first**: search for the person by name (+ company name) in your CRM so you never double-create. **No card → CREATE one**: name `First Last - Company`, desc with title/company/email/phone + one line of context from Phase 2 enrichment (**never fabricate a field — omit it rather than invent it**). List placement, using the lists from your settings: active prospect conversation → the `crmList.activeProspect` list; explicitly not-now → the `crmList.futureProspect` list; referral partner/COI → the `crmList.partner` list; they said yes/paying → the `crmList.client` list. Apply the appropriate label from the `crmLabels` in your settings when the offer fit is clear. Then **log the meeting as a dated comment on the card** (date, summary path, top 3 actions). **No due dates** (board rule) and list moves for EXISTING cards stay Phase 5 triage decisions — always GET the card's current list first (state goes stale). Full mechanics + env vars: `references/trello-api.md` in your repo root references (or the equivalent for your CRM tool).
- **4F. Product research index** — the index file is the `productResearchIndexPath` from your settings; read the `CLAUDE.md` in that same folder first. If this meeting is a **formal product-specific meeting** (the person is on the index roster, or this was a new formal discovery/session for someone who isn't yet), append the row to that index file: correct tier table, next session number for that person, links to the transcript + summary just filed. New formal prospects enter as Tier 2; a Tier 2 person who has now PAID flips to Tier 1 (move all their rows). Not a relevant meeting → skip silently. If no `productResearchIndexPath` is configured, skip this step.

---

## Phase 5: Triage every signal into three lanes + dispatch

The detection is done (Phase 2 ledger), the bookkeeping is done (Phase 4). Now sort every remaining actionable signal into three lanes and dispatch. **Do not print a checklist for the user to do themselves** — the whole point is the actions actually happen (or get teed up). Full rules: **[references/lane-model.md](references/lane-model.md)**.

**The razor:** *is this needed for the follow-up email (or, no email, for what the user owes this person now)?* YES → build inline (heavy inline is fine; "needed" is strict, a promise of future work is NOT needed). NO → standalone → Lane 3 prompt. Genuine fence → ask once.

- **Lane 1 — Do now, report.** Mechanical/safe/reversible: the Phase 4 updates + person-to-person cross-references into other files (type 3). **Cross-client writes require high diarization confidence**; garbled source → flag it, don't write it. Everything done appears under "Done."
- **Lane 2 — Outward, you trigger.** Email, calendar invite, invoice (in the `paymentsTool` from your settings), intro. **Reconcile against reality first** via the `emailTool` / `calendarTool` from your settings — if the user already sent the invite, *perfect it* (rename, fix the gap) rather than duplicate, and let them trigger the guest update. Stage everything; never auto-fire. Batch into "Ready to send."
- **Lane 3 — Loaded prompt for a fresh window.** Standalone heavy work (meeting prep, a new skill, a deck). Do **bounded** research (Gmail/Calendar/who-is-X/what-was-said + file pointers), bake it into a paste-ready prompt saved to `prompts/YYYY-MM-DD-<slug>.md` + echoed in chat. Don't do the heavy build here. Rank + flag time-sensitive ones. Escape hatch: if the user says "just do it now," build inline.

End with the **closing report** (three sections — Done / Ready to send / Prompts queued, plus Flagged if any). Format in [references/lane-model.md](references/lane-model.md). Pick executors (Skill / MCP / CLI / Agent) from [references/awareness-surfaces.md](references/awareness-surfaces.md) + [references/executor-examples.md](references/executor-examples.md) — open lists, not catalogs.

---

## Phase 6: Offer a LinkedIn post (every debrief, after the closing report)

**Gated on `socialPublishTool` from your settings** — if no `socialPublishTool` is configured, skip Phase 6 silently (stop at the closing report). When it is configured, run this phase.

After the closing report, make ONE clean offer to turn the meeting into a post for the user's personal LinkedIn — their lesson, their voice, the client anonymized. **Every debrief, always something** (a business lesson OR a human moment, never a "nothing here" hedge), one strongest angle, then stop. Full procedure — the angle heuristic, anonymization, the `/content-unit` handoff, the image plug + rotating queue, the browser preview, and the publish path — lives in **[references/content-post.md](references/content-post.md)**.

The shape: mine the Phase 2 ledger + Phase 3B summary for the single best angle → offer it in one stanza → on "yes," anonymize the material and hand it to `/content-unit` (tell it to auto-pick the strongest hook — no question — and capture its slop-clean output verbatim) → `scripts/pick-style.mjs` + `scripts/render-card.mjs` make the on-brand image → `scripts/preview-post.mjs --open` shows a mock LinkedIn post in their browser → on an explicit **"post it,"** publish via the `socialPublishTool` from your settings to the `socialAccountId` from your settings (when `socialIsPersonalFeed` from your settings is true, omit any pageId so it lands on their personal feed; Playwright `~/.playwright-profile` is the fallback) and confirm it landed. Never auto-fire; first live post has no API undo, so say so. (Standalone / pasted-thread runs skip Phase 6 — there's no meeting to mine.)

---

## Important rules

1. **Every new file gets a date stamp** (`M/D/YY - HH:MM`, local time, repo-wide).
2. **Never fabricate.** No invented emails, IDs, paths, stages. `[not mentioned]` or ask.
3. **Read before writing.** Always read existing `CLAUDE.md` before editing.
4. **No em dashes** anywhere.
5. **Transcript is sacred** — complete raw text, never summarized in the transcript file.
6. **Never auto-send anything outward** — email, calendar updates, invoices all stage for the user's trigger (Lane 2). The only email path in the `emailTool` from your settings is creating a draft, never sending.
7. **Detect from the raw transcript before summarizing** — the summary is lossy; detecting off it is why things got missed.
8. **Perplexity:** `_search` only. `_reason` / `_research` are banned + hook-blocked.
9. **Verify before acting on stale context** — re-query a CRM card's current list before moving it.
10. **Ask, don't guess** — ambiguous meeting type, unidentifiable speakers, unclear client name, or a genuine inline-vs-prompt fence.
11. **The Phase 6 LinkedIn offer is one clean offer, never a nag** — one angle, anonymize by default ("name them" only on the user's say-so), never publish without an explicit "post it."

## Edge cases
- **Very short meeting (<10 min / <500 words):** proportionally short summary, skip empty sections.
- **No speaker labels (Super Whisper):** ask who was in the room.
- **Legacy `02-conversations/`:** use it, don't create new subfolders.
- **Follow-up with existing client:** read CLAUDE.md first, incremental updates not rewrites.
- **Standalone / pasted thread:** Phases 2 + 5 only.
