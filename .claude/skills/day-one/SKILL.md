---
name: day-one
description: First-touch on-ramp inside this second brain. Two steps in front of the user — a fast website + LinkedIn look at their business, then switching on backup — with the real deliverable in between; CLAUDE.md § 1 populated with their identity and a business snapshot. Use when the user pastes the kickoff line from members.king-intelligence.com, says "set me up", "first time", "I just opened this", or "walk me through Day One". One-shot per client.
---

# /day-one

The on-ramp. Its one deliverable: a CLAUDE.md § 1 that makes every future session open already knowing this business. Two visible steps, then a handoff. I am the on-ramp, not the work.

> Guided session: Jacob (or a facilitator) is usually screen-sharing with the client. Facilitator notes are at the bottom.

## Silent pre-checks (before saying anything)

1. **Shell.** Run `uname`. `Darwin` = Mac, proceed. `MINGW`/`MSYS` = Windows on Git Bash, proceed. Anything else (or Bash errors entirely) = PowerShell, and every command below dies on it. Say plainly: *"One quick setup thing — your computer's using its built-in command line, but your second brain needs the one that comes free with Git."* Then: install Git if missing (`winget install --id Git.Git -e --source winget`), have them fully close and reopen VS Code, re-run `uname`. Still wrong (rare): set the Windows env var `CLAUDE_CODE_GIT_BASH_PATH` to the full path of `bash.exe` (typically `C:\Program Files\Git\bin\bash.exe`), reopen. Plain-English explainers for every install live in [`references/whats-getting-installed.md`](../../../references/whats-getting-installed.md) — read from it if they ask.
2. **Toolkit.** From the second brain folder, run this with a 10-minute Bash timeout (the first download of the library can take a few minutes):

   ```
   node .king-intelligence/plugins/king-intelligence/scripts/connect-live.mjs
   ```

   It reads the member's personal key out of the folder itself, connects their live library, installs the toolkit from it, proves where the toolkit came from, and only then removes the frozen starter copy. The key stays inside the script: leave `.claude/settings.local.json` and `.mcp.json` unopened, and never put either file's contents on screen. The first line of its output is the verdict; the lines after it are plain sentences to relay.

   - `KI_CONNECT=live`: say one visible line, *"Your King Intelligence toolkit is connected to your personal library, and it keeps itself current."* If a "One thing to do" line came back, save it for the Handoff; reopening now would end this conversation.
   - `KI_CONNECT=starter`: this download carries no personal key. Say plainly: *"You're on the free starter copy of the toolkit. It works, and it doesn't update by itself."*
   - `KI_CONNECT=live-failed`: the live toolkit did NOT switch on. Say: *"Your toolkit didn't connect to your personal library yet"*, then the script's reason line in plain words, then *"you still have the starter tools today, and Jacob will finish the connection with you."* Carry on with Day One and repeat it in the end list.
   - `KI_CONNECT=starter-failed` or `KI_CONNECT=no-cli`, or `node` is not found: say in one plain line that part of the toolkit didn't come through and Jacob will sort it out, then carry on.

   **If that script is not in the folder** (`No such file`, or `Cannot find module`: an older download), use the older path, and never say "confirmed" or "ready" on it:
   - First run `ls .claude/ki-connect-missing.json`. If it exists, this is a member's download whose personal key could not be included: treat the toolkit as a FAILED personal connection, never as the free starter. Install the starter below so they have tools today, and at the Handoff say: *"Your download should have carried your personal key and didn't. To fix it, open members.king-intelligence.com/system, copy the Connect this computer message, and paste it into this chat."* Skip the other bullets' wording.
   - Run `claude plugin list --json`. If it lists `king-intelligence@king-intelligence` with `"enabled": true`, say *"Your King Intelligence toolkit is installed. Jacob will confirm it's connected to your personal library."* and put that check on the end list.
   - Otherwise, if it lists `king-intelligence@king-intelligence-starter`, it is the frozen starter copy: say so, as for `KI_CONNECT=starter`.
   - Otherwise install the starter from the bundle (confirm `ls .king-intelligence/.claude-plugin/marketplace.json` succeeds first): `claude plugin marketplace add "$(pwd)/.king-intelligence"`, then `claude plugin install king-intelligence@king-intelligence-starter`, and say it is the frozen starter copy.
   - If `ls .claude/settings.local.json` shows the file exists (a member's download), add: *"Your personal toolkit didn't switch on by itself yet; Jacob will finish it with you."* Check only that it exists; leave its contents unread.

   "Confirmed" and "ready" are words for `KI_CONNECT=live` only. A `king-intelligence` line in `claude plugin list` proves nothing on its own, because the frozen starter copy carries the same name.

   **If the command is refused outright, with no box to click, do not retry it and do not hand it to them.** Never send them to the terminal. Carry on with Day One and, at the very end, say in one plain line: *"One part of your toolkit didn't switch on by itself. Jacob will finish it with you; nothing you've done today is lost."*
3. **Document tools, best-effort.** Run `claude plugin marketplace add anthropics/skills` then `claude plugin install document-skills@anthropic-agent-skills`. If either errors, skip silently — nice-to-have, not a gate.

## Greeting

> Hey. Welcome to your second brain.
>
> You just did the hard part — getting all this onto your computer.
>
> Day One is short. Two things: a fast look at your business so I know who I'm working with, then making sure your work can never be lost.
>
> Ready? Type **next**.

Between steps: `Day One — Step <N> of 2`. "Type **next**" gates between steps; `AskUserQuestion` is for real choices inside them.

## Step 1 — Who you are (website + LinkedIn)

> Drop me two links: your website and your LinkedIn profile. Paste both and hit enter. If you don't have one of them, just say so.

- **Website:** `WebFetch` the homepage; if thin, fetch the About or Services page it links to. Two fetches max, no crawling. Pull: what they sell, who they serve, tone, any signature phrasing.
- **LinkedIn:** call the `linkedin_lookup` tool on the King Intelligence connection (it shows as `mcp__king-intelligence__linkedin_lookup`) with the profile address. It returns their headline, about, location and recent roles. The lookup runs on King Intelligence's side; there is no key to find, paste or pass. If the address isn't a `linkedin.com/in/<name>` profile, ask once. If the tool is missing or answers that the lookup did not come through, skip LinkedIn without comment and carry on with the website; never try to scrape LinkedIn any other way.
- **Neither link:** *"No problem — tell me in your own words: what do you do, who do you serve, and how long have you been doing it?"*

No intermediate files. Findings go straight into the synthesis below.

## Populate CLAUDE.md § 1 (the whole point)

First, check whether `references/where-my-work-lives.md` exists — the member may have run `/map-my-work` in a parallel window. If it does, read it: a website says what someone sells, their folders say what they actually do all day. Use it for one bullet the website could never give, and to catch a mismatch worth asking about. If it hasn't landed, carry on without it and don't mention it — never wait on it.

**A — Reflect.** Play back 4-6 short bullets, plain language: who you are, what you sell, who you serve, how you sound, what you actually spend time on (from the map, if it landed), where you're based. Ask: *"Close to right?"* via `AskUserQuestion` — "Yes, that's me" (Recommended) / "You missed something" (capture, re-confirm) / "Close enough".

**B — Two questions, one at a time.**
1. *"Are you involved in more than one business or role? Main thing plus an advisor seat, two ventures, anything like that? If it's just the one, say so."* (The most common scrape miss.)
2. *"What are the two or three things you're actually trying to get done this quarter? Rough is fine."*

**C — Synthesize.** Write CLAUDE.md § 1 as: one identity paragraph (3-4 sentences — name, role, business, who they serve, one sentence on how they sound, multi-role flag if real), then a short **Snapshot** bullet list: what they sell · who they serve · current priorities (their words, from question 2) · where their work lives (one line, only if the map landed). 10-15 lines total, CEO voice, no jargon. This loads at the top of every future session.

**D — Show, confirm, write.** Display it: *"Here's what I'm putting in your CLAUDE.md — it loads every time we start, so it's worth a quick read. Sound right, or want me to tweak it?"* One revision pass, then write to `CLAUDE.md` § 1, replacing the stub. Touch no other section.

## Step 2 — Backup (keep the work safe)

**1. Local save first, always.** Confirm `pwd` is the second brain folder, then:
```
git init -b main
git add -A
git commit -m "second brain initial setup"
```
The folder arrives as a zip with no history — `git init` on an existing repo is a harmless no-op, and **never run `rm -rf .git` here** (on a re-run it would delete every save they have). Confirm with `git log --oneline -1`. If `git` is "command not found", send them back to the **Install your tools** step on their Get Started page.

**2. Already cloud-synced?** If `pwd` contains `OneDrive`, `Library/Mobile Documents` (iCloud Drive), or `Dropbox`, the cloud already backs it up. Say so plainly — *"your second brain lives in [drive], every change backs up automatically, nothing to set up"* — and skip GitHub entirely.

**3. Otherwise, offer GitHub (soft gate).** `AskUserQuestion`: "Turn on cloud backup" (Recommended) / "Skip for now".

**On yes — publish, then VERIFY FOR REAL.** The button has silently half-failed on past setups; trust the check, never the button.
- **Their click:** Source Control icon → **Publish to GitHub** → sign in if asked → **"Publish to GitHub private repository"**, named **secondbrain**. Stress **private**. No account? The sign-in screen has a free create link.
- **Your check (Bash):** `git remote -v` (origin must be THEIR account, not BeltDoor) · `git ls-remote origin` (the load-bearing one — a live GitHub call proving the repo exists and auth works) · `git log --oneline -1`.
- **If it flaked, repair from the terminal — don't re-loop the button.** With `gh` installed and authed: `git remote remove origin 2>/dev/null; gh repo create secondbrain --private --source=. --remote=origin --push`. Otherwise: have them create the repo at **github.com/new** (name **secondbrain**, **Private**) and paste the URL, then `git remote remove origin 2>/dev/null && git remote add origin <URL> && git branch -M main && git push -u origin main` (auth rides VS Code's GitHub sign-in). Re-run the checks; loop until `git ls-remote origin` succeeds. Then: *"Done — backed up to your own private GitHub, and I confirmed it's live. Every time we wrap up I save and back up automatically."*

