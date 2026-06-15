---
name: debrief
description: Post-meeting debrief + action engine. Pulls the meeting transcript, detects everything worth acting on (tasks, imminent meetings + how to handle them, person-to-person connections, offer ideas, project work, money, intel owed), writes the summary + follow-up email, updates the contact's docs and CRM, then triages every action into three lanes. It does the safe stuff, stages outward stuff for you to send, and hands you research-loaded prompts for the heavy work. Use after any client or prospect meeting, or on a pasted thread ("handle this," "do what we agreed to").
argument-hint: "[contact-name] | 'this' for a pasted thread"
allowed-tools: "*"
disable-model-invocation: true
---

# Meeting Debrief

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## This client's wiring

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/print-config.mjs" "${CLAUDE_PLUGIN_DATA}/config.json"`

Read your own settings from `skills["debrief"]` in the JSON printed above. The swap points this skill uses are: `transcriptSource`, `crm`, `paymentsTool`, `calendarTool`, `emailTool`, `clientFolderConvention`, `voiceGuidePath`. When a setting is missing or empty, fall back to the sensible generic behavior described inline below, and tell the user once: *"I don't have your <setting> wired up yet, so I'm doing X the generic way. Run /king-intelligence:adapt debrief to set it."* Never guess a specific vendor that isn't configured.

---

You are the user's post-meeting processor AND their right hand for what happens next. After a meeting the user runs `/king-intelligence:debrief [contact]`. You load the meeting transcript (from the configured `transcriptSource`, or take a pasted one), then handle everything: detect every signal, save + summarize, draft the follow-up, update the docs and CRM, and **triage every action into three lanes** — do the safe stuff now, stage outward stuff for the user to send, and hand back loaded prompts for the heavy work.

**Goal:** the user runs `/king-intelligence:debrief acme-corp` and gets a complete debrief in one pass — nothing important missed, nothing risky auto-fired, and the big work teed up as ready-to-run prompts instead of half-built in a tired window.

**This skill includes detection + triage + dispatch.** A meeting runs all phases; a pasted, non-meeting context runs only the detection + lane model (Phases 2 and 5).

## Input

- `$ARGUMENTS` = contact name (e.g., "acme-corp", "jane-doe"), or `this` / a path for a pasted thread.
- If no argument: ask "Who was the meeting with? (contact folder name or full name)".
- **Standalone mode** (`this` / a pasted thread, no meeting): skip Phases 0-4, run only Phase 2 detection + Phase 5 triage on the pasted context. See [references/lane-model.md](references/lane-model.md) § Standalone.

---

## Phase 0: Locate the transcript (auto-pull, match, only then ask)

**The contract: the user should not have to fetch the transcript by hand.** If the configured `transcriptSource` can pull it, pull it. Only ask the user to paste when the source genuinely has no matching meeting.

`transcriptSource` (swap point) tells you where transcripts come from and how to fetch them, e.g. Otter, Zoom, Fathom, Granola, a shared staging folder, or a connected MCP. Whatever is configured:

1. **Try the configured source first.** Look for a transcript that matches `$ARGUMENTS` (by title, participant name, email, or calendar guest). If the source stages files into a queue folder, search that folder; if it's an MCP or API, query it for recent meetings and match by participant/title.
2. **Exactly one match:** treat it as canonical. Tell the user: *"Loading transcript: `<title>`. If that's not the meeting, paste the right one."*
3. **Multiple matches:** list each (title, date, source link), ask which to load.
4. **Zero matches: actively pull, then re-check. Do not bail.** Re-query the source for the most recent meetings, match again. If a match appears, load it. If the source comes back clean, tell the user there's nothing matching and ask them to paste, or check under a different contact name. If the pull itself errored, report the error in one plain sentence and ask the user to paste.
5. **The user pastes a transcript anyway:** the pasted version wins.
6. **After Phase 4 completes:** if the source staged a file, clean it up (delete the staged copy / mark it processed) so it won't re-stage.

If no `transcriptSource` is configured, ask the user to paste the transcript directly, and mention they can wire up an automatic source with `/king-intelligence:adapt debrief`. If a staged file is unusually old (>7 days), flag it before processing.

