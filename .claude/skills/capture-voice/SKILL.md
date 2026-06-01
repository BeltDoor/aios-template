---
name: capture-voice
description: Captures the user's writing voice from their real sent emails and writes a lean voice profile that every future draft-related skill reads before writing as the user. Use when the user pastes "pull /capture-voice from BeltDoor/aios-template main and install it", says "capture my voice", "build voice profile", "refresh my voice", or when `/skill-builder` hits its voice-profile hard gate and tells the user to install this first.
---

# /capture-voice

The foundational skill that builds [`/onboarding/voice-profile.md`](../../../onboarding/voice-profile.md) from the user's real sent emails. Every future draft-related skill (email, social post, SMS, customer copy) reads that profile before writing as the user.

## Pre-conditions (must be true before this runs)

- **Gmail OR Outlook is connected** via claude.ai → Settings → Connectors. Check [`CONNECTIONS.md`](../../../CONNECTIONS.md) § 1 — at least one must be listed. If neither, this skill stops at Step 2 and walks the user to connect one.
- No new API keys needed. The Gmail / Outlook MCP runs through the user's claude.ai OAuth — no env var work.

## Workflow

One pass, in order. Don't skip steps. If a hard gate fires, stop and resolve before continuing.

### 1. Detect-existing gate

Check whether [`/onboarding/voice-profile.md`](../../../onboarding/voice-profile.md) already exists. If it does, `AskUserQuestion`:

1. **"Refresh from new corpus (Recommended — voice evolves, fresh capture stays accurate)"** — proceed to Step 2 with overwrite intent (preserve original `created:`, add/update `updated:` per [`CLAUDE.md`](../../../CLAUDE.md) § Timestamps on every file you write).
2. **"Show me what's there first, then decide"** — `Read` the existing file, display it, re-ask the question.
3. **"Cancel — keep current"** — exit cleanly. No files written. No commit.

If the file does not exist, skip the question and proceed to Step 2.

### 2. Connector check (HARD GATE)

Honor § Verify before asserting in [`CLAUDE.md`](../../../CLAUDE.md). Run `claude mcp list` OR read [`CONNECTIONS.md`](../../../CONNECTIONS.md) § 1. Confirm at least one of Gmail / Outlook is connected.

If neither is present: **stop. Do not proceed.** Tell the user, in plain words:

> "Before I can capture your voice, I need to read your real sent emails. Go to claude.ai → Settings → Connectors → Gmail (or Outlook), click Connect, sign in. Then come back here and re-invoke `/capture-voice`."

Do not try to walk through OAuth screens by hand — the user does that in their browser. Wait for the re-invocation.

### 3. Pull corpus

Query the connected email provider for the user's sent emails.

- **Query:** `from:me`, last 6-12 months, exclude `category:promotions`, exclude `category:social`, exclude auto-replies / out-of-office.
- **Target:** ~300 sent emails. If the provider returns fewer, that's fine — the threshold check in Step 4 handles small corpuses.
- **No API key.** The Gmail / Outlook MCP is authorized through claude.ai OAuth. Use the connected tool directly.

Capture both the subject line and the body of each sent email. Strip quoted reply chains (`On <date>, <name> wrote:` and everything below it) — the voice signal is in what the user wrote, not what they replied to.

### 4. Threshold check

Count the emails pulled. Three bands:

- **Fewer than 20** → hard stop. Tell the user: *"I only found N sent emails in the last 12 months — that's not enough to capture your voice reliably. Two options: (1) Try again after you've sent ~50 real emails. (2) Paste 5 of your best representative emails directly into chat now and I'll work from those (the profile will be flagged as `thin-corpus` in the header)."* `AskUserQuestion` between those two options. The paste-in path runs Steps 5-11 normally, except the corpus is the pasted samples.
- **20 to 100** → proceed, but bake a one-line warning into the profile header right under `created:`: *"Thin-corpus profile (built from N emails). Re-run `/capture-voice` in 3 months for a stronger one."*
- **More than 100** → normal path, no warning.

