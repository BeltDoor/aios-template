---
name: level-3
description: Run Slice 2 (Customers) of the AI Operating System — the user's second vertical slice. Maps how they find, talk to, onboard, and keep customers and prospects, pins the tools, verifies and times the recurring customer tasks, connects their email (and works with wherever their customer list lives), and co-builds a working follow-up skill that catches the people slipping through the cracks. Ends in a real, built, running tool. Claude does all the driving; the user talks, Claude builds.
---

# Slice 2 — Customers

You are running the user's second vertical slice. They finished Slice 1 (Meetings) — they have a built `post-meeting` skill running, Otter (or another recorder) connected, and they've seen a full slice work. This one follows the **exact same shape** — that familiarity is the point.

This slice is **Customers**: the follow-ups, the onboarding, the warm leads that go quiet and get forgotten. The connection is heavier than Slice 1 — that's on purpose; the slice pattern and the connection kit are proven now.

Read `.claude/skills/SLICE-TEMPLATE.md` for the seven-beat shape. Read these to orient: `CLAUDE.md`, `about-me.md`, `about-business.md`, `tasks.md`, `.claude/skills/connect-kit/SKILL.md`.

## Voice rules

Same as every slice: 2nd-grade language; banned coder words (stack, deploy, ship, wire up, MCP, repo, API, endpoint, hook, agentic, integrate); one thought per line; one topic per turn; ramble prompts not 20 questions; you drive, the user talks; brief acknowledgments; clean up messy voice input silently. **If anything errors, STOP** — plain English, clear next step, never a guess.

## Progress block

```
Slice 2: Customers   Beat 3 of 5  ▰▰▰▱▱
The journey           Setup ✓  →  Slice 1: Meetings ✓  →  Slice 2: Customers (you're here)  →  ...
```

---

## Kickoff

Silently check the connection kit is still good: `cat .claude/skills/connect-kit/state/install.json`. Then:

> Welcome back. Slice 2.
>
> Last time we did your meetings — and you walked out with a tool built. Same deal today, new part of your business: your **customers**.
>
> The people you're trying to win, the ones you're onboarding, and — the big one — the ones who reply, go quiet, and get forgotten.
>
> By the end you'll have a tool that catches them. Ready? Type **next**.

Wait for "next".

---

## Beat 1 — Map your customers

> Beat 1. Just talk. Tell me about your customers and prospects — ramble.
>
> - How do new ones find you, or you find them?
> - What happens when someone's interested — what do you do?
> - What does onboarding a new one look like?
> - And once they're a customer — what keeps them, what do you do to stay in touch?
> - The honest one: who slips through the cracks?

Wait for the full answer. Probe lightly, one follow-up at a time. One-line recap. Ask "anything else about your customers?"

Show the progress block. Move to Beat 2.

---

## Beat 2 — Pin the tools

> Beat 2. Let me pin down where your customer world lives:
>
> - **New leads / prospects live in:** [a CRM / a spreadsheet / your inbox / your head]
> - **Active customers live in:** [same options]
> - **You talk to them mostly through:** [email / phone / text / LinkedIn]
> - **Their materials and history live in:** [Drive / a folder / scattered]
>
> Fix anything I got wrong.

The two that matter for today: **where the customer list lives** and **email** — those are what Beat 4 connects. Note them clearly.

Show the progress block. Move to Beat 3.

---

## Beat 3 — Verify and time the tasks

> Beat 3. Here's what I heard you actually *do* with customers:

List the recurring customer tasks you heard — things like: chasing down new leads, writing first replies, onboarding steps, checking in on quiet customers, logging who said what, remembering to follow up.

> What did I miss?

Wait. Add what they say.

> Now rough hours-per-week on each. Rattle them off.

Capture every number. Total it. *"That's your customer starting line."*

Then name what you see — the lowest-hanging fruit, and **the big one**. For most people the big one is the same thing it was for Jon Osting in the runs that shaped this program: *people reply, you mean to follow up, and you forget.* If the list backs that up, that's what you build: a **follow-up** skill that catches the people going quiet.

Show the progress block. Move to Beat 4.

---

## Beat 4 — Connect your email and your list

> Beat 4. Now we connect what this tool needs: your email, and your customer list.

**First, verify the install:** `node .claude/skills/connect-kit/scripts/verify.mjs --check install`. If it's not done, STOP and finish it before going on.

**Connect email (Gmail/Calendar/Drive via gws).** Say:

> I'm going to connect your Google — your email especially. A browser will open; the one thing only you can do is sign into your own Google account.

Run, **with a long Bash timeout (at least 10 minutes / 600000 ms)** — it waits for the user to sign in:

```
node .claude/skills/connect-kit/scripts/connect-google.mjs
```

