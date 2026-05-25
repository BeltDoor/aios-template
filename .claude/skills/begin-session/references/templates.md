# Briefing templates

Three templates — one per mode. Briefing is written directly to chat (no file created in v1.0).

**Apply to all modes:**
- **Anti-fabrication:** sections with no data get OMITTED entirely. No `[not found]`, no `TBD`, no padding.
- **CEO voice:** translate plumbing terms before they hit chat. "Recent commits" → "recent changes." "Engagements" → "activity." "Git log" → "history."
- **Length cap (soft):** client ≤25 lines, project ≤20 lines, hybrid ≤50 lines.

## Client mode

```markdown
# <Name> — briefing as of <EST date>

## Identity
<2–4 lines: title, company, location, role — from CLAUDE.md + HubSpot>

## Relationship state
<1–2 sentences: where things stand from CLAUDE.md + HubSpot deal stage>

## Last touchpoint
- **Email:** <subject + date + last sender>
- **Calendar:** <most recent event + date>
- **HubSpot:** <most recent activity type + date + summary>

## Open threads
<bullets — anything in flight per CLAUDE.md "Next Steps" + Gmail threads where last sender is the contact (i.e., awaiting your reply)>

## Watch items
<bullets — scheduled follow-ups, pending decisions, deadlines from CLAUDE.md>

## Upcoming
<bullets — calendar entries in the next 30 days>
```

## Project mode

```markdown
# <Project> — briefing as of <EST date>

## State
<1 line — pull from CLAUDE.md "Status:" or most recent activity>

## Last shipped
<most recent change + 1–2 line summary of what changed>

## In flight
<bullets — from CLAUDE.md Next Steps + uncommitted work signals from git status>

## Blockers
<from CLAUDE.md Blockers section + any "BLOCKED" / "PENDING" markers in recent commits>

## Memory rules in play
<bullets — auto-memory hits for this project>

## Next concrete step
<one line — derived from CLAUDE.md, recent activity, memory>
```

## Hybrid mode (resolves to BOTH client AND project folder)

```markdown
# <Topic> — briefing as of <EST date>

## How they intersect
<1 paragraph — e.g., "Atlas Brewery is the client driving the Q4 Pricing Project. Conference 6/19/26. Last touchpoint was the 5/9/26 walkthrough email + Loom recording. Waiting on their reply.">

<Person section — full client-mode template>

<Project section — full project-mode template>
```

## Date format

EST. Use `date '+%m/%d/%y - %H:%M %Z'` for accurate Eastern (bare `date` — never `TZ='America/New_York'`, which silently returns GMT on Windows MSYS2).
