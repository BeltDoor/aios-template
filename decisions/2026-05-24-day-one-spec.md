# /day-one spec
2026-05-24

Locked via `/grill-me` session on 2026-05-24. This is the design contract for the `/day-one` skill. The S4 plan item (build `/day-one`) implements against this spec. Do not re-litigate without re-grilling.

---

## 1. Purpose (one line)

`/day-one` is the first-touch on-ramp inside the client's second brain. It is **three steps** — voice tool, harness settings (bypass + model), and a fast business scrape — followed by a synthesized identity paragraph and a soft-ask handoff to `/skill-builder`. It is the on-ramp, not the work.

---

## 2. Locked decisions

12 calls locked during the 2026-05-24 grill. Each is the contract S4 must honor.

### 2.1 Pre-/day-one assumptions (handled by the guide, not the skill)

`/day-one` assumes the following is **already done** by the guide before the client pastes the kickoff bundle. The "Notes for whoever is guiding this session" footer (§ 3) enforces this checklist. The skill does NOT walk through any of these:

1. VS Code installed.
2. Claude Code extension installed; signed into Claude account.
3. GitHub account exists; signed into VS Code's GitHub integration (so `git push` works without re-auth later).
4. Visit `github.com/BeltDoor/aios-template` → click **Use this template** → **Create a new private repository** named `second brain-<clientname>` (do NOT initialize with README).
5. Clone the client's NEW private repo locally (NOT `BeltDoor/aios-template` directly). This means `origin` is already correctly pointed at the client's own repo from minute one — no remote swap needed in /day-one.
6. Open the cloned folder in VS Code.
7. Visit `king-intelligence.com/levelup` → enter passcode → **copy the entire kickoff bundle** (one paste-block that includes the kickoff prompt line AND the Apify token line — see § 2.6).
8. Paste the bundle into Claude Code chat. `/day-one` starts.

**Why this changed from the original S3 brief:** the brief listed a "Step 2.5 GitHub private repo setup + git remote add + first push" inside `/day-one`. Locked decision: that work moves to the guide checklist pre-/day-one via GitHub's "Use this template" button. `/day-one` ends up cleaner (3 steps not 4), no auth-failure branch to handle, no `gh` CLI dependency. The "compounding context across laptops" promise (open-by-design GitHub backup story) is preserved — it's just front-loaded into the guided setup.

### 2.2 OS detect (silent, before greeting)

Same as v1 level-1: run `uname` with Bash before saying anything.

- Returns `Darwin` → **Mac**.
- Returns anything else (`MINGW...`, `MSYS...`, Windows version string, error) → **Windows**.

Remember which. A few branches fork on it (notably env-var setting commands if those ever surface, though § 2.6 makes that moot for /day-one itself). Never make the user tell you; just know.

### 2.3 Greeting (warm but tight, no theatrics)

After the silent OS detect, open with this — on-brand, one thought per line, no progress bars:

> Hey. Welcome to your second brain.
>
> You just did the hard part — getting all this onto your computer.
>
> ---
>
> Day One is short. It's the on-ramp.
>
> Three things: get your voice tool working, show you two settings that make this easy to drive, then take a quick look at your business so I know who I'm working with.
>
> Once that's done — your second brain is ready to start building real tools for you.
>
> ---
>
> Ready? Type **next**.

**Progress indicator between steps** (lighter than v1, NO bars):

```
Day One — Step 2 of 3
```

That's it. No `▰▰▰▱▱` bars, no "journey" line showing future modules. Three steps, plain text.

**Ready gates:** "Type **next**" between steps. Reserve `AskUserQuestion` for real either/or choices inside the steps (per Decision 22 + CLAUDE.md § Voice: "don't ask just to ask").

### 2.4 Step 1 — Typeless voice tool (STRONG SOFT GATE)

**Why this matters (client-facing framing):** Voice is the highest-leverage Day-1 install. Talking is ~4x faster than typing and lets the client give the long natural answers that `/day-one` and `/skill-builder` ask for. Without it, every future session is worse.

**The walk:** recommend Typeless with affiliate link (`https://www.typeless.com/?via=jacob-king` — note the kickback transparently). Cross-platform (Mac, Windows, iPhone), 30-day free trial, no credit card to start. If the client already uses a different voice tool (Whisper Flow, Apple Dictation, etc.) — fine, accept it and move on.

