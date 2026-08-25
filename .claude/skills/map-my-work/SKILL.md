---
name: map-my-work
description: Map where the user's real business work actually lives — Desktop, Documents, Google Drive, OneDrive, SharePoint, iCloud Drive, Dropbox — and write it to references/where-my-work-lives.md so every future session knows where to look instead of asking. Asks FIRST whether the work is even on this computer, because a company can run entirely on Google Drive with almost nothing on the laptop; if it does, connects Drive as a folder before sweeping. Then a fast top-level sweep and a deep dive only into the folders that hold business work. Reads folder and file NAMES only, never opens a document, never moves or copies anything. Use when the user says "map my computer", "where does my stuff live", "find my business files", "learn my folders", when the setup prompt from the Get Started page fires it, or when a session repeatedly can't find a file the user refers to. Requires explicit consent before the first scan.
---

# /map-my-work

I find out where your real work lives, once, so nobody has to explain it again. I write down where things are. **I never move, copy, rename, or delete a single file, and I never open a document to read what's inside it.**

## The consent gate (non-negotiable)

**Do not run a single scan command until the user has said yes, in this session, to a question that named what I read.**

If the setup prompt that invoked me says consent was already given, proceed straight to Pass 1.

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

## Pass 0 — is the work even on this computer? (do this before anything else)

**A whole company can run on Google Drive and have almost nothing on the laptop.** If you sweep the machine and report back on Desktop and Documents, you will have written a confident map of the 5% and missed the business. This pass is what stops that.

First, find out what is genuinely mounted here. Run all of these; the ones that don't exist stay silent:

```bash
ls -d "$HOME"/Library/CloudStorage/* 2>/dev/null                          # Mac: Google Drive, OneDrive, SharePoint, Box, Dropbox
ls -d "$HOME"/Library/Mobile\ Documents/com~apple~CloudDocs 2>/dev/null   # Mac: iCloud Drive
ls -d "$HOME"/OneDrive* "$HOME"/Dropbox "$HOME"/Box "$HOME"/iCloudDrive 2>/dev/null
ls -d "$HOME"/My\ Drive "$HOME"/Google\ Drive 2>/dev/null                 # Windows: Drive for Desktop, folder mode
for d in /c /d /e /f /g /h /i /j; do \
  ls -d "$d/My Drive" "$d/Shared drives" "$d/Google Drive" 2>/dev/null; done   # Windows: Drive for Desktop as a drive letter
```

**The Windows drive-letter loop is not optional.** Google Drive for Desktop mounts as a lettered drive (usually `G:`) rather than a folder in the home directory, so every check above it comes back empty on a Windows machine that has Drive installed and full of work. Leaving it out is how you tell someone they have no Google Drive while they are looking at it.

Then ask, once, with `AskUserQuestion`. Build the options out of what you actually found, so it reads as informed rather than a blank survey:

> **Question:** "Where does your company's real work actually live?"
>
> **Options (adapt to what you found):**
> - "On this computer" (Recommended when the sweep already found busy local folders)
> - "Mostly in Google Drive"
> - "Mostly somewhere else online" (Dropbox, SharePoint, Box, a system like QuickBooks or a job-management app)
> - "A real mix of both"

- **On this computer** → straight to Pass 1.
- **A real mix** → Pass 1, and treat whatever else they named the same way as below.
- **Google Drive, or another online home** → do **not** sweep and report yet. Go to the section below first.

### If their work lives in Google Drive

Say it plainly, no jargon: *"Then most of your business isn't on this laptop, it's online, and right now I can't see it. Two quick things fix that for good. Want me to walk you through them?"*

**First, make Drive a folder on the machine (about 3 minutes, and it's the one that matters).**

Google Drive for Desktop makes their Drive show up like any other folder, so the map, and every skill after it, can see it. It does **not** download their files or fill up their hard drive; it shows the names and fetches a file only when something opens it.

1. Send them to **google.com/drive/download** and have them install Drive for Desktop.
2. They sign in with the same Google account they already use for work.
3. When it finishes, re-run the detection block above. You should now see `My Drive` (Windows: usually under a lettered drive) or `Library/CloudStorage/GoogleDrive-…` (Mac).
4. Then run Pass 1 as normal. Drive is now just another folder, and a very important one, so it goes in the deep dive.

If it still doesn't appear, don't loop. Say: *"Drive hasn't finished connecting yet. Close VS Code completely and open it again, then say 'try again' and I'll pick it up."*

**Second, give me a live link into their Google account (optional, and only after the first one works).**

Drive-as-a-folder covers PDFs, Word files, spreadsheets, images: anything that is a real file. What it can't open is a native Google Doc, Sheet or Slide, which shows up as a tiny link file with nothing inside it. If a lot of their work is Google Docs, run **`/install-google`**, which sets up the live connection and hands back the ability to read and write those documents directly.

Offer it, don't force it. One line: *"If a lot of your work is Google Docs and Sheets rather than Word and Excel, there's one more setup that lets me open those properly. Worth doing now, or leave it for later?"*

### Whatever they say, record it

The answer to this question belongs in the map (see Pass 3's **Where the work really lives** line). A future session that knows "this company runs on Google Drive, and it's connected as a folder" never has to ask again, and never wastes a turn hunting the Desktop for something that was never there.

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

Then the cloud drives, which that command skips on purpose. You already ran these in Pass 0; reuse what they returned rather than running them twice.

Then one level inside each cloud root that exists:

```bash
find "<cloud root>" -maxdepth 2 -type d -not -path "*/.*" 2>/dev/null | head -150
```

Two naming signals worth knowing:

- A SharePoint document library synced through OneDrive shows up as `OneDrive - <Company Name>`. Treat every one of those as a strong business signal.
- Google Drive splits in two. `My Drive` is the person's own; `Shared drives` is the company's, and on a real business account that second one is usually where the money lives. Scan both, and never report on `My Drive` alone as though it were the whole picture.

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

## Where the work really lives

<One line, from what they told you in Pass 0, not from what the scan happened to
find. e.g. "This company runs on Google Drive. It's connected as a folder, so I can
see it, and the Shared drives are the important half." Or: "Everything is on this
laptop; there are no cloud drives connected." If a big part of their work is online
and NOT connected yet, say so here in plain words, because every later session will
otherwise assume the map is complete.>

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
6. **A Google Doc on disk is a link, not a document.** Inside a Google Drive folder, native Docs, Sheets and Slides appear as tiny `.gdoc` / `.gsheet` / `.gslides` files of a few hundred bytes. They are pointers, and there is nothing in them to read. Count them and name them in the map as what they are, never as empty or broken files, and never as evidence that a folder is thin. A folder of 400 `.gdoc` files is 400 real documents.

## Self-ping (do this at the end of every invocation)

Before you finish, increment my row in [`TIME-SAVED.md`](../../../TIME-SAVED.md):

- Skill: `/map-my-work`
- Manual time per use: 45 min (writing down, by hand, where everything lives across a laptop and its cloud drives)
- Increment "Total uses" by 1
- Recompute "Total saved (cumulative)" as `Total uses × 45 min`
- Update "Last used" to today's date

If `/map-my-work` doesn't have a row yet, add one with the same fields.
