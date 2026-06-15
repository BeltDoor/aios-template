# Detection Heuristics

Patterns to look for when reading a context to surface actions. **NOT exhaustive.** The detector is reasoning — use these as priming, not as a checklist.

The job: read the context like a sharp assistant. Surface every discrete action the user would normally do as a result of this conversation. Don't pad. Don't force-fit. If the call generated 2 real actions, surface 2.

---

## Verbal-commitment signals (the "I'll" patterns)

These are the strongest. When the user (or the other party) commits to a deliverable, that's an action.

| Pattern in transcript | Likely action |
|---|---|
| *"I'll send you the proposal Friday"* | Send the PDF from the contact's deliverables folder (or generate it if not there) |
| *"I'll email you the agenda"* | Draft + send agenda email |
| *"Let me put together a one-pager and send it over"* | Generate the PDF + email |
| *"I'll get you that quote by Monday"* | Create a draft invoice / proposal doc + schedule a Monday reminder |
| *"I'll introduce you to X"* | Draft intro email (don't send — the user reviews) |
| *"I'll look into Y before our next session"* | Kick off background research |
| *"I'll send a calendar invite"* | Create + send calendar invite |
| *"I'll loop in [name]"* | Draft a "looping in [name]" email |
| *"Let me write that up and share it"* | Draft write-up + email draft to recipient |

---

## Scheduling signals

| Pattern | Likely action |
|---|---|
| *"Let's meet Thursday at 12:30"* | Create calendar invite (use the next Thursday in the future; default the user's local TZ) |
| *"Same time next week"* | Create calendar invite one week from the meeting date, same time |
| *"How about Tuesday morning"* | Either send a tentative invite or draft an email asking for confirmation (judgment call — when the call ended without nailing time, draft the ask) |

---

## CRM signals

| Pattern + context | Likely action |
|---|---|
| *"Send me the proposal"* / *"We're in"* / *"Let's move forward"* + an existing deal | Move deal stage (re-query the live pipeline first; never trust a stale stage) |
| Discovery call ending with mutual fit + no existing deal | Create a new contact + company + deal in the configured CRM (dedup first) |
| Mentioned a NEW stakeholder by name (CTO, partner, A/P contact) | Either add the contact in the CRM OR surface it for the user to confirm relationship (judgment call) |
| Stale info called out on the call ("we moved offices") | Update the company / contact record |

When no CRM is configured, surface these as flagged items for the user to handle, don't fabricate records.

---

## Payment signals

| Pattern | Likely action |
|---|---|
| Agreed price + payment terms (deposit, milestones, monthly) | Create a draft invoice in the configured payments tool |
| *"Send me the invoice"* | Create the invoice (verify the billing email is the A/P person, NOT just the primary contact) |
| *"What was your fee again?"* | No action — just informational |

When no payments tool is configured, flag that money is owed and the user must send the request manually. Never invent a link.

---

## Email-already-drafted signal — NOT an action

If the follow-up email draft was already created in Phase 3C, that draft is **input context**, NOT an action.

- **Never** include "send the drafted follow-up email" in the action list.
- Never wire an email-send command into the triage.
- Mention the parked draft as a one-line FYI in the closing report so the user remembers it's there.

The user sends drafts manually, always. This rule overrides any other "verbal commitment, action" pattern when the deliverable is an email draft.

---

## Research / verification signals

| Pattern | Likely action |
|---|---|
| *"I'll check on X and get back to you"* | Background research via an Agent |
| *"Send me some examples of similar [companies/clients/projects]"* | Background research + email synthesis |
| Open question that came up on the call ("what's their tech stack again?") | Quick `perplexity_search` + record in the contact's notes file |
| Contact mentioned a YouTube/video link | Summarize it (a video-understanding skill if available) and attach to the summary |

---

## Build-engagement blocker signals (highest priority, runs BEFORE other build actions)

If the meeting commits the user to building / installing / setting up anything on the contact's hardware (an AI operating system, Claude Code, MCP servers, CLIs, VS Code, n8n on their machine, a cold-email pipeline on their account), the FIRST detected action should be infrastructure-blocker research. This MUST execute before any "Session 1 prep" action, before any invoice, before any committed-deliverable action.

| Pattern + context | Likely action (runs FIRST) |
|---|---|
| Build-engagement signal + no prior blocker research | Research the contact's hardware/OS compatibility with the intended stack; output to the contact's research folder (`research/infrastructure-blockers.md`) |
| Build-engagement signal + the notes flag a Chromebook / locked corporate laptop / iPad / Linux dev mode | Research the specific blocker + a substitute stack; output to the research folder; surface as "blockers known, here's the substitute plan" |
| Email already drafted committing to a "Session 1 win on your machine" without verified hardware | Flag it: *"Heads up, the parked draft commits to deliverables, but we never verified the hardware. The Chromebook risk: ... Edit the draft if needed before sending."* |
| Build-engagement signal + IT-locked corporate environment | Surface as a `[manual]` action: "Confirm whether the contact has a personal-machine workaround before scheduling Session 1" |

**Why this is first:** if a build engagement is technically infeasible as scoped (e.g. the contact is on a Chromebook and the desktop AI app / local dev tooling won't run), and the follow-up email already commits to it, the blocker research has to be the FIRST action, not a peer of the others.

---

## Publishing / content signals

| Pattern | Likely action |
|---|---|
| *"I'll put a page up about that"* | Generate the page + commit |
| *"Let me post about this"* | Queue a social post (or hand to the user's content pipeline) |
| *"I'll write a blog post"* | Draft the post — surface for the user to review before publishing |

---

## Pending-commitment signals (deadlines)

If a commitment has a future deadline AND no other action is queued to satisfy it, schedule a self-reminder:

- *"Follow up Friday if I haven't heard back"*, a reminder for Friday
- *"Check in next month on whether the migration is done"*, a reminder 30 days out
- *"Remind me to ask about Y when we meet again"*, a reminder for the next meeting date

---

## What's NOT an action

Don't surface these:

- **Things already done on the call** ("We agreed X = 5") — already in the summary.
- **Things the OTHER party committed to** without a corresponding action for the user ("Client will get back to me with the spec next week" — no action for the user unless they need to follow up if it doesn't arrive).
- **Pure relationship moments** ("Loved that story about your kid's tournament") — those go in the contact's notes file, not the action list.
- **Stuff the housekeeping phases already handled** — transcript saved, summary written, memory updated, engagement logged.

---

## Edge cases

- **Multiple actions from one sentence:** *"I'll send the proposal and book the follow-up"* = 2 actions (send PDF + create calendar invite).
- **Conditional actions:** *"Send the contract only if Stacey approves"* — surface as `[conditional]`, don't execute even if approved. Leave it for the user to trigger.
- **Ambiguous timing:** *"Sometime next week"* — schedule a Monday reminder to nudge the user to actually book the thing.
- **The call ran long and the same action was mentioned twice:** dedupe. One action.
- **Action requires data not in the context:** surface as `[needs-info: what's missing]` so the user fills it in before approving.
