---
name: install-email
description: Set up your Email and Debrief skills around your real voice and your real tools, end to end, in one guided run. Claude interviews you about your stack, reads a few hundred of your real sent emails to build your voice file, wires the King Intelligence email and debrief skills to your answers, and live-tests each one with you on real material. Use when you say "install email", "set up my email skill", "make these skills mine", "wire email to my voice", "set up debrief", "teach Claude to write like me", or type /install-email, even if you never name the skill.
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, Skill, AskUserQuestion
disable-model-invocation: false
---

# /install-email: wire Email and Debrief to your voice and your tools

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## What you get

Two connected skills, working as yours by the end of this run:

- **Email** drafts in your real voice: your openers, your sign-offs, your length, your banned phrases, learned from hundreds of emails you actually sent.
- **Debrief** processes a meeting end to end (transcript, speakers fixed, signals detected, summary filed) and hands its follow-up email to Email.
- **Stop Slop** already works with no setup. What this run adds is the guarantee: every email draft passes through it before you see it.

You already have all three skills installed with this plugin. This run does not rebuild them. It wires the installed copies to you.

## Set expectations (read this first)

Claude does the work. Your jobs: answer a short interview, correct the voice file where it gets you wrong, and judge two live tests. Budget about 30 minutes.

Two ground rules for the whole run and forever after:
- Nothing ever sends on its own. Emails, invites, invoices: drafted and staged only. You do the sending.
- No invented facts. Unknown means Claude asks you, or writes [not mentioned].

## Before the steps (Claude checks these)

1. **Files here must persist.** Confirm this session lives in a real workspace, project folder, or repo that will still exist next conversation. If it will not (a throwaway chat window), stop and tell the user plainly to run /install-email from Claude Code or another setup that keeps files.
2. **Find the wiring surfaces.** Run this and hold onto the printed CONFIG_PATH and any current wiring:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/adapt-context.mjs" "${CLAUDE_PLUGIN_ROOT}" "${CLAUDE_PLUGIN_DATA}"
   ```

   Email's settings live in that config file under `skills.email`. Debrief's settings live in the user's own repo at `references/king-intelligence-config.md`, in its `## debrief` section. This run fills both. Never edit any file under the plugin code folder itself; those are the shipped skills and updates overwrite them.

## The steps, in order

### Step 1 of 4: The interview

Ask these one at a time, and wait for each answer. Before answering FOR the user, check what is actually connected in this session.

1. Where do your meeting recordings or transcripts come from? (Otter, Zoom, Fathom, Teams, Read.ai, pasted notes, or nowhere yet)
2. What do you send email with, and can Claude reach it from here? Claude checks its available tools before answering.
3. Where do you keep notes on clients and prospects? (folders in this workspace, a CRM, a notes app, nowhere yet)
4. Do you use a CRM Claude can write to? Claude checks its connected tools if unsure.
5. Can Claude read your calendar or booking system for real availability? Claude checks.

If a named tool is not reachable from this session, say so plainly and design around it: the skill hands over clean text to copy and paste instead. Never pretend a connection exists, and never invent what a tool would have returned.

### Step 2 of 4: Capture the voice

1. Pull 200 or more emails the user personally wrote and sent, from their connected email tool, up to 300 if that is easy. A big sample is the whole point: patterns that repeat across hundreds of emails are the real voice, not a good day. Skip newsletters, receipts, anything automated, and one-line replies that carry no voice. If the email tool is not reachable, ask the user to paste 10 real sent emails instead. If fewer than 10 real emails exist anywhere, build the file from what exists, mark it DRAFT at the top, say it is thin, and grow it from corrections on real drafts.
2. Study them and write `EMAIL-VOICE.md` in the user's workspace with:
   - Their 3 to 5 real openers, ranked by how often they use them, quoted exactly
   - Their real sign-offs, and whether their email tool adds a signature. If it does, the email skill must never also type their name at the end.
   - Their length habit: how many words when they have one thing to say
   - Phrases they never use. Start with the standard AI tells ("I hope this finds you well", "just circling back", "touching base", "I'd be happy to") and the em dash, then add anything their real emails clearly avoid.
   - 2 or 3 of their real emails pasted in full as examples
3. Show the file and ask what they would change. Their corrections outrank the analysis. Save the corrected version.

### Step 3 of 4: Wire the Email skill

1. Merge these into the config at CONFIG_PATH under `skills.email`, leaving every other skill's wiring untouched (same shape /king-intelligence:adapt uses):
   - `voiceGuidePath`: the path to the EMAIL-VOICE.md just written
   - `signature`: their signature, if their email tool does not already add one
   - `emailTool`: what they send with (from the interview)
   - `bannedPhrases`: anything from the voice file beyond the universal blacklist
   Set top-level `"_status": "CONFIGURED"`, `mkdir -p` the data folder, save. This config file is the only plugin-side file this run ever writes.
2. Confirm the wiring holds by reading the shipped email skill's own instructions and checking each of these lands somewhere real: voice file read in full before every draft, facts collected before drafting, one paragraph per thing, the pre-send checklist, draft-never-send.
3. **The stop-slop guarantee, permanent:** every email draft gets the stop-slop skill run on it as the final pass before the user sees it. Every draft, every time, whoever asked for the email. It ships in this same plugin, so it is always available; there is no "if installed" here. Record this rule in the user's own standing instructions (their CLAUDE.md or equivalent) so it survives this session.
4. **Live test, required:** draft one real email right now by invoking the email skill, stop-slop pass included. Fix whatever the user flags, and write the lesson into EMAIL-VOICE.md so they never flag it twice.

### Step 4 of 4: Wire the Debrief skill

1. Open `references/king-intelligence-config.md` in the user's repo (create it if missing) and fill the `## debrief` section as plain `- key: value` lines from the interview answers: `transcriptSource`, `emailTool`, `clientFolderRoot`, and the `crm` and calendar keys if those tools exist. Leave out tools the user does not have; the skill skips those steps safely.
2. Confirm the wired behavior by reading the shipped debrief skill's instructions against the interview: transcript found from their source (pasted always wins), speakers fixed without changing any words, all seven signal types hunted (not just tasks), transcript saved in full to the client's folder, summary built from the signals, follow-up email drafted by invoking the email skill (which carries the stop-slop pass), and everything triaged into the three lanes (done, ready to send, prompts queued).
3. **Live test, required:** run debrief on one real meeting with the user now, end to end.

## Standing rules this run leaves behind

- Never send anything on its own: no emails, no invites, no invoices, no posts. Draft and stage only.
- Every email draft passes through the stop-slop skill before the user sees it. No exceptions.
- Never invent a fact. No made-up times, quotes, prices, names, or contact details.
- If a tool is missing or fails mid-run, say what is missing and do the closest safe version by hand. Do not stop, and do not pretend.
- When the user corrects a draft, update the skill wiring or the voice file in the same session, so they never give the same correction twice.

## If you hit a snag

- Config file not found or the adapt-context script fails: the plugin may need a `claude plugin update`, or the session was started outside the workspace. Fix that first; do not hand-write config into the plugin code folder.
- Fewer sent emails than expected: proceed with what exists, mark the voice file DRAFT, and say so. A thin honest voice file beats a padded fake one.
- The user can rerun /install-email any time; it re-wires over the old answers without breaking anything.
