---
name: email
description: Draft an email as the user. Invoke for ANY request to write, draft, or compose an email the user will send, "write me an email to X", "draft an email to Y about Z", "email Mark about the proposal", or when the user wants an email body produced. Enforces the user's email voice (openers, sign-offs, banned phrases, structure by type) and runs a pre-emit fabrication + anti-slop check.
argument-hint: "[recipient name or meeting context]"
allowed-tools: Read, Bash, AskUserQuestion, Grep, Glob
disable-model-invocation: false
---

# /email — Draft an email as the user

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

> Usage note: this skill drafts emails. It never sends them. The user reviews every draft before it goes out.

## This client's wiring

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/print-config.mjs" "${CLAUDE_PLUGIN_DATA}/config.json"`

The block above is this client's live configuration. Read your own settings from `skills["email"]` in that JSON. The settings you care about:

- **voiceGuidePath** — path to the client's own email voice guide. If present, Read it in full in Phase 2 (it overrides the generic craft for any conflict).
- **voiceDescription** — an inline description of how this client writes, used as the voice when no `voiceGuidePath` is set.
- **signature** — the client's email signature to append to a created draft.
- **bannedPhrases** — extra words or phrases THIS client never wants. Add them to the baked-in blacklist for the grep in Phase 4.
- **emailTool** — the email tool the client has connected (e.g. Gmail, Outlook). Tells you whether to offer to create a draft in their tool vs. just hand over clean text.

If a setting is missing, fall back to the sensible generic behavior described in each phase, and tell the user once: "This skill isn't tuned to your email voice yet. Run `/king-intelligence:adapt email` to set your voice guide, signature, and banned words." Then proceed with the generic defaults.

---

## Goal

