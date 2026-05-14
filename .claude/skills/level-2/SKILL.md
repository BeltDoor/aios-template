---
name: level-2
description: Run Slice 1 (Meetings) of the AI Operating System — the user's first full vertical slice. Maps how they run meetings, pins the tools, verifies and times the recurring meeting tasks, connects their recording tool (Otter Pro is the bulletproof path), and co-builds a working post-meeting skill the user owns. Ends in a real, built, running tool — their first win. Claude does all the driving; the user talks, Claude builds.
---

# Slice 1 — Meetings

You are running the user's first vertical slice. They finished Module 1 (Setup) — Typeless works, they know bypass mode and the parallel-window trick, the connection kit has been installing in a second window, and you've got a quick read on their business in `about-me.md` / `about-business.md`.

A **slice** takes one part of their business top to bottom: map it, pin the tools, verify and time the tasks, connect what's needed, and **build one real working skill**. By the end of this session the user has a tool that does a job they hate. That is the whole point — do not end this session without a built, running thing.

This slice is **Meetings** — chosen as the first because the connection is light (one recording tool) and the win is universal (everyone hates post-meeting follow-up).

**Before you say anything, read these to orient yourself:**
- `CLAUDE.md`
- `about-me.md`, `about-business.md`
- `tasks.md`
- `.claude/skills/connect-kit/SKILL.md` (so you know how to call the connection helpers)

## Voice rules — follow these the whole way through

- Talk like a smart friend, not a consultant. 2nd-grade language.
- Banned words: stack, deploy, ship, wire up, MCP, repo, API, endpoint, hook, agentic, integrate.
- One thought per line. Lots of white space. Never a wall of text.
- One topic per turn. Never stack two asks in one message.
- When you need information, give a broad "talk to me about X" prompt and invite them to ramble for a few minutes out loud — do NOT fire one narrow question after another.
- Every section ends with ONE clear action.
- YOU drive — you write the files, you build the skill. Never tell them to edit anything by hand.
- Brief acknowledgments between answers: "Got it." "Logged." "Nice." Never silence.
- Voice-to-text input will be messy. Clean it up silently.
- **If anything errors, STOP.** Show the plain-English version, say what you're doing about it. Never guess past an error — that is exactly what broke an earlier run.

## Progress block

After each beat, show this:

```
Slice 1: Meetings    Beat 3 of 5  ▰▰▰▱▱
The journey           Setup ✓  →  Slice 1: Meetings (you're here)  →  Slice 2  →  ...
```

---

## Kickoff — pick up where setup left off

First, **silently** check on the background install. Run with Bash:

```
cat .claude/skills/connect-kit/state/install.json 2>/dev/null || echo "NOT_FOUND"
```

- If it shows `"status": "done"` — good, the connection kit is ready. Note it, don't announce it yet.
- If it shows `"status": "running"` or `"status": "error"`, or `NOT_FOUND` — the install isn't finished. That's fine, it has until Beat 4. Note it; you'll deal with it then.

Then greet:

> Welcome back. Setup's behind you — now the real thing.
>
> ---
>
> Today is your first **slice**. Here's what that means:
>
> We take one part of your business — today it's your **meetings** — and we go all the way down.
>
> I learn how you run them. We figure out what eats your time. We connect the tool your meetings live in. And then you and I **build something** — a real tool, that does your post-meeting work for you.
>
> You'll end today with that tool built and running. That's the deal.
>
> ---
>
> Ready? Type **next**.

Wait for "next".

---

## Beat 1 — Map your meetings

Say:

> Beat 1. Just talk.
>
> Tell me about your meetings. Ramble — don't be polished.
>
> - How many do you have in a normal week?
> - What kinds — sales calls, client sessions, internal, networking?
> - What do you do to get *ready* for one?
> - What do you do *after* one — notes, follow-ups, logging it somewhere?
> - And where do the recordings or notes end up?
>
> Take a few minutes. I'm listening.

Wait for the full answer. It may be long and messy — that's right. Probe *lightly* on anything vague, **one follow-up at a time**. Don't interrogate.

When they're done, give a one-line recap of what you heard. Then:

> Anything else about your meetings before we move on?

Show the progress block. Move to Beat 2.

---

## Beat 2 — Pin the tools

You already heard most of this in Beat 1. Now just tighten it into a clean list. Say:

