---
name: ask-your-business-anything
description: Answer any question about the owner's business by reading across all their connected tools at once and returning one plain answer — and, on demand, reconcile their money (read a bank statement, Stripe payouts, invoices, POs, or expenses and match them, flagging anything that doesn't line up). Use when the owner asks a real question that lives in more than one place ("what do I need to know before my meeting with X", "where do things stand with Y", "who owes me", "pull everything we have on Z", "what did we agree to"), OR when they want their books checked ("reconcile this", "match my statement to my invoices", "did everyone actually pay", "close out the month", "money in versus what I billed"). Lean toward firing whenever the owner asks something whose answer is scattered across email, calendar, files, CRM, or payments — even if they never name this skill.
---

# /ask-your-business-anything

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

The proof that the brain is **one connected system**, not a pile of separate apps: the owner asks in plain English and it reads everywhere it needs to, then answers once. The Reconcile half extends that to the books, the part most owners dread.

**What it proves:** one connected system you query by asking (#2), and accounting/reconciliation that actually reads statements and ties them out (#4). Two of the nine make-or-break wins. Reconcile is one of the two capabilities that only gets promised publicly once it has really run, so running it for real matters.

Route by the request: a question → **Ask mode**; anything about matching money/statements/invoices → **Reconcile mode**.

## Ask mode — one question, read across everything

1. **Read what's connected.** Check [`CONNECTIONS.md`](CONNECTIONS.md) so you only reach for tools that are actually wired up (Gmail, Calendar, Drive, a CRM, payments, plus the owner's own files under `clients/`, `projects/`, `finances/`). Don't propose a source that isn't connected.
2. **Pull from every source that could hold the answer**, in parallel. A question like "what do I need before my meeting with X" usually lives in 3-4 places at once: the calendar (when/where), the inbox (what they last said), the customer's file (history), and payments (do they pay on time).
3. **Synthesize ONE answer** in the owner's language: the situation, then the one thing to do about it. Short. No tool jargon.
4. **Cite each source you used** inline ("from Calendar", "from Gmail", "from your X file"). The citation list IS the proof it read across the whole system, so always show it. For anything weighty, save the answer as a short briefing in the relevant folder and hand over the path.

**Honesty is the whole game.** Only state what a source actually says. If a connected tool is empty, unreachable, or silent on the question, say that plainly ("nothing in your inbox on this") rather than filling the gap. Never invent a fact, a date, or a number to make the answer look complete. A flagged blank is trustworthy; a confident guess burns the owner.

## Reconcile mode — match the money, flag what doesn't tie

The matching is done by a script so a match is only ever claimed when the numbers truly line up. **Your job is the extraction; the script's job is the matching.** Never eyeball-match money in your head.

1. **Get both sides.** "Money in" = what was actually received (bank deposits, Stripe payouts). "Expected" = what should have come in (invoices marked paid, POs due). Pull from the connected tool or the file the owner points at.
2. **Normalize each side to JSON** and write them to a working file:
   - money-in: `[{ "date":"MM/DD/YY", "amount":1250.00, "label":"STRIPE TRANSFER ..." }]`
   - expected: `[{ "id":"INV-1042", "who":"Acme Co", "amount":1250.00, "date":"MM/DD/YY" }]`
3. **Run the matcher:**
   `node "$CLAUDE_PLUGIN_ROOT/skills/ask-your-business-anything/scripts/reconcile.mjs" <money-in.json> <expected.json> --out finances/reconciliation-<period>.md`
   It writes a `reconciliation-<period>.md` report and prints a JSON summary with the `headline`.
4. **Walk the owner through the report**, leading with the headline. The point is not the clean matches, it's the two flag lists: money marked paid that never showed up in the bank, and money that landed with no invoice behind it. Tell them the bottom-line gap is those flagged items, never one mystery number. Clearing the flags is their next action.

**Honesty here too:** the script flags anything it can't line up exactly, on purpose. Do not "resolve" a flag by assuming it's fine. A flag is a question for the owner, not a problem to hide.

## Notes

- `reconcile.mjs` has no dependencies; it matches on exact amount within a date window (default ±7 days, tune with `--window`).
- Ask mode has no script, it's you reading the connected tools, but the discipline (cite sources, never fabricate) is what makes it proof rather than a parlor trick.
- This skill is exempt from self-ping (it answers and reconciles for the owner to read; it isn't a send-as-them or fixed-cadence task with a single manual-time baseline).
