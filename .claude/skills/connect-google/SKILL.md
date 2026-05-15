---
name: connect-google
description: Sign the user into their Google account inside the AIOS helper browser. Opens the helper (persistent profile, separate from their real Chrome) to Google's sign-in page; the user signs in like they would anywhere else; the session stays put for future slices. Use when Module 1 (or any slice) needs the user's Google connected. Sign-in only — deeper Gmail/Calendar/Drive integration is a later slice.
---

# /connect-google — sign into Google inside the helper

This skill signs the user into their Google account inside the AIOS helper browser. **Just the sign-in.** Reading Gmail, Calendar, Drive — that's a later slice.

## Voice rules

- 2nd-grade language. No coder words.
- One thought per line. Never a wall of text.
- If anything errors, STOP — read the script's plain-English message to the user, do not guess past it.

## What to do

Run, **with a long Bash timeout — at least 10 minutes (600000 ms)**:

```
node .claude/skills/connect-kit/scripts/connect-google.mjs
```

The script opens the helper browser (persistent profile, in this folder) to Google's sign-in page. While it runs, tell the user:

> The helper just opened to Google's sign-in.
>
> Sign in like you would anywhere else — your email, your password, your 2FA code if you use one.
>
> When you're signed in and you see your normal Google page, just close the helper window. That's how I know you're done.

Wait for the script to finish. It exits when the user closes the helper, or times out at 8 minutes.

**On success:** the script writes `state/google.json` as `signed-in-via-helper`. Confirm to the user:

> Done. Your helper is signed into Google. It'll remember next time.
>
> The thing that uses that connection — reading your email, checking your calendar — that's a later slice. Today was just getting signed in.

**On failure:** the script prints a plain-English failure block. Read it to the user as-is and follow its next step. Do not improvise past a connection error.

## When this fires

Module 1 Step 4 of the AIOS template, after the user picks Google in the "which email do you use?" question. Or any later slice that asks "is the user signed into Google?" and finds they're not.
