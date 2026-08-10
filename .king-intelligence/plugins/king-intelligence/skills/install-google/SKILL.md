---
name: install-google
description: Connect the user's Google account so Claude can actually work in Google Drive, Docs, Sheets and Slides instead of guessing. Two parts, and most people only need the first. Part 1 puts Google Drive on the machine as a normal folder, which takes about three minutes and immediately lets Claude read and write every PDF, Word file, spreadsheet and image in their Drive. Part 2 adds a live link to their Google account for native Google Docs, Sheets and Slides, which show up on disk as empty link files and cannot be opened any other way; Claude drives Google's developer console in the browser itself along a click path that was walked and recorded on a real account, so the user only signs in once. Use when the user says "connect my Google Drive", "set up Google", "my company runs on Google Drive", "connect Google Docs", "Claude can't see my Drive", "hook up my Google account", when /map-my-work finds their real work lives in Drive, or when they type /install-google. Not for Gmail alone (that is /install-email) and not for Outlook shops (that is /install-microsoft).
disable-model-invocation: false
---

# /install-google: let Claude work in your Google Drive

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## What you get

By the end of this, Claude can open, read, edit and create the files your business actually runs on, instead of only seeing what happens to sit on your laptop.

There are two parts and **they are not equally hard**. Say so up front.

| | What it gives you | How long | Who needs it |
|---|---|---|---|
| **Part 1 — Drive as a folder** | Claude can read and write every PDF, Word file, Excel file, image and video in your Drive, and it appears in your file map | About 3 minutes, two clicks | **Everyone whose work is in Drive.** Do this one. |
| **Part 2 — the live link** | Claude can also open and edit native Google **Docs, Sheets and Slides** | About 30 minutes, and it is fiddly | Only people whose real work is Google Docs rather than Word |

**Part 1 first, always.** It is most of the value for a fraction of the effort, and Part 2 is easier to judge once they can see Drive working.

## Set expectations (say this before you start)

For Part 1: *"Two clicks and a sign-in you already know. Your files stay where they are, nothing gets downloaded or moved, and your hard drive doesn't fill up."*

For Part 2, be straight with them: *"This one is fiddly. It's about half an hour and it goes through Google's developer settings, which are not built for normal people. I'll drive all of it, you'll click a few buttons and sign in. Worth it if most of your documents are Google Docs. Skip it if your documents are mostly Word and Excel."*

**Do not start Part 2 unless the user is present and staying present.** There is a step in the middle that cannot be skipped or deferred (see the hard gate), and a Part 2 that is abandoned halfway leaves them with a connection that silently dies a week later.

---

# Part 1 — Put Drive on the machine as a folder

## Step 1.1 — Check whether it is already there

Run all of these. The ones that don't exist stay silent:

```bash
ls -d "$HOME"/Library/CloudStorage/GoogleDrive-* 2>/dev/null       # Mac
ls -d "$HOME"/My\ Drive "$HOME"/Google\ Drive 2>/dev/null          # Windows, folder mode
for d in /c /d /e /f /g /h /i /j; do \
  ls -d "$d/My Drive" "$d/Shared drives" "$d/Google Drive" 2>/dev/null; done   # Windows, drive letter
```

**The Windows drive-letter loop is not optional.** Google Drive for Desktop mounts as a lettered drive (usually `G:`) rather than a folder in the home directory, so every other check comes back empty on a Windows machine that has Drive installed and full of work. Skipping it is how you tell someone they have no Google Drive while they are looking at it.

If something comes back, Drive is already connected. Skip to Step 1.4.

## Step 1.2 — Install Google Drive for Desktop

Send them to **google.com/drive/download** and have them install it. It is a normal app installer from Google, the same as installing anything else.

Explain what it is in one line, no jargon: *"It makes your Google Drive show up like a folder on this computer. It doesn't download your files or fill up your hard drive, it shows the names and fetches a file the moment something opens it."*

## Step 1.3 — They sign in

They sign in with **the same Google account they use for work**. If they have more than one Google account, this matters: signing in with a personal Gmail connects a personal Drive with none of the business in it. Ask which account the business lives in before they click.

When it finishes, Drive appears. Re-run the detection block from Step 1.1 and confirm you can see it.

If it doesn't appear, don't loop. Say: *"Drive hasn't finished connecting yet. Close VS Code completely (File then Exit, not the X) and open it again, then say 'try again'."* VS Code only notices new drives when it starts up.

## Step 1.4 — Look inside, and tell them what you found

