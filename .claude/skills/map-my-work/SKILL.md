---
name: map-my-work
description: Map where the user's real business work actually lives on this computer — Desktop, Documents, OneDrive, SharePoint, iCloud Drive, Dropbox — and write it to references/where-my-work-lives.md so every future session knows where to look instead of asking. Two passes: a fast top-level sweep, then a deep dive only into the folders that hold business work. Reads folder and file NAMES only, never opens a document, never moves or copies anything. Use when the user says "map my computer", "where does my stuff live", "find my business files", "learn my folders", when /day-one hands off after consent, or when a session repeatedly can't find a file the user refers to. Requires explicit consent before the first scan.
---

# /map-my-work

I find out where your real work lives, once, so nobody has to explain it again. I write down where things are. **I never move, copy, rename, or delete a single file, and I never open a document to read what's inside it.**

## The consent gate (non-negotiable)

**Do not run a single scan command until the user has said yes, in this session, to a question that named what I read.**

Normally `/day-one` asks for me, up front, before it hands me off to run in the background. If you were invoked by `/day-one` and the handoff says consent was given, proceed straight to Pass 1.

If you were invoked any other way, ask first with `AskUserQuestion`:

> **Question:** "Can I have a look around your computer to find where your work lives?"
>
> **What I read:** the names of your folders and files. Desktop, Documents, Downloads, and any OneDrive, SharePoint, iCloud Drive or Dropbox you have synced.
>
> **What I never do:** open a document, read what's inside anything, move a file, or send anything anywhere. The list stays in your own folder on your own laptop.
>
> **Options:** "Yes, go ahead (Recommended)" · "Only the folders I name" · "No thanks"

- **Yes** → Pass 1.
- **Only the folders I name** → ask which, then skip Pass 1 and run Pass 2 on exactly those.
- **No** → write nothing, say one line ("No problem, I'll ask when I need to find something"), and stop. Do not ask again this session.

## Before you scan — know the machine

Run `uname`:
- `Darwin` → Mac.
- `MINGW…` / `MSYS…` → Windows on Git Bash.

Everything below is Git Bash syntax and runs on both.

**Two portability rules, both learned the hard way (8/7/26):**
- Use **`-mtime -90`**, never `-newermt '-90 days'`. The relative form errors out on a Mac.
- On a Mac, cloud drives live under `~/Library/…`, which the main sweep deliberately skips. They have to be listed explicitly (see below) or you will report that someone has no OneDrive when they have four years of work in it.

## Pass 1 — the fast sweep (folder names only, ~30 seconds)

Two levels deep, no hidden folders, no app clutter. The point is a map of the neighbourhood, not every house.

```bash
find "$HOME" -maxdepth 2 -type d \
  -not -path "*/.*" \
  -not -path "$HOME/Library/*" \
  -not -path "*/node_modules/*" 2>/dev/null | head -400
```

Then the cloud drives, which that command skips on purpose. Run all of these; the ones that don't exist stay silent:

```bash
ls -d "$HOME"/Library/CloudStorage/* 2>/dev/null            # Mac: OneDrive, SharePoint, Google Drive, Box
ls -d "$HOME"/Library/Mobile\ Documents/com~apple~CloudDocs 2>/dev/null   # Mac: iCloud Drive
ls -d "$HOME"/OneDrive* "$HOME"/Dropbox "$HOME"/iCloudDrive 2>/dev/null   # Windows + Mac shortcuts
```

Then one level inside each cloud root that exists:

```bash
find "<cloud root>" -maxdepth 2 -type d -not -path "*/.*" 2>/dev/null | head -150
```

A SharePoint document library synced through OneDrive shows up as `OneDrive - <Company Name>`. Treat every one of those as a strong business signal.

## Pass 2 — decide what is business, then dig

From Pass 1's names alone, sort every folder into **business**, **personal**, or **system**. You are reading names, so say so if a call is a guess.

Business signals: client, customer, proposal, quote, invoice, contract, agreement, project, job, sales, marketing, admin, accounts, books, tax, payroll, HR, `OneDrive - <Company>`, SharePoint, a company name, a year that looks like a filing scheme (`2024 Jobs`).

Not business: Applications, Library, Movies, Music, Pictures, Public, node_modules, anything under a dot folder, game and app data.

**Cap the deep dive at the 8 most business-looking folders.** If more than 8 qualify, take the 8 with the most recent activity and **say in the map which ones you skipped**. Never silently truncate.

For each folder you picked, run these three:

