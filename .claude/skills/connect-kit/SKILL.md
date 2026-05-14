---
name: connect-kit
description: The connection kit for the AI Operating System. Installs a real browser tool (Playwright, visible — never hidden) and connects outside services — the user's meeting recorder (Otter), their Google (Gmail/Calendar/Drive via gws), and their ChatGPT custom GPTs. Module 1 kicks off the install step of this in a parallel window; each slice calls the specific connector it needs. Every script fails loudly with plain-English guidance — it never fails silently.
---

# connect-kit — the connection kit

This skill installs and runs the tools that let the AI Operating System reach outside itself. It is **not a level** — it's the shared machinery that Module 1 starts and the slices call.

The whole reason this exists as its own carefully-built thing: in an early run, a connection was attempted live, untested, and it died in front of the client. **This kit never does that.** Every script is built to fail loudly, in plain English, with a clear next step — never silently, never with a guess.

## The scripts (all in `scripts/`)

| Script | What it does |
|---|---|
| `install.mjs` | Installs Playwright + a Chromium browser into this folder. The background step Module 1 kicks off. |
| `verify.mjs` | The safety net. Checks whether something is actually connected before a slice depends on it. `--check install\|otter\|google\|all`. |
| `connect-otter.mjs` | Opens a visible browser, the user signs into Otter, the script catches their key off the network. `--key KEY` for the manual fallback. |
| `otter-pull.mjs` | Pulls meeting transcripts from the connected Otter account. The `post-meeting` skill calls this. |
| `connect-google.mjs` | Connects Gmail/Calendar/Drive via the `gws` tool. (Used by a later slice, not Slice 1.) |
| `extract-gpts.mjs` | Opens a visible browser, the user signs into ChatGPT, the script saves their custom GPTs. (Used by a later slice.) |

State files (what's installed, what's connected) live in `state/` — other skills read these to check status without re-running anything.

---

## When Module 1 kicks this off — the install step

Module 1 has the user open a second window and point it here with: *"Read `.claude/skills/connect-kit/SKILL.md` and start the install step. Work in the background."* When that happens, do exactly this:

### 1. Check for Node — BEFORE running anything

Run with Bash: `node --version`

- **If it returns a version (v18 or higher):** good — go to step 2.
- **If it returns v17 or lower:** tell the user, plainly: *"Your Node is a bit old — tell your guide it needs updating to the latest from nodejs.org. Once that's done, tell me to try again."* Then stop.
- **If it errors / "command not found":** Node isn't installed. Tell the user:
  > Quick thing — your computer needs a free tool called Node before I can install the browser helper.
  >
  > Tell your guide: **"Node isn't installed."** They grab the latest from nodejs.org — it's a 2-minute install.
  >
  > Once it's on, tell me to try again.

  Then stop. Do NOT try to install Node yourself — it needs an installer and a fresh terminal afterward. That's the guide's quick job.

### 2. Run the install

Run with Bash: `node .claude/skills/connect-kit/scripts/install.mjs`

**Run it with a long timeout — at least 10 minutes (600000 ms).** The Chromium download is large and can take several minutes; the default Bash timeout would kill it partway and leave a broken install.

Let it run. It's loud on purpose — it prints what it's doing. It installs the Playwright package, then downloads Chromium (the biggest step — a few minutes).

- **If it finishes with "Install complete":** tell the user *"The background helper is installed and ready — you can ignore this window now. Your other window will use it when it's time."* Then stop and wait. You're done until a slice calls a connector.
- **If it fails:** it prints exactly what broke and what to do. Read that to the user in plain English. Don't improvise past it.

### 3. Then park

After the install, this window's job is done until a slice needs a connection. Don't keep going, don't start connecting things — the slices drive that, in order, when they're ready.

---

## When a slice calls a connector

A slice (like Slice 1 — Meetings) will tell you to run a specific connector. When that happens:

1. **Always verify the install first:** `node .claude/skills/connect-kit/scripts/verify.mjs --check install`. If it's not done, the connection can't happen — get the install finished first.
2. **Run the connector the slice names** (e.g. `connect-otter.mjs`) — **with a long Bash timeout, at least 10 minutes (600000 ms).** The connectors open a browser and wait for the user to sign in — that wait is several minutes, and the default Bash timeout would cut it off mid-sign-in. Watch its output.
3. **If it succeeds:** confirm with `verify.mjs --check <thing>`, then tell the slice you're connected.
4. **If it fails:** every script prints a plain-English failure block — headline, what happened, what to do. Read it to the user as-is. Follow the printed next step. **Never guess past a connection error** — that is the exact mistake this kit was built to prevent.

## The manual fallback — always available

If `connect-otter.mjs` can't catch the key automatically, it says so and tells the user to copy the key from their Otter screen. When the user gives you that key, run:

```
node .claude/skills/connect-kit/scripts/connect-otter.mjs --key <THE_KEY_THEY_GAVE_YOU>
```

That saves and verifies it the manual way. Same idea applies to the other connectors — there is always a guided-manual path. A connection should never be a dead end.

## Voice rules

Same as the rest of the program: 2nd-grade language, no coder words (stack, deploy, MCP, repo, API, endpoint, hook, agentic, integrate), one thought per line, never a wall of text. The user is non-technical — "the browser helper," not "Playwright"; "connect your Otter," not "authenticate the Otter API."

## Notes for whoever is guiding this session

- The kit installs Playwright **locally** into the folder (`node_modules/`), not globally — it's self-contained and `.gitignore`d.
- Browsers always launch **visible** (`headless: false`) — the client should always see the work happening. That was a direct fix from a run where a hidden browser made a real win invisible.
- `connect-google.mjs` needs your OAuth client file at `~/.config/gws/client_secret.json` — that's your prep, before any slice that touches Google. The script stops cleanly and says so if it's missing.
- `connect-otter.mjs` and `extract-gpts.mjs` cannot fully prove themselves without a real client account. Do one real run yourself before trusting them with a paid client. The `--key` manual fallback is the safety net if a UI changed.