Produce one email draft the user would actually send. Not a corporate-tone placeholder, not a bloated recap, not a hype-filled disaster. Use the structure and discipline in `references/email-craft.md` (and the client's own voice guide if one is wired up). Stay short. Lead with what the reader gets. Don't fabricate. Never send.

---

## Phase 1: Context intake

Ask the user whatever is missing. Use AskUserQuestion for structured picks; use plain text for open-ended. Never guess.

**Required context:**
1. **Recipient** — first name, last name, email address if the user wants a draft created in their email tool.
2. **Situation** — first-touch? post-meeting follow-up? bump on a silent thread? reply? intro between two people? handoff (credentials/files/links)? This selects the structure in `references/email-craft.md`.
3. **The thing(s) this email needs to carry** — list them. One thing? Three things? Be explicit. This drives the length discernment rule.
4. **What's NEW vs. what was already discussed** — do NOT recap things the recipient already heard on the call or in the thread. Only list items that are genuinely new information, unanswered questions, or explicit commitments.

If the user pastes a meeting transcript or a prior thread, scan it for these answers before asking. If this skill was invoked downstream of a larger workflow (e.g. a meeting debrief), most of this is already in scope — don't re-ask.

### Guardrails during intake

- If the user says "just write it, you know the context" and you aren't sure of specific facts (times, names, what the recipient said), STOP and ask. Fabricating specific claims is the single worst failure mode for this skill.
- If the user names a recipient you don't recognize, check for existing context (search the project folders / any connected CRM) before drafting. Better to ask one question than invent a detail.

---

## Phase 2: Load the voice (MANDATORY — no skip)

This is a mandatory step every invocation. Do not skip it because you read the rules earlier in the session or because you remember them — voice rules leak the moment you stop re-checking them.

1. **Read `references/email-craft.md` in full** (in this skill folder). It is the self-contained, universal email craft: structure by email type, the length discernment rule, the do-not-recap rule, plain-opener / plain-closer principles, and the AI-slop tells to avoid.
2. **If `voiceGuidePath` is set, Read that file in full too.** It is the client's own voice spec and OVERRIDES the generic craft wherever they conflict (specific openers, sign-offs, phrasings, banned words).
3. **If there's no `voiceGuidePath` but `voiceDescription` is set,** treat that inline description as the client's voice on top of the generic craft.
4. **If neither is set,** use `references/email-craft.md` alone as a clean, plain, human-sounding default, and surface the one-time `/king-intelligence:adapt email` nudge.

---

## Phase 3: Draft

Apply the structure from `references/email-craft.md` (and the client voice guide if wired). Write the draft in chat (not to disk yet).

**Discipline:**
- One short paragraph per distinct thing the email carries (the discernment rule: count the things, size to them).
- Lead with what the reader gets, not "I build X" / "I wanted to reach out."
- Opener + closer get the plainest possible treatment. The first line and the last line are where over-writing leaks in. If either feels like it's trying to be warm, clever, or cool, rewrite it.
- Do NOT include bulleted feature recaps of things the recipient already heard.
- Length follows content density, not a target. No minimum word count.
- No em-dashes. Use commas, periods, or parentheses. Real paragraph breaks, short sentences.

---

## Phase 4: Pre-send checklist (every item, every time)

Run these IN ORDER. Any failure → rewrite and re-run the checklist from the top.

### 4.1 Fabrication check

Every specific claim in the draft — times, commitments, meeting references, referrals, "as I mentioned last time," things the recipient supposedly said — must trace to one of:
- The live email thread (read it if a connected email tool can fetch it)
- A project note or file you can point to
- Something the user told you this session

If a claim cannot be sourced, either cut it or mark it `[CONFIRM]` and ask the user before emitting. Never invent a fact to make the email read smoother.

### 4.2 Blacklist grep (automated — must run)

Grep the draft body (not the signature) for the universal AI-slop blacklist below, plus any phrases in this client's `bannedPhrases`:

```
em dash —  OR  double-dash  --  OR
circling back  OR  circle back  OR  touching base  OR  just wanted to touch base  OR
I hope this finds you well  OR  per our conversation  OR  synergy  OR
game-changer  OR  deep dive  OR  excited to explore  OR  reach out  OR
at the end of the day  OR  sets the tone  OR  masterclass
```

If ANY match → rewrite and re-run from the top.

Quick grep helper (paste the draft body between the backticks):

```
node -e 'const b=`PASTE DRAFT HERE`; const banned=["—"," -- ","circling back","circle back","touching base","just wanted to touch base","I hope this finds you well","per our conversation","synergy","game-changer","deep dive","excited to explore","reach out","at the end of the day","sets the tone","masterclass"]; banned.forEach(p=>{ if (b.toLowerCase().includes(p.toLowerCase())) console.log("HIT:", p); });'
```

Also fold in the client's `bannedPhrases` from config when running the check.

### 4.2b Structural anti-slop pass

The grep above catches words. This catches structures. If a `/king-intelligence:stop-slop` skill is available, invoke it via the Skill tool on the draft and apply its fixes. If it isn't, run this inline pass yourself — scan for and rewrite:
- **Binary contrasts / negation reversals** ("Not X. It's Y.", "The answer isn't X, it's Y.") → state the point directly.
- **Negative listing** ("Not a X. Not a Y. A Z.") → state the thing without the runway.
- **False agency** ("the decision emerges," "the data tells us") → name the human actor.
- **Narrator-from-a-distance** ("Nobody designed this," "People tend to...") → use direct address.
- **Passive voice that hides the actor** ("mistakes were made") → name who did it.
- **Vague declaratives** ("the implications are significant," "the stakes are high") → name the specific thing.
- **Crutch adverbs** (genuinely, fundamentally, inherently, crucially, importantly) → cut them.
- **Throat-clearing openers** ("here's the thing," "let me be clear," "the truth is," "it turns out") → cut to the point.

### 4.3 Bracket re-read

Re-read the first line of the body. Does it sound like it's trying to be warm, cool, or clever, or does it open with "I wanted to reach out" / "I build X"? Rewrite to the plainest opener that leads with what the reader gets.

Re-read the last line of the body (before the signature). Does it wrap a bow ("Looking forward to hearing your thoughts"), stack sign-offs, or end with forced enthusiasm? Rewrite to a plain close — often just end on a natural sentence.

### 4.4 Already-heard-it check

Walk through each paragraph and ask: was this already said on the call or in the thread? If yes → cut it, even if it feels like a nice recap. The email transmits NEW info; the meeting was the conversation.

### 4.5 Length sanity

Count the distinct things the email carries. Compare to the discernment table in `references/email-craft.md`. Over the ceiling for its type? Cut. Don't add a disclaimer like "I know this is long" — just cut.

### 4.6 Name repeat

Does the recipient's name appear more than once in the body? Reduce to one (usually just the opener). Repeating the name reads sycophantic.

### 4.7 Sign-off / signature check

If a `signature` is wired up and will be appended to the draft, the body must NOT also end with a typed version of the sender's name — that reads doubled-up. Close on a sentence or a short `Thanks,` / `Talk soon,`. If no signature is being appended (you're handing over plain text), a single typed name close is fine.

---

## Phase 5: Emit

Display the final draft in chat with clear separators so the user can copy-paste cleanly:

```
────────── DRAFT ──────────
Subject: [subject line]

[body]
────────────────────────────
```

**If the user asks to save it as a draft:** create it in whatever email tool the client has connected (`emailTool` in config — e.g. Gmail, Outlook), and append the client's `signature` if one is set. Convert any URL in the body to a friendly hyperlink with short anchor text that names the destination ("book a call", "the proposal", "your login"); never leave a long raw URL sitting in the body. If no email tool is connected (or `emailTool` is unset), just hand over the clean text and the subject for the user to paste in themselves.

**Never send.** Only drafts. The user reviews in their email tool before hitting send.

---

## Invocation examples

- `/email` (no args) → ask for recipient + situation
- `/email jordan blake` → ask situation + things to carry, check project folders / connected CRM for existing context on Jordan Blake
- "write me a quick email to the prospect confirming the proposal" → auto-invokes this skill, Phase 1 extracts what it can, asks for the rest
- "draft an email thanking her for the intros" → same

## What this skill does NOT handle

- **Sending emails.** Only drafts. Send is always a manual human action.
- **A full meeting-debrief workflow** (transcript → summary → email + doc updates). This skill is the lighter-weight path for standalone email drafts.
- **Mass cold-email campaigns.** Those belong in a dedicated outbound pipeline, not here.
