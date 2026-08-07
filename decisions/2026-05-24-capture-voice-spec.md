# /capture-voice spec
created: 05/24/26 - 19:42 EDT

Locked via `/grill-me` session on 2026-05-24 (REBUILD-PLAN.md item P4). This is the design contract for the `/capture-voice` skill. The P5 plan item (build `/capture-voice` locally) implements against this spec; D5 publishes the built skill to `BeltDoor/aios-template` `main` as the first post-v1.0 commit. Do not re-litigate without re-grilling.

---

## 1. Purpose (one line)

`/capture-voice` is the foundational skill that builds `/onboarding/voice-profile.md` from the user's real outbound emails, producing a research-backed voice contract that every future draft-related skill (email, post, document) reads to write as the user.

---

## 2. Locked decisions

11 calls locked during the 2026-05-24 grill. Each is the contract P5 must honor.

### 2.1 Input source — email corpus from connected provider
- **Pull from** the email Connector the user has already authorized via claude.ai → Gmail OR Outlook (whichever is in `CONNECTIONS.md` § 1). Both providers verified working in Claude Code via VS Code (per resolved Concern 1).
- **Query.** `from:me`, last 6-12 months, exclude `category:promotions` + `category:social` + auto-replies / out-of-office. Target ~300 sent emails.
- **Hard precondition.** /skill-builder's connector hard gate (§ 2.6 of `/skill-builder` spec) ensures Gmail or Outlook is connected BEFORE the install trigger fires. /capture-voice can assume "user has Gmail or Outlook connected" as a hard precondition — if neither is present, it stops cleanly and tells the user to connect one via claude.ai → Settings → Connectors and re-invoke.
- **No API keys required.** Uses claude.ai's hosted MCP for the email provider (per F7 CONNECTIONS.md template). No new env vars introduced.

