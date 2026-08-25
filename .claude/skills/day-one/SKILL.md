---
name: day-one
description: First-touch on-ramp inside this second brain. Two steps in front of the user — a fast website + LinkedIn look at their business, then switching on backup — with the real deliverable in between; CLAUDE.md § 1 populated with their identity and a business snapshot. Use when the user pastes the kickoff line from members.king-intelligence.com, says "set me up", "first time", "I just opened this", "walk me through Day One", or when you spot the SETUP_BUNDLE marker in their first message. One-shot per client.
---

# /day-one

The on-ramp. Its one deliverable: a CLAUDE.md § 1 that makes every future session open already knowing this business. Two visible steps, then a handoff. I am the on-ramp, not the work.

> Guided session: Jacob (or a facilitator) is usually screen-sharing with the client. Facilitator notes are at the bottom.

## Silent pre-checks (before saying anything)

1. **Shell.** Run `uname`. `Darwin` = Mac, proceed. `MINGW`/`MSYS` = Windows on Git Bash, proceed. Anything else (or Bash errors entirely) = PowerShell, and every command below dies on it. Say plainly: *"One quick setup thing — your computer's using its built-in command line, but your second brain needs the one that comes free with Git."* Then: install Git if missing (`winget install --id Git.Git -e --source winget`), have them fully close and reopen VS Code, re-run `uname`. Still wrong (rare): set the Windows env var `CLAUDE_CODE_GIT_BASH_PATH` to the full path of `bash.exe` (typically `C:\Program Files\Git\bin\bash.exe`), reopen. Plain-English explainers for every install live in [`references/whats-getting-installed.md`](../../../references/whats-getting-installed.md) — read from it if they ask.
2. **Toolkit.** Run `claude plugin list`. If `king-intelligence` shows, say one visible line: *"Your King Intelligence toolkit is confirmed and ready."* If missing, install from the bundle that shipped in the clone (confirm `pwd` is the second brain folder and `ls .king-intelligence/.claude-plugin/marketplace.json` succeeds first):

   ```
   claude plugin marketplace add "$(pwd)/.king-intelligence"
   claude plugin install king-intelligence@king-intelligence-starter
   ```

   Then have them close VS Code completely and reopen (that's what registers the `/king-intelligence:` commands), and re-confirm with `claude plugin list`. Bundle folder absent (old clone): *"Part of your toolkit didn't come through — re-download from your Get Started page, or text Jacob."* Don't continue until the toolkit shows.
3. **Document tools, best-effort.** Run `claude plugin marketplace add anthropics/skills` then `claude plugin install document-skills@anthropic-agent-skills`. If either errors, skip silently — nice-to-have, not a gate.
4. **Setup bundle.** The first message should carry a `SETUP_BUNDLE v1` HTML-comment block with an `APIFY_TOKEN=` line. Hold the token in working memory for this session only — never `setx`, never `.env`, never committed. If it's missing: *"Looks like part of your setup line didn't come through — go back to your Get Started page, use the copy button on the last step, and paste the whole thing here."* If they can't get it, carry on; LinkedIn is not a gate.

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
- **LinkedIn:** validate the URL matches `linkedin.com/in/<username>` (ask once if not). Then, token inline in curl, never via env var:

  ```bash
  curl -sS -X POST "https://api.apify.com/v2/acts/harvestapi~linkedin-profile-scraper/run-sync-get-dataset-items?token=<TOKEN_FROM_BUNDLE>" \
    -H "Content-Type: application/json" \
    -d '{"queries":["<LINKEDIN_URL>"]}'
  ```

  Pull `headline`, `about`, `experience`, `location`. No valid URL or no token → skip, don't block.
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

> One more thing: your full King Intelligence toolkit is already installed. Type `/king-intelligence:` any time to see every command, and `/king-intelligence:adapt <skill>` wires one up to your own tools.

(A few skills tune themselves from [`references/king-intelligence-config.md`](../../../references/king-intelligence-config.md) — mention it exists, don't walk it now.)

`AskUserQuestion`: **"Build your first skill now" (Recommended)** → invoke `/skill-builder` in this session. **"Take a break"** → show the paste line and stop talking:

> Nice work today. Your second brain is ready. When you want to build your first skill, paste this in:
>
> ```
> Read .claude/skills/skill-builder/SKILL.md and walk me through it.
> ```

## Notes for whoever is guiding this session

- **Pre-flight** (all on the member's Get Started page, before /day-one): Mac or Windows laptop (Chromebook = hard no) · VS Code installed · the one-paste tool install run in a real terminal, then VS Code fully reopened · signed into Claude in the extension · Windows: `uname` says `MINGW`/`MSYS` · second brain downloaded and opened via File → Open Folder · voice tool set up from the page's own step · the three prompts run side by side in separate windows (updates key / this one / the computer map).
- **30-minute soft cap.** The temptation is to start interviewing — don't. Two confirm questions, not a survey; depth is /skill-builder's and /capture-voice's job. But if the § 1 write-up looks subtly wrong, push for the correction NOW — it's locked-in context and fixing it later costs more.
- **Never launch or wait on `/map-my-work`.** It's its own prompt in its own window; it asks its own consent. Read its output if it exists at synthesis time, otherwise write without it.
- **Bundle missing?** Have them use the copy button on the page's last step, never retype. Don't teach what a token is.

## Self-ping (end of every invocation)

Increment my row in [`TIME-SAVED.md`](../../../TIME-SAVED.md): skill `/day-one`, manual time per use 60 min, Total uses +1, recompute cumulative as uses × 60 min, Last used = today. Add the row if missing.
