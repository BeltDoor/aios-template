---
name: install-microsoft
description: Set up the Microsoft / Outlook tool so Claude can read, draft, and send the user's Outlook email and create, update, and delete their calendar events. This installs the Microsoft Graph PowerShell SDK (Connect-MgGraph plus the Mg- cmdlets), the Microsoft-side equivalent of the Google gws tool. Use when the user says "connect my Outlook", "set up Microsoft", "install Microsoft 365", "hook up my work email", "connect Outlook so you can send email and manage my calendar", "my email is on Microsoft / Outlook", or types /install-microsoft, and lean toward firing it whenever a new Outlook or Microsoft 365 user needs Claude wired into their email and calendar, even if they never name the skill.
disable-model-invocation: false
allowed-tools: Bash
---

# /install-microsoft: connect Outlook email and calendar

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## What you get

When this is done, Claude can fully run your Outlook for you: read your email for context, draft replies straight into your Outlook Drafts, send email on your say-so, and create, move, or cancel events on your calendar. This is the Microsoft side of the same setup Google users get. It is the only Microsoft path that does the whole job, both reading AND writing email plus full calendar control. The one-click Microsoft connector can only read, the lighter command-line tool cannot draft email or touch your calendar, and the older one is being shut down, so this is the right tool.

## Set expectations (say this to the client up front)

Claude drives this whole thing in the terminal. Your only job is one or two quick browser logins, the same kind of Microsoft sign-in you do every day. Microsoft is finicky about this connection, so the sign-in step may loop and ask you to log in a second time before it sticks. That looping is normal and expected, not a sign anything is broken. Just complete the next login when it asks. The whole thing usually takes a few minutes.

## Before you start (prerequisites)

Check and handle these first.

1. The client's primary email is on Microsoft 365 / Outlook (not Gmail). Confirm this before doing anything else.
2. Claude Code is running on the client's own machine.
3. PowerShell 7 (the `pwsh` command) is installed. Microsoft recommends PowerShell 7 or newer for the Microsoft.Graph module. Check for it and install it if it is missing (see Step 2). Older Windows PowerShell 5.1 is the bare minimum but PowerShell 7 is what we want.
4. No custom Microsoft / Azure app registration is needed. The default Connect-MgGraph login uses Microsoft's own built-in app, and the email and calendar permissions we ask for are ones a normal user is allowed to approve on their own.

## The steps, in order

### Step 1 — Confirm this is a Microsoft / Outlook shop

Ask the client to confirm their main work email is Microsoft 365 / Outlook, not Gmail. If it is Gmail, stop, this is the wrong tool (use the Google connection instead).

### Step 2 — Make sure PowerShell 7 is installed AND find where it lives

Check whether PowerShell 7 is present:

```bash
pwsh --version
```

If that prints a version, you are good, move on. If the command is not found, install PowerShell 7. The standard way on Windows is winget:

```bash
winget install --id Microsoft.PowerShell --source winget
```

If winget is not available on this machine, use Microsoft's official PowerShell installer instead (verify the right download for the client's machine rather than guessing).

**Critical: do NOT assume `pwsh` is callable in the same shell right after install.** winget installs it fine, but the PATH in your current shell is stale, so `pwsh` will often still be "command not found" until a new terminal opens. Don't fight it. Resolve the real path once and use that for every later step:

```bash
where.exe pwsh 2>/dev/null || echo "$LOCALAPPDATA\\Microsoft\\WindowsApps\\pwsh.exe"
```

Use whatever that returns (call it `PWSH` from here on). On a freshly-installed machine that's almost always `%LOCALAPPDATA%\Microsoft\WindowsApps\pwsh.exe`. Confirm it runs before continuing:

```bash
"<PWSH>" --version
```

### Step 3 — Install the Microsoft Graph module

From inside PowerShell, install the module just for this user (no admin rights needed):

```powershell
Install-Module Microsoft.Graph -Scope CurrentUser
```