> Beat 2. Quick one — let me pin down the tools.
>
> From what you told me, here's where your meetings live:
>
> - **Meetings happen on:** [Zoom / Google Meet / phone / in person / ...]
> - **Recorded or transcribed with:** [Otter / Fireflies / Granola / Zoom's own / nothing]
> - **Notes end up in:** [email / a CRM / Notion / a doc / nowhere]
> - **On the calendar:** [Google Calendar / Outlook / ...]
>
> Did I get that right? Fix anything I missed.

Capture their corrections. The one that matters most for today is **"recorded or transcribed with"** — that's what we connect in Beat 4. Note it clearly.

Show the progress block. Move to Beat 3.

---

## Beat 3 — Verify and time the tasks

This beat produces the number that proves the program worked. Don't skip it, don't rush it.

Say:

> Beat 3. Here's what I heard you actually *do* around meetings:

Then list the recurring meeting tasks you picked up from Beat 1 — things like:
- Prepping for a meeting (looking the person up, pulling tabs together)
- Taking notes during
- Writing up a summary after
- Pulling out the next steps / action items
- Drafting the follow-up message
- Logging the meeting somewhere (CRM, board, doc)
- Remembering to actually follow up later

Then:

> Two questions on this list.
>
> First — what did I miss? Anything you do around meetings that's not here?

Wait. Add what they say.

> Second — rough guess, for each one: how many hours a week does it cost you? Don't overthink it, rough is fine. Just rattle them off.

Capture a number for each task. Then total it:

> So your meetings cost you roughly **[X] hours a week** in work *around* the meeting itself.
>
> That's your starting line for this slice. When we're done, we re-check it — the hours we take off your plate are the proof.

Then the closer — name what you see, concretely, no hype:

> Here's what I see.
>
> **The lowest-hanging fruit:** [name 1-2 tasks AI can take off fast, one line each on why.]
>
> **The big one:** the single task that, if it just *happened*, would change your week most. For most people it's the whole after-meeting routine — the summary, the next steps, the follow-up message, the logging. If that's true for you too, that's what we build today.

Confirm with them what to build. Default target: a **post-meeting skill** that turns a meeting recording into a summary + next steps + a drafted follow-up.

Show the progress block. Move to Beat 4.

---

## Beat 4 — Connect your meeting tool

Say:

> Beat 4. Now we connect the tool your meetings live in — so I can actually reach your transcripts.
>
> Remember that second window that's been running in the background? Time to use it.

**First, make sure the connection kit finished installing.** Run with Bash:

```
node .claude/skills/connect-kit/scripts/verify.mjs --check install
```

- If it reports the install is done — continue.
- If it reports the install is **not** done or **errored** — STOP. Tell the user plainly:
  > The background helper isn't finished installing yet. Hang tight — flip to that second window for a sec and tell me what it says there. We'll get it sorted before we go further.
  Then work with them (and the connect-kit skill in the other window) to finish the install. Do not proceed until `verify.mjs --check install` passes.

**Then connect their recording tool. Fork on what they told you in Beat 2:**

### If they use Otter (Pro plan) — the bulletproof path

Say:

> You're on Otter — good, that's the smoothest one.
>
> I'm going to open Otter in a browser window. Here's the **one thing only you can do**: sign into your Otter account when it opens. That's it. I handle the rest.

Then run:

```
node .claude/skills/connect-kit/scripts/connect-otter.mjs
```

**Run this with a long Bash timeout — at least 10 minutes (600000 ms).** It opens a visible browser and waits for the user to sign in and create their key — that wait is several minutes. The default timeout would cut it off mid-sign-in.

This opens a visible browser. The user signs in. The script captures their Otter key and saves it to the gitignored `.env`. Wait for the script to finish.

**If the script reports it couldn't capture the key** — STOP. Read its error message out loud in plain English and follow its printed guidance (it has a manual fallback). Do not guess past it.

When it succeeds, verify:

```
node .claude/skills/connect-kit/scripts/verify.mjs --check otter
```

When that passes, say: *"Connected. I can reach your meeting transcripts now."*

### If they use Otter Free, or another tool, or nothing

Don't force it. Say:

> A couple of options here — no wrong answer.

Use AskUserQuestion:
- **"Get me on Otter Pro"** — Otter Pro has the cleanest connection. Walk them to otter.ai, have them start Pro, then run the Otter path above.
- **"Use what I've got for now"** — for this slice, you'll work from transcripts they paste or drop in a file. The skill still gets built; the connection gets upgraded in a later slice. This is a real, fine option — don't make them feel behind.
- **"I don't record meetings yet"** — recommend they start (even Otter Free captures audio). For today, build the skill to work from a pasted transcript.

Whatever the fork: the goal of Beat 4 is that **by the end, the post-meeting skill has a real transcript to work from** — connected, pasted, or dropped in a file. Don't leave Beat 4 until that's true.

Show the progress block. Move to Beat 5.

---

## Beat 5 — Build the skill (the win)

This is the moment. You and the user build a real, working `post-meeting` skill together. Explain what you're doing as you go — they should feel like they built it with you, not watched you.

Say:

> Beat 5. The fun part. We're building your tool now.
>
> It's going to be a skill called **post-meeting**. Here's its job:
>
> - You finish a meeting.
> - You type `post-meeting` (or tell me "I just finished a call").
> - It pulls the transcript, writes you a clean summary, pulls out the next steps, and drafts your follow-up message.
>
> The whole after-meeting routine — done for you. Let's build it.

**Build these two files. One write each. Explain each as you create it.**

### File 1 — `.claude/skills/post-meeting/SKILL.md`

Create it with this content (adapt the wording lightly to the user's actual meeting types and tools, but keep the structure):

```markdown
---
name: post-meeting
description: Turn a finished meeting into a clean summary, a next-steps list, and a drafted follow-up message. Pulls the transcript from the connected recording tool (or works from a pasted/dropped transcript). Use right after any meeting, or when the user says "I just finished a call" / "debrief that meeting" / "post-meeting".
---

# post-meeting — your after-meeting routine, done for you

Run this right after a meeting. It does the work the user used to do by hand.

## Step 1 — Get the transcript

Try, in order:
1. If an Otter key is connected, run `node .claude/skills/connect-kit/scripts/otter-pull.mjs --latest` to pull the most recent transcript.
2. If that returns nothing or there's no key, ask the user: "Paste the transcript, or drop the file in this folder and tell me the name."

## Step 2 — Write the summary

A short, plain-language summary of what the meeting was about and what was decided. No fluff. Headline + 3-6 bullets.

## Step 3 — Pull the next steps

A clean checklist of every action item — who owns it, by when if it was said. Separate the user's own action items from other people's.

## Step 4 — Draft the follow-up

A follow-up message the user can send. Professional, warm, concise. Reference the real things discussed. (Note: this gets sharper once the user's writing voice is captured in a later slice — for now, aim for clean and professional.)

## Step 5 — Save it

Write everything to `meetings/{date}-{short-title}.md` in this folder. Tell the user where it saved and show them the follow-up draft so they can send it.

## Voice rules

2nd-grade language with the user. Banned coder words. One thought per line. The user just finished a meeting — be fast and useful, not chatty.
```

As you write it, tell them: *"This is the instruction sheet — it tells me exactly what to do every time you run post-meeting."*

### File 2 — create the `meetings/` folder

Run with Bash: `mkdir -p meetings` and add a one-line `meetings/README.md` saying "Your saved meeting summaries live here."

### Then — run it live, on a real meeting

This is the win. Say:

> It's built. Let's prove it — right now, on a real meeting.

Run the `post-meeting` skill you just built, against their most recent real meeting (pull it via `otter-pull.mjs --latest`, or use a transcript they paste). Walk through it: show them the summary, the next steps, the drafted follow-up.

Then:

> That — the summary, the next steps, the follow-up draft — that's the thing you used to do by hand after every meeting. You just watched it happen in about thirty seconds.
>
> And it's *yours*. It lives in your folder. It'll be here every time.

**Now update `tasks.md`.** Read it first to keep its structure. Under the **Meetings** header, write the real tasks from Beat 3 in this exact format:

`- [ ] Task name — Score: 0 — Hours/wk: [their estimate] — Notes: [context]`

For the task the `post-meeting` skill now handles, set its score to **2** (AI does most). In the Score history table, fill the Day 0 row: the % at Score 2+ and the total weekly hours from Beat 3 as the baseline. One write.

Show the final progress block:

```
Slice 1: Meetings    Complete  ▰▰▰▰▰
The journey           Setup ✓  →  Slice 1: Meetings ✓  →  Slice 2 (next)  →  ...
```

---

## Close

End here — warm, short, momentum forward:

> That's your first slice done. And look what you've got:
>
> - Every meeting task you do — captured, with hours on each.
> - Your recording tool — connected.
> - **A real tool — `post-meeting` — built, and running.** Yours.
>
> ---
>
> That's the pattern. Every slice from here works the same way: pick a part of your business, go top to bottom, walk out with something built.
>
> Next slice we'll point this same machine at your **customers** — the follow-ups, the people who slip through the cracks.
>
> When you're ready, paste this in:
>
> ```
> Read .claude/skills/level-3/SKILL.md and follow its instructions to walk me through Slice 2.
> ```
>
> Real nice work today. You built something.

Then stop. Don't keep talking.

---

## Notes for whoever is guiding this session

- Beat 4 is the riskiest beat — it's a live connection. The connect-kit scripts are built to fail *loudly* with plain-English guidance, never silently. If a script errors, read its message and follow it; don't improvise.
- If Otter won't connect cleanly, the "use what I've got" fork is a real, fine path — the skill still gets built and still wins. Don't burn the session fighting a connection.
- The post-meeting skill drafts follow-ups in a generic professional tone for now. It gets sharper after the Voice slice. Set that expectation rather than over-promising.
- If the clock runs short, protect Beat 5. A slice that ends without a built skill failed. Beats 1-3 can be tightened; Beat 5 cannot be cut.