```bash
find "<dir>" -maxdepth 4 -not -path "*/.*" 2>/dev/null | head -600
find "<dir>" -type f -not -path "*/.*" 2>/dev/null \
  | sed 's|.*/||' | grep '\.' | sed 's|.*\.||' | tr 'A-Z' 'a-z' \
  | sort | uniq -c | sort -rn | head -10
find "<dir>" -type f -not -path "*/.*" -mtime -90 2>/dev/null | wc -l
```

That gives you the shape, what kind of files live there, and whether it's alive or an archive.

## Pass 3 — write the map

Write `references/where-my-work-lives.md`. Overwrite it if it exists; it is a snapshot, not a log.

Plain language, no jargon, no path that isn't real. Every line must trace to something a scan actually returned.

```markdown
# Where my work lives

_Mapped <today's date>. Folder and file names only; nothing was opened, moved, or copied._

## The short version

<Two or three sentences. Where the real business work sits, and the one thing that
would surprise a new assistant. Written for a person, not a machine.>

## Business

| What | Where | Looks like | Still active |
|------|-------|-----------|--------------|
| Proposals and quotes | `~/Library/CloudStorage/OneDrive-Acme/Sales` | 240 files, mostly .docx and .pdf | Yes, 31 touched in the last 90 days |
| Job photos | `~/Desktop/Job Photos` | 4,100 files, mostly .jpg | Yes, 900 in the last 90 days |

## Personal or system, ignore these

<One line each. Named so a future session doesn't re-scan them.>

## Not looked at

<Anything skipped, and why: over the 8-folder cap, permission denied, or the user
asked you not to. If nothing was skipped, say "Nothing.">

## Open questions

<Folders whose purpose you genuinely could not tell from names. Ask about these
next time the user is around. If none, delete this section.>
```

Then make sure the map gets used: confirm `CLAUDE.md` § 2 points at
[`references/where-my-work-lives.md`](../../../references/where-my-work-lives.md). It ships pointed there. If someone removed the pointer, put it back rather than duplicating the map's contents into `CLAUDE.md`.

## Pass 4 — if it's a mess, offer a fix (never do it)

If the deep dive found real disorder (the same kind of file in four unrelated places, a `Desktop` with 200 loose files, three folders that look like copies of each other), do **not** reorganize anything. Instead, append to the bottom of the map:

```markdown
## If you ever want this tidied up

<One plain sentence on what's messy and what it costs you.>

Paste this into the chat whenever you want to sort it out. Nothing happens until you do:

​```
Read references/where-my-work-lives.md and help me reorganize <the specific folders>.
Show me your plan first and don't move anything until I say go.
​```
```

Write the prompt to match what you actually found. A generic one is worse than none.

**Moving a stranger's files on day one is the single most damaging thing this skill could do. It is out of scope permanently, not just by default.**

## When a scan is blocked

On a Mac, `Desktop`, `Documents` and `Downloads` are protected, and a terminal without permission gets `Operation not permitted` instead of results. Don't retry in a loop and don't report an empty folder as empty.

Say it plainly and move on:

> Your Mac is holding back three folders until you give the app permission. It takes about 20 seconds: **System Settings → Privacy & Security → Files and Folders**, find **VS Code**, and switch on Desktop, Documents and Downloads. Say "try again" when you have and I'll finish the map.

Record every blocked folder under **Not looked at**. A map that quietly omits Documents is worse than no map.

## Rules that don't bend

1. **Names only.** Never open a file to see what's in it. `find`, `ls`, `du`, `wc` — never `cat`, `head`, `grep -r` over contents, or any read tool on a document outside this folder.
2. **Nothing moves.** No `mv`, `cp`, `rm`, `mkdir`, or rename outside this folder, ever, for any reason.
3. **Nothing leaves the laptop.** The map is written to this folder and nowhere else. It is never emailed, uploaded, or put in a message.
4. **Never invent a path.** Every path in the map came back from a command you ran in this session.
5. **Say what you skipped.** Caps, permission blocks and user exclusions all get named in the map.

## Self-ping (do this at the end of every invocation)

Before you finish, increment my row in [`TIME-SAVED.md`](../../../TIME-SAVED.md):

- Skill: `/map-my-work`
- Manual time per use: 45 min (writing down, by hand, where everything lives across a laptop and its cloud drives)
- Increment "Total uses" by 1
- Recompute "Total saved (cumulative)" as `Total uses × 45 min`
- Update "Last used" to today's date

If `/map-my-work` doesn't have a row yet, add one with the same fields.
