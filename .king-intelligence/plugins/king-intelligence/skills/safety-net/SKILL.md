---
name: safety-net
description: Prove the system won't break the owner's business and their data is safe — by showing a real undo (damage something, roll it back from a saved point) and by giving them a plain-English written answer to "where does my data live and is it private?". Use when the owner asks "is my data safe", "what about privacy", "is this secure", "what if it breaks", "can you undo that", "roll it back", "restore", "go back to before", "take a snapshot", or shows any worry about losing work or about who can see their information. It's a core part of the $297 Setup proof run. Lean toward firing whenever safety, privacy, breakage, or undo comes up, even if the owner never names this skill.
---

# /safety-net

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

The proof of two of the nine make-or-break wins: a non-technical owner **can't break it** (there's a real undo, so mistakes are recoverable), and their **data is safe** (it runs on their own accounts and isn't used to train the AI). Worry about both is the single biggest thing that stops a non-technical owner from trusting an AI with their business, so this answers it with a demonstration, not a reassurance.

Two halves: the **undo** (show it), and the **written privacy answer** (give it).

## Half 1 — the undo, demonstrated

The brain is a saved (git-tracked) folder, so every save is a real restore point and any change can be rolled back. The owner never types git; the engine [`scripts/safety-net.mjs`](scripts/safety-net.mjs) wraps it in three plain commands:

- **Prove it (the demo for the Setup):**
  `node "$CLAUDE_PLUGIN_ROOT/skills/safety-net/scripts/safety-net.mjs" prove`
  It saves a restore point, damages its own sentinel file on purpose, rolls it back, and verifies it came back byte-for-byte. It only ever touches its own `.safety-net/sentinel.md`, never the owner's real work, so it's safe to run live. Walk the owner through the three steps it prints: saved → broke it → got it back. That's the whole point made real.
- **Save a restore point on demand:** `... safety-net.mjs snapshot --label "before I reorganize clients"`.
- **Roll one file back:** `... safety-net.mjs restore <file> [--from <restore-point>]` — for a real "undo that, put it back how it was."

Frame it in their words: "your work is saved constantly; if anything in here ever gets messed up, I roll it back to the last good version. Watch."

## Half 2 — the written privacy answer

Produce a plain-English data-safety statement, written to `SAFETY-NET.md` at the brain root, tailored to what the owner has actually connected. Read [`CONNECTIONS.md`](CONNECTIONS.md) first and name their real tools. Cover, in their language:

1. **Where their work lives + who owns it** — their own folder + their own private backup; they own it and keep it if they leave.
2. **Their tools run on their accounts** — the system reaches their connected tools through their own logins and acts as them; what it learns is written into their own brain folder (which is itself a copy they own), never into any King Intelligence product, and never sold or shared. Don't claim "your data never leaves your accounts," the brain and the AI's servers are copies, so make the true, narrower claim instead.
3. **The AI doesn't learn from their business** — under the provider's commercial terms, business data isn't used to train the model.
4. **Nothing is ever really lost** — the restore-point undo from Half 1.
5. **A compliant lane for regulated data** — if they handle health/legal/regulated info, a separate compliant setup with a signed agreement (e.g. HIPAA BAA).
6. **They can stop any time** and keep everything.

**Honesty is mandatory here, this is a data-privacy claim.** State only what's true by how the system is built (their repo is theirs, it runs on their accounts, restore points are real). For the model-training point, state the accurate principle but **point them to their provider's official data-usage page to read the current policy first-hand, don't paraphrase a guarantee or invent a link.** If something can't be confirmed (a specific certification, a specific policy line), say "confirm this with your provider," never assert it. An honest "here's where to verify" beats a confident claim that turns out wrong.

## Notes

- `safety-net.mjs` has no dependencies and uses only git, which the brain already relies on for backup.
- If the folder isn't git-tracked yet, the undo can't work, that's the always-on backup not being switched on. Fix that first (it's the backup health check), then the safety net is live.
- Exempt from self-ping (it's a proof + a one-time written answer, not a recurring per-use time-saver).