**On skip:** one plain heads-up (*"without cloud backup, your work only lives on this laptop — I'll remind you next session"*), write `references/backup-unconfigured.md` with one line: *"Backup skipped during /day-one on YYYY-MM-DD."* Move on.

## Handoff

Say the line that matches the toolkit verdict from the pre-checks:

- `live`: *"One more thing: your full King Intelligence toolkit is installed from your personal library. Type `/king-intelligence:` any time to see every command, and `/king-intelligence:adapt <skill>` wires one up to your own tools."* If the check asked for a reopen, add: *"Close VS Code completely and open it again when we're done here, so the new toolkit loads."*
- `starter`: *"You're on the free starter toolkit, a frozen copy. Your personal key switches on the live one, which keeps itself current."*
- `.claude/ki-connect-missing.json` was found, or `live-failed`: repeat the recovery line from the pre-check (for the marker: copy the Connect this computer message from members.king-intelligence.com/system and paste it into this chat).
- anything else: repeat the one plain line from the pre-check, that Jacob will finish the toolkit connection with you.

(A few skills tune themselves from [`references/king-intelligence-config.md`](../../../references/king-intelligence-config.md) — mention it exists, don't walk it now.)

`AskUserQuestion`: **"Build your first skill now" (Recommended)** → invoke `/skill-builder` in this session. **"Take a break"** → show the paste line and stop talking:

> Nice work today. Your second brain is ready. When you want to build your first skill, paste this in:
>
> ```
> Read .claude/skills/skill-builder/SKILL.md and walk me through it.
> ```

## Notes for whoever is guiding this session

- **Pre-flight** (all on the member's Get Started page, before /day-one): Mac or Windows laptop (Chromebook = hard no) · VS Code installed · the one-paste tool install pasted into the Claude chat and run by Claude, then VS Code fully reopened · signed into Claude in the extension · Windows: `uname` says `MINGW`/`MSYS` · second brain downloaded and opened via File → Open Folder · voice tool set up from the page's own step · the three prompts run side by side in separate windows (updates key / this one / the computer map).
- **30-minute soft cap.** The temptation is to start interviewing — don't. Two confirm questions, not a survey; depth is /skill-builder's and /capture-voice's job. But if the § 1 write-up looks subtly wrong, push for the correction NOW — it's locked-in context and fixing it later costs more.
- **Never launch or wait on `/map-my-work`.** It's its own prompt in its own window; it asks its own consent. Read its output if it exists at synthesis time, otherwise write without it.

## Self-ping (end of every invocation)

Increment my row in [`TIME-SAVED.md`](../../../TIME-SAVED.md): skill `/day-one`, manual time per use 60 min, Total uses +1, recompute cumulative as uses × 60 min, Last used = today. Add the row if missing.
