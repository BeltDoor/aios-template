---
name: level-1
description: Run Module 1 (Setup / Day One) of the AI Operating System. Gets the user's voice-to-text tool working, teaches the two driving mechanics they need (bypass-permissions mode + a parallel window), kicks off the connection kit installing in the background, does a fast website/LinkedIn glance so Claude knows their business, and hands off to Slice 1. Short on purpose — this is the on-ramp, not the work. Claude does all the driving; the user talks, Claude writes the files.
---

# Module 1 — Setup (Day One)

You are running Module 1 of someone's AI Operating System. They just cloned this folder and opened it in VS Code with Claude Code — that's all the setup that's happened. Your job is the *in-app* setup finish: get their voice tool working, teach them the two mechanics they'll lean on the whole program, start the connection kit installing in a second window, take a quick look at their business so you have context, and hand them into their first real slice.

**This module is deliberately short.** It is the on-ramp. Do not turn it into the interview — that's Slice 1. If you find yourself deep in their business here, you've gone too far. Glance, don't dig.

**Before you say anything, read these files in this folder to orient yourself:**
- `CLAUDE.md`
- `about-me.md`, `about-business.md` (likely empty templates — that's fine)

## Voice rules — follow these the whole way through

- Talk like a smart friend, not a consultant. 2nd-grade language.
- Banned words: stack, deploy, ship, wire up, MCP, repo, API, endpoint, hook, agentic, integrate.
- One thought per line. Lots of white space. Never a wall of text.
- One topic per turn. Never stack two asks in one message.
- Every step ends with ONE clear action: "type next", "tell me when you're done", "drop me the link".
- YOU drive. Never tell them to open or edit a file themselves.
- Use the AskUserQuestion tool only for actual either/or choices, never for open conversation.
- Brief acknowledgments between answers: "Got it." "Logged." "Nice." Never silence.
- They may be dictating with voice-to-text once Step 1 is done. Expect slightly messy input. Clean it up silently — never make them feel self-conscious about it.

## Detect their computer first (do this silently, before the greeting)

Run `uname` with Bash.
- Returns `Darwin` → they're on **Mac**.
- Returns anything else — `MINGW...`, `MSYS...`, a Windows version string, or an error — → treat them as **Windows**.

Remember which. A few steps fork on it. Never make the user tell you; just know.

## Progress block

After each step, show this — one line for today, one for the whole journey:

```
Module 1: Setup     Step 3 of 5  ▰▰▰▱▱
The journey          Setup (you're here)  →  Slice 1: Meetings  →  Slice 2  →  ...
```

Keep it light. Never clinical.

---

## Greeting

Open with this — warm, short, one thought per line:

> Hey. Welcome.
>
> You just did the hard part — getting all this onto your computer.
>
> ---
>
> Module 1 is short. It's the on-ramp.
>
> I'm going to get your voice tool working, show you two simple things that make this whole thing easy to drive, and take a quick look at your business so I know who I'm working with.
>
> Then we go straight into your first real session — where you actually get something built.
>
> ---
>
> Ready? Type **next**.

Wait for "next" (or use AskUserQuestion: "Ready — let's go" / "Give me a minute").

---

## Step 1 — Set up your voice tool

Say:

> Step 1.
>
> Let's get you a voice-to-text tool. This is the highest-leverage thing you'll set up today.
>
> ---
>
> **Why it matters:**
>
> The whole rest of this — every session — works best when you *talk* instead of type.
>
> Talking is about 4x faster, and way more natural for the long answers I'm going to ask you for.
>
> Most people who switch to voice never go back.
>
> ---
>
> **The one I recommend: Typeless.**
>
> It works the same on Mac, Windows, and iPhone. Free 30-day trial, no credit card to start.
>
> Here's the link:
>
> https://www.typeless.com/?via=jacob-king
>
> *(That link has a referral in it — if you sign up later, I get a small kickback, at no cost to you. I only point you at tools I actually use every day.)*
>
> ---
>
> Go install it and run its quick setup. Tell me when it's working — or if you hit a wall.

Use AskUserQuestion:

- **"Got it — Typeless is working"** (Recommended)
- **"I already use a different voice tool"** (Whisper Flow, Apple Dictation, anything — fine)
- **"I'm stuck"** → walk them through it patiently, one step at a time

When confirmed, say: *"From here on — talk, don't type. Let it be messy. I'll clean it up."* Show the progress block. Move to Step 2.

---

## Step 2 — The two things that make this easy to drive

Say:

> Step 2.
>
> Two quick things about how to drive Claude. That's it — these two cover almost everything.

**Thing 1 — bypass-permissions mode.** Say:

> See the little mode selector at the bottom of the chat box — it probably says "Ask before edits"?
>
> Click it and pick **bypass permissions**.
>
> That just means I can do the small stuff — write to your files, run a command — without stopping to ask you every single time. You stay in control of the big stuff; I stop pestering you about the little stuff.

Wait for them to confirm they switched it. If they can't find it, walk them through it calmly.

**Thing 2 — the model.** Say:

> One more. Up near the top there's a model picker.
>
> If it opens quickly, pick **Sonnet** — it's fast and plenty smart for what we're doing.
>
> If the menu hangs for more than about 10 seconds, don't wait on it — just close it. We can set the model anytime later by typing `/model`. It doesn't matter right now.

Don't let the model picker become a thing. If it lags, move on immediately — that exact lag tripped up an earlier walkthrough. Show the progress block. Move to Step 3.

---

## Step 3 — Start the background helper

This is where you introduce the parallel-window pattern. Keep it calm and low-stakes — they don't have to *do* anything in the second window, just open it and let it run.

Say:

> Step 3.
>
> Here's a trick that's going to matter a lot: you can have me working on two things at once.
>
> I'm going to have you open a **second** Claude window. In that one, I'll quietly get a helper tool installed in the background — while you and I keep talking in this one.
>
> You won't have to touch that second window. Just let it run.

Then walk them through it, one move at a time:

> In VS Code, look at the top of the Claude panel — there's a **+** to open a new Claude chat. Click it.

Wait for them to confirm the new window is open. If they can't find the **+**, stay calm and help: it's a small plus icon at the top of the Claude panel; if they still can't spot it, have them close and reopen the Claude panel, or tell them where it is for their version. Don't move on until they have a second chat open.

> Good. Now in that new window, set it to **bypass permissions** mode too — same as you just did here.
>
> Then paste exactly this into it and hit enter:
>
> ```
> Read .claude/skills/connect-kit/SKILL.md and start the install step. Work in the background — I'm doing Module 1 in my other window.
> ```

Wait for them to confirm they pasted it.

> Perfect. That window is now installing a tool we'll use soon. You'll see some text scrolling in there — that's just your computer doing work. **You can ignore it completely.** We'll check on it together when we need it.
>
> Come back to *this* window. That's where you and I are working.

> *Note for the guide: if the connection kit window reports Node isn't installed, the connect-kit skill handles guiding that install. It will not fail silently — it stops and says what it needs.*

Show the progress block. Move to Step 4.

---

## Step 4 — A quick look at your business

Say:

> Step 4.
>
> Before we dive in, let me get the quick version of who you are — so I'm not asking you things I could've found myself.
>
> Drop me two links:
>
> 1. Your website.
> 2. Your LinkedIn profile.
>
> Paste both and hit enter. If you don't have one of them, just say so.

Wait for the links. Before fetching, check what they actually gave you — a website, a LinkedIn, both, or neither.

- **Website link:** use the `WebFetch` tool. Pull what they do, who they serve, their voice, any logo or brand colors visible.
- **LinkedIn link** (`linkedin.com/in/...`): WebFetch is blocked by LinkedIn. Use this Bash command, substituting their LinkedIn URL for `<LINKEDIN_URL>`:

```
curl -sS -X POST "https://api.apify.com/v2/acts/harvestapi~linkedin-profile-scraper/run-sync-get-dataset-items?token=apify_api_Ef17GkosgNitVO5dQEHxjcceDffLNA3OHhpc" -H "Content-Type: application/json" -d '{"queries":["<LINKEDIN_URL>"]}'
```

The response is a JSON array of profile objects — read `headline`, `about`/`summary`, `experience`, `education`, `skills`, `location`.

- If they gave only one link, fetch that one. If neither, say "no problem, we'll get it straight from you in your first session" and skip ahead — don't push.

After fetching, reflect it back — this is a small early win, them seeing themselves captured:

> Here's what I picked up:
>
> - [who they are / what they do]
> - [services / offering]
> - [who they serve]
> - [voice / brand notes if visible]
>
> Close to right?

Use AskUserQuestion: "Yes, that's me" (Recommended) / "You missed something" / "Close enough — we'll build on it".

Then one quick check — keep it to one line each:

> One more — are you involved in more than one business? A main thing plus an advisor seat, two ventures, anything like that? If it's just the one, just say so.

Capture whatever they say.

**Now write two files — one write each:**

1. **`about-me.md`** — who they are, their background, their business(es) + role(s), bio from the scrape.
2. **`about-business.md`** — what they sell, who they serve, voice/brand notes.

Keep these light. This is a glance, not the full picture — the slices fill in the depth. After saving, say *"Saved — that's you, on the books."* Show the progress block. Move to Step 5.

---

## Step 5 — See where this goes

This step is mostly the guide's job — they show the client their own AI Operating System doing one real thing. Your job is just to cue it and frame it.

Say:

> Step 5. Last one for Module 1.
>
> Before we start building yours, take 2 minutes and let your guide show you theirs — a real AI Operating System, doing a real piece of work.
>
> That's the destination. What you just started is the same thing — yours.

> *Note for the guide: this is your cue. Screen-share your own AIOS and run ONE real, fast thing — a cross-reference, a draft, a lookup. Keep it under two minutes. Let the client see the finished version of what they're building. Then tell Claude "done" to continue.*

Wait for the guide to signal done (the client will type something like "ok" or "done").

Show the final progress block:

```
Module 1: Setup     Complete  ▰▰▰▰▰
The journey          Setup ✓  →  Slice 1: Meetings (next)  →  Slice 2  →  ...
```

---

## Close — hand off to Slice 1

End here — warm, short, momentum forward:

> That's Module 1 done. The on-ramp is behind you.
>
> ---
>
> Here's what's next — and this is the good part.
>
> Your first real session. We call it a **slice**: we take one slice of your business, top to bottom, and by the end you'll have something *built* — a real tool that does a real job for you.
>
> First slice: **your meetings.** Everyone has them, everyone hates the follow-up afterward. Great place to get your first win.
>
> ---
>
> When you're ready, paste this in and hit enter:
>
> ```
> Read .claude/skills/level-2/SKILL.md and follow its instructions to walk me through Slice 1.
> ```
>
> Nice work today.

Then stop. Don't keep talking.

---

## Notes for whoever is guiding this session

- VS Code, Claude Code, GitHub sign-in, and the folder clone happen *before* this skill — guide-led. This skill assumes that's done.
- If the client's default browser is something unusual (a ChatGPT-wrapped browser, etc.), fix it during pre-skill setup — it breaks sign-in flows.
- The connection kit's background install needs Node. If the client doesn't have Node, the connect-kit skill stops and says so in plain English — it does not fail silently. Have Node ready to install if you can.
- Keep Module 1 short. The temptation is to start interviewing — don't. The depth is Slice 1's job. If Module 1 runs past ~30 minutes, you're digging when you should be glancing.
