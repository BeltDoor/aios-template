# Time-Back review — the full spec (Phase 3.55 of /end-session)

Disclosed reference for the Phase 3.55 Time-Back review in [`../SKILL.md`](../SKILL.md). The gate (timeSavedSyncScript configured AND on disk), the don't-double-count rule, and the never-ask-about-a-dollar-rate rule live inline in SKILL.md; this file holds the honesty spec and the run steps.

**The number is honest or it is nothing.** A non-technical owner (and a skeptical prospect later) only trusts this if it's a floor they could defend. So the estimate follows these rules, hard:

1. **Competent-peer baseline, not worst-case.** Estimate how long the task takes a competent person doing it by hand — unhurried but not fumbling. Never the slowest-possible human, never "if you'd had to learn it first."
2. **The ×0.2 calibration — permanent, never skip it.** Sum the competent-peer lines, **multiply the total by 0.2 (divide by 5)**, THEN round down to the nearest 15 minutes. Uncalibrated estimates reliably run 4–5x what the user would actually credit; this multiplier is the permanent fix, not a per-session judgment call. The logged number is always the already-calibrated one.
3. **Credit the human time displaced, never the AI's wall-clock.** If it took Claude 5 minutes to do something that would have taken the human an hour by hand, credit ≤1 hour (before calibration) — never the 5 minutes, never an inflated "it would've taken you all day."
4. **Silent — never ask.** No confirm question, no AskUserQuestion, no pop-up, ever. Build the breakdown internally, calibrate, log it, and carry ONE receipt line into Phase 8 Receipt 1 (e.g. "Time back: logged 45 min saved — running total 50h"). If the owner objects to a logged figure afterward, re-run `record` with the SAME session-id and the corrected minutes (idempotent replace — that's the veto path).
5. **"I don't know" → credit 0.** A low floor beats an invented ceiling.
6. **Per-session soft cap ~8 hours of ad-hoc (post-calibration).** If your figure exceeds it, re-check each line before logging (a runaway session must not poison the lifetime number).

Steps:

1. **Build the figure silently.** From `per_folder_summary` + the conversation (the same material Phase 8 Receipt 1 uses), list the ad-hoc items internally and credit each per the rules above, then apply the ×0.2 calibration and round down to 15 min. If there's no ad-hoc work, the figure is 0 — that's honest, log it as such. Do NOT show a breakdown or ask anything.
2. **Record it deterministically.** Run the **timeSavedSyncScript from your settings** with the calibrated figure. Pass the Phase-1 HEAD hash (short) as the stable session id so a re-run can't double-count, today's date, and the `candidate_wins` you held from Phase 1 as JSON:

   ```bash
   node <timeSavedSyncScript> record \
     --adhoc-min <calibrated minutes> \
     --summary "<one-line what this session did>" \
     --session-id <short HEAD hash from Phase 1> \
     --date <today MM/DD/YY from Phase 1> \
     --wins-json '<JSON array of {"text":...,"minutes":...} from candidate_wins, or []>' \
     --send
   ```

   The script folds it into the **timeSavedState** ledger (recomputing the skills spine from `TIME-SAVED.md`, the ad-hoc total, sessions/weeks/streak, tools, milestones — all deterministically), then `--send` POSTs the full cumulative snapshot up to the members portal using the per-member token already on this machine. **It always exits 0:** offline, or a setup with no portal token (or a legacy key), just keeps the number local and queues the send for next time — it never blocks the close. Read the JSON it prints (`totalHours`, `adhocHours`, `dollarValue`, `send.sent`).

Carry `totalHours`, `adhocHours`, and whether the send landed into the Phase 8 Receipt 1 line — that single receipt line is the only place this phase ever surfaces to the owner.