```bash
ls -d "<the drive root>"/* 2>/dev/null | head -40
```

Google Drive splits in two, and this matters more than it sounds:

- **`My Drive`** is that person's own.
- **`Shared drives`** is the company's, and on a real business account it is usually where the money lives.

Scan both. Never report on `My Drive` alone as though it were the whole picture.

## Step 1.5 — Write it down so no future session has to ask

Add the Drive root to `references/where-my-work-lives.md` under **Where the work really lives** (run `/map-my-work` if that file doesn't exist yet), and add a Google Drive row to `CONNECTIONS.md`. One plain line each. A future session that knows "this company runs on Drive and it's connected as a folder" never wastes a turn hunting the Desktop for something that was never there.

## Step 1.6 — Say the honest limit out loud

Then, and only then, raise Part 2:

> *"One thing you should know: I can read your PDFs, Word files and spreadsheets in Drive now. Anything that's a native Google Doc, Sheet or Slide still shows up here as an empty link file, so I can see the name and nothing else. If a lot of your work is Google Docs, there's a second setup that fixes that. It takes about half an hour and it's fiddly. Worth doing now, or leave it?"*

Count the evidence before you ask, so this is a real question rather than a sales line:

```bash
find "<the drive root>" -type f \( -name "*.gdoc" -o -name "*.gsheet" -o -name "*.gslides" \) 2>/dev/null | wc -l
find "<the drive root>" -type f \( -name "*.pdf" -o -name "*.docx" -o -name "*.xlsx" \) 2>/dev/null | wc -l
```

Tell them the two numbers in plain words. *"You've got about 400 Google Docs and about 60 Word files, so most of your writing is in the half I can't open yet"* is a decision they can make. "Do you want to connect Google?" is not.

**If they say leave it, stop here and mean it.** Part 1 alone is a real result. Do not re-ask later in the session.

---

# Part 2 — The live link (only if they said yes)

This gives Claude a direct connection to their Google account through Google's own command-line tool, which is what makes native Docs, Sheets and Slides readable and writable.

**YOU DRIVE THE CONSOLE, THEY DO NOT.** Every screen below was walked end to end in a real Google Cloud account on 8/9/26 and the exact path recorded, so none of this is guesswork. The member's only job in Part 2 is one Google sign-in and one approval. Do not read these steps aloud as instructions for them to follow; do them.

## Before you start

1. **`/install-playwright` has been run.** That is what gives you the browser. Without it, you are reading a menu to someone over the phone, which is how this takes an hour and still goes wrong. If it isn't installed, run it first.
2. **Node is installed.** Check with `node --version`. It comes with the standard setup.
3. **They are the owner of the Google account, or an admin who can approve apps.** On a locked-down company Google Workspace, an administrator can block third-party access entirely, and you only find out at the sign-in step. If they are on a managed work account and not the admin, say so now rather than 25 minutes in.
4. **They are staying at the keyboard.** Step 2.5 cannot be deferred, and step 2.6 needs their sign-in.

## Step 2.1 — Install Google's own Workspace tool

```bash
npm install -g @googleworkspace/cli
gws --version
```

Published by Google's own `googleworkspace` organisation. Nothing here comes from King Intelligence.

> `gws auth setup` exists and looks like a shortcut. It is not: it requires the `gcloud` SDK, which is a large extra install most members will never otherwise need. The browser path below avoids it entirely.

## How to drive these screens (read this once, it saves the whole run)

Four rules, all learned by getting them wrong on the real console:

1. **Use real browser clicks and typing, never scripted value-setting.** These are Angular forms. Setting a field's value in JavaScript puts the right text on screen and the form still treats it as empty, so the button stays greyed out and nothing tells you why. Click and type like a person.
2. **Navigate by direct link with `?project=<PROJECT_ID>` on the end.** That lands you in the right project every time and skips the whole search-and-drift problem.
3. **The project ID is not the project name.** Google generates the ID: two random words, some digits and a suffix, nothing like the name that was typed. Read it off the project list and use it in every URL.
4. **Check which element you are typing into.** A stale copy of a field can linger in the page while the live one sits inside the dialog. Ten minutes were lost to typing confidently into the wrong box, with the correct text visible on screen the whole time.

## Step 2.2 — Create the project

Go to `https://console.cloud.google.com/projectcreate`, put a name they will recognise (their company plus "AI"), and click **Create**.

**Then find the project ID, because Google will not show it to you.** After Create, the console drops you on some *other* project's dashboard, not the new one. Open `https://console.cloud.google.com/cloud-resource-manager`, expand the organisation row (the button is labelled "Toggle node"), and read the ID from the row next to the name. Hold onto it; every URL below needs it.

## Step 2.3 — Switch on the services

One direct link each. Click **Enable** on each page and wait for it to land on the metrics screen.

```
https://console.cloud.google.com/apis/library/drive.googleapis.com?project=<ID>
https://console.cloud.google.com/apis/library/docs.googleapis.com?project=<ID>
https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=<ID>
https://console.cloud.google.com/apis/library/slides.googleapis.com?project=<ID>
```

Slides only if they use it. **There are two Enable buttons in the page and one of them is invisible**, so pick the one that actually renders rather than the first match.

## Step 2.4 — The consent screen

`https://console.cloud.google.com/auth/overview?project=<ID>` then **Get started**. It is a four-step wizard on one page, and the order matters:

1. **App Information.** App name (their company is fine), then **User support email — this is a dropdown, not a text box.** Open it and pick their address. Skipping it does not complain here; it fails at the very end with "An email address must be selected", after you have filled in everything else. Then **Next**.
2. **Audience.** Choose **External**. This sounds wrong and is right: it only means the app is not restricted to one company's internal directory. On a personal Gmail account External is the only option anyway. Then **Next**.
3. **Contact Information.** Type their email and press Enter so it becomes a chip. Then **Next**.
4. **Finish.** Tick **I agree to the Google API Services: User Data Policy**, then click **Continue**, and only then **Create**.

**That Continue button is the single easiest thing to miss in this whole run.** Create sits right next to it and looks like the finish line. Skip Continue and the wizard quietly does nothing: no error, no change, and the Audience page still says "Google Auth Platform not configured yet". If you land back on that message, this is why.

When it works, the page redirects to `/auth/overview`.

## Step 2.5 — HARD GATE: publish it to production

**Not optional, and never a follow-up.** Do not continue past it, do not let the session end with it undone, and do not accept "I'll do that later."

Go to `https://console.cloud.google.com/auth/audience?project=<ID>`. Read the **Publishing status** line. A new app says **Testing**. Google kills the connection for any app left in Testing after exactly **7 days**, silently, with no warning to them and no error you will see. It stops working a week later, usually while nobody is around to fix it.

Click **Publish app**, then **Confirm** on the "Push to production?" dialog.

**Then verify it, do not ask them.** Re-read the Publishing status line on the page. It must now say **In production**, with a "Back to testing" button beside it. That string is the proof. A run where you could not read those two words has not passed this gate, whatever anyone believes happened.

They will see "Google hasn't verified this app" when they sign in next. **That is fine and expected.** They are connecting their own account to their own project; verification is for apps handed out to strangers. Tell them before they hit it, so the warning doesn't scare them off mid-flow.

*(Learned the hard way on a live client setup on 7/29/26: the warning appeared, the session ran out of time, and five inboxes were set to die eight days later while the client was on a plane.)*

## Step 2.6 — Create the sign-in credential

Go to `https://console.cloud.google.com/auth/clients/create?project=<ID>`.

1. **Application type** is a dropdown. Choose **Desktop app**.
2. Leave the generated name alone and click **Create**.
3. A dialog appears with the Client ID, the Client secret, and a **Download JSON** button. Click Download JSON.

**The dialog says the secret can never be viewed or downloaded again once closed, and it means it.** Grab the file before anything else. If it does get closed, do not hunt for the secret: go to the Clients list and add a new one.

The browser tool saves downloads to `.playwright-mcp/` inside the working folder. Move it into place and lock it down without ever opening it:

```bash
mkdir -p "$HOME/.config/gws"
mv "$(ls -t .playwright-mcp/client*secret*.json | head -1)" "$HOME/.config/gws/client_secret.json"
chmod 600 "$HOME/.config/gws/client_secret.json"
ls -l "$HOME/.config/gws/client_secret.json"
```

If the member downloaded it themselves it will be in `~/Downloads` instead; the same `mv` works with that path.

**That file is a password. Never open it, never print it, never paste it anywhere, never commit it.** Prove it exists with `ls`, never with `cat`. A correct one is about 400 bytes and its top-level key is `installed`.

## Step 2.7 — Sign in

```bash
gws auth login --services drive,docs,sheets,slides
```

A browser opens. They sign in **with the same work account from Part 1** and approve the access. The unverified-app warning appears here: they click Advanced, then continue.

If the browser doesn't open, or it opens in the wrong profile, have them copy the address from the terminal into the browser they're already signed into.

## Step 2.8 — Prove it works, with a real call

Not "it should be connected now". Run something and read back what comes out:

```bash
gws auth status
gws drive files list --params '{"pageSize": 5}' --format table
```

The second one must return **actual file names they recognise**. If it returns an error or an empty list, the connection is not done, whatever the status says. The usual causes, in order:

1. **They signed in with the wrong Google account** (personal instead of work). `gws auth logout`, then Step 2.7 again, watching which account they pick.
2. **The services from Step 2.3 were switched on in a different project** than the credential came from. This is the most likely cause and it is invisible: re-open the API link with `?project=<ID>` and confirm it says Manage rather than Enable.
3. **Their company admin blocks third-party apps.** The error will mention access being blocked by an administrator. This is not fixable from here; it needs their IT.

Then prove the thing they actually came for. Open one of their real Google Docs and read a line back to them:

```bash
gws drive files list --params '{"q": "mimeType='\''application/vnd.google-apps.document'\''", "pageSize": 3}' --format table
```

## Step 2.9 — Write it down

Add a Google row to `CONNECTIONS.md` recording what is connected (Drive, Docs, Sheets, Slides), which account it is connected as, and today's date. Never write the credential itself, or any part of it.

Then add one dated line to the same row: **"Publishing status confirmed In production on <date>."** If for any reason it was NOT confirmed, write that instead, in those words, and tell the user plainly that the connection will stop working in a week unless it gets published. Never record a hope as a fact.

## Step 2.10 — Prove it again in eight days

A connection that works today and dies on day seven is worse than one that never worked, because nobody is watching for it. Before you finish, tell the user in one line: *"I'll re-check this the next time we work together after <date + 8 days>, so we know it stuck."*

Then make that real rather than a promise: add the check to their own notes so a future session runs it, not so a human remembers it.

---

## Rules that don't bend

1. **Never open, print, paste or commit `client_secret.json` or anything under `~/.config/gws/`.** They are live credentials. Prove existence with `ls`, never with `cat`.
2. **Part 2's publishing step is a gate, not a note, and it is verified by reading the words "In production" off the page.** A run that ends with the app in Testing has not succeeded, no matter how well the sign-in went, and a member's recollection is not the check.
3. **Never claim a connection works from a clean exit code.** Claim it from real file names that the user recognises.
4. **One account, everywhere.** Part 1's Drive sign-in and Part 2's account must match, or half their work is visible and half isn't, in a way that is genuinely hard to spot later.
5. **Part 1 is allowed to be the whole answer.** If most of their documents are Word and Excel, saying "you don't need Part 2" is the right outcome, not a failed run.

## Gotchas

- **`My Drive` is not the business.** On a company Google Workspace, `Shared drives` usually holds the real work. Reporting on `My Drive` alone reads as a complete answer and isn't one.
- **A `.gdoc` file is a link, not a document.** Native Docs, Sheets and Slides land on disk as files of a few hundred bytes containing a URL. Never report them as empty or broken, and never treat a folder of 400 of them as thin.
- **Windows mounts Drive on a lettered drive**, usually `G:`, which in the terminal is `/g`. Home-directory checks alone will miss it entirely.
- **VS Code reads what's installed once, at launch.** Anything connected while it was already open is invisible until a full quit (File then Exit on Windows, not the X).
- **A managed company Google account can block all of Part 2 at the admin level.** You find out at the sign-in step, not before. Ask whether it is a company-managed account before starting, so the possibility is named up front rather than discovered as a failure.
- **Google's console fights scripted input, and it fails silently when it wins (walked live 8/9/26).** Setting a field's value in JavaScript renders the right text and leaves the form invalid, so the button stays greyed with no message. Real clicks and real keystrokes work. The destructive dialogs are the worst of it: the project shutdown box keeps a stale copy of its confirmation field in the page, so you can type the project ID perfectly, watch it appear on screen, and still be filling in the wrong element.
- **The consent wizard's Continue button is a trap.** On the Finish step, Continue and Create sit side by side and Create looks like the end. Skip Continue and Create does nothing at all: no error, no change, and the only symptom is the Audience page still reading "not configured yet" minutes later.
- **The support email on the consent screen is a dropdown that fails at the far end.** Leave it unset and the wizard lets you fill in every later step before refusing with "An email address must be selected".
- **The OAuth secret is genuinely one-shot.** The creation dialog says the secret can never be viewed or downloaded again, and that is literal. If it closes, do not go looking: add a new client.
