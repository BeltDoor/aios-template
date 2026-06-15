---
name: install-playwright
description: Install the standard King Intelligence Playwright browser setup so Claude can drive a real browser for you, with a persistent login profile that keeps you signed into sites like Zoom, LinkedIn, and client portals across sessions. Use when you say "install Playwright", "set up the browser tool", "let Claude use a browser", "get the browser automation working", "connect Playwright", "Claude can't see the page", or when a task needs Claude to log into a website, click around, take screenshots, or stay logged in between sessions, even if you never say the word Playwright.
allowed-tools: Bash, Read, Edit, Write
disable-model-invocation: false
---

# install-playwright

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## What you get

This sets up a real web browser that Claude can drive for you. Once it is in place, Claude can open a website, look at the page, click buttons, type into forms, and take screenshots, all on your behalf.

The most useful part is the persistent profile. You log into a site once (Zoom, LinkedIn, a client portal, whatever you need) and you stay logged in. The next time Claude needs that site, you are already signed in. No re-logging-in every session.

This is the standard King Intelligence setup, the official Microsoft Playwright browser tool, registered inside Claude Code as a tool called "playwright".

## Set expectations (read this first)

Claude runs every command in this guide. You do not need to type anything technical. Your only jobs are to watch, to approve a permission prompt or two when they pop up, and to do the occasional browser login when Claude asks (for example, the first time you point it at a site that needs your password). That is it.

One small thing to know up front: partway through, Claude Code has to be fully restarted in a brand-new session. That is normal and expected, not a sign anything went wrong. The browser tool only loads when a fresh session starts.

---

## Before we start (Claude checks these)

Claude confirms two things are already on the machine:

1. **Node.js and npx.** The browser tool is fetched on demand by a small helper called `npx`, which comes with Node.js. Check it with:

   ```bash
   node --version
   npx --version
   ```

   If either command is not found, install Node.js LTS first, then come back to this skill. Everything here depends on Node being present.

2. **The Claude Code command line works.** The `claude` command needs to run. Check it with:

   ```bash
   claude --version
   ```

   If that prints a version, you are good. If it does not, Claude Code itself needs to be installed or fixed before continuing.

---

## The steps, in order

### Step 1: Pick the persistent-profile folder for this user

This folder is where your logins live, so it is named for this specific computer user. Claude fills in the real username.

- **On Windows:** `C:/Users/<their-username>/.playwright-profile`
  (use forward slashes; the folder is created automatically the first time the browser runs)
- **On Mac:** `~/.playwright-profile`

Claude uses this exact path everywhere `<profile-path>` appears below.

### Step 2: Register the browser tool with Claude Code

This is the one command that wires everything up. It writes the configuration into the correct file (`~/.claude.json`) for you. Do NOT hand-edit `settings.json`; that is the single most common way this breaks (see "If you hit a snag").

```bash
claude mcp add playwright npx @playwright/mcp@latest --user-data-dir=<profile-path> --viewport-size=1440,900 --caps=vision
```

Replace `<profile-path>` with the folder from Step 1.

A note on the three flags, so you know what they do:

- `--user-data-dir` is the persistent login profile. This is the key part: it is what keeps you signed into your sites between sessions.
- `--viewport-size=1440,900` forces a normal desktop-sized page, so sites render the way you would see them on a laptop.
- `--caps=vision` lets Claude actually see the page through screenshots, not just read the underlying text.

The exact `claude mcp add` argument format can vary slightly depending on which version of Claude Code is installed. Some versions need a `--` placed before the flags. If the command above does not register cleanly, check the installed version (`claude --version`) and use the fallback in "If you hit a snag" to write the configuration block directly.

### Step 3: Fully restart Claude Code

Close Claude Code and start a brand-new session. Not a window reload, an actual fresh start of the conversation. The browser tool only loads when a new session begins, so a config change made mid-session does nothing until you restart.

### Step 4: Verify it connected

In the new session, confirm the tool is live:

```bash
claude mcp get playwright
```

Look for `Status: Connected`. You can also type `/mcp` inside Claude to see it listed.

The very first time the browser actually runs, it auto-downloads its own copy of Chromium. There is no separate "playwright install" step to run; just let that first download finish. It can take a minute.

### Step 5: Smoke test

Ask Claude to open a website and take a screenshot, for example navigate to a known URL and capture the page. The first time Claude uses a browser action in a session, a per-call permission prompt appears. Approve it. Once you see a screenshot come back, the setup works.

### Step 6 (optional): Log into the sites you need

Now do the part that makes the persistent profile worth it. Have Claude open the sites you actually use (Zoom, LinkedIn, a client portal, and so on) and log in once. Those logins are saved in your profile folder, so future sessions start already signed in.

---

## If you hit a snag

These are the known issues and their exact fixes. If you see one of these, this is what to do.

### The Playwright tools don't show up after install

You almost certainly edited `~/.claude/settings.json` instead of `~/.claude.json`. The browser tool ONLY loads from `~/.claude.json`. Using `claude mcp add` (Step 2) avoids this entirely, which is exactly why we use it. The fix is to register through `claude mcp add` rather than hand-editing any settings file.

### A config change mid-session did nothing

The browser tool only loads when a session starts. Restart Claude Code in a brand-new conversation and the change takes effect.

### "Browser is already in use ... use --isolated" or "Target page/browser closed"

A leftover Chrome is still holding onto the profile folder (a lock). The fix is to kill ONLY the Playwright Chrome processes, then try the action again.

On Windows PowerShell:

```powershell
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*playwright-profile*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

Then delete these two lock files inside the profile folder and try again:

- `.playwright-profile/SingletonLock`
- `.playwright-profile/SingletonCookie`

**Do NOT use `--isolated` to fix this.** `--isolated` starts a clean profile with none of your saved logins, which defeats the entire point of the persistent profile.

### A local HTML file won't open ("file: URLs are blocked")

Playwright blocks `file:` URLs. To view a local HTML file, serve it over a tiny local web server and open the `http://localhost` address instead.

### Only one Claude can use the browser at a time

The profile can only be used by one Claude instance at once. If a second Claude tries to use the browser while another already has it, the second one gets the "already in use" error above. Close or finish the first one.

---

## Fallback if the CLI registration won't take

If `claude mcp add` in Step 2 fails (usually a version-syntax difference), write the configuration block directly into `~/.claude.json`. Under `"mcpServers"`, add:

```json
"playwright": {
  "command": "npx",
  "args": [
    "@playwright/mcp@latest",
    "--user-data-dir=<path>",
    "--viewport-size=1440,900",
    "--caps=vision"
  ]
}
```

Replace `<path>` with the profile folder from Step 1. Then do a full restart (Step 3) and verify (Step 4). Remember: this goes in `~/.claude.json`, never `settings.json`.

---

## Fallback Mode 2: browser extension (not the default)

There is a second way to run Playwright, called extension mode (`--extension`). Use it ONLY as a fallback for sites with heavy single-sign-on, multi-factor authentication, or CAPTCHA that the persistent profile cannot get through. Instead of opening its own browser, this mode drives the Chrome you already have open, through a small unpacked extension. It is not the default and you should not reach for it unless the persistent-profile setup above genuinely cannot log into a specific site. For anything not in that situation, verify on the client's machine which path works for that site before switching modes.
