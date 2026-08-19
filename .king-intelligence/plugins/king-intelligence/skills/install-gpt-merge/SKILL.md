---
name: install-gpt-merge
description: Move the user's entire ChatGPT or Claude history into their second brain, properly organized. Takes the data-export zip from either app (Settings → export data), converts every conversation into a readable file, sorts them into the user's real client and project folders with their approval on every bucket, keeps the junk in a tidy archive, and leaves behind a map plus a memory note so every future session knows the history exists and where to find it. Use when the user says "I exported my ChatGPT", "import my chat history", "here's my Claude export", "move my old chats in", "organize my ChatGPT conversations", "I'm switching from ChatGPT", "merge my old AI chats", or types /install-gpt-merge. Handles exports from BOTH ChatGPT and Claude. Not for a single pasted conversation (just save that where it belongs) and not for mapping the computer's folders (that is /map-my-work).
disable-model-invocation: false
---

# /install-gpt-merge: bring your ChatGPT or Claude history home

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

Years of business thinking are sitting in the user's old ChatGPT or Claude account. This skill moves
all of it into the second brain so it actually gets used: every conversation becomes a readable
file, the valuable ones land in the right client and project folders, and a map ties it together so
future sessions know this history exists.

**The split:** a script does the deterministic work (open the zip, convert every conversation,
track what went where); you do the judgment (propose the sort, ask the user, write the summaries).
The engine is `${CLAUDE_PLUGIN_ROOT}/scripts/import-chat-export.mjs` — check the user's
`references/king-intelligence-config.md` for an `## install-gpt-merge` section first; if it names a
`scriptPath`, use that instead. Run every command from the second-brain root (or pass `--repo`).

## Hard rules

- **Never delete or move the zip.** It is the permanent raw copy. Say so once at the end.
- **Never guess a destination.** A conversation you are unsure about gets asked about, or stays in
  the archive. A wrong guess repeated hundreds of times is a disaster.
- **Every real decision goes through AskUserQuestion**, one decision per question, your
  recommendation first marked "(Recommended)". Use as many rounds as the sort needs — quality
  beats speed here.
- **Plain English throughout.** No file-format talk, no JSON, no "parsing". The user is a
  non-technical business owner moving their stuff into a new home.
- Re-running is always safe: nothing gets imported twice (the engine keeps a ledger).

## Steps

### 1. Find the zip

It is usually in Downloads, named like `<random letters>.zip` (ChatGPT) or `data-<date>.zip`
(Claude). Check Downloads for a recent zip; if you can't find it, ask where they saved it. If they
haven't exported yet: ChatGPT → Settings → Data controls → Export data; Claude → Settings →
Privacy → Export data. The download link the email carries expires within about a day, so they
should grab it promptly — but the zip itself, once downloaded, keeps forever.

**Claude's newer export is a MANIFEST, not a zip** (proven live 8/19/26): Downloads gets a
`manifest-<ids>.json` pointing at ~5 separate zips (conversations, projects, memories,
design_chats, light_metadata), and **each link works exactly once, only from the user's logged-in
browser**. Running `inspect` on the manifest prints the file list and this warning. To fetch them,
use the user's logged-in Playwright browser, and use the ONE method that works: open each
`export_url` in its OWN new browser tab (`page.goto`) with a `waitForEvent("download")` listener,
then `download.saveAs()` into Downloads. Do NOT curl the links (blocked), do NOT anchor-click them
in an existing claude.ai tab, and do NOT fetch them from page context (both return the app's web
page and can waste the single use). Then continue with `conversations-000.zip` as the zip.

### 2. Look inside (changes nothing)

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/import-chat-export.mjs" inspect <zip>
```

Report in plain English: which app it came from, how many conversations, the date range, any
projects, rough size. If the engine says the zip is damaged or unrecognized, relay its message
plainly and stop — tell them to re-download the export. Do not improvise a parser.

### 3. Convert everything

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/import-chat-export.mjs" convert <zip> --repo <second-brain-root>
```

Everything lands as readable files in `_archive/chat-imports/` (a quiet corner that stays out of
the main folder map). Report the counts. If anything failed, name it — never paper over a failure.
The engine also writes two files you will use next: `inventory.md` (one line per conversation) and
`manifest.json`, both inside the staging folder it prints.

### 4. One honest heads-up about sensitive information

