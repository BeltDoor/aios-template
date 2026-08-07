# Security

How your second brain stays safe. Plain rules, not paranoia.

## What this is

Your second brain folder holds real business data — customer names, deal notes, draft emails, identity work. That's the point. This file is the short list of things to never do with it, and what's already taken care of so you don't have to think about them.

## Secrets — API keys, passwords, tokens

Anything that lets a program act as you (an API key, an OAuth token, a vendor password) is a **secret**. Secrets get their own file: [`api-keys.md`](api-keys.md). The short version:

- Secrets live in **environment variables** on your laptop, never in a file inside this folder.
- If you ever paste a key into chat, I (Claude) stop, capture it to an env var, and tell you to rotate the old one — leaked secrets get cleaned up, not ignored.

If you're not sure whether something counts as a secret, assume it does and ask me.

## What's already gitignored (you don't have to think about these)

Two things on your laptop never leave it, because `.gitignore` (git's "don't back this up" list) keeps them out of every push to GitHub:

- **`.env`** — where your API keys live. Pushing this would be the same as emailing your passwords.
- **`.playwright-profile/`** — the browser session I use when I need to log in somewhere as you. It holds live cookies. Pushing it would also be the same as pushing your passwords.

Keep both lines in `.gitignore`. If you ever ask me to take one out, I'll stop and ask you to confirm — there's almost no good reason to.

## Real customer data in chat

When you and I talk, the conversation is logged so we can pick up where we left off and so auto-memory can compound. That's normally fine. But some content shouldn't go through chat verbatim:

- **Identifying customer info** — full names + email + phone + address all in one paste. Use what you need ("draft a follow-up to my contact at Acme") instead of pasting the contact card.
- **Medical, legal, or financial detail about a specific person** — same rule. I'll work from "the client" or first names if you tell me to.
- **Anything covered by an NDA you signed.** If you're not sure, treat it as covered.

This isn't because chat is insecure — it's because the more sensitive a detail is, the less it should sit in a transcript or a memory note where it might get re-surfaced months later. Keep the sensitive stuff in your CRM or your inbox; talk to me about it by reference, not by paste.

If you ever paste something and immediately regret it, just say "scrub that" — I'll note what to leave out of any memory or follow-up draft.

## Your setup line is personal — don't share it

The line you copy off your Get Started page at members.king-intelligence.com is **yours**. It carries the key that keeps your toolkit current, so treat it the way you'd treat a password.

What that means in practice:

- **Don't post it anywhere public** — not on social, not in a deck, not in a public Slack or Discord. Email, text and Signal are fine.
- **If it ever gets out**, sign in to the members site, open **Your System**, and hit **Regenerate**. That kills the old one instantly and gives you a fresh one. No harm done.
- The page itself sits behind your own login, so nobody can reach your line without being you.

## If something feels wrong

Better to flag a false alarm than miss a real one:

- A key looks like it leaked → say "rotate that key" and we'll handle it together.
- A push went somewhere it shouldn't → say "we may have pushed a secret" and I'll walk the diff with you.
- A chat went somewhere it shouldn't → say "scrub that from memory" and I'll fix it.

The second brain is yours. Keeping it tight is a five-minute habit, not a project.
