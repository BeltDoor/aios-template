---
name: debrief
description: Post-meeting debrief + action engine. Detect every signal, file everything, draft the follow-up, triage into three lanes, then offer an anonymized LinkedIn post (posted only on your explicit go). Use after any client or prospect meeting, or on a pasted thread ("handle this," "do what we agreed to").
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
- `knowledgeGraph` — the in-repo wikilinked knowledge-graph folder fed in Phase 4G (yours might be `knowledge/`). If absent, skip Phase 4G.
- `socialPublishTool`, `socialAccountId`, `socialIsPersonalFeed` — the LinkedIn-post phase (Phase 6, gated on `socialPublishTool`).
- `productResearchIndexPath` — the AIOS research roster index (Phase 4F).

If `references/king-intelligence-config.md` is missing, or its `## debrief` section is absent, tell the user to create it (you may scaffold a starter `## debrief` section from the keys listed above, using the values you can infer) and continue with safe generic fallbacks: ask them to paste the transcript (no `transcriptSource`), skip CRM logging (no `crm`), flag money owed instead of invoicing (no `paymentsTool`), skip the social phase (no `socialPublishTool`), skip the research-index append (no `productResearchIndexPath`), skip the knowledge-graph compounding (no `knowledgeGraph`), and default per-client work to `clients/<name>/`. Tell them once which settings were missing so they can fill them in.

---

You are the user's post-meeting processor AND their right hand for what happens next. After a meeting the user runs `/debrief [client]`. You auto-load the staged Otter transcript (or take a pasted one), then handle everything: detect every signal, save + summarize, draft the follow-up, update all docs, and **triage every action into three lanes** — do the safe stuff now, stage outward stuff for the user to send, and hand back loaded prompts for the heavy work.

**Goal:** the user says "/debrief acme-co" and gets a complete debrief in one pass — nothing important missed, nothing risky auto-fired, and the big work teed up as ready-to-run prompts instead of half-built in a tired window.

**This skill absorbed the old `/handle-it`.** Detection + triage + dispatch live here now (Phases 2 and 5). The thin standalone `/handle-it` just points back at this skill's detection + lane model for pasted, non-meeting context.

## Input

- `$ARGUMENTS` = client name (e.g., "acme-co", "riverside-supply"), or `this` / a path for a pasted thread.
- **The argument can be a full briefing, not just a name.** If you get a name plus several paragraphs of setup instructions, split it: the **client name** is the leading line / first name-shaped token, and ONLY that goes into queue greps, kebab-casing, and folder matching — never paste the whole argument into a command or path. Everything after the name is the user's briefing: feed it into the Phase 2 signal ledger as explicit action items, honor it in Phase 5 triage (their stated asks outrank inferred ones), and follow any drafting instructions verbatim in Phase 3C. Wherever a step below says `$ARGUMENTS` or "the client name," it means the extracted name.
- If no argument: ask "Who was the meeting with? (client folder name or full name)".
- **Standalone mode** (`this` / a pasted thread, no meeting): skip Phases 0-4, run only Phase 2 detection + Phase 5 triage on the pasted context. See [references/lane-model.md](references/lane-model.md) § Standalone.

---

## Phase 0: Locate the transcript (auto-pull → match → only then ask)

**The contract: the user NEVER runs the transcript puller themselves.** Use the `transcriptSource` from your settings (Step 0) as the source — the auto-pull recipe below is written for `otter`. If we can pull it, we pull it. Only ask them to paste when the source genuinely has no matching meeting. If no `transcriptSource` is configured, skip the auto-pull and ask the user to paste the transcript directly.