Skim titles from `inventory.md`, and sample a dozen conversations spread across the date range
using **peek, never by opening the files** — one conversation can hold a 30,000-character
transcript that floods the session:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/import-chat-export.mjs" peek <id8,id8,...>
```

That returns each conversation's title, date, and the first line the user typed, capped short.
Use the same command later whenever a title is too cryptic to route. If real people's information is in there — client names, health details,
financial or ID numbers — tell the user once, plainly: roughly how much and a couple of examples of
the *kind* of thing you saw. Then continue. One clear statement, no lecture, and do not keep
re-raising it.

### 5. Learn where their work lives

Read, in this order: `references/where-my-work-lives.md`, `references/folder-layout.md`, and the
`**Purpose:**` line of each folder's CLAUDE.md. If none of these exist, offer to run
`/map-my-work` first (recommended), or build the buckets from the folder names you can see.

### 6. Propose the sort — then ask until it's right

Work from `inventory.md`, not by opening thousands of files. Group the conversations into buckets
that match their real folders: per client, per project, per topic — plus one "leave in the archive"
bucket for small talk, one-off questions, and dead ends.

Present the plan: each bucket with its destination folder, a count, and 2-3 example titles. Then
resolve every open point through AskUserQuestion rounds — one decision per question:

- Is there a date before which nothing matters? (Recommend keeping everything; old ≠ useless.)
- Each bucket's destination, wherever it isn't obvious from their folder map.
- The explicit "I'm not sure about these" list — show it, ask, never guess.
- **Deeply personal conversations get their own question.** Faith, health scares, relationships,
  private struggles: if the user keeps a separate personal vault, offer to move those OUT of this
  repo entirely with the engine's `remove` command (below) — they leave the ledger and the map, so
  a business repo never indexes them. If there's no separate vault, the archive is fine; just say
  what you saw in one plain sentence.
- Anything else the inventory raises (a person who appears constantly, a topic with no home).

Keep asking until you could not build it wrong. If a bucket needs a folder that doesn't exist,
create it during the move with a one-line-Purpose CLAUDE.md, following their folder conventions.

### 7. Execute in batches

Write the approved plan as a JSON array of `{id, destination, summary}` (id from the ledger /
manifest; destination is a repo-relative folder; `"archive"` keeps it put). **Write a one-line
summary for every conversation you route — and for archive-bound ones too when the title is
cryptic** — that summary is what makes the map useful later. Then:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/import-chat-export.mjs" assign <plan.json> --repo <root>
```

Do it in batches of roughly 25-50 conversations and check in between batches with a one-line
progress note. After all moves, add one line to each destination folder's CLAUDE.md:
"N conversations imported from ChatGPT/Claude on <date> — see references/imported-chats-map.md".

**Moving private conversations OUT of the repo** (when approved in step 6):

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/import-chat-export.mjs" remove <id8,id8,...> --to <absolute folder outside the repo>
```

That moves the files and delists them from the ledger and map. Never hand-move these or hand-edit
the ledger.

**Projects:** a Claude export's projects arrive in the staging folder under `projects/<name>/`
(instructions + documents). In the newer multi-zip export they come as a separate
`projects-*.zip` — run `convert` on that zip too (the engine accepts a projects-only zip). Offer
each project as its own bucket; its files move with a plain move to the destination the user picks.

**The other zips in a newer Claude export** — handle deliberately, never silently skip:
- `memories-*.zip`: the app's saved memories about the user. Offer to read them and fold the still-true
  facts into the second brain's memory system (their format varies — look before promising).
- `design_chats-*.zip`: design-tool conversations. Offer to convert (if it parses as conversations)
  or park the zip's contents in the archive folder; usually not worth sorting.
- `light_metadata-*.zip`: bookkeeping only — tell the user it holds nothing worth importing, skip it.

### 8. Build the map and the memory

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/import-chat-export.mjs" map --repo <root>
```

That writes `references/imported-chats-map.md` — every conversation, where it lives now, one line
each. It can be regenerated any time, so it never goes stale.

Then write one memory so every future session knows: a file in the memory folder (type
`reference`), saying the user's ChatGPT/Claude history was imported on <date>, N conversations,
sorted into <folders>, full map at `references/imported-chats-map.md`, archive at
`_archive/chat-imports/`. Add its one-line entry to `MEMORY.md` per the memory system's format.

### 9. The receipt

Close with, in plain English:

1. What landed where (bucket → folder, with counts).
2. What stayed in the archive and why that's fine (nothing was deleted).
3. Anything that failed or couldn't be matched (attachments included), honestly.
4. Two or three real questions they can now ask their second brain that they couldn't before —
   and show the actual answers, pulled from the imported files, to prove it works.
5. "Your original zip is untouched at <path>, and re-running this is always safe."

## If something goes wrong

- **Interrupted mid-run?** Just run the same command again — the ledger resumes where it stopped.
- **`status` shows the current state** any time: `node .../import-chat-export.mjs status --repo <root>`.
- **Unknown export format?** Relay what the engine found and stop. Ask the user where the zip came
  from; only ChatGPT and Claude exports are supported.
