# Creating a Gmail Draft (with signature) via gws

Canonical procedure for creating an email as a **draft** (never sent) in the `emailTool` from your settings (`## debrief` section of `references/king-intelligence-config.md`), using the `emailDraftMethod` from your settings (the recipe below is written for `gws` / Gmail; adjust to your configured tool if different). Used by the `/email` skill's Phase 5 and the `/debrief` follow-up email. Keep logic here, don't duplicate it in SKILL.md.

**Golden rules:**
1. **Drafts only.** Never call `gmail users messages send` or `drafts send`. The user sends manually.
2. **Always create the draft AND show the email inline in chat.** Both, every time. Don't gate draft creation on approval.
3. **The body must come from the `/email` skill** (voice guide + checklist). Don't hand-write email bodies.

---

## Step 1: Get the signature from the STORED file (do NOT scrape sent mail)

The user's branded HTML signature is stored in the repo at the `signatureFilePath` from your settings. Read that file. It's a `<table>...</table>` block (headshot + logo + name + title + contact rows + social buttons + tagline). The signature = everything from the first `<table` to the matching final `</table>`.

**Why the stored file, not sent-mail extraction:** grepping sent emails for `<div class="gmail_signature">` fails when the signature is a plain `<table>` with no `gmail_signature` class — it returns nothing and the draft ships with no signature. The stored file is the source of truth.

**Known wart:** if the stored file contains a calendar button whose `<a href>` contains a placeholder (e.g., `REPLACE_ME`), strip that `<td>...</td>` block before using the signature, so the draft never carries a broken link. Flag it to the user so they fix the stored file.

Load it into the build script (read it from the `signatureFilePath` in your settings):

```js
let sig = fs.readFileSync(signatureFilePath, 'utf8'); // = signatureFilePath from your settings
sig = sig.replace(/<!--[\s\S]*?-->/, '').trim();           // drop setup comments
sig = sig.replace(/<td[^>]*>\s*<a[^>]*REPLACE_ME[\s\S]*?<\/td>/i, ''); // drop broken placeholder links
```

---

## Step 2: Build the raw RFC822 message via Node

Write a short Node script to the repo working directory (NOT `/tmp` — use a path you control inside the working directory, e.g., a temp file at the repo root). Delete the script after use.

Template (the body text comes from the `/email` skill output; adjust `To`, `Subject`, and use the `senderEmail` from your settings):

```js
const fs = require('fs');
const signatureFilePath = '<signatureFilePath from your settings>';
let sig = fs.readFileSync(signatureFilePath, 'utf8');
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
// Close on a natural sentence or a short "Thanks," / "Talk soon,". Do NOT type the sender's name as a
// sign-off line — the HTML signature already carries their name; a typed name above it reads
// doubled-up. The body ends, then ${sig}, with no name in between.

const headers = [
  'From: <Your Name> <<senderEmail from your settings>>',
  'To: <FIRST> <LAST> <<recipient@domain.com>>',
  'Subject: <subject line, no em dashes>',
  'MIME-Version: 1.0',
  'Content-Type: text/html; charset=UTF-8',
  'Content-Transfer-Encoding: 7bit',
].join('\r\n');

const raw = headers + '\r\n\r\n' + bodyHtml;
const b64url = Buffer.from(raw, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Write the payload to a temp file in the working directory
fs.writeFileSync('draft_payload.json', JSON.stringify({ message: { raw: b64url } }));
console.log('OK sig_bytes=' + sig.length);
```

Run from the repo root directory so the relative signature path resolves:

```bash
node build_draft.js
```

If `sig_bytes` is near 0 or the script can't find the signature file, STOP and report — never ship a signature-less draft.

### Links in the body — always a pretty hyperlink

Never drop a raw URL into the body, especially a long tokenized one (Zoom share links, signed download links). Render every link as a styled gold `<a>` with short, friendly anchor text:

```js
const url = 'https://full/url?including=any&pwd=token';   // the real, complete URL
const link = `<a href="${url}" style="color:#DC990A; font-weight:600; text-decoration:underline;">watch the recording</a>`;
```

Then drop `${link}` inside the paragraph. Anchor text names the destination in the user's casual register ("watch the recording", "book a call", "the proposal", "your login"); lowercase is fine. Gold `#DC990A`, bold. This is the default for every link. (Baked in after a giant raw Zoom URL shipped in a draft.)

---

## Step 3: Create the draft via gws

The payload (body + signature, no attachments) is small enough to pass as an argument:

```bash
gws gmail users drafts create --params '{"userId":"me"}' --json "$(cat draft_payload.json)"
```

A success response contains `"labelIds": ["DRAFT"]` and a draft `id`. If it doesn't, stop and report.

> **Attachments (large files):** gws passes `--json` on the command line, which can hit command-line length limits for large payloads. For large attachments, use the Gmail API directly (POST multipart message). Don't silently drop an attachment the user asked for; if you can't attach, say so.

---

## Step 4: Clean up + report

1. Delete the Node build script: `rm build_draft.js` and the payload file `rm draft_payload.json`.
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
7. **No typed name sign-off.** Don't end the body with the sender's typed name; the HTML signature carries it. Close on a sentence or a short `Thanks,` / `Talk soon,`.
8. **Links are pretty hyperlinks.** Styled gold `<a>` (`#DC990A`, bold) with friendly anchor text, never a raw URL (see "Links in the body" above).
