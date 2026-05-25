# Git and Backup

How your Snowball folder stays safe — and how it follows you to a new laptop.

## What this is

Your Snowball folder is a **git repo**. Think of git as a time machine for the folder: every change you save gets a snapshot you can roll back to.

**GitHub** is where those snapshots get sent for safekeeping. Pushing your folder to a private GitHub repo gives you two things at once:

- **An encrypted off-laptop backup.** If your laptop is lost, stolen, or wiped, your Snowball is still there.
- **Access from any machine.** Sign into GitHub on a new laptop, clone the folder, and you're back — same identity, same skills, same history.

Your repo is **private**. Only you (and anyone you explicitly invite) can see it.

## One-time setup (`/day-one` walks you through this)

You don't have to do this by hand — `/day-one` does it with you, step by step. The shape:

1. **Create a private GitHub repo.** Whatever you want to call it (e.g. `my-snowball`). Leave it empty — no README, no .gitignore, no license.
2. **Tell your local folder where the repo lives.** Claude runs `git remote add origin <your-repo-url>`.
3. **Push for the first time.** Claude runs `git push -u origin main`. Your whole Snowball is now backed up.

If you don't have a GitHub account yet, `/day-one` walks you through creating one first.

## What `/end-session` does

Every time you wrap up with `/end-session`, the skill:

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

Three steps:

1. **Clone the repo.** `git clone <your-repo-url>` — this downloads your whole Snowball folder onto the new machine.
2. **Open it in VS Code.**
3. **Run `/day-one`.** Claude will notice you're on a fresh machine, walk you through re-adding your API keys to local env vars, and (when needed) re-create your browser profile so Claude can log in as you again.

When `/day-one` finishes, you're back where you left off — same identity, same skills, same history.
