# Handoff Prompt Template

This template defines the paste-ready prompt that `/handoff` (1) prints in a single copy-paste code block AND (2) writes verbatim to `.claude/last-handoff.md` so a dying window never loses it. The prompt is read by the NEXT CLAUDE SESSION, not by the user, so it stays dense and precise: real file paths, real IDs (billing customer/invoice/subscription ids, CRM deal/contact ids, email draft ids, workflow ids, whatever the project uses), real env-flag NAMES, real account handles, kill-switches. No em-dashes anywhere (use commas, periods, colons, parentheses).

`/handoff` does NOT update folder docs/memory and does NOT commit or push. Those are the close-out skill's job (`/king-intelligence:end-session`, or a separate mid-flow save skill if the user keeps one). This skill only prints the prompt and writes the backup file.

---

## How to fill this template

1. **Write the file FIRST, then print.** Assemble the full prompt and write it to `.claude/last-handoff.md` BEFORE you print the code block to chat. The window may be at ~75% and could truncate mid-output. The backup file is the crash-safety priority, not a co-equal afterthought. If you must, write the Fixed Core (Objective + Phase Map + Start Here) first so even a partial file carries the spine.
2. **Always emit the FIXED CORE.** Then walk the OPTIONAL BLOCK LIBRARY top to bottom and emit a block ONLY when its `Emit when:` trigger is true from the state you detected this session. Skip any block whose trigger is false. Never write a block with a "none" / "N/A" body.
3. **Leanness target.** A trivial handoff is the 3-line MICRO FORM and nothing more. A real one grows exactly as much as live state demands, not one empty header more. Omit-if-empty is strict.
4. **Per-project split** when two or more projects/clients were touched (see rule at the bottom).
5. **Pre-emit self-scan.** Before printing, scan the generated prompt for: any em-dash (replace with comma/period/colon/parens), any ID/path you did NOT verify this session (omit it, do not guess), and any live secret VALUE that slipped in (redact it). Only then write the file and print.

---

## FIXED CORE (always emit, in this order)

```
Continuing a previous session. The full recoverable copy of this handoff is at `.claude/last-handoff.md` (read it if anything below got truncated). This brief is written for you, the next Claude session, not for the user: act on Start Here.

# HANDOFF: [3-to-8-word objective title], [M/D/YY HH:MM]
[One meta line ONLY if it matters: which window this is when several ran today, and the focus arg if the user passed one. Example: "Window: deploy decision (1 of 3 today). Focus arg: next window works the deploy decision, not new features." Omit this line entirely if there is one window and no focus arg.]

## Objective
[One sentence: the WHOLE outcome this multi-phase effort drives toward, with the real project/client/repo path named. Force the full outcome, not just the topic. Example: "Ship brand-specific image styles into the content app so any client post renders logo + colors + font pixel-perfect." If the session was pure ops (no repo), name the business outcome instead.]

## Phase Map  <- the spine, read this first
phase source: [PLAN.md path | in-flight handoff doc path | reconstructed from this session's chat]
[Ordered list of EVERY phase in this effort. Tag each [x] done, [>] in progress, [ ] queued. One line per phase. Under the [>] current phase, add an indented "stopped at:" line naming the precise next concrete action (a file:line, an exact command, or the open decision). Try hard to reconstruct real phases from PLAN.md / handoff doc / chat before falling back. Only if you genuinely cannot tell phases apart, fall back to a 3-line done/current/queued split.]
- [x] Phase 1: [done phase, what it produced]. [proof: artifact path or commit hash if load-bearing]
- [x] Phase 2: [done phase]. [artifact]
- [>] Phase 3: [CURRENT phase]
   stopped at: [the precise next action, e.g. "redo the branded-photo style (the user rejected it as not cool enough); quote/hybrid/tweet styles approved"]
- [ ] Phase 4: [queued phase, what it will do]
- [ ] Phase 5: [queued phase]
[If GSD owns this effort, REPLACE this whole Phase Map with one line: "GSD project active (phase [XX-name]). The phase map lives in GSD's own files. Run /gsd:resume-work to restore full phase context, or /gsd:progress for current state. Do not re-invent the phase list."]

## Start Here  <- only the CURRENT [>] phase, immediately actionable
Read first: [the single most load-bearing file to open, usually the project CLAUDE.md or the in-flight handoff/spec doc, e.g. `path/to/HANDOFF.md`]
Then: [the first concrete action, doable without reading anything else. Not "continue X." Name the file/ID/command, e.g. "regenerate the 282 ready_for_review captions through the new gate via scripts/regen.mts."]
[If a staged send depends on this work, say so HERE: e.g. "this is a precondition for the client draft [draft-id] which promises his queue is refreshed, so regenerate captions BEFORE that draft is sent."]

## Suggested skills
[1-3 skills from the available skills whose triggers match (a) the skill that drove this session and (b) the immediate next action. Cap 3, prefer 1. Each line names a concrete in-flight artifact. Never invent a skill name. If none genuinely fit, write exactly: "No specialized skill needed, continue per Start Here." Always end with the closer line.]
- /[skill-name]: [why, tied to a named artifact/path/ID]
- Run /handoff again when this window fills, or /king-intelligence:end-session to close out the day.
```