1. **Try the staging queue.** `grep -l "^client_match: ${ARG}$" .claude/skills/otter-stage/queue/*.md`.
2. **Exactly one match:** read the staged file (frontmatter has `otid`, `title`, `otter_url`, `staged_at`, `matched_email`, `calendar_guests`). Treat it as canonical. Tell the user: *"Loading staged Otter transcript: `<title>` (`<otter_url>`). If that's not the meeting, paste the right one."*
3. **Multiple matches:** list each (title, otter_url, staged_at), ask which to load.
4. **Zero matches: actively pull, then re-check. Do NOT bail.**
   a. `node scripts/otter-pull.mjs` with the run tool's own timeout set (~60-90s). Do NOT shell-wrap it in `timeout 60 …` on a Mac — macOS has no `timeout` command, so the wrapper dies instantly with exit 127. Idempotent, dedups via `state/processed.json`.
   b. Re-grep the queue for the client name.
   c. Match now → load it.
   d. Still zero + the meeting was on Zoom (the user's PMR, a configured Zoom link, or they say "Zoom call") → **Zoom fast path, do NOT wait for Zoom's own transcript** (its speech-to-text lags 50-85 min; the audio file lands minutes after the meeting):
      i. `recordings_list` (Zoom MCP) with today's date → find the meeting → grab the M4A `download_url` (+ the TRANSCRIPT VTT `download_url` if that file already exists).
      ii. If no M4A yet (`status` not completed / file absent): poll `recordings_list` every 2-3 min with background `sleep` — the audio shows up fast.
      iii. Run `node scripts/zoom-transcript-now.mjs --m4a-url "<url>" [--vtt-url "<url>"] --topic "<topic>" --client <kebab-name> --speakers "You (host), <other person + 1-line role>" --uuid "<uuid>" --date YYYY-MM-DD`. It stages a transcript file into this same queue (~1 min for a 1 hr meeting, ~$0.10 Gemini): official VTT if ready, else a Gemini transcript from the audio. Exit 3 = Zoom web session expired → `node scripts/zoom-web-login.mjs`, then retry.
      iv. Re-grep the queue and load the staged file. Gemini-mode timestamps are approximate; names come from the `--speakers` hint — attribute by content where they look off (Phase 2 does this anyway).
   e. Still zero + not a Zoom meeting + puller exit 0 → Otter has nothing matching. Tell the user to paste, or check the queue under a different client name.
   f. Puller failed/timed out → report the exit code + first stderr line, then try the Zoom fast path (d) before asking the user to paste.
5. **The user pastes a transcript anyway:** the pasted version wins.

If a staged file is >7 days old, flag it before processing (likely a queue-cleanup bug, not a fresh meeting).

---

## Phase 1: Resolve client

Per-client work lives under the `clientFolderRoot` from your settings (default `clients/`), following the `clientFolderConvention` from your settings (default `clients/<name>/` with `01-research/` and `02-conversations/`). The steps below assume that convention.

### Existing client
1. Kebab-case the client name → `<clientFolderRoot>/[name]/`.
2. Read the client's `CLAUDE.md` for relationship history.
3. File organization: if `01-research/` or `02-conversations/` exists, use `02-conversations/` for transcript + summary; legacy `transcripts/` + `summaries/` if present; else create `02-conversations/`.

### New prospect (no folder)
1. Propose `<clientFolderRoot>/[first-last]/`; confirm with the user.
2. Create `<clientFolderRoot>/[name]/`, `01-research/`, `02-conversations/`, and a `CLAUDE.md` (populated in Phase 4).

---

## Phase 2: Process transcript + DETECT SIGNALS

### Speaker diarization — hand it to /speaker-id
Otter's "who said what" is routinely wrong (it splits a 2-person call into "Speaker 1-9," swaps the user and the client, lets side conversations bleed in), so the transcript must be corrected, never trusted as-is.
1. **Build the roster** from what you know: **you are always present**; `calendar_guests` (names + emails) and `matched_email` from the staged frontmatter Phase 0 loaded; the client's name + any named colleagues from their `CLAUDE.md`; the meeting type's expected headcount.
2. **Invoke the `/speaker-id` skill** with the transcript, that roster, and the source (`otter`, or `zoom` on the Zoom fast path). It relabels every line to real names, isolates bleed-in, and flags (`⟦?⟧`) only what genuinely can't be resolved. For a long transcript, run it in a subagent so the full text doesn't fill this context. **If `/speaker-id` isn't installed**, do the same relabel inline yourself from the roster (every line to a real name, a `[Side conversation]` label, or a `⟦?⟧` flag; never leave a bare "Speaker N") and note slightly lower confidence: never skip diarization or stop. Take back the **relabeled transcript + speaker map + confidence note**.
   **Clean-labels fast path:** if the source already tags every line with the correct REAL names (they match the roster) and only trivial strays remain (a few one-word "Speaker N" fragments sitting mid-sentence inside one person's speech), fix those strays inline, note "source labels were clean" in the diarization header, and SKIP the /speaker-id invocation entirely — a full pass (or subagent) on an already-clean transcript is pure waste. Reserve /speaker-id for genuinely scrambled transcripts: bare "Speaker 1-9" tags, swapped speakers, bleed-in, or any roster mismatch.
3. **Carry the confidence forward — attribution is best-effort, not gospel.** Note where it's shaky. A `⟦?⟧` line is low-confidence: never quote it in a Phase 6 post and never propagate it into another client's file in Phase 5 (the cross-client rule in [references/lane-model.md](references/lane-model.md) enforces this). Show the speaker map in the closing report. Only ask the user when a speaker who genuinely matters is a coin flip.

### Meeting type
Auto-detect per [references/meeting-types.md](references/meeting-types.md). If ambiguous, ask.

### Background enrichment (MANDATORY floor for prospects, not a ceiling)
Before writing anything, find real public background on the person + company. **Skip only if:** `01-research/` exists from `/research-prospect`; OR `CLAUDE.md` already has a populated About + Quick Reference; OR the user said "skip research"; OR the meeting is non-prospect (internal/coaching/personal).
Otherwise run the full ladder: LinkedIn `WebFetch` if a URL exists → 2-3 parallel `mcp__perplexity__perplexity_search` queries → `WebFetch` the company site → directory lookup (BBB / state records) for trades/small-biz → email discovery (CLAUDE.md, `gws gmail` search, existing CRM card / same-company pattern, site contact page; mark `[not yet captured]` only after all four fail — NEVER fabricate). Synthesize `backgroundContext` (name, title, company, domain, address, phone, 3-6 positioning bullets). **Floor, not ceiling** — one empty query is not "no info found." Escalate to the user before creating a CRM card if you still have less than name+title+company+domain.

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
`<clientFolderRoot>/[name]/02-conversations/YYYY-MM-DD-[type]-transcript.md` (the `clientFolderRoot` from your settings, or the folder's existing pattern). Template: [templates/transcript.md](templates/transcript.md). Save the **fully relabeled** transcript from the `/speaker-id` pass: every line carries a real name (or a `⟦?⟧` flag / `[Side conversation]` label) — no bare "Speaker N" survives. **Transcript is sacred** — full content, every line, never summarized or truncated; relabeling changes the speaker tag only, never the words. Do this regardless of length: a long or badly-scrambled file gets relabeled in full, not saved raw. Add the short **diarization-quality header note** the template specifies (speaker count, confidence, flagged spans) so the reader knows how trustworthy the attribution is.

### 3B. Create summary — FROM the signal ledger
`<clientFolderRoot>/[name]/02-conversations/YYYY-MM-DD-[type]-summary.md` (the `clientFolderRoot` from your settings). Template: [templates/summary.md](templates/summary.md). **Build it from the Phase 2 signal ledger** so nothing soft gets dropped.
- Lead with the verdict. Direct, factual prose, no fluff. Pull quotes that reveal intent/commitment.
- Capture specific numbers, names, dates, tools, pricing. Action items have an owner + are concrete.
- Give the soft signals real estate: a dedicated section each for meeting-prep coaching (type 2), connections (type 3), and offer ideas (type 4) when they exist — those are the ones that used to evaporate.
- Omit empty sections. Under ~200 lines, scaled to meeting length.

### 3C. Follow-up email — Lane 2, inline-built, draft only
This is a **Lane-2** outward item AND the razor's anchor (see Phase 5). **Write the email body by invoking the `/email` skill — mandatory, every time, never hand-write it** (it enforces your email voice rules + the real stored signature). Build everything the email *needs* (research, facts, PDFs, a payment link for any money owed) **inline** and bake/attach it. **Always do BOTH: show the email inline in chat AND create the draft** in the `emailTool` from your settings — you want it sitting in your drafts every time, not gated on approval. Never send it (you send). **Reconcile first** — check for an existing draft/thread before composing.

If money was agreed, create the invoice in the `paymentsTool` from your settings: a **real invoice** with its hosted invoice link in the body — a real numbered invoice with a due date and a PDF, **NOT a bare payment link** (a standing rule). Flow (Stripe shape): find-or-create the customer by email → `create_invoice` with `days_until_due` (14 default) → `create_invoice_item` (reuse an existing price for the rate, or create product+price once) → `finalize_invoice` → put the returned hosted `url` in the email. Finalize only; never trigger the payments tool's own send (your email is the delivery). Don't just say "invoice coming." (Live key `STRIPE_API_KEY` / Stripe MCP, see `references/stripe-api.md`.) If no `paymentsTool` is configured, don't fabricate a link: flag in the closing report that money is owed and the user needs to send the payment request manually.

Drafting rules: [templates/follow-up-email.md](templates/follow-up-email.md). Draft + signature procedure: [references/gmail-draft.md](references/gmail-draft.md). Voice: read the `voiceGuidePath` from your settings.

---

## Phase 4: Update documentation (Lane 1 — do now)

These are mechanical, safe, reversible — just do them. They appear in the closing report under "Done."

- **4A. Client `CLAUDE.md`** — read first, then targeted updates only (Status, Next Steps, new info, Files). Build new-prospect files from the standard structure; never fabricate contact info (`[not mentioned]`).
- **4B. Rollup** the `clientRollupFile` from your settings — update the client's row (Status, Next Step), or add a row in the right status group for a new prospect.
- **4C. Auto-memory** — add/update the client's section in your auto-memory file (key decisions, time-sensitive info, relationship intel). Update, don't duplicate.
- **4D. Folder structure** in root `CLAUDE.md` if a new client folder was created.
- **4E. CRM — get everyone on the board, THEN log the meeting** (skip only for internal/personal meetings, never for a real outside person or company; skip CRM logging entirely if no `crm` is configured in your settings, and note it once). The CRM is the `crm` from your settings, board id = the `crmBoardId` from your settings. **Dedup-search first** — look the person up by name, then by company, so you never double-create. **No match → CREATE one**: name is the person's name ONLY (company goes in its own field, never in the title), with title/email/phone + one line of context from Phase 2 enrichment (**never fabricate a field — omit it rather than invent it**). List/column placement, using the values from your settings: a brand-new person you just met → the `crmList.newPerson` list if your settings define one (this is the default — everyone the user meets gets carded); active prospect conversation → the `crmList.activeProspect` list; explicitly not-now → the `crmList.futureProspect` list; referral partner/COI → the `crmList.partner` list; they said yes/paying → the `crmList.client` list. Apply the appropriate label from the `crmLabels` in your settings when the offer fit is clear. Then **log the meeting as a dated comment/touch on the card** (date, summary path, top 3 actions) — that keeps the card's last-activity honest. **No due dates** (a common board rule) and list/column moves for EXISTING cards stay Phase 5 triage decisions — always re-fetch the card's current list first (state goes stale), and never move anyone into a "won"/client stage without a real verbal yes.
- **4F. AIOS research index** — the index file is the `productResearchIndexPath` from your settings; read the `CLAUDE.md` in that same folder first. If this meeting is a **formal AIOS meeting** (the person is on the index roster, or this was a new formal AIOS discovery/session for someone who isn't yet), append the row to that index file: correct tier table, next session number for that person, links to the transcript + summary just filed. New formal-AIOS prospects enter as Tier 2; a Tier 2 person who has now PAID flips to Tier 1 (move all their rows). Not an AIOS meeting → skip silently. If no `productResearchIndexPath` is configured, skip this step. The index must never go stale; you should never have to re-explain the roster.
- **4G. Knowledge graph — compound the people + company from this meeting.** Gated on the `knowledgeGraph` from your settings (yours might be `knowledge/`) — the wikilinked Obsidian graph over the repo; read its `CLAUDE.md` for the full spec. This is the LIVE half of compounding (the other half runs at `/end-session`), and a meeting is the single richest source of new entities, so do it here, every debrief, the moment the intel is fresh. **Skip silently** if no `knowledgeGraph` is configured, or this was a purely internal/personal meeting that surfaced no durable new entity. Otherwise, for the person(s) met AND their company (plus any genuinely new concept/project the meeting crystallized):
  - **Dedup-search first** — look in the graph's `people/` and `companies/` subfolders for an existing note (try name + company); **prefer updating** the existing note over creating a near-duplicate (same anti-rot rule as the CRM dedup in 4E).
  - **Create or update** the note following the graph's `CLAUDE.md` frontmatter spec: `type` (person/company/…), `created` (`date '+%m/%-d/%y'`), `tags`, `status` (`active`/`prospect`/`archived` for people/companies/projects), `related`, `source`. Filenames are kebab-case slugs.
  - **`source:`** → the client's `CLAUDE.md` + the summary file you just wrote in Phase 3B (relative paths from the note). **`related:`** → `[[wikilinks]]` to the company note, the referrer or any type-3 connection from the Phase 2 ledger, and the relevant concept/project (e.g. `[[ai-operating-system]]` for an AIOS prospect).
  - **No fabrication** — every claim traces to the Phase 2 enrichment or the summary; omit what you can't source. **Honor diarization confidence** — never propagate a `⟦?⟧` low-confidence attribution into a knowledge note (same bar as the Lane 1 cross-client write rule).
  - **Hub-link them in.** Project/product notes in the graph are HUBS with a People section — clicking a product must show everyone in it. If this meeting puts the person into a product's orbit (a discovery, a trial, a signup), add their `[[link]]` to that project note's People section under the right group (paying / trial / warm), and make the person's note link the project back. If a `.parity.json` sits at the graph root and that hub carries a manual `roster` list (e.g. the SMM hub), add the person's slug there too — that's what keeps the gap machine-detectable. (The AIOS hub roster derives automatically from the 4F index row you just wrote.)
  - These are in-repo files; they get committed by the normal backup, and `/end-session` Phase 3 is idempotent with this step (dedup means whichever runs first creates, the other updates) so the two never fight. Report what you created/updated under "Done."
- **4H. Clear the staging queue** — delete the staged transcript file (`rm .claude/skills/otter-stage/queue/<file>.md`); the `otid` is already in `processed.json` so it won't re-stage. Skip if the transcript was pasted (nothing staged).

---

## Phase 5: Triage every signal into three lanes + dispatch

The detection is done (Phase 2 ledger), the bookkeeping is done (Phase 4). Now sort every remaining actionable signal into three lanes and dispatch. **Do not print a checklist for the user to do themselves** — the whole point is the actions actually happen (or get teed up). Full rules: **[references/lane-model.md](references/lane-model.md)**.

**The razor:** *is this needed for the follow-up email (or, no email, for what the user owes this person now)?* YES → build inline (heavy inline is fine — real research plus attachments baked directly into the email is the model; "needed" is strict, a promise of future work is NOT needed). NO → standalone → Lane 3 prompt. Genuine fence → ask once.

- **Lane 1 — Do now, report.** Mechanical/safe/reversible: the Phase 4 updates + person-to-person cross-references into other files (type 3). **Cross-client writes require high diarization confidence**; garbled source → flag it, don't write it. Everything done appears under "Done."
- **Lane 2 — Outward, you trigger.** Email, calendar invite, invoice (in the `paymentsTool` from your settings), intro. **Reconcile against reality first** via the `emailTool` / `calendarTool` from your settings (often driven by the `emailDraftMethod` from your settings, e.g. `gws`) — if the user already sent the invite, *perfect it* (rename, Meet→Zoom, fix the gap) rather than duplicate, and let them trigger the guest update. Stage everything; never auto-fire. Batch into "Ready to send."
- **Lane 3 — Loaded prompt for a fresh window.** Standalone heavy work (meeting prep, a new skill, a deck). Do **bounded** research (Gmail/Calendar/who-is-X/what-was-said + file pointers), bake it into a paste-ready prompt saved to `prompts/YYYY-MM-DD-<slug>.md` + echoed in chat. Don't do the heavy build here. Rank + flag time-sensitive ones. Escape hatch: if the user says "just do it now," build inline.

End with the **closing report** (three sections — Done / Ready to send / Prompts queued, plus Flagged if any). Format in [references/lane-model.md](references/lane-model.md). Pick executors (Skill / MCP / CLI / Agent) from [references/awareness-surfaces.md](references/awareness-surfaces.md) + [references/executor-examples.md](references/executor-examples.md) — open lists, not catalogs.

---

## Phase 6: Offer a LinkedIn post (every debrief, after the closing report)

**Gated on `socialPublishTool` from your settings** — if no `socialPublishTool` is configured, skip Phase 6 silently (stop at the closing report). When it is configured, run this phase.

After the closing report, make ONE clean offer to turn the meeting into a post for the user's personal LinkedIn — their lesson, their voice, the client anonymized. **Every debrief, always something** (a business lesson OR a human moment, never a "nothing here" hedge), one strongest angle, then stop. Full procedure — the angle heuristic, anonymization, the `/content-unit` handoff, the image plug + rotating queue, the browser preview, and the publish path — lives in **[references/content-post.md](references/content-post.md)**.

The shape: mine the Phase 2 ledger + Phase 3B summary for the single best angle → offer it in one stanza → on "yes," anonymize the material and hand it to `/content-unit` (tell it to auto-pick the strongest hook — no question — and capture its slop-clean output verbatim) → `scripts/pick-style.mjs` + `scripts/render-card.mjs` make the on-brand image → `scripts/preview-post.mjs --open` shows a mock LinkedIn post in the user's browser → on an explicit **"post it,"** publish via the `socialPublishTool` from your settings to the `socialAccountId` from your settings (when `socialIsPersonalFeed` from your settings is true, omit any pageId so it lands on their personal feed; Playwright with a persistent profile is the fallback) and confirm it landed. Never auto-fire; first live post has no API undo, so say so. (Standalone / pasted-thread runs skip Phase 6 — there's no meeting to mine.)

---

## Important rules

1. **Every new file gets a date stamp** (`M/D/YY - HH:MM EDT`, repo-wide).
2. **Never fabricate.** No invented emails, IDs, paths, stages. `[not mentioned]` or ask.
3. **Read before writing.** Always read existing `CLAUDE.md` before editing.
4. **No em dashes** anywhere.
5. **Never auto-send anything outward** — email, calendar updates, invoices all stage for the user's trigger (Lane 2). The only email path in the `emailTool` from your settings is creating a draft (`drafts create` for Gmail), never `messages send` / `drafts send`.
6. **Detect from the raw transcript before summarizing** — the summary is lossy; detecting off it is why things got missed.
7. **Perplexity:** `_search` only. `_reason` / `_research` are banned + hook-blocked.
8. **Verify before acting on stale context** — re-query a CRM card's current list/column before moving it.
9. **Ask, don't guess** — ambiguous meeting type, unclear client name, a *material* speaker who's a genuine coin flip (relabel + flag the rest yourself via /speaker-id, don't ask about every uncertain line), or a genuine inline-vs-prompt fence.
10. **The Phase 6 LinkedIn offer is one clean offer, never a nag** — one angle, anonymize by default ("name them" only on the user's say-so), never publish without an explicit "post it."
11. **Money-facing builds get a client's-eye check before "done."** When the debrief builds anything a client will pay through or see a price on (a coupon, custom pricing, a portal pre-stage, an invoice, a checkout), close the loop by rendering the CLIENT'S actual live view — their real rendered page, the real checkout total — not just by proving the parts individually. Report that rendered evidence in the closing report.

## Edge cases
- **Very short meeting (<10 min / <500 words):** proportionally short summary, skip empty sections.
- **No speaker labels (Super Whisper):** build the roster from frontmatter + CLAUDE.md first, then hand it to /speaker-id; ask who was in the room only if you still can't tell the voices apart.
- **Legacy `02-conversations/`:** use it, don't create new subfolders.
- **Follow-up with existing client:** read CLAUDE.md first, incremental updates not rewrites.
- **Standalone / pasted thread:** Phases 2 + 5 only.

## Self-ping (do this at the end of every completed run)

If a `TIME-SAVED.md` file exists at your repo root, update your row in it ([`TIME-SAVED.md`](../../../TIME-SAVED.md)). Skip silently if it doesn't exist.
