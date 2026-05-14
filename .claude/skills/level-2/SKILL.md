---
name: level-2
description: Run Level 2 (Connect Workspace) of the AI Operating System — connect the user's Gmail, Google Calendar, and Google Drive through the gws CLI so Claude can read from them. Checks prerequisites first; if gws or the OAuth client file isn't in place, it stops and tells the user to get their guide. The user signs into their own Google account — that is the one manual step.
---

# Level 2 — Connect Workspace

You are running Level 2. The user has already done Level 1 — you can *see* their business in the files. Now you give Claude a way to actually *reach into* it: their Gmail, Google Calendar, and Google Drive, through a tool called `gws`.

## Voice rules — follow these the whole way through

- Talk like a smart friend, not a consultant. 2nd-grade language.
- Banned words: stack, deploy, ship, wire up, MCP, repo, API, endpoint, hook, agentic, integrate.
- One thought per line. Lots of white space. Never a wall of text.
- Every section ends with ONE clear action.
- They may be dictating with voice-to-text. Expect slightly messy input. Clean it up silently.
- If anything errors, STOP. Show the user the plain-English version and tell them what to do. Do not guess your way past an error.

---

## Step 1 — Check the prerequisites (do this BEFORE saying anything to the user)

Two things have to be in place before this session can run. Check both with Bash, silently:

1. **Is `gws` installed?** Run `gws --version`. If it errors or isn't found, gws is not installed.
2. **Is the OAuth client file in place?** Check whether `~/.config/gws/client_secret.json` exists.

**If EITHER is missing**, do not try to install or create anything. Stop and tell the user:

> Quick pause — your system needs one thing set up before we can connect your email and calendar.
>
> Tell your guide: **[name exactly what's missing — "gws isn't installed yet" and/or "the Google client file isn't in place yet"]**.
>
> This is a quick thing for them to handle. Once it's done, come back and we'll pick up right here.

Then stop. Do NOT improvise an install — installing gws and placing the client file is the guide's prep, not something to wing live.

**If BOTH are present**, continue to Step 2.

---

## Step 2 — Frame it

Say:

> Level 2. Connecting your world.
>
> Up to now I can *see* your business — everything you told me in Level 1.
>
> But I can't *reach into* it yet.
>
> Today changes that. We connect your Gmail and your Google Calendar.
>
> After this, I stop being something you only talk to — and start being something that can actually look things up and do work with you.
>
> ---
>
> Here's the one thing only you can do: sign into your own Google account when the browser opens.
>
> Everything else, I handle.
>
> Ready? Type **next**.

Wait for "next".

---

## Step 3 — Connect

Say:

> Opening the sign-in now.
>
> A browser window is about to open.
>
> Sign in with your Google account, and approve the access it asks for.
>
> Take your time — tell me when you're done, or if anything looks confusing.

Then run:

```
gws auth login -s gmail,calendar,drive
```

This opens a browser for the user to sign in. Wait for them to tell you they're done.

**If the login fails** — especially with anything about an unverified app, access blocked, or the account not being allowed — stop and tell the user:

> Looks like the sign-in didn't go through.
>
> Tell your guide: **the Google account may need to be added as a test user on the app.**
>
> That's a one-click thing on their end. Once they've done it, we'll try again.

Then stop and wait.

---

## Step 4 — Confirm

Once the user says they're signed in, run:

```
gws auth status
```

Confirm it shows authenticated. Then say:

> Connected. Let me prove it.

---

## Step 5 — Prove it (this is the moment)

Run two quick read-only tests so the user sees it working on their real data:

1. List a few of their most recent Gmail messages (just senders + subjects).
2. List their calendar events for this week.

Use the appropriate `gws` commands. Keep the output short and human — don't dump raw data, summarize it the way a helpful assistant would.

Then say:

> That's your real inbox and your real calendar — and I just read them.
>
> From here on, I can pull things up for you instead of you digging for them.

---

## Close

End here — warm, short, momentum forward:

> Level 2 done. Big step.
>
> Here's what's next.
>
> Next we'll connect the rest of your tools — your customer list, wherever your work lives.
>
> Then we teach me how *you* sound when you write, using your real email history. That's why we connected email first.
>
> Nice work today.

Then stop. Don't keep talking.

---

## Notes for whoever is guiding this session

- The user uses **your** OAuth client (`~/.config/gws/client_secret.json`) — they do NOT run `gws auth setup`, do NOT install gcloud, do NOT touch the Google Cloud Console. Their sign-in produces their own tokens; your client file is just the app identity.
- gws install on Windows: npm (`npm install -g @googleworkspace/cli`, needs Node) or the pre-built Windows binary from the gws Releases page (no Node, needs to be on PATH). Decide and do this BEFORE the session.
- If your OAuth app is in "testing" mode, the user's Google account must be added as a test user on your side, or their login fails (Step 3 handles this case).
