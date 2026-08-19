---
name: install-playwright
description: Install the standard King Intelligence browser setup so Claude can drive a real browser for you. Three browsers with a persistent login profile, plus an optional password handoff that moves your saved website passwords into Claude's browser so you never have to remember or type them. Use when you say "install Playwright", "set up the browser tool", "let Claude use a browser", "get the browser automation working", "connect Playwright", "Claude can't see the page", "Claude needs my passwords", "I don't know my password", or when a task needs Claude to log into a website, click around, take screenshots, or stay logged in between sessions, even if you never say the word Playwright. Also run it again on a machine that already has it installed to add the newer pieces (the extra browsers, the password handoff).
allowed-tools: Bash, Read, Edit, Write
disable-model-invocation: false
---

# install-playwright

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## What you get

This sets up a real web browser that Claude can drive for you. Once it is in place, Claude can open a website, look at the page, click buttons, type into forms, and take screenshots, all on your behalf.

Three things make this setup worth doing properly:

1. **A persistent profile.** You log into a site once (Zoom, LinkedIn, a client portal, whatever you need) and you stay logged in. The next time Claude needs that site, you are already signed in.
2. **Three browsers, not one.** Only one Claude conversation can use a browser at a time. With three identical browsers registered (`playwright`, `playwright-2`, `playwright-3`), a second conversation grabs the next one instead of waiting.
3. **The password handoff (optional but recommended).** Your website passwords live in your everyday browser, and like most people you probably do not know them by heart. This step moves the ones Claude needs into Claude's browser, so logins fill themselves in and you never type a password for Claude again.

This is the standard King Intelligence setup, the official Microsoft Playwright browser tool, registered inside Claude Code.

## Set expectations (read this first)

