---
name: install-remote-control
description: Set up Claude Code Remote Control so you can see and steer your Claude sessions from your phone, and fix the red "Remote Control error: Remote Control initialization failed" banner. Use when you say "install remote control", "set up remote control", "put Claude on my phone", "control Claude from my phone", "continue my session from my phone", "connect my phone to Claude", "the remote control thing is broken", when the red initialization-failed message appears, or when you want to check on Claude while away from your computer, even if you never say the words remote control. Also run it again after changing Claude accounts or moving to a new computer.
allowed-tools: Bash, Read, Edit, Write
disable-model-invocation: false
---

# install-remote-control

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## What you get

Remote Control lets you open the Claude app on your phone and pick up the exact Claude Code session running on your computer: read what it's doing, send it new instructions, approve its questions, all from anywhere. Your computer does the work; your phone is the window into it.

When this setup is done, three things are true:

1. **Every session is phone-reachable automatically.** You never have to remember to turn it on; it starts with Claude Code.
2. **The red error is gone for good**, because this skill removes the specific settings that cause it.
3. **You have actually done it once.** The setup only ends when you send a message from your phone and watch it land on your computer screen.

## Set expectations (read this first)

Claude runs every command here. Your jobs: watch, answer two or three plain questions, sign into the Claude app on your phone, and send one test message at the end. Partway through, Claude Code has to be fully restarted in a brand-new session; that is normal and expected, the fix only loads on a fresh start.

One honest sentence before anything changes: part of this fix removes a privacy setting that stops usage analytics from being shared with Anthropic. Remote Control depends on the service that setting turns off, so there is no way to have both. Claude says this out loud before removing it, and only proceeds on your okay.

---

## Already working? Start here

Claude checks first, inside the current session, by looking at the settings before touching anything:

```bash
claude doctor
```

If Remote Control already initializes cleanly and starts automatically, skip to Step 6 (the phone walkthrough) and just finish the test message. Otherwise, run the steps in order.

---

## The steps, in order

### Step 1: Find what is blocking it

The red banner has a short list of known causes. Claude checks them in this order and reports what it found in plain words before changing anything.

**1a. The blocking privacy settings.** Any one of these four being set anywhere blocks Remote Control: `DISABLE_TELEMETRY`, `DO_NOT_TRACK`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, `DISABLE_GROWTHBOOK`. Claude checks all the places they can live:

```bash
# the live environment
env | grep -E "DISABLE_TELEMETRY|DO_NOT_TRACK|NONESSENTIAL_TRAFFIC|GROWTHBOOK"
```

Plus the `"env"` block of each settings file that exists: the project's own `.claude/settings.json` and `.claude/settings.local.json`, and the personal `~/.claude/settings.json`. **If your second brain was set up from the standard template before late August 2026, the project's `.claude/settings.json` contains `"DISABLE_TELEMETRY": "1"` — that single line is the whole problem.** This is the most common cause by far; check it first and expect to find it.

**1b. How you are signed in.** Remote Control only works when Claude Code is signed in with your claude.ai account (Pro, Max, Team, or Enterprise). An API key can never work, no matter what else is fixed. If the environment has `ANTHROPIC_API_KEY` set, or login was done with a long-lived token, that is the blocker.

**1c. A rerouted connection.** If `ANTHROPIC_BASE_URL` is set to anything, Remote Control is blocked. It must be unset.

**1d. Everything else.** If 1a–1c come up clean, run the fuller in-session checkup by typing `/doctor` inside Claude Code (the in-session version can also fix what it finds; the command-line `claude doctor` is a lighter check and may print nothing under its Remote Control heading even when something is wrong). What is left is almost always an expired sign-in, a plan or organization restriction, or a firewall, each covered in the snag list.

### Step 2: Remove the blockers

For each blocking setting found in 1a: say the one-sentence privacy tradeoff, get the user's okay, then remove that line from the settings file it lives in (or tell them where it is set in their shell profile and remove it there). Edit only the lines found; leave the rest of each settings file exactly as it is.

For 1b: run `/login` and have the user choose the claude.ai sign-in (not the API key path). If the plan check still fails after a clean login, sign fully out and back in to refresh what the account is entitled to:

```bash
claude auth logout
claude auth login
```