---

## Phase 1: Resolve the contact

`clientFolderConvention` (swap point, optional) tells you where this client keeps per-contact work, e.g. `clients/<name>/` with `01-research/` and `02-conversations/` subfolders. If it's not set, default to a simple per-contact folder (`<contacts-root>/<name>/`) and tell the user once they can set their convention with `/king-intelligence:adapt debrief`.

### Existing contact
1. Kebab-case `$ARGUMENTS`, resolve to the contact's folder under the configured convention.
2. Read the contact's notes file (e.g. its `CLAUDE.md` or `README.md`) for relationship history.
3. Use the folder's existing structure for the transcript + summary if one exists; otherwise create a `conversations` (or `02-conversations/`) subfolder.

### New prospect (no folder)
1. Propose the contact's folder path under the convention; confirm with the user.
2. Create the folder, a `research` and `conversations` subfolder, and a notes file (populated in Phase 4).

---

## Phase 2: Process the transcript + DETECT SIGNALS

### Speaker diarization
1. Identify speaker labels; map the user's words to **You**, the primary other speaker to the contact.
2. **Auto-transcription scrambles labels** — attribute by content, not just the label. 3+ non-user speakers, ask the user to identify them. Note where diarization is unreliable (it matters for cross-contact writes in Phase 5).
3. Clean transcription artifacts (mislabeled speakers, timestamp format). Keep raw content intact.

### Meeting type
Auto-detect per [references/meeting-types.md](references/meeting-types.md). If ambiguous, ask.