### 5. Send corpus to Claude (single pass)

Take all pulled emails as a single context block and produce four structured outputs in one pass:

- 5 candidate exemplars (the diversity selection — see Step 6 for dimensions).
- 5-8 candidate anti-patterns (what's notably absent or rare across the corpus).
- 10-20 candidate signature words / phrases (vocabulary tics, bridge words, characteristic transitions).
- 10 candidate voice rules (tone, formality, opener pattern, sign-off, sentence-length tendency, paragraph rhythm).

Hold these in working memory for Steps 6-8. Don't write the profile yet.

### 6. Exemplar confirm gate (freeform, NOT AskUserQuestion)

Show the 5 candidate exemplars. For each, surface a 1-line context note and a 1-line reasoning:

> **Exemplar 1 — Customer follow-up after no response**
> *Picked because it shows your follow-up voice — direct, no preamble.*
>
> [verbatim email body, unedited]
>
> ---
>
> **Exemplar 2 — Decline to a vendor pitch**
> *Picked because it shows how you turn things down without burning the relationship.*
>
> [verbatim email body, unedited]
>
> *…3 more…*

The 5 picks should span: length (1-line reply ↔ multi-paragraph), formality (casual ↔ formal), intent (reply / initiate / follow-up / decline / proposal), recipient-type (client / vendor / peer / cold), and mood (transactional / warm / direct / explanatory).

Ask in plain chat: *"Good to ship these, or want to swap any out? You can say 'good' or 'swap 3 for something else' or 'swap 1 and 4'."* This is a freeform reply — not `AskUserQuestion` — because swap requests don't fit a 4-option cap and the user needs to point at specific picks.

If the user asks to swap, pick replacement(s) from the remaining ~295 emails matching the same dimension the swapped exemplar was filling. Up to **2 swap rounds**, then proceed.

### 7. Anti-pattern confirm gate (freeform, NOT AskUserQuestion)

Show the 5-8 anti-pattern candidates as a plain list:

> Things I notice you never (or almost never) do:
>
> - You never use em-dashes. Lock as banned?
> - You never open with "Hope this finds you well." Lock as banned?
> - Your sign-off is always "Thanks," (never "Best regards" / "Cheers"). Lock the convention?
> - You never use bullet lists in emails. Lock as a stylistic ban?
> - …

Ask in plain chat: *"All good? Or edit / drop / add any? For example, you might want to add things like 'don't call clients guys' or 'don't use the word leverage' that wouldn't show up in your inbox but you know you want banned."*

Freeform reply — again not `AskUserQuestion`, because the user might add, drop, OR edit. Target a final count of **8-12** anti-patterns (research-backed range — see [`/decisions/2026-05-24-capture-voice-spec.md`](../../../decisions/2026-05-24-capture-voice-spec.md) § 2.3).

### 8. Mechanical write — voice-profile.md (~150 line cap, 6 sections in this exact order)

Write [`/onboarding/voice-profile.md`](../../../onboarding/voice-profile.md) with these six sections, in this order, no others:

1. **H1 + creation stamp.** Per [`CLAUDE.md`](../../../CLAUDE.md) § Timestamps:

   ```markdown
   # Voice Profile
   created: <mm/dd/yy - HH:MM EDT from `date '+%m/%d/%y - %H:%M %Z'`>
   ```

   On re-runs, `created:` stays original — add or refresh an `updated:` line below it.

2. **How Claude should use this** (1-2 lines, verbatim):

   > Before drafting anything I'll send as myself (emails, social posts, SMS, replies), read this top-to-bottom and match the patterns in the exemplars at the bottom. The exemplars are the gold standard; the rules constrain edge cases the exemplars don't cover.

3. **Voice rules** — ~10 short bullets (tone, formality, sentence length, opener pattern, sign-off, paragraph rhythm — extracted from the corpus in Step 5).

4. **Banned patterns** — the confirmed 8-12 anti-patterns from Step 7. One-line bullet each. Add a brief *why* only when non-obvious.

5. **Signature words/phrases** — 10-20 items from Step 5, formatted as `phrase — typical use`. No user confirm gate — corpus-derived; the user usually isn't aware of their own tics. Trim to top 12 by frequency if the section threatens to push the file past 150 lines.

6. **5 verbatim email exemplars** — the confirmed picks from Step 6. Each exemplar gets a 1-line context note above it ("Customer follow-up after no response") and a blank line between exemplars. Bodies are UNEDITED.

**Hard format rules.**

- **No YAML `voice_parameters` block.** Research is clear: LLMs ignore 0-1 sliders in favor of prose + exemplars. Sliders are documentation-only bloat.
- **No platform overrides** (LinkedIn vs SMS vs cold-email). v1.0 writes ONE merged profile. Multi-platform tuning is `/skill-builder`'s job after the user has 2-3 draft skills in flight.
- **Soft 150-line cap.** If the file pushes past, trim the signature-words section to top 12 by frequency before anything else.

### 9. Test step (fixed prompt, 1-5 rating)

After the file is written, run a fixed test draft.

**Fixed test prompt** (use this verbatim, do not let it drift):

> Draft a 4-sentence follow-up email to a prospect who went quiet after a discovery call last week. They expressed interest in your services but haven't replied to your initial proposal.

Read the newly-written `voice-profile.md` top-to-bottom. Draft the test email matching the voice. Display the draft in chat.

Ask the user: *"Does this sound like you? Rate 1-5."*

- **4 or 5** → proceed to Step 11 (commit).
- **3 or lower** → enter the iterate loop in Step 10.

### 10. Iterate cap — 2 fix cycles, then ship-or-scrap

**Cycle 1.** Ask the user ONE specific question:

> "Was the issue (a) the exemplar mix didn't cover this voice mode, (b) a missing banned-pattern that snuck in, or (c) the rules block missed something?"

- **(a)** → re-pick exemplars (one swap round) → re-write the profile → re-generate the test draft.
- **(b)** → add the missing anti-pattern to § 4 of the profile → re-generate the test draft.
- **(c)** → add or refine 1-2 rules in § 3 → re-generate the test draft.

**Cycle 2.** Same loop — one more fix, one more re-run.

**After Cycle 2**, `AskUserQuestion`:

1. **"Ship as-is — I'll edit voice-profile.md manually if I need to (Recommended if it's 80% there)"** — proceed to Step 11.
2. **"Scrap and re-grill — the corpus may not represent how I want to sound, take me back to the drawing board"** — delete `voice-profile.md`, exit. The user can re-invoke later with a different corpus window or paste-in fallback.
3. **"Hand it to me — write the profile to disk but skip the commit so I can edit before committing"** — leave the file written, exit without committing.

If iterate keeps needing more than 2 cycles, the corpus or the spec has an issue that more fix-passes won't paper over. Surface the cap, don't keep patching.

### 11. Atomic commit

Stage and commit ONLY the files this build touched:

- `/onboarding/voice-profile.md` (new or modified)
- [`SKILLS.md`](../../../SKILLS.md) — modify the `/capture-voice` row's status flag to `[live]` if it isn't already. (Row addition happens at install — see § Install vs invoke below.)

**Do NOT add a TIME-SAVED.md row.** This skill is exempt — see § Self-ping EXEMPTION at the bottom of this file.

Commit message format:

```
aios(voice): capture voice from <N>-email corpus

<2-3 line summary: how many emails analyzed, what diversity dimensions the 5
exemplars cover, any thin-corpus warning that applied>
```

No `--no-verify`. No amends. No bulk `git add .` — stage by path.

### 12. Soft handoff (optional, recommended)

After commit:

> "Voice profile is live. Want to build your first email-draft skill now? `/skill-builder` can use this voice profile right away."

If the user says yes, invoke `/skill-builder` via the Skill tool in the same session.

## Install vs invoke — two distinct moments

Per Decision 20 in [`REBUILD-PROMPT.md`](../../../../REBUILD-PROMPT.md), `/capture-voice` is installed via the trigger phrase: `pull /capture-voice from BeltDoor/aios-template main and install it`. Two moments:

- **Install moment** (Claude reads BeltDoor repo, copies this SKILL.md into local `.claude/skills/capture-voice/SKILL.md`):
  - Add a row to [`SKILLS.md`](../../../SKILLS.md): `/capture-voice — captures your writing voice from your sent emails to build /onboarding/voice-profile.md`. Status: `[live]`. Trigger phrases: `capture my voice`, `build voice profile`, `refresh my voice`.
  - No TIME-SAVED row added — see § Self-ping EXEMPTION.
  - After install completes, `AskUserQuestion`:
    1. **"Yes, run /capture-voice now (Recommended — that's why you installed it)"** — invoke immediately.
    2. **"Not yet — I'll invoke it later"** — stop cleanly.

- **Invoke moment** (user types `/capture-voice`, or the post-install question auto-runs it):
  - Run Steps 1-12 above.

## Re-run flow (compressed)

Same as Steps 1-12 with these differences:

- Step 1 detects the existing profile → user picks refresh / show-first / cancel.
- Step 3 pulls fresh emails from the re-run date's window (last 6-12 months from TODAY, not the original capture date).
- Step 8 preserves the original `created:` line and adds or updates an `updated:` line.
- Step 11 commit message: `aios(voice): refresh voice from <N>-email corpus (was: <prev created date>)`.

No versioned files. Git history preserves prior profiles for diffing.

## Out of scope (parked, not v1.0)

- **Cross-session resume.** If `/capture-voice` is interrupted mid-build (context compaction, user steps away for a day), re-invoke from scratch. No partial-state recovery in v1.0.
- **Multi-persona profiles.** v1.0 writes one merged profile. Per-audience profiles (cold-outreach / nurture / internal) deferred — no signal yet that anyone wants this.
- **Platform overrides.** LinkedIn / SMS / cold-email-specific tuning deferred to v1.1 once the user has 2-3 draft skills built and real validation data.
- **YAML `voice_parameters` block.** Deferred indefinitely — LLMs don't use it; it's documentation-only bloat.
- **Voice drift auto-suggest.** v1.0 relies on the user re-invoking manually. Auto-suggest-after-N-drafts is a v1.1 candidate.
- **Interview-style fallback.** The 20-question interview model deferred — email corpus is sufficient signal for solo experts.
- **Multi-source corpus** (emails + LinkedIn posts + blog drafts). v1.0 is email-only.

## Self-ping EXEMPTION (deliberate — do not add a self-ping block)

`/capture-voice` is **exempt** from the universal self-ping pattern that every other skill follows.

- **No "Self-ping" section at the bottom of this SKILL.md.** Do not add one.
- **No row added to [`TIME-SAVED.md`](../../../TIME-SAVED.md)** at install or invocation.

**Why:** This is a setup / install tool, not a recurring-value skill. TIME-SAVED tracks recurring per-use time savings; a one-shot voice capture doesn't fit that model. The compounding value of `/capture-voice` surfaces downstream — every draft-related skill the user builds via `/skill-builder` saves ~5 minutes per use (the typical per-email time saved by the AI nailing voice without manual editing). `/skill-builder` should recommend `5` as the `manual_time_minutes` baseline when building draft-related skills that consume this profile.

This exemption is documented in [`/decisions/2026-05-24-capture-voice-spec.md`](../../../decisions/2026-05-24-capture-voice-spec.md) § 2.12. If the exemption needs to apply to other setup tools (e.g. `/install-connector`), formalize as Decision 27 ("Setup tools are exempt from self-ping") via `ADD-ITEM-PROMPT.md` in a follow-up session.