Claude runs every command in this guide. You do not need to type anything technical. Your jobs are: watch, approve a permission prompt or two, click a few buttons in your own browser when Claude asks (the password export is deliberately your hands, not Claude's), and be nearby for any site that texts you a login code. That is it.

One small thing to know up front: partway through, Claude Code has to be fully restarted in a brand-new session. That is normal and expected, not a sign anything went wrong. The browser tools only load when a fresh session starts.

---

## Already installed? Start here

Claude checks first:

```bash
claude mcp get playwright
```

- **If that says Connected**, the base install is already done. Skip the install steps and offer the upgrades, in this order:
  1. **Add the extra browsers** if `claude mcp get playwright-2` comes back empty (Steps 1 and 2 below, for the missing ones only, then the restart).
  2. **The password handoff** (Step 6) if it has never been run here.
  3. **The profile clone** (Step 8) so all three browsers share the same logins.
- **If it is not registered**, do the full install from Step 1.

---

## Before we start (Claude checks these)

1. **Node.js and npx.** The browser tool is fetched on demand by a small helper called `npx`, which comes with Node.js:

   ```bash
   node --version
   npx --version
   ```

   If either is missing, install Node.js LTS first, then come back.

2. **The Claude Code command line works:**

   ```bash
   claude --version
   ```

   If that prints a version, you are good.

3. **Which browser holds the user's passwords.** Ask, or check what their default browser is. Chrome, Edge, and Brave all export the same way; Safari and Firefox have their own paths (covered in Step 6). This also matters for the "your main browser stays untouched" promise below.

---

## Your main browser stays untouched (the promise, and how we keep it)

Claude's browser is the same Chrome program you may already use, but pointed at its own separate storage folders (the `.playwright-profile` folders). Your own Chrome profile, history, extensions, and logins are never opened, never read, and never changed by this setup.

Two practical things follow from that, and Claude says both out loud to the user during setup if their everyday browser is Chrome:

- **You will sometimes see two Chrome windows that look identical.** The one Claude opened is Claude's. If you are ever unsure which is which, close nothing and just ask Claude, it can tell you exactly which windows it owns.
- **Every cleanup or fix command in this guide is scoped to the playwright profile folders by name.** If a troubleshooting step ever proposes closing or killing a browser process and the command does not contain the text `playwright-profile`, do not run it. That filter is what guarantees the user's real browser is never the one that gets closed.

---

## The steps, in order

### Step 1: Pick the persistent-profile folders for this user

Three folders, one per browser. They are named for this specific computer user, and they are created automatically the first time each browser runs. Claude fills in the real username.

- **On Windows:** `C:/Users/<their-username>/.playwright-profile`, `.playwright-profile-2`, `.playwright-profile-3` (use forward slashes)
- **On Mac:** `~/.playwright-profile`, `~/.playwright-profile-2`, `~/.playwright-profile-3`

Claude uses these exact paths everywhere `<profile-path>` appears below.

### Step 2: Register the three browser tools with Claude Code

Three commands, identical except for the name and folder. They write the configuration into the correct file (`~/.claude.json`) for you. Do NOT hand-edit `settings.json`; that is the single most common way this breaks (see "If you hit a snag").

```bash
claude mcp add playwright npx @playwright/mcp@latest --user-data-dir=<profile-path> --viewport-size=1440,900 --caps=vision
claude mcp add playwright-2 npx @playwright/mcp@latest --user-data-dir=<profile-path>-2 --viewport-size=1440,900 --caps=vision
claude mcp add playwright-3 npx @playwright/mcp@latest --user-data-dir=<profile-path>-3 --viewport-size=1440,900 --caps=vision
```

A note on the three flags, so you know what they do:

- `--user-data-dir` is the persistent login profile. This is the key part: it is what keeps you signed into your sites between sessions.
- `--viewport-size=1440,900` forces a normal desktop-sized page, so sites render the way you would see them on a laptop.
- `--caps=vision` lets Claude actually see the page through screenshots, not just read the underlying text.

**How Claude picks a browser from now on:** use `playwright` first. Reach for `playwright-2` or `playwright-3` only when the one you want is already in use by another conversation. After Step 8 all three carry the same logins, so any of them can do any job.

The exact `claude mcp add` argument format can vary slightly depending on which version of Claude Code is installed. Some versions need a `--` placed before the flags. If the command does not register cleanly, check the installed version (`claude --version`) and use the fallback in "If you hit a snag" to write the configuration block directly.

### Step 3: Fully restart Claude Code

Close Claude Code and start a brand-new session. Not a window reload, an actual fresh start of the conversation. The browser tools only load when a new session begins, so a config change made mid-session does nothing until you restart.

### Step 4: Verify they connected

In the new session:

```bash
claude mcp get playwright
claude mcp get playwright-2
claude mcp get playwright-3
```

Look for `Status: Connected` on each. You can also type `/mcp` inside Claude to see them listed.

The very first time a browser actually runs, it auto-downloads what it needs. There is no separate "playwright install" step; just let that first download finish. It can take a minute.

### Step 5: Smoke test

Ask Claude to open a website and take a screenshot using the `playwright` browser. The first time Claude uses a browser action in a session, a per-call permission prompt appears. Approve it. Once you see a screenshot come back, the setup works.

### Step 6: The password handoff (recommended)

This is the step that ends "I don't know my password" forever. It moves the passwords Claude needs out of your everyday browser and into Claude's browser, where they autofill on login pages exactly like they do in your normal browser.

**The safety rules of this step, stated up front and repeated to the user in plain words:**

- **Business sites only, never banking.** Bring over the sites Claude will actually work in: your scheduling tool, your website login, LinkedIn, client portals, that kind of thing. Never your bank, never your personal email password manager, nothing you would not hand a trusted assistant. Be straight with the user about why: passwords in Claude's browser are protected about as well as any private file on this computer, better than a written-down list, not as strong as the vault in their everyday browser. The trim is the real protection: a problem on this computer could only ever expose the short business list, not their life.
- **The export file lives for minutes, not hours.** The exported password file is the most sensitive file that will ever sit on this computer. It gets created, trimmed, imported, and deleted inside one sitting, and Claude verifies the deletion at the end. If anything interrupts this step partway, deleting the export files is the first thing Claude does before continuing.
- **The export click is always the user's hands.** Their computer will ask them to confirm with their own login or fingerprint. Claude never automates that, and never asks them to read a password out loud or paste one into the chat.

**6a. Pick the sites.** Ask the user: "Which websites will you want me working in?" Write the list down (usually 5 to 15 domains). This list drives the trim in 6c.

**6b. Export from their everyday browser (their hands, Claude navigates them there with words):**

- **Chrome, Edge, or Brave:** Settings → Passwords (in Chrome it is inside "Autofill and passwords", in Edge "Wallet", in Brave "Autofill and passwords") → find "Export passwords" (usually behind a ⋮ three-dot menu next to Saved Passwords) → Export. The computer asks them to confirm with their system password or fingerprint. Save the file to the Desktop.
- **Safari (Mac):** Safari menu → Settings → Passwords → unlock → the ⋯ menu at the bottom → Export All Passwords → save to Desktop.
- **Firefox:** type `about:logins` in the address bar → the ⋯ menu top right → Export Logins → save to Desktop.

All of these produce the same kind of file: a spreadsheet-style list (CSV) with columns for site, username, and password.

**6c. Trim it to just the chosen sites.** Claude does this with a small script, and the script must never print the password column to the screen, the chat, or any log. Pattern (adjust the filename and domain list):

```bash
python3 - <<'PYEOF'
import csv
keep_domains = ["example.com", "linkedin.com", "zoom.us"]  # the user's list from 6a
src = "/Users/<their-username>/Desktop/passwords.csv"      # the export from 6b
dst = "/Users/<their-username>/Desktop/passwords-for-claude.csv"
kept = 0
with open(src, newline="", encoding="utf-8-sig") as f, open(dst, "w", newline="", encoding="utf-8") as out:
    r = csv.DictReader(f)
    w = csv.DictWriter(out, fieldnames=r.fieldnames)
    w.writeheader()
    for row in r:
        url = (row.get("url") or row.get("web_address") or "").lower()
        if any(d in url for d in keep_domains):
            w.writerow(row)
            kept += 1
print(f"kept {kept} logins for the chosen sites")
PYEOF
```

Report only the count, never the contents.

**6d. Import into Claude's browser.** Claude opens the `playwright` browser, navigates to `chrome://password-manager/settings`, and clicks the **Select file** button under "Import passwords". That click opens a normal file-picking window on the user's screen, which Claude cannot drive, and that is by design. Tell the user: "A file window just opened. Pick the file called passwords-for-claude.csv on your Desktop and click Open." Click **Select file** once and only once; if the window did not appear, check behind other windows before clicking again (a half-finished import attempt can jam the import feature, see the snag list). Then verify the import took: open `chrome://password-manager/passwords` and confirm the sites are listed. Report the count to the user. If the count comes up short, the missing rows almost certainly have unusual site addresses (anything that is not a normal `https://` website is silently skipped by the import).

**6e. Delete both files, immediately, and prove it.**

```bash
rm "/Users/<their-username>/Desktop/passwords.csv" "/Users/<their-username>/Desktop/passwords-for-claude.csv"
ls "/Users/<their-username>/Desktop/" | grep -i password
```

(Windows: `Remove-Item` on both paths, then `Get-ChildItem` to confirm.) The second command coming back empty is the proof; say so to the user in one line. If the browser saved the export anywhere else (check the Downloads folder too), delete that copy the same way.

**6f. Smoke test the autofill.** Navigate the `playwright` browser to the login page of one of the imported sites. The username and password fields fill themselves in on page load. Click sign in. If the site asks for a code from their phone, that is normal (see the note below), have the user enter it, and the session is then saved in the profile for the future.

**A note on login codes (2FA):** codes texted to a phone or generated by an app stay the user's job, on the user's phone. The password handoff removes the password wall, not the code step. The good news: for most sites the code is only asked on the first login per browser, and after Step 8 the logged-in state carries to all three browsers.

**If autofill does not offer the password on some site:** do not ask the user for the password and do not go digging for it. Open `chrome://password-manager/passwords` in the Playwright browser, click into the entry for that site, and tell the user: "Click the copy button next to the password, your computer will ask you to confirm, then click into the login box on the page and paste." The password goes from Claude's browser vault to the site directly, the user never has to know it, and it never appears in the chat.

### Step 7: Log into anything the vault could not cover

Some sites will still want a first login done by a person (single sign-on, "sign in with Google", unusual flows). Do those now, in the `playwright` browser only, with the user driving the tricky part. Every login done here is saved in the profile.

### Step 8: Clone browser 1 into browsers 2 and 3

This is what makes the three browsers interchangeable: one copy step, and every login and every imported password exists in all three.

First, make sure no Playwright browser is running (close them from Claude, or use the scoped kill from the snag section, which only ever matches `playwright-profile` processes). Then:

**Mac:**

```bash
rm -rf ~/.playwright-profile-2 ~/.playwright-profile-3
cp -R ~/.playwright-profile ~/.playwright-profile-2
cp -R ~/.playwright-profile ~/.playwright-profile-3
rm -f ~/.playwright-profile-2/Singleton* ~/.playwright-profile-3/Singleton*
```

**Windows (PowerShell):**

```powershell
Remove-Item -Recurse -Force "C:/Users/<their-username>/.playwright-profile-2","C:/Users/<their-username>/.playwright-profile-3" -ErrorAction SilentlyContinue
Copy-Item -Recurse "C:/Users/<their-username>/.playwright-profile" "C:/Users/<their-username>/.playwright-profile-2"
Copy-Item -Recurse "C:/Users/<their-username>/.playwright-profile" "C:/Users/<their-username>/.playwright-profile-3"
Remove-Item "C:/Users/<their-username>/.playwright-profile-2/Singleton*","C:/Users/<their-username>/.playwright-profile-3/Singleton*" -ErrorAction SilentlyContinue
```

The copies decrypt fine because the protection is tied to the computer user account, not the folder. Verify by opening a login page of an imported site in `playwright-2`: the fields fill themselves.

**When to re-clone:** if browser 1 later collects important new logins that 2 and 3 need, just repeat this step. Do not re-clone on a schedule; the vault autofill means a missing login in browser 2 costs two clicks, not a password hunt.

---

## If you hit a snag

These are the known issues and their exact fixes.

### The Playwright tools don't show up after install

You almost certainly edited `~/.claude/settings.json` instead of `~/.claude.json`. The browser tool ONLY loads from `~/.claude.json`. Using `claude mcp add` (Step 2) avoids this entirely. The fix is to register through `claude mcp add` rather than hand-editing any settings file.

### A config change mid-session did nothing

The browser tools only load when a session starts. Restart Claude Code in a brand-new conversation and the change takes effect.

### "Browser is already in use ... use --isolated" or "Target page/browser closed"

A leftover browser is still holding onto that profile folder (a lock). First choice: use one of the other two browsers and move on. To actually clear it, kill ONLY the Playwright browser processes, then try again.

On Windows PowerShell:

```powershell
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*playwright-profile*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

On Mac:

```bash
pkill -f "playwright-profile"
```

Then delete the lock files inside that profile folder and try again:

- `.playwright-profile/SingletonLock`
- `.playwright-profile/SingletonCookie`

Both commands are scoped to `playwright-profile` on purpose: they can never touch the user's real browser. Never broaden them.

**Do NOT use `--isolated` to fix this.** `--isolated` starts a clean profile with none of the saved logins, which defeats the entire point of the persistent profile.

### The import file window opened but the user picked the wrong file or cancelled

No harm done. Click **Select file** again and point them at the right file. If the window never appeared, it may have opened behind other windows; have them click the Claude browser window first.

### "You're already importing passwords in another tab"

A previous import attempt was left half-finished (a file window opened and never got an answer, or Select file was clicked more than once). The import feature stays jammed until the browser is fully restarted. Fix: close the Playwright browser completely (the scoped kill above), open it again, go back to `chrome://password-manager/settings`, and click **Select file** once. This was hit in real testing; it looks broken but the restart clears it every time.

### A local HTML file won't open ("file: URLs are blocked")

Playwright blocks `file:` URLs. To view a local HTML file, serve it over a tiny local web server and open the `http://localhost` address instead.

### All three browsers are busy

Rare, but possible with three conversations working at once. Wait for one to finish, or close a conversation you are done with.

---

## Fallback if the CLI registration won't take

If `claude mcp add` in Step 2 fails (usually a version-syntax difference), write the configuration blocks directly into `~/.claude.json`. Under `"mcpServers"`, add one block per browser:

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

Repeat for `playwright-2` and `playwright-3` with their own folders. Then do a full restart (Step 3) and verify (Step 4). Remember: this goes in `~/.claude.json`, never `settings.json`.

---

## Fallback Mode 2: browser extension (not the default)

There is a second way to run Playwright, called extension mode (`--extension`). Use it ONLY as a fallback for sites with heavy single-sign-on, multi-factor authentication, or CAPTCHA that the persistent profile cannot get through. Instead of opening its own browser, this mode drives the Chrome you already have open, through a small unpacked extension. It is not the default and you should not reach for it unless the persistent-profile setup above genuinely cannot log into a specific site. For anything not in that situation, verify on the client's machine which path works for that site before switching modes.
