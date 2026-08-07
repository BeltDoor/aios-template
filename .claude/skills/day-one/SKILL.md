---
name: day-one
description: First-touch on-ramp inside this second brain. Three steps in front of the user — voice tool, harness settings (bypass mode + model picker), and a fast website + LinkedIn scrape — followed by a synthesized identity paragraph and a soft-ask handoff to /skill-builder. Use when the user pastes the kickoff line from members.king-intelligence.com, says "set me up", "first time", "I just opened this", "walk me through Day One", or when you spot the SETUP_BUNDLE marker in their first message. One-shot per client.
---

# /day-one

The first-touch on-ramp inside this second brain. Three steps, identity paragraph, soft handoff. I am the on-ramp, not the work.

> Guided session: this skill assumes Jacob (or a future facilitator) is screen-sharing with the client on Zoom or in-person. See § Notes for whoever is guiding this session at the bottom.

## Before you start — silent OS + shell detect

Before saying anything, run `uname` in Bash and read the result:

- **`Darwin`** → Mac. Remember it, proceed.
- **`MINGW...` or `MSYS...`** → Windows, and (this is the part that matters) you're running on **Git Bash**, the command line this whole skill is written in. Good. Remember it, proceed.
- **The command errors, the Bash tool can't run at all, or you get anything other than the above** → you're almost certainly on **PowerShell** (Windows' built-in command line), NOT Git Bash. **Stop here.** Every step below is Git Bash; on PowerShell the very first real command fails and onboarding dies confusingly three steps in. Fix the shell first (next section), then re-run `uname` and confirm you now get `MINGW...`/`MSYS...` before continuing.

Don't make the user tell you their OS; just know. But don't paper over a PowerShell shell either — catching it here is the difference between a clean setup and a baffling failure.

### If you're on PowerShell, not Git Bash (Windows only)

Say it plainly, no jargon: *"One quick setup thing before we start. Your computer's using its built-in command line, but your second brain needs a slightly different one that comes free with Git. Let me get that sorted, then we're off."*

1. **Make sure Git is installed** (it brings Git Bash with it). In the VS Code terminal: `winget install --id Git.Git -e --source winget` (winget ships with Win10 1809+/Win11).
2. **Close and reopen VS Code completely.** This is what lets your AI pick up Git Bash. Nine times out of ten this alone fixes it.
3. **Re-run `uname`.** If it now says `MINGW...`/`MSYS...`, you're set — continue with onboarding.
4. **If it STILL isn't on Git Bash** (rare): point Claude Code at Git Bash directly. Set the Windows environment variable `CLAUDE_CODE_GIT_BASH_PATH` to the full path of `bash.exe` (typically `C:\Program Files\Git\bin\bash.exe`), then reopen VS Code. To the user: *"I'm just telling your AI exactly where to find the right command line. One-time thing."*

The plain-English "what even is Git Bash" explainer for the user lives in [`/references/whats-getting-installed.md`](../../../references/whats-getting-installed.md) — read it to them if they ask why any of this matters.

## Silent toolkit install (right after the OS detect)

The full King Intelligence toolkit ships INSIDE this clone (the bundled `.king-intelligence` folder). No key is needed to use it — the key only turns on live updates later. Your job here is to make sure it's switched on. Still before saying anything, run `claude plugin list` in Bash:

- **The output includes `king-intelligence`** → already installed. Say one line so the check is visible (you're usually on a screen-share): *"Your King Intelligence toolkit is confirmed and ready."* Then proceed.
- **It's missing** → install it from the bundle that came with the clone. Confirm you're in the second brain folder (`pwd`), confirm the bundle is there (`ls .king-intelligence/.claude-plugin/marketplace.json`), then run:

  ```
  claude plugin marketplace add "$(pwd)/.king-intelligence"
  claude plugin install king-intelligence@king-intelligence-starter
  ```

  Then tell the client, plainly, no jargon:

  > Switching your toolkit on. One quick thing makes it stick: close VS Code all the way and open it again, then we'll keep going.

  After they reopen, re-run `claude plugin list` and confirm `king-intelligence` shows before moving on. The typeable `/king-intelligence:` commands appear after that reopen.

  **If the bundle folder isn't there** (rare — an old clone): fall back to *"Part of your toolkit didn't come through. Download it again from your Get Started page, or text Jacob."* Don't continue until `claude plugin list` shows `king-intelligence`.

### Also switch on the document tools (best-effort, don't block on it)

These are Anthropic's own free tools for making and reading PDFs, Word, Excel, and PowerPoint files. Public, no key. Run both; if either errors (no internet, etc.), skip silently and move on, this is a nice-to-have, not a gate:

```
claude plugin marketplace add anthropics/skills
claude plugin install document-skills@anthropic-agent-skills
```

They also load on the next reopen, alongside the toolkit above.

## Capture the setup bundle from the paste

The user's first message should be the kickoff line copied from their Get Started page at `members.king-intelligence.com`:

```
Read .claude/skills/day-one/SKILL.md and follow it to walk me through Day One.
<!-- SETUP_BUNDLE v1
APIFY_TOKEN=apify_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
-->
```

Parse the `APIFY_TOKEN=` line from inside the `SETUP_BUNDLE v1` HTML-comment block. Hold the value in working memory for this session only. Do **not** `setx` it, do **not** write it to `.env`, do **not** commit it. The token vanishes when this session ends — that's intentional.

**If the bundle is missing the token line** (they typed the prompt by hand instead of copying it): *"Looks like the LinkedIn-scrape part didn't come through. Quick fix — go back to your Get Started page and use the copy button on the last step, then paste the whole thing here."* Wait for the re-paste. Don't try to teach what a token is — that's exactly the surface I'm hiding. If they can't get it, carry on without LinkedIn; it is not a gate.

## Greeting

After the silent OS detect, the silent toolkit check, and the bundle parse, open with this — on-brand, one thought per line, no progress bars:

> Hey. Welcome to your second brain.
>
> You just did the hard part — getting all this onto your computer.
>
> ---
>
> Day One is short. It's the on-ramp.
>
> Three quick things: get your voice tool working, two settings that make me easy to drive, and a fast look at your business so I know who I'm working with. Then I'll make sure your work is safely backed up.
>
> Once that's done, your second brain is ready to start building real tools for you.
>
> ---
>
> Ready? Type **next**.

Between steps, use a plain progress indicator — no bars:

```
Day One — Step <N> of 3
```

"Type **next**" gates between steps. Reserve `AskUserQuestion` for real either/or choices inside the steps.

## The computer map is NOT yours to run

`/map-my-work` is its own separate prompt on the member's Get Started page, fired in its own window (Jacob's call, 8/7/26 — he runs the three setup prompts side by side). **Do not launch it, and do not ask for permission to scan anything.** That skill asks for its own consent when it runs.

If `references/where-my-work-lives.md` already exists by the time you write the identity paragraph, read it (see below). If it doesn't, carry on without it and don't mention it.

## Step 1 — Typeless voice tool (strong soft gate)

**Why this matters (say if asked):** Voice is the highest-leverage Day-1 install. Talking is ~4x faster than typing and lets you give the long natural answers I'm going to ask for. Without it, every future session is worse.

Recommend Typeless with affiliate link: `https://www.typeless.com/?via=jacob-king` — note the kickback transparently. Cross-platform (Mac, Windows, iPhone), 30-day free trial, no credit card to start.

`AskUserQuestion`:

1. **"Got it — Typeless is working" (Recommended)** — accept, proceed to Step 2.
2. **"I already use a different voice tool"** — accept, proceed.
3. **"I'm stuck"** — patient walkthrough, one step at a time.
4. **"I'll skip this for now"** — skip path below.

**Skip path** (only if the user picks option 4):

1. Plain-English cost warning: *"Quick heads-up — you'll get a worse experience here without it. Talking is 4x faster and lets you give me the long answers I'm going to ask for. I highly recommend doing this now. But if you want to defer — totally fine, I'll remind you next session."*
2. `AskUserQuestion` ONE more time: **"Try Typeless now"** / **"No, defer it (Recommended if you really want to skip)"**.
3. If they still defer: write `onboarding/voice-unconfigured.md` containing a single line: *"Voice tool skipped during /day-one on YYYY-MM-DD. /begin-session should re-prompt."* (Substitute today's date.) Proceed to Step 2.

No hard gate. A client who hits an install wall and is told "we can't proceed" closes the window. The re-prompt mechanism catches the lost conversion next session.

**On confirm:** *"From here on — talk, don't type. Let it be messy. I'll clean it up."*

## Step 2 — Two settings: bypass-permissions + model picker

Two micro-steps inside Step 2.

### 2a — Bypass-permissions UI verification

The settings file already sets `permissions.defaultMode = "bypassPermissions"`. Honor § Verify before asserting — confirm with the user rather than assume the UI matches.

> See the mode selector at the bottom of the chat? Your settings file already set it to **Bypass permissions** — that means I don't stop and ask you every time I want to write a file or run a command. You stay in control of the big stuff; I stop pestering you about the little stuff.
>
> Check the selector — what does it say?

`AskUserQuestion`:

- **"It says Bypass permissions" (Recommended)** — proceed to 2b.
- **"It says something else"** — *"No problem. Click the selector and pick Bypass permissions."* Wait for confirm, then proceed.

### 2b — Model picker (default Opus 4.7)

> Up at the top there's a model picker. Pick **Opus 4.7** if you see it — that's the deepest-thinking model, best for real business work.
>
> If you don't see Opus 4.7 in your list (depends on your plan), pick whatever's at the top — Sonnet works too.
>
> If the menu hangs for more than ~10 seconds, don't wait — just close it. You can change models any time by typing `/model`.

Wait for any kind of confirm ("done" / "picked it" / "ok"). Don't gate too hard — model picker UI lag is a known v1 trip-up.

**No Max-plan upsell.** Plan-tier upgrade is a sales conversation, not a setup step. If the client volunteers interest in Opus 4.7 and doesn't have it, that's a guide handoff outside /day-one.

## Step 3 — Business scrape (website + LinkedIn)

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

### Website scrape (Firecrawl primary, WebFetch silent fallback)

1. **Primary:** Firecrawl `/scrape` via the `mcp__firecrawl__firecrawl_scrape` MCP tool. Uses `FIRECRAWL_AIOS_API_KEY` (already captured at user scope).
2. **Fallback (silent):** if Firecrawl returns empty content, an HTTP error, or the env var is missing, use `WebFetch`. Same extraction targets, narrower data quality. Don't tell the user the fallback fired — silent.
3. **Extraction targets:** title, description, main copy, services, target audience, voice notes, any visible brand colors.
4. **Output:** `onboarding/profile-from-website.md`. Frontmatter-tag which path was used:

   ```yaml
   ---
   source: firecrawl  # or webfetch-fallback
   url: <user's URL>
   scraped: YYYY-MM-DD
   ---
   ```

### LinkedIn scrape (Apify, token from bundle)

1. **Validate URL.** If it doesn't match `linkedin.com/in/<username>`, ask once: *"That doesn't look like a profile URL — got a `linkedin.com/in/...` link handy?"*
2. **If still wrong, OR the client says they don't have LinkedIn:** skip the Apify call. Note in identity synthesis below that only the website was captured. Do **not** block Day 1 over a missing LinkedIn.
3. **Apify call** (token from § Capture the Apify token, inline in curl — never via env var):

   ```bash
   curl -sS -X POST "https://api.apify.com/v2/acts/harvestapi~linkedin-profile-scraper/run-sync-get-dataset-items?token=<TOKEN_FROM_BUNDLE>" \
     -H "Content-Type: application/json" \
     -d '{"queries":["<LINKEDIN_URL>"]}'
   ```

4. **Parse** the returned JSON array of profile objects. Pull `headline`, `about` / `summary`, `experience`, `education`, `skills`, `location`.
5. **Output:** `onboarding/profile-from-linkedin.md` — parsed JSON rendered as markdown.

### Neither link works

If the client has no website AND no LinkedIn:

> No problem — we'll get it straight from you. Tell me in your own words: what do you do, who do you serve, and how long have you been doing it?

Capture the answer. Write it to `onboarding/profile-from-client-statement.md`. Proceed to identity synthesis with that as the only source.

## Identity paragraph synthesis (fills CLAUDE.md § 1)

Four-step flow.

### First: check for the computer map

Before you reflect anything back, check whether `references/where-my-work-lives.md` exists (the member may have run `/map-my-work` in a parallel window). If it does, **read it**. It is the strongest source you have: a website says what someone sells, their folders say what they actually do all day. A folder called `2024 Roofing Jobs` holding 4,000 photos tells you more than any About page.

Use it to add one bullet the website could never give you, and to catch a mismatch worth asking about (the site sells consulting, the laptop is full of installs).

If the scan hasn't finished yet, don't wait for it and don't mention it. Carry on with the website and LinkedIn alone.

### A — Bullet reflect

Reflect what you found back as 4-5 short bullets. Plain language, no jargon:

> Here's what I picked up:
>
> - **Who you are:** [name + role + headline]
> - **What you sell:** [services / products in plain English]
> - **Who you serve:** [target customer segment]
> - **How you sound:** [voice notes from website / LinkedIn — tone, signature phrases if any]
> - **What you actually spend your time on:** [from the computer map, if it landed — the folders that are alive]
> - **Where you're based:** [city / region from LinkedIn]
>
> Close to right?

`AskUserQuestion`:

1. **"Yes, that's me" (Recommended)** — proceed to B.
2. **"You missed something"** — *"What did I miss?"* — capture, add to the picture, re-confirm.
3. **"Close enough — we'll build on it"** — accept as-is, proceed to B.

### B — One fact-check question

Ask exactly one — not a survey:

> One quick check — are you involved in more than one business or role? Main thing plus an advisor seat, two ventures, anything like that? If it's just the one, just say so.

Capture the answer. This is the most common scrape miss in 30 seconds.

### C — Synthesize the identity paragraph

Write a single paragraph (5-7 sentences) covering: name + primary role, business + what it sells, who they serve, voice notes (1 sentence on tone), multi-role flag if applicable, location if relevant. CEO-level voice — no jargon. This becomes the always-loaded identity context for every future session.

Format: just the paragraph as the body content under `## 1. Identity` in `CLAUDE.md`. No subheadings inside that section.

### D — Show-write confirm

Display the written paragraph back:

> Here's what I'm putting in your CLAUDE.md as your identity. This loads every time we start a session — so it's worth a quick read:
>
> [paragraph]
>
> Sound right, or want me to tweak it?

`AskUserQuestion`:

1. **"Sounds right" (Recommended)** — write to disk, done.
2. **"Tweak it"** — *"What needs to change?"* — capture, rewrite, re-confirm. One revision pass, then accept.

Write the final paragraph to `CLAUDE.md` § 1 Identity, replacing the empty stub. Do **not** touch any other section of CLAUDE.md.

## Backup — keep the work safe (the last setup task)

By now they've seen what the second brain can do. The last setup task is making sure the work can't be lost. Always make a local save first, then handle the off-machine backup, and skip GitHub entirely if the cloud already has it.

**1. Always make the first local save (you drive this in Bash).**
Confirm you're in the second brain folder first (`pwd`, never run this anywhere else), then:
```
git init -b main
git add -A
git commit -m "second brain initial setup"
```
The folder arrives as a downloaded zip with no history of its own, so there is nothing to sever first and **you must never run `rm -rf .git` here** — on a re-run, or on a member who set up a backup already, that would delete every save they have. `git init` on a folder that is already a repo is a harmless no-op. Confirm the save landed with `git log --oneline -1`.

If `git init` errors with "command not found", Git didn't install during setup. Send them back to the **Install your tools** step on their Get Started page rather than trying to fix it here.

**2. Is the folder already in a cloud-synced home? Check before asking for anything.**
Read the path from `pwd`:
- contains `OneDrive` → OneDrive already backs it up
- contains `Library/Mobile Documents` (that's iCloud Drive) → iCloud already backs it up
- contains `Dropbox` → Dropbox already backs it up

If any match, the off-machine backup is already handled. Say so plainly, and you're done with backup:

> Good news: your second brain lives in [OneDrive / iCloud / Dropbox], so every change backs up to the cloud automatically. Nothing to set up, your work is safe. (I also save a version locally every time we wrap up.)

Then go to the handoff. Do NOT run the GitHub step.

**3. Not in a synced folder? Offer GitHub backup (optional, soft gate).**
`AskUserQuestion`:

1. **"Turn on cloud backup" (Recommended)** runs the publish + verify + self-repair below.
2. **"Skip for now"** goes to the skip path.

**If they choose backup**, turn the local save into their OWN private, backed-up GitHub repo, and prove it's real before you move on. The button has silently half-failed on past setups (origin left pointing at the template, or a publish that made no commit), so verify against GitHub for real and repair it yourself if the verify fails. Never trust the button, trust the check.

**3a. Create the private repo (the client's one click).**
> Click the **Source Control** icon on the left bar (the branch icon). Click **Publish to GitHub**. If it asks you to sign in to GitHub, do it (a browser opens, approve it). Choose **"Publish to GitHub private repository"** and name it **secondbrain**.

Stress **private**: their real business data lives here. No GitHub account yet? The sign-in screen has a free "Create an account" link.

**3b. VERIFY FOR REAL, do not trust the button (you drive this in Bash).**
Wait for them to confirm they clicked through, then check against GitHub itself, not just a local string:
```
git remote -v          # origin MUST show github.com/<their-account>/secondbrain, NOT BeltDoor
git ls-remote origin   # actually contacts GitHub: success proves the repo exists, is reachable, and auth works
git log --oneline -1   # the commit exists (guaranteed by step 1)
```
The load-bearing check is **`git ls-remote origin`**: a clean local `git remote -v` can still be a dead backup. If it errors, or `git remote -v` is empty / still shows `BeltDoor`, the publish did NOT take, go to 3c. Only when `git ls-remote origin` succeeds AND origin is their own account do you tell them it's backed up.

**3c. Repair it yourself if the button flaked.**
Do NOT just re-loop the button. Repair from the terminal:
- **Fast path if `gh` is installed + authed** (`gh auth status` succeeds):
  ```
  git remote remove origin 2>/dev/null; gh repo create secondbrain --private --source=. --remote=origin --push
  ```
  (Don't install `gh` just for this; a stock Mac has no Homebrew, so it isn't guaranteed. If it's not there, use the next path.)
- **No-install path (works everywhere):** guide a 30-second manual repo create:
  > Go to **github.com/new**, name it **secondbrain**, set it to **Private**, click **Create repository**, then paste me the URL it shows you.

  When they paste the URL:
  ```
  git remote remove origin 2>/dev/null
  git remote add origin <THEIR-REPO-URL>
  git branch -M main
  git push -u origin main
  ```
  The push authenticates through VS Code's built-in GitHub sign-in, no token needed.

Re-run the 3b checks after any repair. Loop 3c until `git ls-remote origin` succeeds. On success:

> Done: your second brain is backed up to your own private GitHub, and I confirmed it's live, not just set up. Every time we wrap up I save and back it up automatically; you won't have to think about it.

**Skip path** (they chose "Skip for now"): one plain-English heads-up, then move on. Don't gate Day One on it:

1. *"No problem. Heads-up: without a cloud backup, your work only lives on this laptop. If it's lost or the laptop dies, the work goes with it. I'll remind you next session, and you can turn it on any time."*
2. Write `onboarding/backup-unconfigured.md` containing one line: *"Backup skipped during /day-one on YYYY-MM-DD. /begin-session should re-prompt."* (Substitute today's date.) Then go to the handoff.

## Handoff to /skill-builder (soft ask)

First, one short line introducing the toolkit, in plain words:

> One more thing: your full King Intelligence toolkit is already installed. Type `/king-intelligence:` any time to see every command, and `/king-intelligence:adapt <skill>` wires one up to your own tools.

A few skills (debrief, end-session, networking) tune themselves from a plain settings file at [`references/king-intelligence-config.md`](../../../references/king-intelligence-config.md). It ships pre-filled with safe defaults, so everything works today; open it and fill in your own tools (your CRM, your city, your calendar) whenever you're ready. Don't walk the client through it now (it's a "later, on your own time" thing), just let them know it's there.

Then `AskUserQuestion`:

1. **"Build your first skill now" (Recommended)** — invoke `/skill-builder` via the Skill tool in the same session. Continuity preserved.
2. **"Take a break — I'll be here when you come back."** — show the paste-line explicitly and stop:

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

## Out of scope (v1.0)

- **Re-running /day-one.** One-shot per client. Re-invocation behavior is undefined in v1.0.
- **Connector setup.** Connectors are lazy-loaded by `/skill-builder` § Connector gap when a skill needs them. /day-one ends with no connectors active.
- **Voice profile capture.** That's `/capture-voice`'s job (first opt-in update per the "Getting updates" pattern). /day-one does not create `voice-profile.md`.
- **Autonomous client self-onboarding.** v1.0 assumes a guided session. Autonomous mode is v1.1 backlog.
- **Connector setup walkthrough.** CONNECTIONS.md § "Recommended for solo experts" is visible to anyone who reads the file, but /day-one doesn't proactively walk through it.

## Notes for whoever is guiding this session

You (Jacob at first, possibly future facilitators) are on Zoom or in-person, screen-sharing the client. Use this as a pre-flight checklist + pacing aid.

### Pre-flight checklist (before /day-one starts)

**Everything below happens on the member's own Get Started page at `members.king-intelligence.com` before /day-one starts. Rebuilt 8/7/26: five steps, one tool install, one paste.**

- [ ] Client has Mac or Windows laptop. **Chromebook = hard no.** ChromeOS (stock OR Crostini) can't reliably run npm / git CLI / browser-helper flows the second brain assumes. Escalate to "buy a real laptop first" before Day 1.
- [ ] **Step 1 — VS Code installed** (a normal app download, the only thing they install by hand).
- [ ] **Step 2 — one paste installs the rest.** In VS Code: **Terminal → New Terminal**, then paste the line off their Get Started page. It installs Git, Node.js and Claude Code, and adds the Claude Code extension (`anthropic.claude-code`). Mac uses Apple's own developer tools and the official Node installer, **no Homebrew**. Windows uses `winget`. Then **close and reopen VS Code completely** so it detects all three. Verify: `git --version`, `node --version`, `claude --version`.
- [ ] Client signed into their Claude account in the extension.
- [ ] **Windows only — confirm the shell is Git Bash, not PowerShell.** The install line runs in PowerShell on Windows (that's where `winget` lives), which is correct — installing Git is what *gives* them Git Bash. After the reopen, run `uname`. `MINGW...`/`MSYS...` = good. An error or anything else means Claude is still on PowerShell and onboarding breaks on step one. `/day-one` auto-checks and self-repairs this at its very start, so this is just a belt-and-suspenders glance. Why it matters, in plain English: [`references/whats-getting-installed.md`](../../../references/whats-getting-installed.md).
- [ ] **Step 3 — download their second brain.** A gold button on the page gives them a zip already named `<firstname>s-secondbrain`. There is a paste-able clone line underneath as a backup if the download misbehaves.
- [ ] **Step 4 — open it in VS Code by hand.** **File → Open Folder**, pick `<firstname>s-secondbrain`. They do this themselves; it's a click they need to learn, and it's more reliable than asking an AI to do it.
- [ ] **Step 5 — THREE separate prompts**, meant to be run side by side in separate VS Code windows on the same folder: (A) turn on updates, which carries their personal key, (B) start Day One, the only one that needs a human, (C) map where their work lives. Nothing waits on anything else. `/day-one` neither launches nor waits on the other two.
- [ ] GitHub account (OPTIONAL). Backup is the LAST setup task, and it's only needed if their folder is NOT already in OneDrive / iCloud / Dropbox. Those drives back up on their own, so `/day-one` detects them and skips GitHub entirely. When GitHub backup IS used, the happy path is VS Code's "Publish to GitHub" (no `gh`, no token); the step still **commits first, verifies against GitHub for real (`git ls-remote origin`), and self-repairs from the terminal** if the button flakes.
- [ ] **Toolkit is keyless — no install lines needed to USE it.** The full King Intelligence toolkit ships INSIDE the download (the bundled `.king-intelligence` folder). `/day-one` installs it from that bundle at the start and has the client reopen VS Code once so the `/king-intelligence:` commands register. Their personal key only unlocks live updates (`/king-intelligence:update`), and it rides along in the step-5 paste.

**If the client asks what any of these installs are, don't improvise jargon.** The plain-English, no-background answers for every tool above (VS Code, Git, GitHub, Node.js, Git Bash vs PowerShell, and why we skip Homebrew on Mac) live in [`references/whats-getting-installed.md`](../../../references/whats-getting-installed.md). Read it to them.

> Repo creation lives in `/day-one`'s "Backup — keep the work safe (the last setup task)" step and uses VS Code's built-in Publish-to-GitHub. As of 6/30/26 backup runs LAST (after the client has seen the value), is SKIPPED when the folder already syncs to OneDrive / iCloud / Dropbox, and is OPTIONAL (soft gate) otherwise. Decision: `decisions/2026-05-28-onboarding-flow-publish-to-github.md`, **hardened 6/3/26** (commit-first + live `git ls-remote` verify + terminal self-repair) after the publish silently half-failed on two early client setups, **moved-to-last + made smart/optional 6/30/26**. (`BeltDoor/aios-template` is a normal public repo, not a GitHub "template" repo, so the old "Use this template" step never actually applied.)

### Pacing rules (during /day-one)

- **30-minute soft cap.** If /day-one runs past 30 min, you've gone too deep — the temptation is to start interviewing, don't. Identity-paragraph depth is /skill-builder's job (when building voice-aware skills), or /capture-voice's job later. Glance, don't dig.
- **Voice tool is the highest-leverage install.** If the client wants to skip, push back gently ONCE then let them skip — the re-prompt mechanism catches it next session.
- **Never wait on the computer map.** It is a separate prompt the member may be running in another window. If `references/where-my-work-lives.md` hasn't appeared by the identity paragraph, write the paragraph without it.
- **The setup bundle comes from the step-5 paste on their Get Started page.** If it's missing, have them use the copy button on that step rather than retyping. Don't try to teach them what a token is. LinkedIn is not a gate; carry on without it if it won't come.
- **Identity paragraph is locked-in context for every future session.** If the bullet reflect or paragraph looks subtly wrong, push for the correction NOW — fixing it later costs more.

### Guided-vs-autonomous flag

/day-one v1.0 explicitly assumes a guided session. Autonomous client self-onboarding is parked in V5 (v1.1 backlog) — a different SKILL.md shape that handles its own pacing without a human reading between the lines.

## Self-ping (do this at the end of every invocation)

Before you finish, increment my row in [`TIME-SAVED.md`](../../../TIME-SAVED.md):

- Skill: `/day-one`
- Manual time per use: 90 min (the rough cost of doing this kickoff by hand without a second brain — installing a voice tool, configuring Claude Code, manually researching my own business notes, writing the identity paragraph)
- Increment "Total uses" by 1
- Recompute "Total saved (cumulative)" as `Total uses × 90 min`
- Update "Last used" to today's date

If `/day-one` doesn't have a row yet, add one with the same fields.