---

## OPTIONAL BLOCK LIBRARY (emit a block ONLY when its `Emit when:` trigger is true)

### Deploy & gates
**Emit when:** code shipped, OR is code-complete-but-held for the user's OK, OR is code-complete-typecheck-clean-but-not-yet-wired, OR a feature flag / kill-switch / env var changed, OR there is a post-deploy manual step. ALWAYS emit the "Auto-deploy" line whenever a push to the working branch deploys an app, even on a no-deploy session.
```
## Deploy & gates
- Shipped + live: [what deployed + commit hash + version tag if the app uses one, e.g. "v2.23 feature, live for all clients, commit 7d99f064"]
- HELD (awaiting the user's OK): [code-complete + typecheck-clean but NOT deployed, and WHY held, e.g. "customer-facing gate, held for the deploy decision"]
- Code-complete, not yet wired: [built + typecheck-clean but the switch is not flipped]
- Flags now ON/OFF: [each feature-flag NAME + state + kill-switch, e.g. "FEATURE_ALL default-on (kill: =off)". Carry NAMES, never the secret VALUE.]
- Env-only vs rebuild: [whether the flag is a host env-only change or needs a rebuild, e.g. "NEXT_PUBLIC_X_URL needed a rebuild"]
- Post-deploy step: [exact manual step the next window must run, e.g. "after every deploy, force the background-worker re-sync via the documented endpoint or it runs stale code"]
- Auto-deploy WARNING: [if a push to the working branch auto-deploys this app, say so here in one line: "a push to main auto-deploys this app, never blind-commit"]
```
[Covers state categories 2 (deploy) + 7 (kill-switches/flags).]

### Money / billing (the billing system is truth, not the app DB)
**Emit when:** money is owed/owing, OR a subscription changed, OR an invoice was finalized-but-not-sent, OR the revenue/customer-roster state matters to the next step.
```
## Money / billing (the billing system is truth, not the app DB price column)
- Owed: [customer + amount + REAL invoice id + draft email id + finalized-not-sent flag, e.g. "Customer X $125, invoice [invoice-id] finalized but NOT sent, email draft [draft-id]"]
- Sub changes: [cancellations/edge cases + sub id + customer id + effective date, e.g. "Customer Y [sub-id] cancel_at_period_end, ends 6/30, revenue -$169"]
- Roster note: [only if relevant, e.g. "the active $999 sub on account Z is NOT a real customer, cancel"]
- Freshness: [flag any money id that could be stale, e.g. "verify the invoice is still finalized-not-sent, it may have been sent or voided since"]
```
[Covers category 5 (money/billing truth). Carry the ids (the next window needs them); NEVER paste a live billing API key.]

