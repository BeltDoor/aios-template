# Fan-out — per-mode source list

What `/begin-session` reads, per mode. All sources dispatched as parallel subagents in ONE message. 60-second budget per source.

## Client mode (`snowball/clients/<x>/`)

- **Folder:** read `snowball/clients/<x>/CLAUDE.md` verbatim.
- **Recent files:** top 3 by modification time in the folder.
- **Auto-memory:** grep for the topic name (first + last name tokens if person-shaped, full phrase otherwise).
- **Gmail** (if wired): threads from last 90 days where the contact's email or name appears in subject/from/to. Return top 5–10 sorted by recency: subject, last date, last sender, 1-line snippet.
- **Calendar** (if wired): events from last 60 days through next 30 days where the contact appears or the title contains the name. Return event title + date + duration.
- **HubSpot** (if wired): contact ID, associated deals (dealstage, dealname, amount, close date), most recent 5 engagements (type, date, summary).
- **Otter** (if wired): staged transcripts where attendee or title matches the topic. Capture title + date + Otter URL.

## Project mode (`snowball/projects/<x>/`)

- **Folder:** read `snowball/projects/<x>/CLAUDE.md` verbatim.
- **Recent files:** top 3 by modification time in the folder.
- **Auto-memory:** grep for the project name.
- **Git history:** `git log -10 --pretty=format:'%h %ad %s' --date=short -- snowball/projects/<x>/` (last 10 commits scoped to folder).
- **Otter** (if wired): staged transcripts where title or attendees match the project name.
- **Notion** (if wired): page search for the project name.
- **Drive** (if wired): file search for the project name.

## Hybrid mode (resolves to BOTH client AND project folder)

Union of client-mode + project-mode sources, PLUS one extra step:

- **Intersection scan:** grep both folders' `CLAUDE.md` for cross-references to the other party's name. Surface 3–5 most relevant cross-mentions with context in the briefing's intro paragraph.

## Connector-availability discipline

Before querying any connector, read [`CONNECTIONS.md`](../../../../CONNECTIONS.md) § 1 Connected. Not in the table → skip silently. At the end of the briefing, IF an obviously-useful unwired connector exists for this mode (client mode + HubSpot not wired, etc.), append ONE single-line upgrade hint. Once per briefing maximum, not per missing connector.

## Subagent timeout behavior

If any source hasn't returned in 60s, proceed with partial data. Note the gap in the briefing where the missing section would live: *"Calendar pull timed out — briefing proceeds without upcoming-events section."* Don't fail the whole briefing on one slow source.