For 1c: remove the `ANTHROPIC_BASE_URL` setting wherever it is defined.

**If the user is on a Team or Enterprise plan and doctor says the organization has Remote Control disabled:** this is the one thing Claude cannot fix from here. The account owner has to flip one switch. Hand the user this, ready to send:

> "Can you enable Remote Control for our workspace? It's one toggle at claude.ai/admin-settings/claude-code — takes ten seconds."

Then stop gracefully and tell the user to run this skill again once the owner has done it. Everything already fixed stays fixed.

### Step 3: Turn it on for every future session

Add one line to the personal settings file `~/.claude/settings.json` (create the file with just this if it does not exist):

```json
"remoteControlAtStartup": true
```

This is what makes it automatic: from now on, every Claude Code session announces itself to your phone without you doing anything.

### Step 4: Fully restart Claude Code

Close Claude Code and start a brand-new session. Not a window reload; an actual fresh start. The settings changes above do nothing until this happens. In the new session the footer shows an `rc` indicator instead of the red banner.

### Step 5: Keep the computer awake

Your phone can only reach a computer that is on and awake. A laptop that goes to sleep takes your remote session down with it. Claude sets the machine to stay awake while plugged in (battery behavior stays untouched):

**Mac:**

```bash
sudo pmset -c sleep 0
```

**Warn the user before running the Mac command:** it asks for their own computer login password, typed into the terminal, where nothing appears on screen as they type. That blank-looking prompt is normal. If they would rather not, this step is optional; skipping it just means they must keep the lid open and the computer awake themselves.

**Windows (PowerShell):**

```powershell
powercfg /change standby-timeout-ac 0
```

Say it plainly to the user: "Leave the computer plugged in and lid open when you want to reach it from your phone."

### Step 6: Phone in hand (this is the finish line)

1. Install the **Claude** app on the phone (App Store or Google Play) if it is not there already.
2. Sign in with the **same account** used on the computer. A different account sees nothing.
3. Tap the **Code** tab. The computer's session appears with a small computer icon and a green dot.
4. Open it and send one short message, anything at all.
5. Watch it arrive on the computer screen.

**Done means that message landed while the user watched.** If it has not landed, the setup is not done; go to the snag list. Do not report success on anything less than the test message arriving.

Two useful things to mention once it works, then stop:

- The phone can also attach photos, switch models, and approve Claude's permission questions.
- The same sessions are visible at **claude.ai/code** in any browser, which is handy on a tablet or someone else's computer.

---

## If you hit a snag

### The red banner is still there after the fix

Almost always one of two things: the restart in Step 4 was a window reload, not a true fresh start (close Claude Code completely and reopen), or a blocking setting still lives somewhere Step 1a did not look, usually the shell profile. Re-run the Step 1a checks in the *new* session; if `env` still shows one of the four names, it is being set by the shell profile file, find and remove it there.

### "Please run /login" or the error came back days later

The sign-in expired or was done with a long-lived token. Run `/login`, choose the claude.ai option, then `/remote-control`. Long-lived tokens created with `claude setup-token` do not work with Remote Control; a normal `/login` does.

### Doctor says the plan does not support it

If the user genuinely has Pro, Max, Team, or Enterprise, the entitlement is stale: `claude auth logout`, then `claude auth login`. If they are signed in with a work account on Team/Enterprise, see the account-owner branch in Step 2.

### The phone app shows no sessions

The phone is signed into a different account than the computer, the computer session is not running, or the computer went to sleep. Check all three in that order. Sessions only appear while the computer-side session is alive and awake.

### Notifications never arrive on the phone

Open the Claude app once so it re-registers itself. On iPhone, check Settings → Notifications → Claude (Focus modes silence it). On Android, exempt Claude from battery optimization.

### It fails only on office Wi-Fi or on a VPN

A firewall or proxy is blocking the connection to Anthropic. Claude retries for about three minutes and then gives up. Test once on a phone hotspot: if it works there, the network is the blocker and the office IT person needs to allow outbound connections to api.anthropic.com.

### Windows: a trust question keeps appearing

Claude Code must be started from inside the project folder (the second brain), not from the home folder, and the "do you trust this folder" question answered yes once. Trust from the home folder is never saved.