If it prompts you to trust the PowerShell Gallery, or to install the NuGet provider, accept (yes / yes to all). The `-Scope CurrentUser` part is what lets this work without administrator access.

### Step 4 — First-time sign-in via the persistent connector

A plain `Connect-MgGraph -Scopes ...` does NOT remember the login across fresh PowerShell sessions in an agent context, so the client ends up re-logging-in every single time (this cost a client several hours before we fixed it). Use the connector script that ships with this skill instead. It saves the login once and silently reconnects forever after.

**Warm the client up before you start the login, because the code window is short (about 120 seconds).** Say this to them: "In a second a short code is going to appear. The clock on it is tight, about two minutes, so let's get you ready first. Open this page now and have it sitting open: https://microsoft.com/devicelogin . When I give you the code, you'll paste it there, sign in, and approve. We're not racing, we just want you ready before the code appears."

Once they confirm the device-login page is open and they're ready, run the one-time login (use the `PWSH` path from Step 2):

```bash
"<PWSH>" -File "${CLAUDE_PLUGIN_ROOT}/skills/install-microsoft/scripts/graph-connect.ps1" -Login
```

A short code prints in the terminal. Tell the client exactly where it is, have them paste it on the device-login page they already have open, sign in, and approve the access request. On success the script prints `LOGIN_OK`.