- **If it succeeds:** verify with `node .claude/skills/connect-kit/scripts/verify.mjs --check google`, then say *"Connected — I can see your email now."*
- **If it stops saying the Google sign-in file isn't in place:** that's the guide's prep. Tell the user plainly: *"Quick pause — tell your guide the Google client file isn't in place yet. It's a quick thing for them. Then we pick up right here."* Then stop. Do NOT guess past it.
- **If sign-in fails with anything about an unverified app or the account not being allowed:** tell the user *"Tell your guide the Google account may need to be added as a test user — one click on their end."* Then stop.

**Then handle the customer list.** Fork on what they told you in Beat 2:
- **A spreadsheet or a file** → ask them to drop it in this folder (or export it and drop it) and tell you the name. You read it directly.
- **A CRM (HubSpot, monday.com, etc.)** → for this slice, ask them to export their customer list to a file and drop it in. Connecting the CRM directly is a later slice; the export is enough to build the follow-up tool today.
- **Their inbox or their head** → that's fine — the follow-up skill will work straight from Gmail.

Don't leave Beat 4 until Gmail is connected AND you have a way to know who their customers are (a file, an export, or "it's all in the inbox").

Show the progress block. Move to Beat 5.

---

## Beat 5 — Build the skill (the win)

> Beat 5. We're building your tool. It's called **follow-up**.
>
> Its job: find the people who replied to you, or went quiet, or are mid-onboarding — and tell you who needs a nudge, with a drafted message ready to go.
>
> The thing you used to do by remembering. Now it just happens.

**Build `.claude/skills/follow-up/SKILL.md`** — one write — adapting lightly to their real tools:

```markdown
---
name: follow-up
description: Find the people who need a nudge — replied and waiting, gone quiet, mid-onboarding — and draft the follow-up message for each. Reads Gmail and the user's customer list. Use weekly, or when the user says "who do I need to follow up with" / "follow-up".
---

# follow-up — catch the people slipping through the cracks

## Step 1 — Gather

- Read recent Gmail threads (sent + received) with `gws`.
- Read the customer list (the file/export they dropped in, or work straight from Gmail).

## Step 2 — Find who needs a nudge

Three groups:
1. **Replied, waiting on you** — they answered, you haven't responded.
2. **Gone quiet** — a real thread that just stopped, no reply in 2+ weeks.
3. **Mid-onboarding** — a new customer whose onboarding steps aren't finished.

## Step 3 — Draft each nudge

For each person: one short, warm, specific follow-up message — referencing the real last thing discussed. Not generic. (Gets sharper after the Voice slice.)

## Step 4 — Hand it over

Show the user a simple list: who, why they're flagged, and the drafted message. They send the ones they want. Save the list to `follow-ups/{date}.md`.

## Voice rules

2nd-grade language, no coder words, one thought per line. Be a sharp assistant, not chatty.
```

Then `mkdir -p follow-ups` and a one-line `follow-ups/README.md`.

**Run it live** — on their real Gmail and real list. Walk them through the flagged people and the drafts. Then:

> That list — the people you'd have forgotten — that's the thing that used to live in your head and slip. Now it's a tool. Yours.

**Update `tasks.md`** — read it first to keep its structure. Under **Customers**, write the real tasks from Beat 3 with hours. Set the follow-up task to **Score 2**. Update the Score history table — recalculate % at Score 2+ and the running total hours.

Show the final progress block.

---

## Close

Before the close: check whether the next slice exists yet — run `ls .claude/skills/level-4` with Bash.

**If `level-4` exists**, end with:

> Slice 2 done. Two tools built now — `post-meeting` and `follow-up` — both yours, both running.
>
> See the pattern? Every slice, same shape, another piece of your week handed off.
>
> Next we teach me how *you* sound when you write — using your real email history — so every draft from here on sounds like you.
>
> When you're ready:
>
> ```
> Read .claude/skills/level-4/SKILL.md and follow its instructions to walk me through Slice 3.
> ```
>
> Strong work. Two for two.

**If `level-4` does NOT exist yet**, end with:

> Slice 2 done. Two tools built now — `post-meeting` and `follow-up` — both yours, both running.
>
> See the pattern? Every slice, same shape, another piece of your week handed off.
>
> That's the last slice that's ready right now — your guide is lining up the next one. When it's ready, they'll point you at it.
>
> Strong work. Two for two.

Then stop.

---

## Notes for whoever is guiding this session

- Beat 4 connects Google via `gws` — your OAuth client file (`~/.config/gws/client_secret.json`) must be in place first, and the user's Google account added as a test user on your app. `connect-google.mjs` stops cleanly and says so if either is missing.
- Direct CRM connections are deliberately out of scope for this slice — an export is enough to build a real follow-up tool. A dedicated CRM slice can come later.
- Protect Beat 5. If the clock runs short, tighten Beats 1-3; never cut the build.
- `level-4` (Slice 3 — Voice) is referenced in the close. If it's not built yet, tell the user their next slice is being prepared and to check with their guide — don't let the close dead-end.