### Drafted, awaiting the user's send
**Emit when:** one or more emails/messages are DRAFTED but not sent and wait on the user to fire them.
```
## Drafted, awaiting the user's send
- [recipient + subject gist + draft id + sent?/unsent?, e.g. "Client reply, email draft [draft-id], unsent"]
- [If a draft makes a promise the next window must make true BEFORE send, say so and link it to the phase, e.g. "this draft promises his queue is refreshed, so regenerate captions first (see Start Here)."]
- Freshness: [a draft id may have been sent or superseded mid-session, flag any you are unsure of]
```
[Covers category 9 (drafted-not-sent with ids). Bidirectional with Start Here when the send depends on in-flight work.]

### Waiting on the user / client / web-only
**Emit when:** something is paused waiting on a decision/action only the user can take, a client action, or a web-only action not reachable from this session.
```
## Waiting on the user / client / web-only
- The user (web-only / decision): [the exact action + where, e.g. "Pause the scheduled job in the vendor's web dashboard. Not reachable from here, only the user can do it." or "Approve the deploy."]
- Client: [client-side action awaited, e.g. "Client to send the site URL + name before the portal build"]
- Needs fresh key/token: [what is blocked + the env-var NAME, e.g. "the card rebuild blocked on a fresh storage key; the local env key is STALE"]
```
[Covers category 4 (hold states & blockers).]

### Parallel windows (do NOT commit these)
**Emit when:** another concurrent window owns files this window must NOT commit, OR a push here would collide with parallel work. The user routinely runs 2-3 concurrent windows.
```
## Parallel windows (do NOT commit these)
- Window [name/topic] owns: [explicit file list], left uncommitted on purpose, that window commits its own clean tree.
- Owned by THIS effort (safe to commit / already committed): [the files this work owns]
- Ownership handoff: [if THIS window is RE-CLAIMING files a prior handoff said do-NOT-commit, say so explicitly and that it supersedes the earlier note, e.g. "these quality/* files are now THIS window's, supersedes the do-NOT-commit note from the earlier window"]
- Auto-deploy reminder: [if a push to the working branch auto-deploys an app, e.g. "a push to main auto-deploys this app, never blind-commit"]
```
[Covers category 8 (parallel work, file ownership, ownership-handoff/supersession). The auto-deploy reminder fires from here even on a no-deploy session, but only if an auto-deploy is actually wired.]

### Verification
**Emit when:** something was verified LIVE, OR tested-locally-only, OR shipped-but-unverified and the next window should watch a first real run.
```
## Verification
- Verified LIVE: [what, on which account/handle, how, e.g. "the feature on the test account via the browser tool (placement + non-repetition + 4 on-voice posts in Review)"]
- Tested locally only: [what + proof, e.g. "the gate: 47 unit tests + 5 red-team rounds pass; NOT yet watched on a live run"]
- Unverified / watch the first real run: [dated, e.g. "tomorrow ~11am: first real scheduled email, confirm it sends + links resolve"]
```
[Covers category 3 (verification status); the dated line feeds the Watchlist.]

### Watchlist (fires soon / in flight)
**Emit when:** something is dated/scheduled to fire, OR a per-project next step is pending that is not already the Start Here, OR a client token expires on a known date.
```
## Watchlist
- [date/time]: [scheduled run to verify, soonest first, e.g. "Mon 6/8 scheduled job: pipeline first run with the fixes, watch delivery volume"]
- Token expiry: [client + platform + expiry date, e.g. "client X social token expires [date]; some tokens expire silently, re-auth before then"]
- [secondary in-flight per project, with the next concrete step]
- [standing item, e.g. "the unsubmitted press release at path/to/release.md"]
```
[Covers categories 6 (token expiry) + 9 (operational sequences & watchlist). Token-expiry has a firm home here even when it fires later than the immediate next step.]

### Connections (per-client inventory)
**Emit when:** the next step depends on which platforms a client has connected, their tier/status, CRM deal alignment, or a token expiry not already in the Watchlist.
```
## Connections
- [client: connected platforms + billing tier/status + CRM deal id + token expiry, e.g. "Client: two social pages + video channel connected; $700 via invoices (not the $200 sub); CRM deal [id]; tokens [expiry]"]
```
[Covers category 6 (client connections).]

