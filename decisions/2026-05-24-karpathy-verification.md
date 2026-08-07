---
date: 2026-05-24
item: P3 — Karpathy adapter verification
depends_on: F6
verdict: verified, no changes
---

# Karpathy adapter verification — `CLAUDE.md` § 3

**Goal of this pass:** confirm the four behavioral sub-sections inside `CLAUDE.md § 3 "How to work with me — behavioral rules"` are faithful, complete, CEO-translated adaptations of the four sections in REBUILD-PROMPT.md Appendix A (verbatim Karpathy source).

**Method:** read both files in this session; walked section-by-section through Karpathy's four sub-sections + the translation table; flagged any phrasing not yet translated, any bullet missing, and any unjustified structural deviation.

**Result:** verified. No edits to `CLAUDE.md`.

---

## Translation table — applied / not applied

| Karpathy phrasing | AIOS translation | Status in `CLAUDE.md` |
|---|---|---|
| "Think Before Coding" | "Think Before Acting" | ✅ applied (§ 3 first sub-heading) |
| "Don't write 200 lines if 50 will do" | "Don't take 10 actions if 2 will do" | ✅ applied (§ 3 Simplicity First, 5th bullet: "If you took 10 actions and 2 would have worked, redo it.") |
| "Would a senior engineer say overcomplicated?" | "Would a CEO say overcomplicated?" | ✅ applied (§ 3 Simplicity First, closing question) |
| "Tests pass before and after refactor" | "Verify behavior before and after change" | ✅ applied (§ 3 Goal-Driven Execution, 3rd example: "'Improve X' → 'Verify behavior before the change and after the change.'") |
| "Add validation → Write tests for invalid inputs" | "Add a check → Try the broken case, confirm it fails the right way, then make it work" | ✅ applied (§ 3 Goal-Driven Execution, 1st example, verbatim) |
| "Fix the bug → Write a test that reproduces it" | "Fix the issue → Reproduce it first, then fix it, then reproduce again to confirm fixed" | ✅ applied (§ 3 Goal-Driven Execution, 2nd example, verbatim) |
| "Touch only what you must" | (applies identically — keep) | ✅ kept verbatim (§ 3 Surgical Changes, tagline) |
| "Goal-Driven Execution / Loop until verified" | (applies identically — keep) | ✅ heading kept; tagline translated to "Define what success looks like. Loop until you've verified it." (substance preserved) |

All eight translation-table items present and correctly applied.

---

## Section completeness — Karpathy source vs `CLAUDE.md § 3`

| Karpathy § | `CLAUDE.md` § | Tagline | Bullet count (Karpathy vs second brain) | Notes |
|---|---|---|---|---|
| 1 Think Before Coding | 3.1 Think Before Acting | ✅ verbatim | 4 → 5 (extra = Decision 23C cross-reference to § 6) | Faithful + intentional cross-reference bullet per F6 success check |
| 2 Simplicity First | 3.2 Simplicity First | ✅ translated cleanly | 5 → 5 | All bullets present; CEO substitutions applied |
| 3 Surgical Changes | 3.3 Surgical Changes | ✅ verbatim | 4 + 2 → 5 (orphans sub-block folded into one bullet) | See structural compression note below |
| 4 Goal-Driven Execution | 3.4 Goal-Driven Execution | ✅ translated cleanly | 3 examples + plan-format → 3 examples + plan-format | All 3 examples match translation table; numbered-plan format preserved |

---

## Decision 23C cross-reference verification

F6 success check requires: § 3 "Think Before Acting" has a cross-reference bullet pointing at § 6 "Verify before asserting" per Decision 23C.

✅ Present at `CLAUDE.md:26`:
> "Before asserting any factual claim about my files, tools, skills, connectors, env vars, or external data, verify in this session via a tool call. If you didn't verify, lead with 'I haven't verified this, but…' or ask me to confirm. See § 6 Verify before asserting below."

Cross-reference correct. Anchored in the behavioral spine as Decision 23C mandates.

---

## Single structural deviation (intentional, not patched)

**Surgical Changes — orphans sub-block compressed.** Karpathy splits this section into two sub-blocks with their own intro lines:

> When editing existing code: [4 bullets]
>
> When your changes create orphans:
> - Remove imports/variables/functions that YOUR changes made unused.
> - Don't remove pre-existing dead code unless asked.

`CLAUDE.md § 3.3` keeps the four "When editing something that already exists:" bullets and folds the two orphan-handling rules into a single 5th bullet:

> "Remove anything YOUR changes made unused. Don't remove pre-existing dead weight unless I ask."

Both content points preserved. The translation-table note "applies identically — keep" refers to phrasing fidelity, not structural fidelity; structural compression is a permitted adaptation when it serves the CEO audience. One sub-heading + two bullets → one bullet is a tightening choice consistent with the ~90-line cap in Decision 15. **Verdict:** acceptable, not patched.

---

## Preamble check

Karpathy: `**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.`

`CLAUDE.md § 3` intro: `These four rules bias toward caution over speed. Trivial requests are exempt — use judgment.`

The "**Tradeoff:**" label is dropped; substance preserved. "Trivial requests are exempt — use judgment" is slightly stronger than "For trivial tasks, use judgment." Accepted as an intentional softening for the CEO audience that doesn't lose the guard rail.

---

## Final verdict

`CLAUDE.md § 3` is a complete, faithful, correctly-translated adaptation of Karpathy's four behavioral sections per Appendix A and the translation table. The only structural deviation (orphans-block compression in Surgical Changes) is intentional and consistent with the CEO-audience tightening Decision 15 calls for.

**No edits applied.** P3 closes as `done`.