(If the client's account is a locked-down managed tenant and `organizations` is rejected at this first login, re-run with their tenant GUID: add `-TenantId "<guid>"`. See the managed-account snag below.)

### Step 5 — Expect a second round (this is normal)

Microsoft will often ask the client to sign in again, a "round 2." When it does, have the client repeat the same thing: take the new code, enter it on the device-login page, and approve. Do not treat this re-prompt as a failure. It is expected behavior with Microsoft. Just walk the client through the next login round until you see `LOGIN_OK`.

### Step 6 — Prove the login actually persists (the real test)

This is the step that proves the hours-long problem is gone. Open a **brand-new** PowerShell process (a fresh shell, not the one you logged in from) and run the connector in reconnect mode:

```bash
"<PWSH>" -File "${CLAUDE_PLUGIN_ROOT}/skills/install-microsoft/scripts/graph-connect.ps1" -Test
```

If it prints `RECONNECT_OK` with **no new code and no browser**, the persistent login works and Claude can use Outlook headlessly from now on. If it instead asks for a code, the save didn't take, go back to Step 4. From here on, every script that uses Graph dot-sources the connector and calls `Connect-KIGraph` first:

```powershell
. "<path>\graph-connect.ps1"; Connect-KIGraph; <Mg cmdlets>
```

### Step 7 — Prove read/write works (definition of done)

Have Claude save a TEST DRAFT into the client's Outlook Drafts. Wrap the call in the connector's retry helper, because Microsoft commonly throws a transient 503 / GatewayTimeout / "Cannot query rows in a table" on the first read or write right after a connect. Those clear on a retry and are NOT real failures:

```powershell
. "<path>\graph-connect.ps1"; Connect-KIGraph
Invoke-KIGraphRetry { New-MgUserMessage -UserId "<client-email-or-UPN>" -Subject "King Intelligence test draft" -Body @{ ContentType = "Text"; Content = "This is a test draft created by Claude to confirm the Outlook connection works." } -ToRecipients @(@{ EmailAddress = @{ Address = "<client-email-or-UPN>" } }) }
```

Then have the client open Outlook on the WEB (Outlook online in a browser, not only the desktop app) and confirm the draft is sitting in their Drafts folder. **A draft that lands in Drafts is the definition of done** — it proves the read AND write path.

Sending a test email is optional and OFF by default. Some clients (and some agent setups) have a hard no-send rule, so do not send unless the client explicitly okays it. If they do want the extra confirmation, have them send the draft from Outlook web themselves and confirm it arrives.

### Step 8 — Record it

Write into the client's CONNECTIONS notes that Outlook is now fully live: read, draft, and send email plus full calendar (create / update / delete events), all via the Microsoft Graph PowerShell SDK. Note the date.

## The core commands Claude uses after the one-time login

After the client logs in once, every Graph script starts by dot-sourcing the connector and calling `Connect-KIGraph` (silent, no code), then runs the cmdlets below. `UserId` is always the client's own email address (their UPN). Wrap the first read/write after a connect in `Invoke-KIGraphRetry { ... }` to ride out transient Microsoft 503s.

```powershell
. "<path>\graph-connect.ps1"; Connect-KIGraph
Invoke-KIGraphRetry { Get-MgUserMessage -UserId "<client-UPN>" -Top 5 }
```

- `New-MgUserMessage` — save a draft into Outlook Drafts WITHOUT sending it.
- `Send-MgUserMail` — compose and SEND an email.
- `New-MgUserEvent` — create a calendar event.
- `Update-MgUserEvent` — change an existing calendar event.
- `Remove-MgUserEvent` — delete a calendar event.
- `Get-MgUserMessage` — read email (for context).
- `Get-MgUserEvent` — read calendar events (for context).

## If you hit a snag

**Every new session demands another full login (the big one).** If you find yourself asking the client for a fresh code on a machine that already logged in, you are NOT using the connector script, or its saved record didn't take. Plain `Connect-MgGraph` does not persist headlessly: a bare reconnect uses Windows' account broker (WAM) and fails with "a window handle must be configured," `-UseDeviceAuthentication` prints a brand-new code every session, and `Set-MgGraphOption -DisableLoginByWAM $true` does not reliably turn the broker off. The fix is the `graph-connect.ps1` connector (Steps 4 and 6): it saves an AuthenticationRecord on first login and silently mints a token from it after, so `Connect-KIGraph` reconnects with no window and no code. Re-run the `-Login` step once if the record is missing, then confirm with `-Test`.

**"Authentication timed out after 120 seconds due to inactivity."** The device-code window is short. Get the client onto https://microsoft.com/devicelogin and ready BEFORE you generate the code (Step 4), then re-run the `-Login` step. They were just racing the clock, nothing is broken.

**A read or write fails the first time with a 503 / GatewayTimeout / "Cannot query rows in a table."** Transient Microsoft hiccup right after a connect, not a real failure. Wrap the call in `Invoke-KIGraphRetry { ... }` (ships in the connector) and it clears on a retry.

**The sign-in loops and keeps asking the client to log in again (during the first login).** This means the login simply needed more than one round before it took hold. Fix: just finish the next round. Have the client re-enter the new code on the device-login page and approve. This is expected with Microsoft, not a failure.

**Claude says "it doesn't look like we're actually connected yet" but it actually IS connected.** This is a false alarm Claude sometimes raises when the connection already succeeded. Fix: tell Claude it is wrong and to go verify the connection properly. If Claude keeps looping on this, restart Claude Code once. A fresh connection often needs a quick restart before it is picked up.

**Claude is going in circles.** Break the loop with this exact instruction: "no guessing, no assuming, no hallucinating, figure it out, don't come back until you're certain."

**The Outlook desktop app crashes or won't show the new draft.** This happened with a client who had around 10,000 contacts loaded in the desktop app. Fix: do not fight the desktop app. Verify and work against Outlook on the WEB (Outlook online) instead. The draft is there, the desktop app is just struggling to render it.

**A notetaker tool (for example Fyxer) seems to be in the way.** It is not. A notetaker and this Outlook connection do not talk to each other, so a notetaker cannot block or eat the draft. Do not chase this. Just confirm the draft directly in the Drafts folder in Outlook web.

**The one thing you canNOT fix from the client's side.** If the client's Outlook is a locked-down managed work account, their company's IT can block this connection at the company level. You only find this out at the first login, when the approval gets refused. There is no client-side workaround. If you hit this, the client's IT department (their Global Admin) has to grant the approval. Plan around this for any managed corporate account: flag the possibility before you start, so a blocked login isn't a surprise.