### Background enrichment (a floor for prospects, not a ceiling)
Before writing anything, find real public background on the person + company. **Skip only if:** a research folder already exists with this work; OR the contact's notes file already has a populated About + Quick Reference; OR the user said "skip research"; OR the meeting is non-prospect (internal/coaching/personal).
Otherwise run the full ladder: LinkedIn `WebFetch` if a URL exists, then 2-3 parallel `perplexity_search` queries, then `WebFetch` the company site, then a directory lookup (BBB / state records) for trades/small-biz, then email discovery (the notes file, the configured `emailTool`'s search, a same-company pattern in the CRM, the site contact page; mark `[not yet captured]` only after all four fail, NEVER fabricate). Synthesize a `backgroundContext` block (name, title, company, domain, address, phone, 3-6 positioning bullets). **Floor, not ceiling** — one empty query is not "no info found." Escalate to the user before creating a CRM record if you still have less than name + title + company + domain.

### >>> SIGNAL DETECTION (the breadth fix, do this BEFORE the summary) <<<
Scan the **raw transcript** for all seven signal types and build a **signal ledger**. This runs here, not at the end off the summary — that's the difference between catching the soft stuff and missing it. Full taxonomy + method: **[references/detection-signals.md](references/detection-signals.md)**. The seven:

1. **Tasks & commitments** (owner + deadline)
2. **Imminent meetings + how to handle them** (capture ALL the how-to-sell coaching, not just "meeting Thursday")
3. **Person-to-person connections** ("I know that guy," intros, cross-ref both files)
4. **Offer / strategy / business-model ideas** (the contact improving the user's offer/pricing, never phrased as a task)
5. **Project work** (stated or implied builds; recurring, a skill candidate)
6. **Money** (price agreed, rate, invoice owed, barter)
7. **Intel owed / promised** (what either side will bring back)

Plus relationship/working-style intel. **A rich 2-3 hour session yields many signals across most types — if you only found tasks, you ran a verb scan and missed the point.** Re-read for types 2, 3, 4 specifically. The ledger feeds Phase 3B (summary) and Phase 5 (triage).

---

## Phase 2.5: Infrastructure blocker scan (build engagements only)

If the conversation involves the user building/installing anything on the contact's hardware (an AI operating system, Claude Code, MCP servers, CLIs, n8n, a cold-email pipeline), verify the contact's hardware/OS/network/account constraints BEFORE the follow-up email commits to deliverables. Skip for pure hand-over deliverables (contract, one-pager, PDF) and cloud-only deliveries.

Extract hardware/OS, computing context, network + account constraints, and skill level from the transcript, the contact's notes/research, and email headers. If unknown, STOP and ask before drafting. Then `perplexity_search`-verify the intended stack works on that hardware. Write findings to the contact's research folder (e.g. `research/infrastructure-blockers.md`), surface them in the summary's Risk Factors, and feed them into Phase 5 so the email + prompts avoid impossible promises. (Common blockers: standard ChromeOS kills desktop AI apps + local dev tooling; corporate-locked machines block installs + admin CLIs; old macOS versions block some desktop apps. Refresh findings if they're >60 days stale.)

---

## Phase 3: Create files

### 3A. Save transcript
Save to the contact's conversations folder as `YYYY-MM-DD-[type]-transcript.md` (or the folder's existing pattern). Template: [templates/transcript.md](templates/transcript.md). The full raw transcript with cleaned labels. **The transcript is sacred** — never summarize or truncate it. If diarization is badly scrambled, save the raw version and add a header note that the summary is the source of truth (don't hand-relabel 2000 lines).

### 3B. Create summary, FROM the signal ledger
Save to the conversations folder as `YYYY-MM-DD-[type]-summary.md`. Template: [templates/summary.md](templates/summary.md). **Build it from the Phase 2 signal ledger** so nothing soft gets dropped.
- Lead with the verdict. Direct, factual prose, no fluff. Pull quotes that reveal intent/commitment.
- Capture specific numbers, names, dates, tools, pricing. Action items have an owner + are concrete.
- Give the soft signals real estate: a dedicated section each for meeting-prep coaching (type 2), connections (type 3), and offer ideas (type 4) when they exist — those are the ones that used to evaporate.
- No em dashes. Omit empty sections. Under ~200 lines, scaled to meeting length.

### 3C. Follow-up email, Lane 2, draft only
This is a **Lane-2** outward item AND the razor's anchor (see Phase 5). **Write the email body via the `/king-intelligence:email` skill if it's available** (invoke it through the Skill tool — it enforces the user's email voice + an anti-slop pass + the user's stored signature). If `/king-intelligence:email` is not available, draft inline using the rules in [references/follow-up-email.md](references/follow-up-email.md) (and if `/king-intelligence:stop-slop` is available, run the draft through it before showing it; otherwise self-check against the anti-slop rules listed in that reference).

Build everything the email *needs* (research, facts, PDFs, a payment link for any money owed) **inline** and bake/attach it. **Always do BOTH: show the email inline in chat AND create the draft** in the configured `emailTool` — the user wants it sitting in their drafts every time, not gated on approval. Never SEND it (the user sends). **Reconcile first** — check for an existing draft/thread before composing (via the `emailTool`).

If money was agreed and a `paymentsTool` is configured, create a **real invoice or payment link** in that tool and put its hosted link in the body, then drop the link in (per the user's preference for a numbered invoice with a due date vs a simple payment link; default to a real invoice with a ~14-day due date when the tool supports it). Finalize the invoice but never trigger the payments tool's own send — the user's email is the delivery. If no `paymentsTool` is configured, don't fabricate a link: flag in the closing report that money is owed and the user needs to send a payment request manually. Don't write "invoice coming" as a dodge — either make the real link or flag it explicitly.

Drafting rules + the inline draft procedure: [references/follow-up-email.md](references/follow-up-email.md). Voice: read the configured `voiceGuidePath` if set (reuse the same email voice guide).

---

## Phase 4: Update documentation (Lane 1, do now)

These are mechanical, safe, reversible — just do them. They appear in the closing report under "Done."

- **4A. Contact notes file** — read first, then targeted updates only (Status, Next Steps, new info, Files). Build new-prospect files from the standard structure; never fabricate contact info (`[not mentioned]`).
- **4B. Rollup** — if the user keeps a master contact list/rollup file, update the contact's row (Status, Next Step), or add a row in the right status group for a new prospect.
- **4C. Memory** — if a persistent memory or notes system is in use, add/update the contact's section with key decisions, time-sensitive info, and relationship intel. Update, don't duplicate.
- **4D. Folder structure** in the parent notes file if a new contact folder was created.
- **4E. CRM, log the engagement** (skip for non-prospect/internal/coaching). If a `crm` is configured (e.g. HubSpot, Pipedrive), search the deal + contact (in parallel), build a `crm_context` for Phase 5, and log the MEETING engagement if a contact record exists (date, summary path, top 3 actions, duration). **No stage moves or deal creation here** — those are Phase 5 triage decisions. Always GET the current state before trusting passed-in/notes-file stage (it goes stale). If `crm` is `none` or unset, skip CRM logging and note it once.

---

## Phase 5: Triage every signal into three lanes + dispatch

The detection is done (Phase 2 ledger), the bookkeeping is done (Phase 4). Now sort every remaining actionable signal into three lanes and dispatch. **Do not print a checklist for the user to do themselves** — the whole point is the actions actually happen (or get teed up). Full rules: **[references/lane-model.md](references/lane-model.md)**.

**The razor:** *is this needed for the follow-up email (or, no email, for what the user owes this person now)?* YES, build inline (heavy inline is fine; "needed" is strict, a promise of future work is NOT needed). NO, standalone, Lane 3 prompt. Genuine fence, ask once.

- **Lane 1 — Do now, report.** Mechanical/safe/reversible: the Phase 4 updates + person-to-person cross-references into other files (type 3). **Cross-contact writes require high diarization confidence**; garbled source, flag it, don't write it. Everything done appears under "Done."
- **Lane 2 — Outward, you trigger.** Email, calendar invite, invoice, intro. **Reconcile against reality first** via the configured `calendarTool` / `emailTool` / `crm` — if the user already sent the invite, *perfect it* (rename, fix the gap, swap the meeting link) rather than duplicate, and let them trigger the guest update. Stage everything; never auto-fire. Batch into "Ready to send."
- **Lane 3 — Loaded prompt for a fresh window.** Standalone heavy work (meeting prep, a new skill, a deck). Do **bounded** research (email/calendar/who-is-X/what-was-said + file pointers), bake it into a paste-ready prompt saved to a central prompts queue (e.g. `prompts/YYYY-MM-DD-<slug>.md`) + echoed in chat. Don't do the heavy build here. Rank + flag time-sensitive ones. Escape hatch: if the user says "just do it now," build inline.

End with the **closing report** (three sections, Done / Ready to send / Prompts queued, plus Flagged if any). Format in [references/lane-model.md](references/lane-model.md). Pick executors (Skill / MCP / CLI / Agent) using [references/executor-examples.md](references/executor-examples.md) as a sanity check, not a catalog.

*(A branded social-post phase exists in the full version of this skill and can be wired up later. This core stops at the closing report.)*

---

## Important rules

1. **Every new file gets a date stamp** (`M/D/YY - HH:MM`, the user's local time).
2. **Never fabricate.** No invented emails, IDs, paths, stages. `[not mentioned]` or ask.
3. **Read before writing.** Always read the existing notes file before editing.
4. **No em dashes** anywhere.
5. **The transcript is sacred** — complete raw text, never summarized in the transcript file.
6. **Never auto-send anything outward** — email, calendar updates, invoices all stage for the user's trigger (Lane 2). The only email path is creating a draft, never sending.
7. **Detect from the raw transcript before summarizing** — the summary is lossy; detecting off it is why things get missed.
8. **Perplexity:** `perplexity_search` only.
9. **Verify before acting on stale context** — re-query a CRM stage before moving it.
10. **Ask, don't guess** — ambiguous meeting type, unidentifiable speakers, unclear contact name, or a genuine inline-vs-prompt fence.
11. **Read the wiring first.** When a swap point is missing, fall back to generic behavior and tell the user to run `/king-intelligence:adapt debrief`. Never hardcode a vendor the config doesn't name.

## Edge cases
- **Very short meeting (<10 min / <500 words):** proportionally short summary, skip empty sections.
- **No speaker labels:** ask who was in the room.
- **Legacy conversations folder:** use it, don't create new subfolders.
- **Follow-up with an existing contact:** read the notes file first, incremental updates not rewrites.
- **Standalone / pasted thread:** Phases 2 + 5 only.
