---
name: refresh-passwords
description: Top up the website passwords Claude's browser can use, so it stops getting stuck on logins for accounts you opened after your setup day. Claude walks you through exporting your current passwords, trims them to your business sites only, loads them into every one of Claude's browsers, then deletes the export and proves it is gone. Takes about two minutes. Use when you say "refresh my passwords", "update Claude's passwords", "Claude can't log in", "the login isn't filling in", "it doesn't know my password", "I signed up for a new tool", "I changed my password", or type /refresh-passwords. Also run after adding a new website or service you want Claude working in.
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion
disable-model-invocation: false
---

# /refresh-passwords: top up what Claude's browser can log into

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## Why this exists

Your passwords were moved into Claude's browser once, on the day it was set up. That was a snapshot. Every account you have opened since then, and every password you have changed since then, is invisible to Claude, so one day it hits a login it cannot fill and the whole setup looks broken. It is not broken, it is just out of date.

This tops it up. Two minutes, and it can be run as many times as you like.

## When to run it

**When the owner asks.** Any of the trigger phrases above.

**Or the one moment Claude may bring it up unprompted:** Claude has just failed to fill in a login and the owner is watching it fail. In that moment, and only that moment, say one line and stop:

> "The passwords I have are from your setup day, so I don't have this one. Want me to pull your current ones over? Takes about two minutes."

Then wait. Do not raise it on a schedule, do not raise it at the start of a session, do not raise it when nothing is wrong, and do not raise it twice in a session if the answer was no.

## The safety rules, said out loud to the owner

These are the same rules as the original handoff, and they are not optional.

- **Business sites only, never banking.** Bring over the sites Claude will actually work in. Never a bank, never anything the owner would not hand a trusted assistant. Be straight about why: passwords in Claude's browser are protected about as well as any private file on that computer. Better than a written-down list, not as strong as the vault in their everyday browser. The trim is the real protection, because a problem on that computer could only ever expose the short business list.
- **The export file lives for minutes, not hours.** It is the most sensitive file that will ever sit on that machine. Created, trimmed, loaded, deleted, in one sitting. If this run is interrupted partway, deleting the export files is the first thing to do before anything else.
- **The export click is always the owner's hands.** Their computer will ask them to confirm with their own login or fingerprint. Never automate that, never ask them to read a password out loud, never ask them to paste one into the chat.
- **Never print a password.** Not to the screen, not into a file, not into the transcript. The script in this skill is built so it cannot, and that guarantee only holds if you use the script instead of doing it by hand.

## The run

### 1. Get the site list

Look for a stored list first:

```bash
cat "${CLAUDE_PLUGIN_DATA}/browser-sites.txt" 2>/dev/null
```

If it exists, read it back to the owner in plain words and ask if anything should be added or dropped. If it does not exist, ask: "Which websites do you want me able to log into?" Usually 5 to 15. Then save it, one domain per line:

```bash
mkdir -p "${CLAUDE_PLUGIN_DATA}" && printf '%s\n' linkedin.com zoom.us > "${CLAUDE_PLUGIN_DATA}/browser-sites.txt"
```

Saving it is the point. It means the second run of this skill never re-asks.

### 2. Find out which browsers exist

```bash
claude mcp get playwright; claude mcp get playwright-2; claude mcp get playwright-3
```

Note which are registered. Every one that exists gets the passwords in step 5. If only `playwright` exists, offer the extra two as a separate job afterwards, do not fold it into this run.

### 3. The owner exports their current passwords

Their hands, you navigate them there with words. Save it to the Desktop.

- **Chrome, Edge, Brave:** Settings, then Passwords (Chrome puts it under "Autofill and passwords", Edge calls it "Wallet"), then the three-dot menu next to Saved Passwords, then Export passwords.
- **Safari:** Safari menu, Settings, Passwords, unlock, the three-dot menu at the bottom, Export All Passwords.
- **Firefox:** type `about:logins` in the address bar, three-dot menu top right, Export Logins.
- **1Password:** open the app, File or the account menu, Export, choose CSV. (If they have 1Password, mention once that there is a better setup where nothing ever goes stale, and leave it there. Do not sell it mid-run.)
- **LastPass:** the extension, Account, Advanced, Export. It arrives as a CSV the same as the rest.
- **Bitwarden:** the extension, Settings, Export vault, format CSV.

