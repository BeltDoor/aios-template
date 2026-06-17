# The lane model — triage + dispatch

After the signal ledger exists (Phase 2 detection) and the files are written (Phase 3-4), every actionable signal gets sorted into one of three lanes and dispatched. This replaces the old hand-off to `/handle-it`. The brain lives here now.

## The razor (the one rule that drives everything)

**Is this needed for the follow-up email — or, when there's no email, for what the user owes this person right now?**

- **YES → build it INLINE.** Research, branded PDFs, a quoted fact, a price, an attachment. Inline is the default and heavy inline work is fine. "Needed" is **strict**: the email is wrong or incomplete without it. A mere *promise* of future work in the email ("I'll build your X next") is NOT needed — that's Lane 3.
- **NO → it's standalone work → Lane 3 loaded prompt.** Meeting prep for a different person, a new skill build, a separate project.
- **On the genuine fence → ask once** ("I can build X inline and attach it, or hand you a prompt — which?"). Only when truly ambiguous; don't gate routine debriefs.

Trivial mechanical updates are their own thing (Lane 1) regardless of the razor. Anything a person receives is staged (Lane 2) regardless of the razor.

---

## Lane 1 — Do now, then report

Mechanical, safe, reversible work. Just do it, no gate. Then list what you touched so the user can catch errors.

- Update the client's `CLAUDE.md`, the rollup file, auto-memory, knowledge graph.
- Log the meeting as a dated comment on the person's CRM card (see `references/trello-api.md` in your repo root references for the Trello-specific mechanics; or use the CRM tool from your settings).
- Person-to-person cross-references into other files (signal type 3).

**Cross-client safety:** writing into a DIFFERENT client's file based on this transcript (e.g. "Riley knows Sam" → Sam's file) is allowed only at **high diarization confidence**. If the source line is garbled, downgrade it to a flagged item in the report instead of writing it. Never propagate a possible mishearing into another client's record.

**Report, don't hide.** Lane 1 is silent while running but every Lane-1 write appears in the closing report under "Done." Trust comes from visibility, not from a gate.

---

## Lane 2 — Outward: reconcile, prepare, you trigger

Anything a person receives: the follow-up email, a calendar invite, a payment invoice, an intro email. **Never auto-fired. The user always pulls the trigger.**

**Reconcile against reality FIRST (mandatory).** Before creating anything outward, check whether the user already did it. They often have.
- **Calendar:** if an invite already exists for the agreed next session, the action is **perfect it, not duplicate it** — rename it, swap a video link, ensure a gap from neighbors. Prepare the corrected invite, show the exact change, and let the user trigger the guest update (perfecting a sent invite re-notifies the guest, so it's outward → their trigger).
- **Email:** check for an existing draft or live thread before composing a new one. Reply into the thread when one exists; don't start a parallel one. (Post-meeting follow-ups are new threads — no "re:" — but a genuine reply continues its thread. See [gmail-draft.md](gmail-draft.md).)
- **Invoice:** check the payments tool for an existing draft before creating one.

**The follow-up email is Lane 2 + inline.** Build everything the email *needs* (per the razor) inline and bake it in. **Always do BOTH — show it inline in chat AND create the draft, every time.** Never send (the user sends). If money was agreed, include a real invoice/payment link in the body — create it live using the `paymentsTool` from your settings. Procedure + signature: [gmail-draft.md](gmail-draft.md).

**Batch, don't drip.** Present all outward items together in the closing report under "Ready to send (your trigger)" — the email draft, the perfected invite, the invoice draft. One list, the user acts. No per-item approval gate.

---

## Lane 3 — Loaded prompt for a fresh window

Standalone work the email doesn't need: prep for a different meeting, a new skill, a deck, a separate build. **Do not do the work in the debrief window** (it's already heavy with the transcript). Instead, do bounded research and hand back a paste-ready prompt.

**Loadedness (bounded, baked in):** do exactly the cheap lookups that make the prompt cold-startable — Gmail, Calendar, who-is-X, what people said (already in the transcript), file pointers. Embed them as facts. Do NOT do the heavy synthesis or build — that's the fresh window's job. Tell the prompt explicitly what's known vs what it still must do.

**Where it lands:** save each prompt as a file in the central queue `prompts/YYYY-MM-DD-<slug>.md` AND echo it in chat. In a fresh window the user either pastes it or says "run prompts/...". Remind them to delete after use. (No per-client folder — a cross-subject prompt belongs in the central queue where all pending work is visible at a glance.)

**No cap, but rank + flag.** List Lane-3 prompts ranked by urgency/value. Flag time-sensitive ones with the date ("Riley — Thursday 6/4, prep before then"). If a session spawns five, list five.

**Escape hatch:** if the user says "just do X now," build it inline instead of handing the prompt. The prompt is the default for standalone work, not a wall.

### Loaded-prompt template

```markdown
# <Task in one line> — for a fresh window

<2-3 sentences: what to produce and why it matters, with the deadline if any.>

## What I already know (researched for you)
- <fact from Gmail / Calendar / transcript / web — the bounded research, baked in>
- <who the person is, the relationship, what was said about them>
- <relevant file pointers: clients/<name>/..., the summary, related deliverables>

## What you still need to do
- <the heavy synthesis / build / creative work — the part deliberately NOT done here>
- <any research that's genuinely open-ended, told to run itself>

## What good looks like
- <success criteria, constraints, voice/brand rules, known preferences>
```

---

## Closing report (the end of every debrief)

One clean block, three sections. No mandatory gate — Lane 1 is already done, Lane 2 is staged for the user's trigger, Lane 3 is queued.

```
Debrief complete — <client>, <date>.

Done (already updated):
  - <Lane-1 item>
  - <Lane-1 item>

Ready to send (your trigger):
  - Email draft to <recipient> — <subject>  (Gmail draft <id>)
  - Calendar: perfected invite "<name>" Mon 6/8 3pm — swapped Meet→Zoom (your send)
  - Invoice: draft $300 to <recipient>  (your send)

Prompts queued (run in a fresh window):
  - prompts/2026-06-04-riley-acme-thursday.md  [URGENT — Thursday]
  - prompts/2026-06-02-acme-spec-skill.md

Flagged (low confidence / your call):
  - <anything downgraded from a cross-client write, etc.>
```

Use plain words. No emojis. If a lane is empty, omit its section.

**After the report:** the debrief makes one optional LinkedIn-post offer (Phase 6 in SKILL.md, procedure in [content-post.md](content-post.md)). It renders below this report, not inside it — the report's three-lane contract stays intact.

---

## Standalone (non-meeting) use

When invoked on a pasted email thread or "handle this" with no meeting transcript, skip Phases 0-4 and run only detection ([detection-signals.md](detection-signals.md)) + this lane model on the pasted context. This is what the thin `/handle-it` now points at.

## Execution toolbox

When dispatching, pick the right capability — Skill, MCP, CLI, script, Agent. The full map and illustrative pairings live in [awareness-surfaces.md](awareness-surfaces.md) and [executor-examples.md](executor-examples.md). Open lists, not catalogs. Perplexity: `_search` only (`_reason`/`_research` are hook-blocked).
