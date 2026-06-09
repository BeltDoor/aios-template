# Git and Backup

How your Snowball folder stays safe — and how it follows you to a new laptop.

## What this is

Your Snowball folder is a **git repo**. Think of git as a time machine for the folder: every change you save gets a snapshot you can roll back to.

**GitHub** is where those snapshots get sent for safekeeping. Pushing your folder to a private GitHub repo gives you two things at once:

- **An encrypted off-laptop backup.** If your laptop is lost, stolen, or wiped, your Snowball is still there.
- **Access from any machine.** Sign into GitHub on a new laptop, clone the folder, and you're back — same identity, same skills, same history.

Your repo is **private**. Only you (and anyone you explicitly invite) can see it.

## One-time setup (`/day-one` does this with you)

You don't touch the terminal for this — `/day-one` handles it as its very first step, using a button built into VS Code. The shape:

1. **Publish to GitHub.** When Claude prompts you, click the **Source Control** icon on the left, then the **Publish to GitHub** button. If it asks you to sign in to GitHub, do it — a browser window opens, you approve it. (No GitHub account yet? The sign-in screen has a free "Create an account" link.)
2. **Pick "private."** Choose **"Publish to GitHub private repository"** and name it `snowball`. In one click, VS Code creates the repo under your account, connects your folder to it, and pushes the first backup.
3. **Claude proves it's real, then moves on.** Before saying you're backed up, Claude actually reaches out to GitHub to confirm your repo is there and reachable — not just that it looks set up. If that one click didn't fully take (it happens — a browser closes, the connection hiccups), Claude fixes it on the spot from the terminal so you leave the session with a backup that genuinely works, not one that quietly isn't there.

## What `/king-intelligence:end-session` does

Every time you wrap up with `/king-intelligence:end-session`, the skill:

1. Saves any unsaved changes (a git commit).
2. Sends them to your GitHub repo (a git push).

So your backup is current as of the last time you closed out a session — never more than one session behind.

**If the push fails**, Claude tells you in plain English what went wrong (your sign-in expired, your internet is down, the repo URL is wrong) and what to do about it. It doesn't fail silently.

## What's NOT in the repo

Two things stay on your laptop only and never get pushed to GitHub:

- **`.env`** — where your API keys live. Keys never belong in a backup, even a private one.
- **`.playwright-profile/`** — the browser session Claude uses when it needs to log in somewhere as you. It holds live cookies; pushing it would be the same as pushing your passwords.

Both are listed in `.gitignore`, which is git's "don't ever back this up" file. So your backup is safe to push even though your Snowball folder contains real business data — the actual secrets stay local.

## Restoring on a new laptop

1. **Install Git, VS Code, and the Claude Code extension** — same as your first setup.
2. **Clone your repo.** In VS Code: **Source Control → Clone Repository → pick your `snowball` repo** (or run `git clone <your-repo-url>` in the terminal). This downloads your whole Snowball.
3. **Open it in VS Code, then run `/day-one`.** Claude notices you're on a fresh machine, walks you through re-adding your API keys to local env vars, and (when needed) re-creates your browser profile so Claude can log in as you again.

When `/day-one` finishes, you're back where you left off — same identity, same skills, same history.

## Sharing one Snowball with a teammate

Two people can share one Snowball so it works as a single shared brain. The trick: one private repo, two laptops pointing at it. Do NOT have both people set up from scratch separately, or you end up with two unconnected copies.

1. **First person** sets up normally (`/day-one` publishes the private `snowball` repo to GitHub).
2. **Second person** does NOT clone the template. They get access to the first person's repo (either both sign into the same GitHub account, or the first person invites them as a collaborator on the repo in GitHub), then in VS Code: **Source Control → Clone Repository → pick the `snowball` repo**. Now both laptops point at the same private repo.
3. **Working rhythm:** before you start, pull the latest down (Source Control → Sync Changes, or just tell Claude "sync the latest down"). When you finish, `/king-intelligence:end-session` saves and backs up for you, and it pulls down any of your teammate's changes first. To keep it simple, avoid both running a session on the exact same file at the exact same time.

If two people did edit the same file at once, nothing is lost: both versions are saved, and Claude merges them and asks you to confirm.

**Already set up separately by mistake?** (Both laptops still point at `BeltDoor/aios-template`, or you each made your own repo.) Pick one laptop as the main one, turn its backup on properly (`/day-one`'s publish step), then on the other laptop clone that same repo per step 2.