**Gate strength: strong soft gate.** Default to setup. Walk them through patiently. `AskUserQuestion`:

1. **"Got it — Typeless is working" (Recommended)**
2. **"I already use a different voice tool"** — accept, move on
3. **"I'm stuck"** → patient walkthrough, one step at a time
4. **"I'll skip this for now"** — lands with a plain-English cost warning (see "Skip path" below)

**Skip path:** when they pick "I'll skip this for now":

1. Show ONE callout in plain language: *"Quick heads-up — you'll get a worse experience here without it. Talking is 4x faster and lets you give me the long answers I'm going to ask for. I highly recommend doing this now. But if you want to defer — totally fine, I'll remind you next session."*
2. `AskUserQuestion` ONE more time: "Try Typeless now" / "No, defer it (Recommended if you really want to skip)."
3. If they still defer: write `onboarding/voice-unconfigured.md` with a single-line note like *"Voice tool skipped during /day-one on 2026-XX-XX. /begin-session should re-prompt."* `/begin-session` (per S5 spec, when locked) reads this on session open and re-prompts ONCE per session until either the file is deleted (voice is set up) OR the client explicitly says "stop reminding me" (then `/begin-session` rewrites the file to `voice-declined-permanently.md`).
4. Proceed to Step 2.

**No hard gate.** A new client who hits a Typeless install wall and is told "we can't proceed" closes the window. That's the worst possible Day-1 failure mode. The re-prompt mechanism catches the lost conversion later.

**On confirm:** say *"From here on — talk, don't type. Let it be messy. I'll clean it up."* Then progress indicator → Step 2.

### 2.5 Step 2 — Two settings: bypass-permissions + model picker

**Two micro-steps, single Step 2.**

**2.5a — Bypass-permissions UI verification.**

settings.json already sets `permissions.defaultMode = "bypassPermissions"` (per F5). Claude Code's UI selector at the bottom of the chat box should already reflect that on first session. But honor § 6 "Verify before asserting" — the skill must ask the client to confirm rather than assume.

Say (client-voice):

> See the mode selector at the bottom of the chat? Your settings file already set it to **Bypass permissions** — that means I don't stop and ask you every time I want to write a file or run a command. You stay in control of the big stuff; I stop pestering you about the little stuff.
>
> Check the selector — what does it say?

`AskUserQuestion`:

- **"It says Bypass permissions" (Recommended)** — proceed to 2.5b.
- **"It says something else"** — *"No problem. Click the selector and pick Bypass permissions."* Wait for confirm, then proceed.

**2.5b — Model picker (default Opus 4.7).**

Per open-by-design item: default-recommend **Opus 4.7** (not Sonnet — v1 was Sonnet, v2 is Opus 4.7). Single chat turn covering all three cases:

> Up at the top there's a model picker. Pick **Opus 4.7** if you see it — that's the deepest-thinking model, best for real business work.
>
> If you don't see Opus 4.7 in your list (depends on your plan), pick whatever's at the top — Sonnet works too.
>
> If the menu hangs for more than ~10 seconds, don't wait — just close it. You can change models any time by typing `/model`.

**No Max-plan upsell.** Plan-tier upgrade is a sales conversation, not a setup step. If the client volunteers interest in Opus 4.7 + doesn't have it, that's a guide handoff outside `/day-one`.

Wait for any kind of confirm ("done" / "picked it" / "ok"). Don't gate too hard — model picker UI lag is a known v1 trip-up. Progress indicator → Step 3.

### 2.6 Step 3 — Business scrape (Firecrawl + WebFetch fallback + Apify, token invisible)

**Apify token architecture (LOCKED — deviates from Decision 7 / Concern 2 wording; see § 4):**

The Apify token is **invisible to the client**. They never see the word "Apify," never see the token value as a separate concept, never run `setx`. Mechanism:

1. The `/levelup` page (D4) generates a paste-bundle when the passcode is entered. The bundle contains the kickoff prompt line AND a token line embedded as a parseable marker. Concrete proposed format (D4 implements the exact shape):

   ```
   Read .claude/skills/day-one/SKILL.md and follow it to walk me through Day One.
   <!-- SETUP_BUNDLE v1
   APIFY_TOKEN=apify_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   -->
   ```