All of these produce the same thing: a spreadsheet-style list of site, username and password.

### 4. Trim it to the business list

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/passwords.mjs" trim \
  "<the exported file>" "<same folder>/passwords-for-claude.csv" \
  $(tr '\n' ' ' < "${CLAUDE_PLUGIN_DATA}/browser-sites.txt")
```

It prints counts only, never contents. Read the counts back to the owner. It also rewrites the column names to the ones a browser's importer actually accepts, which is what makes a Safari, 1Password, LastPass or Bitwarden export work at all: each of those names its columns differently, and an importer silently refuses a file whose columns it does not recognise. Entries with no password saved (a passkey, or a note) are dropped and counted, because importing a blank password is worse than importing nothing. If it names a site it found no login for, say so plainly: that site will still not fill in, and the reason is that there is no saved password for it to copy. Do not guess at why.

If it stops with NOTHING WAS KEPT, do not continue. The site list and the export do not match up, usually because the export came from a different browser than the one holding those logins.

### 5. Load it into each of Claude's browsers

Do this once per browser that exists. Use `playwright` first, then `playwright-2`, then `playwright-3`.

1. Navigate that browser to `chrome://password-manager/settings`.
2. Click **Select file** under "Import passwords". Click it **once**. It opens a file-picking window on the owner's screen that Claude cannot drive, by design.
3. Tell them: "A file window just opened. Pick passwords-for-claude.csv and click Open."
4. Verify at `chrome://password-manager/passwords` and report the count.

**Load into each browser separately. Never copy the password file from one browser's folder into another's.** On Windows each browser scrambles its saved passwords with its own key, so a copied file arrives unreadable, and on any machine a folder copy can wipe logins the other browsers had collected on their own. Importing per browser is both safe and correct everywhere.

If a browser is in use by another conversation, skip it, finish the others, and say which one was skipped and why.

### 6. Delete the export files and prove it

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/passwords.mjs" shred \
  "<the exported file>" "<same folder>/passwords-for-claude.csv"
```

This deletes them and then checks they are actually gone. It refuses to claim success if it cannot prove it. Say the result to the owner in one line. Also check the Downloads folder, because some browsers save the export there instead of where the owner chose.

### 7. Prove the whole thing worked

Open a login page for one of the sites that was just loaded, in the `playwright` browser. The fields should fill themselves. This is the only step that proves the run did anything, so do not skip it and do not report success without it.

If the site asks for a code from their phone, that is normal and it is their job. Codes are usually only asked once per browser.

## When autofill still will not offer a password

Do not ask the owner for the password and do not go hunting for it. Open `chrome://password-manager/passwords` in that browser, find the entry, and tell them: "Click the copy button next to the password, your computer will ask you to confirm, then click into the login box and paste." It goes from the browser's own store to the site directly. It never passes through the chat and they never have to know it.

## Snags

**"You're already importing passwords in another tab."** A previous import was left half finished, usually because Select file was clicked twice. The import stays jammed until the browser fully restarts. Close that Playwright browser completely, reopen, and click Select file once.

**The count came up short after an import.** Entries whose address is not an ordinary `https://` website are silently refused by the browser. The trim step already reports how many of those it dropped, so compare against that number before treating it as a fault.

**The file window never appeared.** It may be behind other windows. Have the owner click the Claude browser window first. Do not click Select file again until they have looked, because a second click is what causes the jam above.

**Viewing or deleting a saved entry asks for their computer's login password.** That prompt comes from their operating system, not from the browser, and Claude cannot answer it and must never try. Importing does not trigger it, which is why the run above works. If an entry needs to be inspected or removed, that is the owner's hands on their own keyboard, and it is fine to say so plainly rather than working around it.

**A password fills in but the site rejects it.** That password has been changed since the export, or there are two saved entries for that site. Open `chrome://password-manager/passwords`, look at the entry, and have the owner fix or delete the wrong one. Do not let it retry into a lockout.
