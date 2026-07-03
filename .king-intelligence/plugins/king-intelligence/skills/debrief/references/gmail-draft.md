# Creating a Gmail Draft (with signature) via gws

Canonical procedure for creating an email as a **draft** (never sent) in the `emailTool` from your settings (`## debrief` section of `references/king-intelligence-config.md`), using the `emailDraftMethod` from your settings (often `gws` for Gmail; the recipe below is written for that). Used by the `/email` skill's Phase 5 and the `/debrief` follow-up email. Keep logic here, don't duplicate it in SKILL.md.

> **Mac vs Windows paths.** If your `gws` install and repo live on different OSes, adjust paths accordingly. On a Mac: `gws` typically lives at `~/.npm-global/bin/gws` (on PATH), the repo root is your session's working dir (so relative paths like the signature path just work, no `cd` needed), and for the payload just write `draft_payload.json` to the working dir and `cat` it into `--json`. On Windows, use the equivalent local temp path. To thread a reply: add `"threadId":"<id>"` to the `message` object and set `In-Reply-To` + `References` headers to the original message's RFC822 `Message-ID` (get it via `gws gmail users messages get --params '{"userId":"me","id":"<id>","format":"metadata","metadataHeaders":["Message-ID"]}'`).

**Golden rules:**
1. **Drafts only.** Never call `gmail users messages send` or `drafts send`. The user sends manually.
2. **Always create the draft AND show the email inline in chat.** Both, every time (the user's rule). Don't gate draft creation on approval.
3. **The body must come from the `/email` skill** (your email voice rules + anti-slop checklist). Don't hand-write email bodies.

---

## Step 1: Get the user's signature from the STORED file (do NOT scrape sent mail)

The user's branded HTML signature is stored in the repo at the `signatureFilePath` from your settings, e.g.:

```
king-intelligence/website/email-signature-gmail.html
```

Read that file. It's a `<table>...</table>` block (headshot + logo + name + title + contact rows + social buttons + tagline) preceded by an HTML setup comment. The signature = everything from the first `<table` to the matching final `</table>`. Strip the leading `<!-- ... -->` comment.

**Why the stored file, not sent-mail extraction:** grepping sent emails for `<div class="gmail_signature">` is fragile — a plain `<table>` signature with no `gmail_signature` class returns nothing, and the draft ships with a fallback / no signature. The stored file is the source of truth. Re-export it from the signature file whenever the user updates their signature.

**Calendar button:** the stored signature's calendar button should link to the user's real booking URL and ship as-is in drafts. If an old placeholder pattern like `REPLACE_ME` is still present anywhere in the file, strip it defensively (see below) rather than shipping a broken link — but don't tell the user the calendar button is broken unless you've actually verified it is.

Load it into the build script (read it from the `signatureFilePath` in your settings):

```js
let sig = fs.readFileSync('king-intelligence/website/email-signature-gmail.html', 'utf8'); // = signatureFilePath from your settings
sig = sig.replace(/<!--[\s\S]*?-->/, '').trim();           // drop the setup comment
sig = sig.replace(/<td[^>]*>\s*<a[^>]*REPLACE_ME[\s\S]*?<\/td>/i, ''); // defensive no-op: strips a placeholder calendar button only IF one is ever re-introduced
```

---

## Step 2: Build the raw RFC822 message via Node

Bash heredoc + base64url on Windows/MSYS is unreliable. Use a short Node script written to your repo's working directory (NOT `/tmp` on Windows/MSYS setups, since the Write tool and MSYS `/tmp` can resolve to different paths). Delete the script after use.

Template (the body text comes from the `/email` skill output; adjust `To`, `Subject`):

```js
const fs = require('fs');
let sig = fs.readFileSync('king-intelligence/website/email-signature-gmail.html', 'utf8'); // = signatureFilePath from your settings
sig = sig.replace(/<!--[\s\S]*?-->/, '').trim();
sig = sig.replace(/<td[^>]*>\s*<a[^>]*REPLACE_ME[\s\S]*?<\/td>/i, '');

const bodyHtml = `<div dir="ltr">
<div>Hey <FIRST>,</div>
<div><br></div>
<div><PARAGRAPH from the /email skill; render any link as a pretty <a>, see "Links" below — never a raw URL></div>
<div><br></div>
<div>Thanks,</div>
<div><br></div>
${sig}
</div>`;
// Close on a natural sentence or a short "Thanks," / "Talk soon,". Do NOT type the user's name as a
// sign-off line — the HTML signature already carries their name; a typed name above it reads
// doubled-up. The body ends, then ${sig}, with no name in between.

const headers = [
  'From: <Full Name> <<senderEmail from your settings>>',
  'To: <FIRST> <LAST> <<recipient@domain.com>>',
  'Subject: <subject line, no em dashes>',
  'MIME-Version: 1.0',
  'Content-Type: text/html; charset=UTF-8',
  'Content-Transfer-Encoding: 7bit',
].join('\r\n');

const raw = headers + '\r\n\r\n' + bodyHtml;
const b64url = Buffer.from(raw, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
fs.writeFileSync('<your local temp dir>/draft_payload.json', JSON.stringify({ message: { raw: b64url } }));
console.log('OK sig_bytes=' + sig.length);
```

Run from your repo directory so the relative signature path resolves:

```bash
cd "<your repo root>" && node build_draft.js
```

If `sig_bytes` is near 0 or the script can't find the file, STOP and report — never ship a signature-less draft.

### Links in the body — always a pretty hyperlink

Never drop a raw URL into the body, especially a long tokenized one (Zoom share links, signed download links). Render every link as a styled gold `<a>` with short, friendly anchor text:

```js
const url = 'https://full/url?including=any&pwd=token';   // the real, complete URL
const link = `<a href="${url}" style="color:#DC990A; font-weight:600; text-decoration:underline;">watch the recording</a>`;
```

Then drop `${link}` inside the paragraph (e.g. `Here's today's session: ${link}.`). Anchor text names the destination in the user's casual register ("watch the recording", "book a call", "the proposal", "your login"); lowercase is fine. Use the user's brand accent color, bold. This is the default for every link, not just when the user asks.

---

## Step 3: Create the draft via gws

The payload (body + signature, no attachments) is small enough to pass as an argument:

```bash
gws gmail users drafts create --params '{"userId":"me"}' --json "$(cat <your local temp dir>/draft_payload.json)"
```

A success response contains `"labelIds": ["DRAFT"]` and a draft `id` like `r-9052...`. If it doesn't, stop and report.

> **Attachments (large files) — verified recipe:** don't pass a big message via `--json` (it hits the command-line size limit). Instead build the FULL `multipart/mixed` RFC822 message in a Node script (HTML body part + each file base64-encoded as its own attachment part, CRLF line endings), write it to a `draft.eml` file, then create the draft by UPLOADING the file:
> ```
> gws gmail users drafts create --params '{"userId":"me"}' --upload draft.eml --upload-content-type message/rfc822
> ```
> The file is read from disk, so there's no command-line size limit. **Two gotchas on this path:** (1) `--upload <path>` must point INSIDE the current working directory or gws rejects it with `resolves to '...' which is outside the current directory` — write the `.eml` into the cwd, or `cd` to its folder, and pass a relative filename. (2) **Threading a reply needs the threadId, not just headers.** `In-Reply-To`/`References` headers in the RFC822 ALONE start a NEW thread on the `--upload` path. To nest the draft under the right message you MUST also pass the threadId as metadata on the SAME call: `gws gmail users drafts create --params '{"userId":"me"}' --json '{"message":{"threadId":"<thread-id>"}}' --upload draft.eml --upload-content-type message/rfc822` (gws sends the `--json` body as the multipart metadata). Keep the `In-Reply-To`/`References` headers too. Verify the response `message.threadId` equals your target thread. Delete the `.eml` + build script after. Don't silently drop an attachment the user asked for; if you can't attach, say so.

---

## Step 3.5: Updating an existing draft (edit in place, no duplicate)

To change a draft that already exists (e.g. the user hand-edited one and wants the same pattern applied to others), use `drafts update` with the draft id, NOT delete-and-recreate, so the id is preserved and no duplicate appears:

```bash
gws gmail users drafts update --params '{"userId":"me","id":"<DRAFT_ID>"}' --json "$(cat draft_payload.json)"
```

The payload body is the same as create plus the id: `{ "id": "<DRAFT_ID>", "message": { "raw": "<base64url>" } }`. The draft id SURVIVES a manual Gmail edit, so list drafts first (`drafts list`) to grab the current id.

---

## Step 4: Clean up + report

1. Delete the Node build script: `rm "<your repo root>/build_draft.js"`.
2. Show the email body inline in chat (the user reads it here AND it's in their drafts).
3. Tell the user: "Draft saved in Gmail (ID: `<id>`). Review and send when ready."

---

## Hard rules

1. **Never send.** No `messages send`, no `drafts send`. Ever.
2. **Always both:** create the draft AND show it inline.
3. **Signature from the stored file** (the `signatureFilePath` from your settings), never scraped, never a fallback. If it fails, stop and report.
4. **No em dashes** in subject or body.
5. **Recipient required.** If the email can't be resolved (CLAUDE.md, Gmail search, transcript), stop and ask.
6. **Body via `/email` skill** — don't author email prose here.
7. **No typed name sign-off.** Don't end the body with a typed name line; the HTML signature carries the user's name. Close on a sentence or a short `Thanks,` / `Talk soon,`.
8. **Links are pretty hyperlinks.** Styled brand-color `<a>`, bold, with friendly anchor text, never a raw URL (see "Links in the body" above).

---

## Gotchas

- **A threaded reply draft (threadId set) does NOT show as a separate line in Gmail's Drafts list** — it sits nested at the bottom of the conversation thread. Users sometimes say "I don't see the draft" about a correctly-created threaded draft. When you stage a threaded reply, tell them it's waiting inside the thread, not in the Drafts folder. If they want it visible as a standalone Drafts item, create it WITHOUT the Gmail threadId (keep the `In-Reply-To`/`References` headers so it still threads on the recipient's side when sent).
- **Reply to the client's MOST RECENT inbound message, not just the thread.** Fetch the thread, find the newest message whose `From` is the client (not the user), and set `In-Reply-To` to ITS `Message-ID`, so the draft nests under their latest email rather than under the user's own last message. Follow-ups should land as a reply to the client's last note.
- **`gws` prints `Using keyring backend: keyring` to stdout before its JSON** — piping straight into `json.load(stdin)` throws "Expecting value". Redirect the output to a file and parse that, or strip the prefix line first.
- **Blank-subject threads → a bare `Re: ` subject.** Some real Gmail threads have an empty Subject header on every message. Computing the reply subject as `"Re: " + threadSubject` then yields just `"Re: "` with nothing after it. Guard for it: if the fetched thread subject is empty, fall back to a real descriptive subject line (e.g. `Checking in`) instead of shipping a bare `Re: `.

## Gotcha — gws flag split

`gws gmail users drafts create` takes the REQUEST BODY in `--json` and ONLY URL/query params in `--params`. Putting `{"message":{...}}` inside `--params` returns a 400 "Missing draft message". Correct shape: `gws gmail users drafts create --params '{"userId":"me"}' --json '{"message":{"raw":"...","threadId":"..."}}'`. Also: gws prints `Using keyring backend: keyring` before the JSON on every call — strip that line before piping output into a JSON parser.