2. Client pastes the entire bundle into Claude Code chat. `/day-one` starts.
3. On first message, `/day-one` parses the bundle for the `SETUP_BUNDLE` block and captures the token into **session memory only** (not committed, not `setx`'d, not written to `.env`). The skill keeps the value in working memory for the duration of the session.
4. Step 3's LinkedIn scrape uses the token **inline in the curl command**, never via `$APIFY_AIOS_API_KEY` env var.
5. At session end, the token vanishes with Claude Code's memory. Future sessions don't need it — `/day-one` is one-shot per client; no future skill needs Apify (LinkedIn scraping is a one-time identity capture).

**If the paste-bundle is missing the token marker** (e.g., client pasted the kickoff line by hand without grabbing /levelup): `/day-one` says *"Looks like the LinkedIn-scrape token didn't come through. Quick fix — go to king-intelligence.com/levelup, enter the passcode, and paste me the whole bundle this time."* Wait for re-paste. Don't try to teach what the token is — that's exactly the surface we're hiding.

**Step 3 walk (client-facing):**

> Step 3.
>
> Before I get into the rest, let me get the quick version of who you are — so I'm not asking you things I could've found myself.
>
> Drop me two links:
>
> 1. Your website.
> 2. Your LinkedIn profile.
>
> Paste both and hit enter. If you don't have one of them, just say so.

**Website scrape:**

1. Primary: Firecrawl `/scrape` via the existing MCP tool (uses `FIRECRAWL_AIOS_API_KEY` env var — already captured at user scope per Decision 8). Extract: title, description, main copy, services, target audience, voice notes, any visible brand colors.
2. Fallback (silent): if Firecrawl returns empty content, HTTP error, or `FIRECRAWL_AIOS_API_KEY` is missing — use `WebFetch`. Same extraction, narrower data quality.
3. Output: `onboarding/profile-from-website.md` — frontmatter-tagged with which path was used (`source: firecrawl` or `source: webfetch-fallback`).

**LinkedIn scrape (Apify):**

1. Validate URL: if it doesn't match `linkedin.com/in/<username>`, ask once: *"That doesn't look like a profile URL — got a `linkedin.com/in/...` link handy?"*
2. If still wrong OR client says they don't have LinkedIn: skip the Apify call entirely. Note in identity synthesis (§ 2.7) that only website was captured. **Do not block** Day 1 over a missing LinkedIn.
3. Apify call (use token captured in § 2.6 paste-bundle, inline in curl):

   ```bash
   curl -sS -X POST "https://api.apify.com/v2/acts/harvestapi~linkedin-profile-scraper/run-sync-get-dataset-items?token=<TOKEN_FROM_BUNDLE>" \
     -H "Content-Type: application/json" \
     -d '{"queries":["<LINKEDIN_URL>"]}'
   ```

4. Parse the returned JSON array of profile objects. Pull: `headline`, `about`/`summary`, `experience`, `education`, `skills`, `location`.
5. Output: `onboarding/profile-from-linkedin.md` — parsed JSON rendered as markdown.

**If neither link works** (no website, no LinkedIn): say *"No problem — we'll get it straight from you. Tell me in your own words: what do you do, who do you serve, and how long have you been doing it?"* Capture the answer, write it to `onboarding/profile-from-client-statement.md`, proceed to § 2.7 with that as the only source.

### 2.7 Identity paragraph synthesis (CLAUDE.md § 1)

After scrape lands, fill `CLAUDE.md` § 1 Identity (currently empty). Four-step flow:

**Step A — Bullet reflect.** Reflect what the scrape captured back to the client as 4-5 short bullets. Plain language, no jargon:

> Here's what I picked up:
>
> - **Who you are:** [name + role + headline]
> - **What you sell:** [services / products in plain English]
> - **Who you serve:** [target customer segment]
> - **How you sound:** [voice notes from website / LinkedIn — tone, signature phrases if any]
> - **Where you're based:** [city / region from LinkedIn]
>
> Close to right?

`AskUserQuestion`:

1. **"Yes, that's me" (Recommended)** — proceed to Step B.
2. **"You missed something"** → *"What did I miss?"* — capture, add to the picture, re-confirm.
3. **"Close enough — we'll build on it"** → accept as-is, proceed to Step B.

**Step B — One fact-check question.** Ask exactly one (not a survey):

> One quick check — are you involved in more than one business or role? Main thing plus an advisor seat, two ventures, anything like that? If it's just the one, just say so.

Capture answer. This is the most common scrape miss in 30 seconds.

**Step C — Synthesize the identity paragraph.** Write a single paragraph (5-7 sentences) covering: name + primary role, business + what it sells, who they serve, voice notes (1 sentence on tone), multi-role flag if applicable, location if relevant. CEO-level voice — no jargon. This becomes the always-loaded identity context for every future session.

Format: just the paragraph as `## 1. Identity` body content. No subheadings inside.

**Step D — Show-write confirm.** Display the written paragraph back:

> Here's what I'm putting in your CLAUDE.md as your identity. This loads every time we start a session — so it's worth a quick read:
>
> [paragraph]
>
> Sound right, or want me to tweak it?

`AskUserQuestion`:

1. **"Sounds right (Recommended)"** — write it to disk, done.
2. **"Tweak it"** → *"What needs to change?"* — capture, rewrite, re-confirm. One revision pass, then accept.

Write the final paragraph to `CLAUDE.md` § 1 Identity (replacing the empty stub). Do **not** touch any other section of CLAUDE.md.

### 2.8 Handoff to /skill-builder (soft ask: build now or break)

After identity paragraph lands, `/day-one`'s last action is `AskUserQuestion`:

1. **"Build your first skill now (Recommended)"** — `/day-one` invokes `/skill-builder` via the Skill tool in the same session. Continuity preserved.
2. **"Take a break — I'll be here when you come back."** — `/day-one` ends with the paste-line shown explicitly:

   > Nice work today. Your second brain is ready.
   >
   > When you want to build your first skill, paste this line in and hit enter:
   >
   > ```
   > Read .claude/skills/skill-builder/SKILL.md and walk me through it.
   > ```
   >
   > See you soon.

   Then stop. Don't keep talking.

**Why soft-ask not auto-invoke:** /day-one is ~30 min of cognitive load. Forcing /skill-builder immediately can land the first-skill build at low energy, ruining the most important first impression. Letting the client choose preserves the guide-on-Zoom's judgment about whether to push through or break. Per Decision 22 — this is a genuine choice, AskUserQuestion is the right shape.

**No "destination demo" Step (per Decision 6).** The old v1 Step 5 ("guide screen-shares their AIOS") is dropped. The identity paragraph + soft-ask handoff IS the close.

### 2.9 Self-ping at end (TIME-SAVED tracking)

After the handoff branch resolves (whichever way client picked), the absolute last action `/day-one` takes is incrementing its row in `TIME-SAVED.md`:

- Skill: `/day-one`
- Manual time per use: **90 min** (the rough cost of doing this kickoff by hand without an AIOS — install voice tool, configure Claude Code, manually research own business notes, write identity paragraph).
- Increment "Total uses" by 1.
- Recompute "Total saved (cumulative)" as `Total uses × 90 min`.
- Update "Last used" to today's date.
- Add row if `/day-one` doesn't have one yet.

Use the same self-ping template `/skill-builder` bakes into generated skills (see `.claude/skills/skill-builder/SKILL.md` § AIOS append templates → Self-ping block).

### 2.10 Output file structure (deliverables at session end)

After `/day-one` completes, these files exist (and get committed by `/end-session` later):

| Path | Content | Purpose |
|---|---|---|
| `CLAUDE.md` § 1 | 1-paragraph identity (synthesized) | Always-loaded context for every future session |
| `onboarding/profile-from-website.md` | Firecrawl/WebFetch output, frontmatter tags which path | Raw scrape archive for `/skill-builder` to mine later |
| `onboarding/profile-from-linkedin.md` | Parsed Apify JSON rendered as markdown | Same, for LinkedIn data |
| `onboarding/profile-from-client-statement.md` | Only if neither URL was provided — client's spoken self-description | Same, fallback path |
| `onboarding/voice-unconfigured.md` | Only if voice tool was skipped — flag file | `/begin-session` reads → re-prompts |
| `TIME-SAVED.md` (modified) | `/day-one` row added with manual_time=90, uses=1, saved=90 | Cumulative time-saved tracker |

`about-me.md` and `about-business.md` from v1 are **NOT** recreated. CLAUDE.md § 1 (identity) + raw scrape archive in `/onboarding/` covers what they did.

### 2.11 Connector setup is OUT of /day-one

Per Decision 6 + resolved Concern 1: /day-one does NOT walk the client through connecting Gmail / Calendar / Notion / Drive / HubSpot / Otter. Connectors are lazy-loaded by `/skill-builder` § 2.6 (Connector gap HARD GATE) when a skill actually needs them. /day-one ends with no connectors active.

The CONNECTIONS.md § 2 "Recommended for solo experts" table (per F7) is visible to anyone who reads CONNECTIONS.md but `/day-one` doesn't proactively walk them through it.

### 2.12 Banned-words list, voice rules, AskUserQuestion default — NOT restated

Per Decision 11 / Concern 4 (resolved as "trust the pattern"): `/day-one` does NOT restate CEO voice rules, banned words, AskUserQuestion-with-Recommended default, or verify-before-asserting. Those live in `CLAUDE.md` and auto-load as project instructions for every session. Restating bloats the skill past its target length.

Length cap: same as `/skill-builder` generated skills — **soft 100 lines** for `/day-one` SKILL.md. If pushing 150+, push detail into `.claude/skills/day-one/references/*.md`.

---

## 3. Notes for whoever is guiding this session

The guide (Jacob at first, possibly future facilitators) sees this section in the built SKILL.md and uses it as a pre-flight checklist + pacing aid. Bake the following verbatim into the bottom of the SKILL.md.

### Pre-flight checklist (done by guide before /day-one starts)

- [ ] Client has Mac or Windows laptop. **Chromebook = hard no.** ChromeOS (stock OR Crostini) can't reliably run npm / git CLI / browser-helper flows the second brain assumes. Don't onboard Chromebook clients — escalate to "buy a real laptop first" before Day 1. *(Source: early onboarding feedback.)*
- [ ] VS Code installed.
- [ ] Claude Code extension installed; client signed into Claude account.
- [ ] GitHub account exists; client signed into VS Code's GitHub integration.
- [ ] `github.com/BeltDoor/aios-template` → click **Use this template** → **Create a new private repository** named `second brain-<clientname>` (DO NOT initialize with README).
- [ ] Client clones the NEW private repo locally (NOT `BeltDoor/aios-template` directly).
- [ ] Folder opened in VS Code; Claude Code chat panel visible.
- [ ] `king-intelligence.com/levelup` → enter passcode → **copy the entire kickoff bundle** (kickoff prompt + Apify token line — D4 ships this as a single paste block).
- [ ] Client pastes the bundle into Claude Code chat. `/day-one` starts.

### Pacing rules (during /day-one)

- **30-minute soft cap.** If `/day-one` runs past 30 min, you've gone too deep — the temptation is to start interviewing, don't. Identity-paragraph depth is `/skill-builder`'s job (when building voice-aware skills), or `/capture-voice`'s job later. Glance, don't dig.
- **Voice tool is the highest-leverage install.** If client wants to skip, push back gently ONCE then let them skip — the re-prompt mechanism catches it next session.
- **Apify token comes from /levelup paste.** If the bundle is missing, send them back to /levelup. Don't try to teach them what a token is.
- **Identity paragraph is locked-in context for every future session.** If the bullet reflect or paragraph looks subtly wrong, push for the correction NOW — fixing it later costs more.

### Guided-vs-autonomous flag (v1.0 = guided only)

`/day-one` v1.0 explicitly assumes a guided session (you on Zoom or in-person, screen-sharing the client). Autonomous client self-onboarding is parked in V5 (v1.1 backlog) — a different SKILL.md shape that handles its own pacing without a human reading between the lines.

---

## 4. Deviations from REBUILD-PROMPT.md surfaced

Two scope changes locked in this grill that need REBUILD-PROMPT.md updates in a separate `ADD-ITEM-PROMPT.md` session:

### 4.1 Step 2.5 (GitHub repo setup) removed from /day-one

**Decision 6** says "Day-1 setup = 3 steps … Step 3 Firecrawl web + Apify LinkedIn scrape." The open-by-design "GitHub backup story" said "/day-one includes the GitHub setup." This grill locked: GitHub setup moves entirely to the pre-/day-one guide checklist via GitHub's "Use this template" pattern. /day-one stays at 3 steps but has NO Step 2.5.

**REBUILD-PROMPT.md update needed:** open-by-design "GitHub backup story" item should say "(b) **Pre-/day-one guide checklist** includes GitHub repo creation via 'Use this template'; (c) /end-session does the push."

**REBUILD-PLAN.md update needed:**
- S3 brief — remove "Step 2.5 (GitHub private repo setup + git remote add + first push)" line.
- S4 brief — same removal; success check should no longer mention "GitHub repo pushable" as part of Day 1.

### 4.2 Apify token bundled into /levelup paste, not setx-into-env-var

**Decision 7 + Resolved Concern 2** lock the Apify flow as "gets pasted into the client's env var (APIFY_AIOS_API_KEY) during /day-one Step 3 via setx." This grill replaced that flow with: token bundled into /levelup paste, parsed into session memory by /day-one, used inline in curl, never persisted. The `setx` path doesn't actually work end-to-end in /day-one's session anyway (Windows setx persists to registry but the CURRENT shell doesn't see the new var until a new shell starts — Claude Code's Bash tool spawns shells per call, all fresh, none seeing the freshly-set var).

**REBUILD-PROMPT.md update needed:** Decision 7 text should say "Apify token bundled into /levelup paste, captured into /day-one session memory, used inline; not persisted." Resolved Concern 2 in REBUILD-PLAN.md needs the same revision.

**REBUILD-PLAN.md update needed:**
- D4 brief — "Apify token coupling" section should change from "the page ALSO hosts the shared APIFY_AIOS_API_KEY value so /day-one Step 3 can instruct the client to paste it" to "the /levelup page generates a single paste-bundle (kickoff prompt + Apify token line) so the client copies once and `/day-one` parses the token silently."
- S3 brief — Apify resolution section should be rewritten to match the bundled-paste mechanism.

**Action:** Jacob runs `ADD-ITEM-PROMPT.md` in a separate session to formally update these. Not blocking S4 (build /day-one) — the spec is now the source-of-truth for the build, and the deviations are documented here.

---

## 5. Out of scope (parked, not v1.0)

- **Autonomous client self-onboarding.** /day-one assumes a guided session. Autonomous mode is V5 in the v1.1 backlog — different SKILL.md shape, harder spec.
- **Multi-language onboarding.** English only. Non-English clients = v1.1 backlog.
- **Voice profile capture.** `/onboarding/voice-profile.md` is /capture-voice's job (P4-P5, shipped as first opt-in update per Decision 21). /day-one does not touch it.
- **Connector setup.** Connectors are lazy-loaded by `/skill-builder` § 2.6 when a skill needs them. /day-one ends with no connectors active.
- **GitHub repo creation inside /day-one.** Moved to guide checklist (§ 2.1 + § 4.1).
- **Mac vs Windows divergence beyond OS detect.** OS detect happens; the only place a fork would matter for v1.0 is the (now-removed) setx command. No other Mac/Windows fork in /day-one v1.0.
- **Re-running /day-one.** Designed as one-shot per client. Re-invocation behavior is undefined in v1.0.

---

## 6. What S4 (build) must verify

Per Decision 23 (Verify before asserting), the S4 executing session must verify these in-session before claiming /day-one is built:

1. `onboarding/` directory exists (created by F18 migration).
2. `CLAUDE.md` § 1 Identity section is still empty (so /day-one fills it).
3. `TIME-SAVED.md` exists with table header in place (F9 done).
4. `SKILLS.md` has the `/day-one` row in `[not yet built]` state (F8 set this up).
5. Firecrawl MCP is connected and `FIRECRAWL_AIOS_API_KEY` env var is set (`claude mcp list` + PowerShell env var check).
6. D4 (/levelup page) **bundle format is locked** before S4 runs — /day-one's parser logic depends on the exact comment-marker shape D4 ships. If D4 hasn't built yet, S4 should either (a) lock the bundle format in this spec by amending § 2.6, or (b) wait for D4.

Item 6 is a real ordering hazard. The original Phase 5 plan has D4 AFTER all S3/S4 work. With this spec, /day-one's parser depends on D4's exact paste-block format. Options:
- **Lock the bundle format in this spec now** (§ 2.6 already proposes a concrete `<!-- SETUP_BUNDLE v1 ... -->` shape). S4 implements against the locked shape; D4 must honor it.
- **Defer the parser logic to a /day-one v1.0.1** that lands after D4. S4 ships /day-one without the parser; the build flow assumes the token is already in `$APIFY_AIOS_API_KEY` (fallback to old flow), and the parser is patched in post-D4.

**Recommendation (locked):** option 1 — lock the bundle format here. The concrete shape in § 2.6 IS the contract. D4 implements it. S4 implements the parser. No deferral.

---

End of spec.
