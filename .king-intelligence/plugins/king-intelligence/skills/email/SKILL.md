---
name: email
description: Draft an email in your own voice. Use for any request to write, draft, or compose an email you will send — "write me an email to Sam", "draft an email to Riley about Z", "email Sam about the proposal", or when you want an email body produced for your email tool. If this setup has its own tailored version of this skill, prefer that one.
argument-hint: "[recipient name or meeting context]"
allowed-tools: Read, Bash, AskUserQuestion, Grep, Glob, Skill
---

# /email — Draft an email

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## Goal

Produce one email draft you would actually send. Short, plain, in your own voice. Don't fabricate.

## Voice settings

This skill can be wired to your own voice via `/king-intelligence:adapt email`. Read the saved settings before drafting:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/print-config.mjs" "${CLAUDE_PLUGIN_DATA}/config.json"
```

Look at `skills.email` in the JSON:
- `voiceGuidePath` — if set, **read that file in full, every invocation, no skip.** It overrides the generic craft below.
- `voiceDescription` — if set and there's no `voiceGuidePath`, hold it as a lightweight voice guide.
- `signature` — appended when a draft is created in your email tool; if set, don't also type a name at the end of the body (avoids a doubled-up close).
- `bannedPhrases` — extra words/phrases to grep for on top of the universal anti-slop blacklist (Phase 4 below).
- `emailTool` — which tool (Gmail, Outlook, etc.) to create the draft in, if any. If unset, or the skill can't reach it, hand over clean text to paste instead.

If neither `voiceGuidePath` nor `voiceDescription` is set, use "Default voice craft" below as-is.

---

## Phase 1: Context intake

Ask whatever is missing. Use AskUserQuestion for structured picks; use plain text for open-ended. Never guess.

**Required context:**
1. **Recipient** — first name, last name, email address if a draft should be created in an email tool.
2. **Situation + register.** Situation: first-touch? post-meeting follow-up? bump? reply? intro? handoff? recap after a client session? proactive update? value-add / no-ask? ultra-short confirmation? scheduling offer (§4.3 below)? AND register: (a) client/business, (b) networking/intro, (c) warm peer/friend, (d) cold/first-touch. Register drives tone — a warm peer gets a looser, longer, more personal treatment; a client recap gets a tight, businesslike formula.
3. **The thing(s) this email needs to carry** — list them. One thing? Three things? Be explicit; this drives length (Phase 3). Most replies carry ONE thing and run 10-40 words. If you're past 90 words on a reply, you're over-writing.
4. **What's NEW vs. what was already discussed** — do NOT recap things the recipient already heard. Only list items that are actually new information, unanswered questions, or explicit commitments.

If a meeting transcript or a prior thread gets pasted in, scan it for these answers before asking. If this skill is invoked downstream of a meeting-processing workflow, most of this is already in scope — don't re-ask.

### Guardrails during intake

- If told "just write it, you know the context" and you aren't sure of specific facts (times, names, what the recipient said), STOP and ask. Fabricating specific claims is a critical failure mode — inventing a detail that never happened (e.g. a contact who supposedly "sent two time options" that were never sent) has burned real threads before.
- If a recipient isn't recognized, check your notes / CRM / client records for existing context before drafting.

---

## Phase 2: Load the voice

Apply the settings resolved above. If `voiceGuidePath` is set, use the Read tool to read it in full — **mandatory, every invocation, no skip**, even if it was already read earlier in the session or you're confident you remember the rules. That confidence is exactly when a banned phrase slips through; the file is short, re-read it.

If no voice file or description is configured, use the craft below.

### Default voice craft (used when no voice guide is configured)

This is condensed, general email craft. Swap in something more specific to you via `/king-intelligence:adapt email`.

- **Openers:** `Hey [Name],` is the solid default. No greeting at all is fine for a reply already mid-thread. A bare `[Name],` works for someone you talk to often. `Hi [Name],` reads a little softer or more formal.
- **Closers:** end on a natural, short line — `Looking forward to it!`, `Talk soon!`, `Thanks,`. Don't sign off with a typed name if the email tool's own signature already carries it — that reads doubled-up.
- **Banned:** em dashes (either the `—` character or a spaced ` -- ` double-hyphen), and worn-out filler like "circling back," "just wanted to," "hope this finds you well," "touching base," "at your earliest convenience." Say the plain thing instead.
- **The #1 miss is over-writing.** A reply carrying one thing should usually run 10-40 words. Past ~90 words on a plain reply, cut it down: don't recap what the recipient already knows, don't restate the subject line, don't bullet a feature list they already heard.
- **Structure:** one paragraph per distinct thing the email carries. Three separate asks means three short paragraphs, not one dense one.
- **Rough length guide:** a reply already threaded runs 10-40 words, rarely past 100. A first-touch or cold email stays tight, 60-120 words. A recap with real content to convey runs as long as the content needs — still no padding.

---

## Phase 3: Draft

Apply the loaded voice (Phase 2). Write the draft in chat, not to disk yet.

**Discipline:**
- One paragraph per distinct thing the email carries.
- Opener + closer: plainest possible version. If they feel written-up, rewrite.
- Do NOT include bulleted feature recaps of things the recipient already heard.
- Match length to content density, not a fixed target — see the length guide above (or the voice guide's own, if one is loaded).

---

## Phase 4: Pre-send checklist (every item, every time)

Run every check below against the draft, in order. Any failure → rewrite and re-run from the top. If a loaded voice guide has its own checklist, run that instead (or in addition, if it doesn't cover fabrication/blacklist/ball-return/structure).

### 4.1 Fabrication check

Every specific claim in the draft — times, commitments, meeting references, "as mentioned last time," things the recipient supposedly said — must trace to one of:
- The live email thread (search/read it directly)
- Your notes or memory system
- Something you were told this session

If a claim can't be sourced, either cut it or mark it `[CONFIRM]` and ask before emitting.

### 4.2 Blacklist grep (automated — must run)

Grep the draft body (not the signature) for every banned phrase — the Default voice craft list above, or the loaded voice guide's list, plus any `bannedPhrases` from settings — including both em-dash forms. Any hit → rewrite. Do this yourself; an automated safety check in this environment (if one exists) is a backstop, never the primary check.

### 4.3 Ball-return check (run on every draft)

Ask: **does the draft hand work back to the recipient that could have been done for them?** The tell is asking them to supply something already knowable — times, dates, a link, an invoice number, an amount, a status.

The canonical failure: someone asks "do you have a few hours coming up?" and the draft comes back "send over a few times that work for you." Correct and polite and completely useless — it costs a round trip with someone who may book quickly elsewhere.

- **Draft asks for times, dates, or availability → HARD FAIL unless a real availability check actually ran.** Check an actual calendar or booking system for genuinely open windows before offering anything. Never invent times, and never ask the recipient to propose times your own systems could answer. If no live availability tool is wired up, say so and ask for real times rather than fabricate or offload the work.
- **Never filter what a real availability check returns down to what "feels right."** Offer the actual open windows it returns — don't drop a day for being fragmented, being soon, or sitting near a deadline unless there's an explicit reason to. The recipient can decline a time they don't want; they can't accept one they were never shown.
- **Scheduling offer formula:** 15-35 words, 2-3 real windows across at least 2 different days, ranges not single slots, timezone with the weekday spelled out. A booking link underneath as the easy button, never instead of the times.

  > Happy to. Open on my end: Monday after 10:30, or the following Monday anytime after 9. Which works for your team?

- **Anything else the draft asks for** — an amount, a status, whether something was paid — gets fetched from the real system (payments tool, CRM, client records) or cut. If it can't be checked right now, ask rather than leave a vague ask sitting in the draft.

### 4.4 Structural anti-slop pass (stop-slop) — required on every draft

The phrase grep above catches words. This catches structures. Two parts, both required:

1. Scan the draft for AI-slop structural tells: binary contrasts ("not X, it's Y"), negative listing, false agency ("the decision emerges"), passive voice that hides the actor, narrator-from-a-distance, vague declaratives ("the stakes are high"), crutch adverbs (genuinely/fundamentally/crucially), and throat-clearing openers ("here's the thing," "the truth is"). If the draft leans on any of these, rewrite it directly.
2. **Invoke the `stop-slop` skill on the rewritten draft via the Skill tool, every draft, every time.** It ships in this same plugin, so it is always available. The inline scan above is the fast filter; the skill run is the gate: no email reaches the user without it. Your own voice guide wins wherever it conflicts with stop-slop's rules.

---

## Phase 5: Emit

Display the final draft in chat. Format with clear separator lines for a clean copy-paste:

```
────────── DRAFT ──────────
Subject: [subject line]

[body]
────────────────────────────
```

**If and only if a draft is wanted inside an actual email tool**, and `emailTool` is configured, follow the matching draft-creation procedure this plugin ships (for Gmail via the shared recipe at `${CLAUDE_PLUGIN_ROOT}/skills/debrief/references/gmail-draft.md`). If no such procedure applies, hand over the clean text above to paste in manually.

**Never send.** Only drafts. Review in your email tool before hitting send.

---

## Invocation examples

- `/email` (no args) → asks for recipient + situation
- `/email sam riley` → asks situation + things to carry, checks notes/client records for Sam Riley context
- "write me a quick email to sam confirming the proposal" → auto-invokes this skill, Phase 1 extracts what it can, asks for the rest
- "draft an email to riley thanking her for the intro" → same

## What this skill does NOT handle

- **Sending emails.** Only drafts. Send is a manual action you take.
- **A full post-meeting workflow** (transcript → summary → email + doc updates). Use a dedicated debrief-style skill for that if you have one; this is the lighter-weight path for a standalone email.
- **Mass cold-outreach campaigns.** Those belong in a dedicated outreach tool, not this skill.
