# API keys

This file is for me (Claude). It's the protocol I follow whenever you hand me an API key — a long password that lets two tools talk to each other. The point: keep the key working without it ever ending up somewhere a stranger could read it.

## What an API key is

When a tool like Firecrawl, Stripe, or Apify wants to let another program act on your behalf, it gives out a long random string of letters and numbers. That string is the API key. Think of it as a hotel key card for software — anyone holding it can walk in and act as you. If it leaks, the only safe move is to rotate it (cancel the old one, get a new one). So we treat it like cash: not in the open, not pasted into chat, not in any file that goes to GitHub.

## 1. The rule

The moment you give me a key, I stop everything else and capture it first. No "I'll do it in a minute." No continuing the task we were on. **Stop. Capture. Verify. Then resume.**

This rule exists because keys get lost otherwise — they scroll away in chat history, and the next session has no idea they were ever given.

## 2. Where it goes

The key lives in an **environment variable** — a sticky note your computer keeps for itself, outside this second brain folder, that any program on your laptop can read. Because it lives outside the folder, it never gets backed up to GitHub. That's the point.

### On Windows

Run from a bash terminal (the kind VS Code's terminal opens by default):

```bash
cmd //c "setx <TOOL>_API_KEY \"<value>\""
```

Replace `<TOOL>` with the tool name in all caps (e.g. `STRIPE`, `FIRECRAWL`). Replace `<value>` with the actual key. The `setx` command persists the variable across every future shell on this user account.

> The `cmd //c` prefix is what lets a Windows command run from inside bash. Without it, bash treats `setx` as a missing program.

### On Mac

Append an `export` line to `~/.zshenv` (the file that runs whenever a new terminal opens). From the terminal:

```bash
echo 'export <TOOL>_API_KEY="<value>"' >> ~/.zshenv
```

Replace `<TOOL>` and `<value>` the same way. If you're on an older Mac that still uses bash by default, use `~/.bash_profile` instead of `~/.zshenv`.

## 3. Verify it survived

Capture is silent — it doesn't print a confirmation. I always run a verify step to make sure the variable is there before I move on.

### On Windows

Open a **new** terminal (the variable won't show up in the shell that ran `setx`) and run:

```bash
powershell -Command "[Environment]::GetEnvironmentVariable('<TOOL>_API_KEY', 'User')"
```

It should print the value. If it prints nothing, the capture didn't take — I retry the capture step.

### On Mac

Open a new terminal and run:

```bash
echo $<TOOL>_API_KEY
```

Same logic: prints the value if it took, prints nothing if it didn't.

## 4. Register it in CONNECTIONS.md

After capture + verify, I add a row to [`CONNECTIONS.md`](../CONNECTIONS.md) § "API keys captured":

| Tool | Env var name | Captured | Reference |
|---|---|---|---|
| Stripe | `STRIPE_API_KEY` | 2026-05-24 | [`stripe-api.md`](stripe-api.md) |

I record the env var **name** only — never the value. This lets future sessions know which keys exist without ever exposing one.

## 5. Document the tool

I make sure `/references/<tool>-api.md` exists. If it doesn't, I create it with at least:

- **What the tool is** — one sentence
- **What you use it for in second brain** — one paragraph
- **Vendor docs** — a link

If the file already exists, I leave it alone unless something is actually wrong.

## 6. Naming convention

The env var name is `<TOOL>_API_KEY` — tool name in all caps, then `_API_KEY`:

- `STRIPE_API_KEY`
- `FIRECRAWL_API_KEY`
- `APIFY_API_KEY`

When two keys for the same vendor coexist (e.g. a Stripe key for the live integration and a separate Stripe key for a CLI), I disambiguate with a suffix:

- `STRIPE_SECRET_KEY`
- `STRIPE_CLI_KEY`

Stay consistent — when I'm not sure what a script wants, the convention is what saves the lookup.

## 7. Hard rules (no exceptions)

- **Never write a key value to a tracked file.** That includes `CLAUDE.md`, this file, anything in `references/`, anything in a code file. The only place a key value ever sits is the env var.
- **Never print the key value back to you in chat.** Once it's captured, I refer to it by env var name (`$STRIPE_API_KEY`), not by value.
- **Never read `.env` aloud.** If a script needs `.env` for some reason, I handle it silently — I don't paste contents into chat.
- **`.env` is already gitignored** (see [`security.md`](security.md)), so even if a script writes to it the file won't reach GitHub. But the env var route above is still preferred because it survives folder deletions and laptop swaps.

---

> If I ever break one of these rules — print a key, write it to a tracked file, skip the capture step — just say "rotate that key" and we'll handle the cleanup together. Better to lose 5 minutes rotating than to leave a leaked key in git history.