### Gotchas (carry forward)
**Emit when:** an API quirk, model rule, proven pattern, or hard-won id/path was learned this session that the next window would otherwise re-discover.
```
## Gotchas (carry forward)
- [quirk/model rule, e.g. "use the dedicated caption model for the gate, not the default API; force JSON-object mode or the model truncates JSON"]
- [proven pattern + path, e.g. "the browser tool wedges on Windows; kill the stray browser procs + remove the lock file to recover"]
- [load-bearing id/handle/path the next window needs: backend project ref, account handle, place id, workflow id, gitignored local-only dir]
- [reference a memory file or folder CLAUDE.md by path instead of re-pasting it]
```
[Covers category 10 (domain gotchas + carry-forward facts).]

---

## PER-PROJECT SPLIT
**Emit when:** two or more distinct projects/clients were touched this session.
Keep ONE Fixed Core (one Objective line can name the session's umbrella, then each project gets its own Phase Map + Start Here). Under it, give each project its own mini-section with only the blocks that apply to it. Do NOT duplicate a genuinely global block per project; split only what is actually project-specific.
```
## Per project

### [Project 1 name + path]
[its Phase Map line(s), its Start Here, and only the optional blocks that apply to it]

### [Project 2 name + path]
[same]
```

---

## TRIVIAL-SESSION MICRO FORM
**Emit when:** no meaningful file/state changes (just chat, light research, no decisions). This OVERRIDES everything above. Replace the entire prompt with these lines only:
```
Continuing a previous session. Backup at `.claude/last-handoff.md`.
We were [topic]. No code/doc/state changes; no money/drafts/deploys pending.
Start Here: [the one thing, or "nothing pending, ask the user what's next"].
```

---

## Fill discipline (governs every section)

- **Phase map is the spine and goes first.** It is the cure for "more phases to do." Reconstruct real phases from PLAN.md / the in-flight handoff doc / the conversation. Try hard before falling back to a 3-line done/current/queued split. Tag the source on the `phase source:` line so the next window knows authoritative-from-PLAN.md vs reconstructed-from-chat.
- **Ignore meta-bookkeeping commits when reconstructing "what got done":** skip any commit whose message starts with `chore(checkpoint):`, `chore(session):`, or `docs: context handoff`. Those are prior save/handoff commits, not session work, and counting them double-counts handoffs (especially on a second `/handoff` in one window).
- **Reference, do not restate.** Point at commits, diffs, PLAN.md, folder CLAUDE.md, and memory files by real path instead of pasting their content. The handoff points at artifacts; the close-out skill is what writes them.
- **Every reference is a REAL path/ID verified this session.** No fabrication. If unknown, omit the block, do not guess. Mark genuinely-unknown-but-needed items `[unknown]` rather than inventing.
- **Freshness over deletion.** Carry operational ids, handles, env-flag NAMES, and paths in full because the next window needs them. The likelier failure than a fabricated id is a STALE-but-real one (an invoice later voided, a draft later sent), so flag money/draft ids that could have changed mid-session. The tie-breaker: an id the next window needs beats a deleted one it has to re-discover.
- **Redaction boundary (carry the id, mask the value).** Redact ONLY live secret VALUES: API keys, passwords, tokens, raw PII like full SSNs / DOBs. CARRY the operational ids that point at them: billing customer/invoice/subscription ids, CRM deal/contact ids, email draft ids, account handles, a client's CRM record id, env-var NAMES. Example boundary: carry the env-var NAME (e.g. `SOME_ACCESS_TOKEN`), never its value; carry "contact 497173877439", never a client's SSN.
- **No em-dashes anywhere.** Bullets over paragraphs. Lead with the load-bearing fact.
- **This skill does not write docs and does not commit.** It only prints the prompt and writes `.claude/last-handoff.md`. Folder-note updates and commits belong to the close-out skill.
- **Backup-file safety.** `.claude/last-handoff.md` holds redacted-but-operational ids and may live in a private repo whose history carries PII and that could auto-deploy on push, so it MUST be gitignored. The skill body confirms the `.gitignore` entry exists before writing and never edits `.gitignore` beyond noting it once if missing.
