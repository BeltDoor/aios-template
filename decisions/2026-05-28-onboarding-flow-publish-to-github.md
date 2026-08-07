# Onboarding flow: VS Code "Publish to GitHub" replaces gh / "Use this template"

created: 05/28/26 - 21:20 EDT

Supersedes the repo-creation parts of [`2026-05-24-day-one-spec.md`](2026-05-24-day-one-spec.md) §2.1 + §4.1 (the "Use this template → private repo" pre-flight) and the briefly-considered `gh auth login` / `gh repo create` approach.

## Context

Two questions from a client AIOS setup call (5/28) exposed gaps in the live onboarding:
1. Clients hit a "Git is not installed" error mid-call, because Git was never in the pre-flight checklist.
2. The live `king-intelligence.com/levelup` page does a plain **public** `git clone` of `BeltDoor/aios-template`, so the client's `origin` points at the public template (no write access) — meaning `/end-session`'s push silently can't work and the "off-laptop backup / across-laptops" promise was never actually live.

`gh` was considered to force-create a private repo, but it's another install (and on a stock Mac needs Homebrew, which isn't preinstalled — verified). That breaks the "client installs almost nothing" frame.

## Decision

Client-facing onboarding installs **only Git**, and the private backup repo is created with **VS Code's built-in "Publish to GitHub" → private repository** — no `gh`, no Personal Access Token, identical on Mac and Windows.

Locked flow:
1. **Pre-flight:** install Git (Windows `winget install --id Git.Git -e --source winget`; Mac `xcode-select --install`), restart VS Code, verify `git --version`.
2. **Step 1 (levelup):** `git clone … "$HOME/Downloads/second brain"` (lands in Downloads — not OneDrive-synced).
3. **Step 2 (levelup):** paste the kickoff bundle (Apify token embedded in a `SETUP_BUNDLE` HTML comment — see [`2026-05-28`-era levelup edit]). `/day-one` starts.
4. **`/day-one` first action — "turn on the backup":** Claude detaches the cloned template (`rm -rf .git`), then guides the client to click **Source Control → Publish to GitHub → "Publish to GitHub private repository"** (named `secondbrain`), and verifies `git remote -v` points at the client's account, not `BeltDoor`.
5. Ongoing: `/end-session` commits + pushes; the push runs unattended from VS Code's integrated terminal because VS Code injects its GitHub sign-in into its own terminal (`git.terminalAuthentication`, default on).

Decisions locked with Jacob via AskUserQuestion (5/28): GitHub is the backup · clone into Downloads · client owns the repo under their own account · force-private · Git is the one required install.

## Why (verified, not assumed)

A research workflow verified each load-bearing fact against official docs:
- **VS Code "Publish to GitHub"** creates a new repo under the signed-in account, offers an explicit **"Publish to GitHub private repository"** Quick Pick, and creates + remotes + pushes in one action — built-in auth, no `gh`, no PAT (code.visualstudio.com). It is GUI/Command-Palette only, so a human must click it (Claude can't drive it from the terminal) — hence Claude *guides* the click.
- **Terminal push auth:** in VS Code's integrated terminal (default settings), git uses VS Code's injected askpass / GitHub sign-in, so `/end-session`'s push runs without a separate login. (An *external* terminal would instead use Git Credential Manager with a one-time browser click.)
- **Agentic install limits:** `winget` can install Git/gh mid-session on Windows (with a PATH refresh), but a stock **Mac has no Homebrew** and `xcode-select` is a GUI dialog — so `gh` can't be installed invisibly cross-platform. This is why the no-install VS Code publish path wins.
- `BeltDoor/aios-template` is **not** flagged as a GitHub "template" repo and is public — so the old "Use this template" instruction never actually worked.

## Files changed (5/28)

- `docs/levelup/index.html` — Step 1 clones into Downloads; Step 2 carries the Apify token bundled in the kickoff paste (separate "copy the key" step removed).
- `.claude/skills/day-one/SKILL.md` — added the "First — turn on the backup" step; greeting mentions backup; pre-flight checklist now requires Git install and drops the "Use this template" / `gh` steps.
- `references/git-and-backup.md` — one-time setup + restore rewritten around Publish-to-GitHub (no manual `git remote add` / `git push`).

## 6/3/26 update — hardened the backup step (commit-first + real verify + self-repair)

**Why:** the Publish-to-GitHub button silently half-failed twice (two early client setups, 6/1 and 6/3) — origin left on the template and/or no commit made — and the soft verify (`git remote -v` only) didn't catch it, so clients walked away with a dead backup that surfaced later as a failed push. Root cause: the button is a GUI action Claude can't drive or verify in real time, and a local `git remote -v` read can look clean while the backup isn't real.

**What changed (the publish button stays — it's still the zero-install, cross-platform happy path; the *constraint that gh can't be guaranteed on a stock Mac still holds*, so we did NOT switch to gh):**
1. **Commit first.** `/day-one` now runs `git init -b main && git add -A && git commit` BEFORE the publish, so a first save always exists (kills the "no commits" half).
2. **Verify for real.** The check is now `git ls-remote origin` (a live call to GitHub that proves the repo exists + is reachable + auth works), not just `git remote -v`. Don't declare "backed up" until it succeeds and origin is the client's own account (kills the "silently broken" half).
3. **Self-repair from the terminal.** If verify fails, Claude repairs it itself instead of re-looping the button: `gh repo create … --push` if gh happens to be present + authed, else guide a 30-second manual repo create at github.com/new and run `git remote add origin <url> && git push -u origin main` (push auths through VS Code's GitHub sign-in). Loop until `git ls-remote origin` succeeds; never proceed on an unverified backup.

Files touched 6/3: `.claude/skills/day-one/SKILL.md` (backup step + pre-flight note + decision pointer), `CLAUDE.md` § 4 health check (now uses `git ls-remote`), `references/git-and-backup.md` (client-facing § one-time setup). Republished to `BeltDoor/aios-template`.
