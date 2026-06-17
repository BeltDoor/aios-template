# Detection Heuristics

Patterns to look for when reading a context to surface actions. **NOT exhaustive.** The detector is reasoning — use these as priming, not as a checklist.

The job: read the context like a sharp assistant. Surface every discrete action the user would normally do as a result of this conversation. Don't pad. Don't force-fit. If the call generated 2 real actions, surface 2.

---

## Verbal-commitment signals (the "I'll" patterns)

These are the strongest. When the user (or the other party) commits to a deliverable, that's an action.

| Pattern in transcript | Likely action |
|---|---|
| *"I'll send you the proposal Friday"* | Send the PDF from `clients/<name>/03-deliverables/` (or generate it if not there) |
| *"I'll email you the agenda"* | Draft + send agenda email |
| *"Let me put together a one-pager and send it over"* | Generate PDF + email |
| *"I'll get you that quote by Monday"* | Create draft invoice / proposal doc + schedule a Monday wakeup |
| *"I'll introduce you to X"* | Draft intro email (don't send — user reviews) |
| *"I'll look into Y before our next session"* | Kick off `Agent` background research |
| *"I'll send a calendar invite"* | Create + send calendar invite |
| *"I'll loop in [name]"* | Draft a "looping in [name]" email |
| *"Let me write that up and share it"* | Draft write-up + Gmail draft to recipient |

---

## Scheduling signals

| Pattern | Likely action |
|---|---|
| *"Let's meet Thursday at 12:30"* | Create calendar invite (use the next Thursday in the future; default local TZ) |
| *"Same time next week"* | Create calendar invite one week from the meeting date, same time |
| *"How about Tuesday morning"* | Either send a tentative invite or draft a Gmail asking for confirmation (judgment call — when the call ended without nailing time, draft the ask) |

---

## CRM signals

| Pattern + context | Likely action |
|---|---|
| *"We're in"* / *"Let's move forward"* / verbal yes | Move the CRM card to the Clients list (verbal yes = client) |
| Discovery call ending with mutual fit + no existing card | Create the CRM card in the active-prospect list (Phase 4E mechanics) |
| *"Not right now"* / timing pushback but real need acknowledged | Move/create the card in the future-prospect list |
| Mentioned a NEW stakeholder by name (CTO, partner, A/P contact, etc.) | Either add a card / note it on the company's card OR surface it for the user to confirm relationship (judgment call) |
| Stale info called out on the call (e.g., "we moved offices") | Update the card's description |

---

## Payment signals

| Pattern | Likely action |
|---|---|
| Agreed price + payment terms (deposit, milestones, monthly) | Create draft invoice via `paymentsTool` from your settings |
| *"Send me the invoice"* | Create AND surface the invoice (verify the A/P email, not just the primary contact) |
| *"What was your fee again?"* | No action — just informational |

---

## Email-already-drafted signal — NOT an action

If a `gmail_draft_id` was passed from `/debrief`, the draft is **input context**, NOT an action.

- **Never** include "send the drafted follow-up email" in the gate.
- Never wire `gws gmail users drafts send` into a `/handle-it` action.
- Mention the parked draft as a one-line FYI in the Phase E status report so the user remembers it's there (e.g. *"Gmail draft `r123...` parked in your drafts for your review"*).

The user sends drafts manually, always.

---

## Research / verification signals

| Pattern | Likely action |
|---|---|
| *"I'll check on X and get back to you"* | Background research via `Agent` |
| *"Send me some examples of similar [companies/clients/projects]"* | Background research + email synthesis |
| Open question that came up on the call ("what's their tech stack again?") | Quick Perplexity search + record in client CLAUDE.md |
| Client mentioned a YouTube link or video | `Skill: playwatch` to summarize, attach to summary |

---

## Build-engagement blocker signals (highest priority — runs BEFORE other build actions)

If the meeting commits the user to building / installing / setting up anything on the client's hardware (AIOS, Build OS, Claude Code, MCP servers, CLIs, VS Code, n8n on their machine, cold-email pipeline on their account, etc.), the FIRST detected action should be infrastructure-blocker research. This MUST execute before any "Session 1 prep" action, before any invoice, before any committed-deliverable action.

| Pattern + context | Likely action (runs FIRST) |
|---|---|
| Build-engagement signal + `pre_session_blockers` field is null or empty | `Agent` to research client's hardware/OS compatibility with the intended stack; output to `clients/<name>/01-research/infrastructure-blockers.md` |
| Build-engagement signal + client CLAUDE.md flags Chromebook / locked corporate laptop / iPad / Linux dev mode | `Agent` to research the specific blocker + substitute stack; output to research folder; surface in gate as "blockers known, here's the substitute plan" |
| Email already parked committing to "Session 1 win on your machine" without verified hardware | Flag in Phase E status: *"Heads up — the parked draft commits to deliverables, but we never verified [client]'s hardware. Edit the draft if needed before sending."* |
| Build-engagement signal + IT-locked corporate environment | Surface as `[manual]` action: "Confirm whether [client] has personal-machine workaround before scheduling Session 1" |

**Why this matters:** if the build was scoped to a client on a ChromeOS device, Claude Desktop / Claude Code / VS Code are all unavailable. The blocker research has to be the FIRST action, not a peer of the others.

---

## Publishing / content signals

| Pattern | Likely action |
|---|---|
| *"I'll put a page up about that"* | Generate `docs/<slug>/index.html` + commit |
| *"Let me post about this"* | Queue social post or send to content-app pipeline |
| *"I'll write a blog post"* | Draft markdown blog post — surface for user to review before publishing |

---

## Pending-commitment signals (deadlines)

If a commitment has a future deadline AND no other action is queued to satisfy it, schedule a self-reminder:

- *"Follow up Friday if I haven't heard back"* → `ScheduleWakeup` for Friday
- *"Check in next month on whether the migration is done"* → `ScheduleWakeup` 30 days out
- *"Remind me to ask about Y when we meet again"* → `ScheduleWakeup` for next meeting date

---

## What's NOT an action

Don't surface these:

- **Things already done on the call** ("We agreed X = 5") — already in the summary.
- **Things the OTHER party committed to** without a corresponding action for the user ("Client will get back to me with the spec next week" — no action unless a follow-up is needed if they don't).
- **Pure relationship moments** ("Loved that story about their kid's tournament") — those go in the client CLAUDE.md, not the action gate.
- **Stuff the housekeeping phases of `/debrief` already handled** — transcript saved, summary written, memory updated, engagement logged. These are already done by the time `/handle-it` runs.

---

## Edge cases

- **Multiple actions from one sentence:** *"I'll send the proposal and book the follow-up"* = 2 actions (send PDF + create calendar invite).
- **Conditional actions:** *"Send the contract only if Stacey approves"* — surface as `[conditional]` in the gate, don't execute even if approved. Better to leave for the user to trigger.
- **Ambiguous timing:** *"Sometime next week"* — schedule a Monday wakeup to nudge the user to actually book the thing.
- **The call ran long and the same action was mentioned twice:** dedupe. One action.
- **Action requires data not in the context:** surface in gate as `[needs-info: what's missing]` so the user fills it in before approving.