### 2.2 Selection algorithm — LLM-driven diversity + user-confirm gate
- After pulling 300 emails, send all 300 as a single context block to Claude (Opus 4.7's 1M context handles ~30k tokens easily).
- **Prompt Claude to pick 5 maximally diverse exemplars across these dimensions:** length (1-line reply vs multi-paragraph), formality (casual vs formal), intent (reply / initiate / follow-up / decline / proposal), recipient-type (client / vendor / peer / cold), mood (transactional / warm / direct / explanatory).
- **Surface to the user.** Show the 5 picks each with a 1-line context note: "Customer follow-up after no response" / "Decline to a vendor pitch" / etc. Plus a 1-line reasoning: "Picked this one because it shows your follow-up voice — direct, no preamble."
- **Single user-confirm gate.** Freeform reply: "good" / "ship these" → proceed. OR "swap [N] for something else" → Claude picks a replacement from the remaining 295. Up to 2 swap rounds, then proceed (per the 2-iterate-cap pattern in /skill-builder § 2.10).
- **Cap at 5 exemplars.** Per arXiv 2509.14543 + multiple sources: gains plateau past 5. Going to 7-10 bloats every downstream draft prompt for marginal benefit.

### 2.3 Anti-pattern capture — LLM proposes from corpus + user confirms/adds
- After exemplar confirmation, Claude does a second pass on the 300 emails specifically extracting **what's notably absent or rare**. Surfaces 5-8 candidate anti-patterns:
  - "I never see you use em-dashes — lock as banned?"
  - "You never open with 'Hope this finds you well' — lock as banned?"
  - "Your sign-off is always 'Thanks,' (never 'Best regards' or 'Cheers') — lock the convention?"
  - "You never use bullet lists in emails — lock as a stylistic ban?"
- **Single user-confirm gate.** Freeform reply: "all good" → proceed. OR user can edit any line, drop any line, or add their own (e.g., "Also never call clients 'guys'"; "Don't use the word 'leverage'").
- **Why this matters.** Negative examples meaningfully improve voice adherence (jeffbullas: 8-12 negatives recommended; prompthub: positives AND negatives help). Corpus alone won't surface user-known landmines — Jacob's own em-dash ban wasn't visible in his journal, only in his explicit instruction.
- **Target range.** 8-12 anti-patterns in the final profile.

### 2.4 Signature words/phrases extraction
- Same second-pass run as § 2.3. Claude identifies vocabulary tics that recur across the 300 emails — bridge words, intensifiers, signature phrases, characteristic transitions. Pulls 10-20 candidates.
- **No user gate.** This section is corpus-derived only — the user typically isn't aware of their own tics. Bake into the profile as observed.
- **Why this matters.** Per arXiv 2509.14543 "+Snippet" finding: authentic text fragments yield the strongest perceived-human boost in generated outputs. Signature phrases are condensed snippets.

### 2.5 Output file shape — lean, ~150 line cap
`/onboarding/voice-profile.md` has exactly 6 sections in this order:

1. **H1 + creation stamp** per Decision 26:
   ```markdown
   # Voice Profile
   created: <mm/dd/yy - HH:MM EDT>
   ```
   On re-runs: `created:` stays original, `updated:` line is added/refreshed below it.

2. **How Claude should use this** (1-2 lines).
   > "Before drafting anything I'll send as myself (emails, social posts, SMS, replies), read this top-to-bottom and match the patterns in the exemplars at the bottom. The exemplars are the gold standard; the rules constrain edge cases the exemplars don't cover."

3. **Voice rules** (~10 short bullets — tone, formality, sentence-length tendency, opener pattern, sign-off, paragraph rhythm, etc. — extracted from corpus).

4. **Banned patterns** (8-12 anti-patterns from § 2.3, each as a one-line bullet with a brief "why" when non-obvious).

5. **Signature words/phrases** (10-20 items from § 2.4, formatted as `phrase — typical use`).

6. **5 verbatim email exemplars** (unedited copies of the user's actual emails, with a 1-line context note above each — "Customer follow-up after no response" / "Decline to a vendor pitch" — and a blank line between exemplars).

**Length cap.** Soft 150 lines. If signature words/phrases section threatens to push past, trim to top 12 by frequency.

**Format choices.**
- NO `voice_parameters` YAML block. Per arXiv 2509.14543 + KI's own research finding: LLMs ignore 0-1 sliders in favor of prose + exemplars. Sliders are human documentation only and bloat the file.
- NO platform overrides (LinkedIn vs SMS vs cold-email). v1.0 writes ONE merged profile. Multi-platform tuning is `/skill-builder` modify-existing territory after the user has 2-3 draft skills in flight.

### 2.6 Test step — generate 1 sample + user rates 1-5
After the file is written, run a fixed test:

- **Fixed test prompt** (baked into SKILL.md, not LLM-determined): "Draft a 4-sentence follow-up email to a prospect who went quiet after a discovery call last week. They expressed interest in your services but haven't replied to your initial proposal."
- **Generation.** Claude reads the newly-written `/onboarding/voice-profile.md`, drafts the test email matching the voice.
- **Display.** Show the draft in chat. Ask user to rate 1-5: "Does this sound like you?"
- **Score branches.**
  - **≥ 4** → proceed to commit (§ 2.10).
  - **≤ 3** → enter the iterate loop (§ 2.7).

### 2.7 Iterate cap — 2 fix cycles, then ship-or-scrap
- **Cycle 1.** Ask user ONE specific question: "Was the issue (a) the exemplar mix didn't cover this voice mode, (b) a missing banned-pattern that snuck in, or (c) the rules block missed something?"
  - **(a)** → re-pick exemplars (one swap round) → regenerate test draft.
  - **(b)** → add the missing anti-pattern → regenerate test draft.
  - **(c)** → add/refine 1-2 rules → regenerate test draft.
- **Cycle 2.** Same loop. One more fix, one more regenerate.
- **After cycle 2**, `AskUserQuestion` with three options:
  - "Ship as-is — I'll edit voice-profile.md manually if I need to (Recommended if it's 80% there)"
  - "Scrap and re-grill — the corpus may not represent how I want to sound, take me back to the drawing board"
  - "Hand it to me — write the profile to disk but skip the commit so I can edit before committing"

### 2.8 Re-run handling — overwrite, preserve `created:`, add `updated:`
- **Detect-existing gate at invocation start.** If `/onboarding/voice-profile.md` already exists, `AskUserQuestion`:
  - "Refresh from new corpus (Recommended — voice evolves, fresh capture stays accurate)"
  - "Show me what's there first, then decide"
  - "Cancel — keep current"
- **On refresh.** Pull FRESH emails (last 6-12 months from re-run date, NOT the original window). Run the full workflow (selection → anti-patterns → write → test). Overwrite file content. Preserve `created:` line (original date); add or update `updated:` line per Decision 26.
- **No versioned files.** git history preserves the prior profile if user needs to compare. Single canonical voice-profile.md = unambiguous for downstream skills.

### 2.9 Edge cases — corpus thresholds + graceful degrade
- **< 20 emails.** Hard stop with explanation: "I only found 12 sent emails in the last 12 months — that's not enough to capture your voice reliably. Two options: (1) Try after you've sent ~50 real emails. (2) Paste 5 of your best representative emails directly into chat now and I'll work from those as a fallback (voice-profile will be flagged as 'thin corpus' in the file header)."
- **20-100 emails.** Proceed with a one-line warning baked into the profile under the `created:` stamp: "Thin-corpus profile (built from N emails). Re-run `/capture-voice` in 3 months for a stronger one."
- **> 100 emails.** Normal path, no warning.
- **Hybrid voice across recipients.** Diversity-selection in § 2.2 naturally pulls cross-recipient exemplars. One line in profile § 3 (Voice rules): "Your voice varies by audience. These rules capture the common spine; if a downstream draft skill needs audience-specific tuning, `/skill-builder` can extend the profile."
- **Multi-persona ask** ("I want a separate cold-outreach voice"). v1.0 says no — single profile. Surface as v1.1 backlog item if user pushes back.
- **Paste-in fallback** (offered only on < 20 hard stop OR if Connector pull fails). User pastes 5-10 sent emails directly into chat. Skill runs § 2.2 selection (capped to 5) + § 2.3-2.5 normally. Profile header notes "Built from user-pasted samples (no Connector pull)."

### 2.10 Atomic commit shape
One commit. Stage and commit only the files this build touched:

- `/onboarding/voice-profile.md` (new or modified)
- `SKILLS.md` (modified — flag `/capture-voice` row as `[live]` if not already; no row addition since install step did that — see § 2.11)
- (No TIME-SAVED.md row added — see § 2.12)

Commit message format:

```
aios(voice): capture voice from <N>-email corpus

<2-3 line summary: how many emails analyzed, what diversity dimensions the 5 exemplars cover, any thin-corpus warnings>
```

No `--no-verify`. No amends.

### 2.11 Install vs invoke — two-moment registry behavior
Per Decision 20, `/capture-voice` is installed via the trigger phrase: `pull /capture-voice from BeltDoor/aios-template main and install it`. Two distinct moments:

- **Install moment** (Claude reads BeltDoor repo, copies SKILL.md to local `.claude/skills/capture-voice/SKILL.md`):
  - Add row to `SKILLS.md`: `/capture-voice — captures your writing voice from your sent emails to build /onboarding/voice-profile.md`. Status: `[live]`. Trigger phrases: "capture my voice", "build voice profile", "refresh my voice".
  - **No TIME-SAVED row added at install** — TIME-SAVED rows are added on first invocation per /skill-builder pattern. But for /capture-voice this also doesn't happen — see § 2.12.
  - **After install completes**, Claude asks via `AskUserQuestion`: "Installed. Run it now? (Recommended — that's why you installed it)" with options:
    - "Yes, run /capture-voice now (Recommended)"
    - "Not yet — I'll invoke it later"

- **Invoke moment** (user types `/capture-voice` or it auto-runs from the post-install AskUserQuestion):
  - Detect-existing gate (§ 2.8).
  - Full workflow runs.
  - Atomic commit per § 2.10.

### 2.12 Self-ping EXEMPTION — /capture-voice does not write to TIME-SAVED.md
**Deviates from REBUILD-PROMPT.md Decision 12.** Per Jacob's call on 2026-05-24: setup/install tools like /capture-voice are exempt from the universal self-ping pattern. TIME-SAVED.md tracks recurring-value skills only.

- **/capture-voice itself.** No self-ping block in the SKILL.md. No TIME-SAVED row added at install or invocation.
- **Downstream draft-related skills built by /skill-builder.** When /skill-builder is later building an email-draft skill that consumes this voice-profile.md, it should recommend **~5 min as the `manual_time_minutes` baseline** when the user is filling in their per-use time saved. This reflects the typical per-email time savings users get from the AI nailing voice without manual editing — and this is where the compounding value of /capture-voice actually surfaces in TIME-SAVED.md.

This exception should be formalized as Decision 27 ("Setup tools are exempt from self-ping") via ADD-ITEM-PROMPT.md in a follow-up session if the pattern needs to apply beyond /capture-voice.

---

## 3. The /capture-voice workflow (end-to-end, in order)

1. **Detect-existing gate.** If `/onboarding/voice-profile.md` exists, apply § 2.8 (refresh / show-first / cancel).
2. **Connector check.** Verify Gmail or Outlook is in `CONNECTIONS.md` § 1. If neither: stop, walk user to claude.ai → Settings → Connectors, ask them to re-invoke after connecting.
3. **Pull corpus.** Query the connected provider per § 2.1. Pull ~300 sent emails matching filters.
4. **Threshold check.** Apply § 2.9 thresholds. <20 = hard stop or paste-in fallback. 20-100 = proceed with thin-corpus warning. >100 = normal.
5. **Send corpus to Claude.** Single big context block (all ~300 emails). One LLM read produces structured intermediate output: 5 candidate exemplars + 5-8 candidate anti-patterns + 10-20 signature phrases + 10 candidate voice rules.
6. **Exemplar confirm gate** (§ 2.2). Show 5 picks with context + reasoning. User confirms or swaps. Up to 2 swap rounds.
7. **Anti-pattern confirm gate** (§ 2.3). Show 5-8 candidates. User confirms / drops / adds.
8. **Mechanical write.** Compose voice-profile.md per § 2.5 shape (6 sections, ~150 line cap). Write to `/onboarding/voice-profile.md` per Decision 26 (created: stamp at top; updated: if re-run).
9. **Test step** (§ 2.6). Generate test follow-up email using just-written profile. User rates 1-5.
10. **Iterate or proceed** (§ 2.7). ≤3 → iterate loop (max 2 cycles, then ship-or-scrap). ≥4 → proceed.
11. **Commit** (§ 2.10). Atomic, single commit.
12. **No self-ping** (§ 2.12 exemption).
13. **Optional handoff** (recommended, not required): "Voice profile is live. Want to build your first email-draft skill now? `/skill-builder` can use this voice profile right away."

---

## 4. Re-run flow (compressed)

Same as § 3 with these differences:

- Step 1 detects existing file → user picks refresh/show/cancel.
- Step 3 pulls fresh emails from the re-run date's window, NOT the original window.
- Step 8 writes preserving the original `created:` line and adding/updating `updated:`.
- Step 11 commit message: `aios(voice): refresh voice from <N>-email corpus (was: <prev date>)`.

---

## 5. Out of scope (deliberately parked, not v1.0)

- **Cross-session resume.** If /capture-voice is interrupted mid-build, user re-invokes from scratch (same as /skill-builder § 5).
- **Multi-persona profiles.** v1.0 writes one merged profile. Per-audience profiles (cold-outreach / nurture / internal) deferred — no signal yet that anyone wants this. (Edge case § 2.9 handles asks gracefully.)
- **Platform overrides** (LinkedIn vs SMS vs cold-email). Deferred to v1.1 once user has 2-3 draft skills built and real validation data.
- **YAML `voice_parameters` block.** Deferred indefinitely — research says LLMs don't use it; it's documentation-only bloat.
- **Voice drift monitoring** (auto-suggest refresh after N months / N drafts). v1.0 relies on user re-invoking manually. v1.1 candidate.
- **Interview-style fallback** (KI's 20-question interview model). Deferred — email corpus is sufficient signal for solo experts who don't have a paid copywriter.
- **Multi-source corpus** (emails + LinkedIn posts + blog drafts). v1.0 is email-only. Adding sources is post-validation v1.1+.

---

## 6. P5 acceptance criteria (so the build session knows when it's done)

P5 produces `.claude/skills/capture-voice/SKILL.md` (held LOCAL — excluded from D2's push manifest per resolved Concern 3). The build is complete when:

1. **Pre-conditions documented.** SKILL.md states "Gmail or Outlook must be connected via claude.ai" as a hard precondition.
2. **Detect-existing gate** (§ 2.8) implemented as the first step.
3. **Connector check** (workflow step 2) implemented with verify via `claude mcp list` or reading `CONNECTIONS.md`.
4. **Pull mechanism** (§ 2.1) implemented for both Gmail AND Outlook providers. Query filters (`from:me`, last 6-12 mo, exclude promotions/social/auto-replies) are explicit.
5. **Threshold logic** (§ 2.9) implemented with the three bands: <20 hard stop, 20-100 warning, >100 normal.
6. **Diversity-selection prompt** (§ 2.2) is concrete and lists all 5 dimensions (length, formality, intent, recipient-type, mood).
7. **Two confirm gates** (exemplar + anti-pattern) implemented as freeform-reply pattern (not AskUserQuestion — these need swap-out flexibility AskUserQuestion's 4-option cap can't handle).
8. **Output file shape** (§ 2.5) is exactly 6 sections in the specified order. ~150 line soft cap enforced. No `voice_parameters` YAML. No platform overrides.
9. **Test step** (§ 2.6) uses the fixed test prompt verbatim. 1-5 rating with ≥4 / ≤3 branches.
10. **Iterate cap** (§ 2.7) enforces 2 fix cycles + ship-or-scrap AskUserQuestion.
11. **Re-run flow** (§ 4) implemented as documented branch.
12. **Atomic commit** (§ 2.10) stages only voice-profile.md + SKILLS.md status flag (if needed).
13. **Install-vs-invoke distinction** (§ 2.11) implemented — SKILLS.md row added at install moment; post-install AskUserQuestion offers immediate run.
14. **Self-ping EXEMPTION** (§ 2.12) — NO self-ping block in SKILL.md. NO TIME-SAVED row written. Comment in SKILL.md notes the exemption + cross-references Decision 27 (when formalized).
15. **End-to-end test of P5.** Jacob runs `/capture-voice` against his own Gmail (which has the 300+ sent emails to test thresholds). Confirms: (a) 5 diverse exemplars surface and his confirm-or-swap works, (b) 5-8 anti-patterns surface with em-dash ban auto-detected, (c) signature phrases include "man", "honestly", "here's the deal" (or whatever Jacob's tics are in his Gmail), (d) test draft generates and Jacob rates ≥4, (e) commit lands cleanly, (f) re-invocation correctly detects the existing profile and offers the refresh/show/cancel gate.

When all 15 criteria pass, P5's status flips to `done` in REBUILD-PLAN.md. P5's deliverable file lives at `king-intelligence/ai-operating-system/secondbrain-template/.claude/skills/capture-voice/SKILL.md`, held LOCAL — explicitly excluded from D2's push manifest. D5 publishes it as the first post-v1.0 commit on `BeltDoor/aios-template main`.

---

## 7. Cross-references

- Decision 9 — Day-1 skill inventory (6 skills, NOT including /capture-voice). /capture-voice ships POST-v1.0 as the first opt-in update.
- Decision 12 — TIME-SAVED.md self-ping pattern. /capture-voice is EXEMPT (§ 2.12) — flag for Decision 27 formalization.
- Decision 20 — Template update propagation via ad-hoc trigger. /capture-voice IS the first test case (install trigger phrase: `pull /capture-voice from BeltDoor/aios-template main and install it`).
- Decision 21 — Voice profile lazy + opt-in via /capture-voice. This spec implements that decision.
- Decision 22 — AskUserQuestion-with-Recommended default. Used in: post-install run-now gate (§ 2.11), iterate-cap ship/scrap/hand (§ 2.7), detect-existing refresh/show/cancel (§ 2.8). NOT used for the two confirm gates (exemplar + anti-pattern) because those need swap-out flexibility AskUserQuestion's 4-option cap can't handle — freeform-reply pattern there.
- Decision 23 — Verify-before-asserting. Used in: workflow step 2 (verify Connector via `claude mcp list`, not assumption), workflow step 11 (commit success verified before declaring done), iterate loop (test draft is real-data verification of profile quality).
- Decision 25 — Folder organization. This spec lives at `decisions/`; voice-profile.md lives at `onboarding/`; SKILL.md lives at `.claude/skills/capture-voice/`. All paths in §§ 2-4 are relative to the folder root.
- Decision 26 — Timestamps on accumulating business files. voice-profile.md has `created:` (original date) and `updated:` (re-run date) at top per § 2.5 (1).
- Resolved Concern 3 — Phase ordering. /capture-voice built locally in P5 (Phase 4 Polish), held out of D2's push manifest, published as first post-v1.0 commit in D5 (Phase 5 Distribution). This spec respects that ordering — § 6 acceptance criterion 15 explicitly mentions D2 exclusion.
- `/skill-builder` spec (`decisions/2026-05-24-skill-builder-spec.md`) — § 2.7 references this spec's install trigger phrase verbatim. /capture-voice satisfies /skill-builder's voice-profile hard gate.

## Research foundations

Per Jacob's explicit ask for "TON of research on best practices for capturing a voice that an LLM can consistently replicate," the following findings informed each locked decision:

- **arXiv 2509.14543 (EMNLP 2025 Findings)** — "LLMs Still Struggle to Imitate the Implicit Writing Styles of Everyday Users." Few-shot prompting 91-100% style accuracy vs zero-shot 3-7%. **Email is one of the BEST surfaces for LLM voice imitation** — significantly easier than blogs/forums. 5-shot is the default; gains plateau past 5. Authentic snippet inclusion (verbatim exemplars) yields strongest perceived-human boost. (Locks: § 2.1 email-source, § 2.2 cap-at-5, § 2.5 verbatim-exemplars.)

- **arXiv 2509.24930** — "How Well Do LLMs Imitate Human Writing Style?" Prompting strategy is 23.5× more impactful than model size. Few-shot (2-5): 91-100%. One-shot: 67-94%. Zero-shot: 3-7%. (Locks: § 2.2 cap-at-5, § 2.5 5-exemplars-non-negotiable.)

- **jeffbullas.com (2025-11)** — Practitioner playbook. 8-12 negative examples optimal. 50-200 samples for fine-tuning (not in-context). Variety beats volume. (Locks: § 2.3 anti-pattern target range 8-12, § 2.2 diversity-over-volume.)

- **QWE/EMNLP synthesis (2026-03)** — Numeric scales (0-1 sliders) work poorly as LLM input; prose + examples win. Markdown beats PDF/image for samples. 5+ samples beat 2-3 if diverse. (Locks: § 2.5 no-YAML-parameters, § 2.5 markdown-format.)

- **KI voice-profile/ folder (Jacob's own prior work)** — 900-line VOICE-PROFILE.md is overkill for v1.0; the 7 few-shot examples carry most of the load. Anti-patterns lifted from corpus extraction + explicit user input (em-dash ban). (Locks: § 2.5 lean-150-line-cap, § 2.3 hybrid-extraction-plus-user.)
