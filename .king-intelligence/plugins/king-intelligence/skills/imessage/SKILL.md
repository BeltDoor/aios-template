---
name: imessage
description: Read the user's iMessages and draft/send replies through the Mac's Messages app. Use when the user says "/messages", "check my texts/messages", "read my messages", "what did <person> text me", "any texts from <person>", "did <person> reply", "text <person> back", "reply to <person>", "send <person> a text", or otherwise wants to see or respond to their iMessages. NEVER sends a text without showing the user the draft and getting an explicit yes first.
---

# /messages — read and reply to iMessages

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

The user's iPhone messages sync down into the Mac's local Messages database. This skill reads them and, on their explicit say-so, sends replies as them.

## How it works (plain version for the user)
- **Reading** is 100% on this Mac. The phone's texts ride iCloud into a local database; the skill queries a read-only copy of it. No new permission needed if Photos access was already granted.
- **Replying** hands the Messages app the text and the recipient, and it sends as a real iMessage from the user's number.
- The only thing that ever leaves the Mac is whatever messages the user actually asks to look at, which then go to the model to process, same as anything else shown to it.

## Reading — `scripts/read_messages.py`
Read-only. Always use this rather than a raw `sqlite3` query, because on modern macOS most message text is hidden in a binary `attributedBody` blob that a plain query silently skips. This script decodes it (verified across a large sample of real data) and resolves phone numbers to contact names.

```bash
python3 scripts/read_messages.py --recent 20                 # latest messages, all conversations
python3 scripts/read_messages.py --contact "Riley" --limit 30 # one thread by name / number / email
python3 scripts/read_messages.py --search "invoice"          # find messages containing a term
python3 scripts/read_messages.py --list-chats                # recent conversations overview
```
Add `--json` for structured output. `--contact` accepts a contact name, a phone number, or an email.

## Replying — `scripts/send_message.py`
**HARD RULE (standing order): ALWAYS draft only. NEVER send anything without the user's explicit, per-message permission.** No exceptions, no "implied" yes. Even when the user says "reply to him" or "text him back," that is a request for a DRAFT, not a send. Produce the exact wording, show who it's going to, and wait for an explicit go on that exact text before running the send script. Texting as the user is an outward action and is never automatic.

**HARD RULE — ALWAYS send through `scripts/send_message.py`. NEVER hand-roll `osascript`.** Raw `osascript` returns exit 0 on sends that fail, so it will report success on a text that reached nobody. The script exists precisely to prevent that: hand-rolling it is how wrong-number texts get reported as delivered when they never arrived.

### STEP 0 (MANDATORY) — resolve the number before you draft anything

**NEVER take a phone number from a client file, a research doc, a CRM card, a summary, or a newsletter.** Those store company switchboards, marketing lines, fax numbers and scraped directory listings. They are not cell phones. Feedback texts have gone out on numbers pulled from exactly those places before: one recipient's stored number turned out to be a company switchboard (which was also saved in Contacts under a different person's name, so the wrong person got the text), another's was a public business marketing line, and a third's was a non-mobile number from discovery notes.

Resolve every recipient in this order, and stop at the first hit:

1. **An existing iMessage thread** with that person: `python3 scripts/read_messages.py --contact "<name>"`. A real two-way thread is the strongest proof you have the right number.
2. **The Contacts app** (authoritative for mobiles, and it tells you whose number it actually is):
   ```bash
   osascript -e 'tell application "Contacts" to get value of phones of (first person whose name contains "<Name>")'
   ```
3. **Ask the user.** If 1 and 2 come up empty, ask for the number. Do not guess, and do not fall back to a file.

**Reverse-check before sending to a number you did not get from a live thread:** look the digits up in Contacts and confirm the name that comes back is the person you mean. That single check catches a mismatched-number send before it happens.

Then the normal flow:
1. Read the thread first (`--contact`) so the reply fits the conversation.
2. Draft the reply in the **user's casual texting voice**: short, lowercase-ish, plain, no corporate tone, no em-dashes. Texts are more casual than an email; do not over-format.
3. Show the user the draft + who it's going to. Wait for an explicit go.
4. Only then send:
```bash
python3 scripts/send_message.py --to "<number-or-email>" --text "<approved text>"
python3 scripts/send_message.py --to "..." --text "..." --dry-run   # preview, sends nothing
python3 scripts/send_message.py --to "..." --text "..." --file a.pdf --file b.pdf   # see the attachment note below
```
5. Confirm it landed. **`error = 22` means the WRONG NUMBER, not "they don't use iMessage."** That misread is exactly what lets a wrong-number text get reported as sent. If a number you believe is a cell phone throws 22, stop and re-resolve it via STEP 0; do not fall back to SMS. **An SMS fallback hides the failure** — a text to a landline is accepted by the carrier and silently vanishes, and SMS never records a receipt, so `error = 0` on SMS proves nothing at all. **Only `date_delivered > 0` proves a text landed.**

   **The script confirms this itself** when it can read the Messages database: it checks connectivity BEFORE sending, verifies real delivery afterwards, and prints one of three honest lines — "delivery confirmed", "delivery NOT verifiable from here" (running somewhere without Full Disk Access, e.g. under launchd), or "QUEUED" with exit code **75**, meaning it could not send and has parked the message to be delivered automatically on the next run. **Exit 75 is NOT a success — never log it as sent.** Verify by hand when you want certainty, or when the script said "not verifiable":
```bash
sqlite3 "file:$HOME/Library/Messages/chat.db?mode=ro" "SELECT datetime(m.date/1000000000 + strftime('%s','2001-01-01'),'unixepoch','localtime'), h.id, m.is_sent, m.error FROM message m LEFT JOIN handle h ON h.ROWID=m.handle_id WHERE m.is_from_me=1 ORDER BY m.date DESC LIMIT 3;"
```
`is_sent=1` + `error=0` = actually sent. `error=22` with `is_sent=0` = silent failure (typically a number that isn't on iMessage).

**Send only to the handle from the person's ACTUAL thread** (`--contact` output shows it via the number/email), never a number from a contact card in a file: office lines are often not iMessage handles and fail silently with error 22 (see the gotcha below). For Apple-to-Apple it goes blue-bubble iMessage by default; `--sms` forces SMS (needs the iPhone relay and only reaches non-Apple numbers that way).

## Sending a FILE: not reliable on every macOS version

**Messages.app can fail to send attachments via AppleScript on some macOS builds.** A failed attempt lands in the database as `is_sent=0, error=25`. If that happens for you, it is not a permissions problem and not fixable in the script; treat attachments as unsupported on that machine until Apple fixes it.

`send_message.py --file <path>` is wired correctly, so it works the moment the OS cooperates. Until then it fails honestly (exit 75, "NOT SENT") rather than lying.

**Do this instead** — put the file in cloud storage and text the link. Whatever file-sharing tool you already use (Drive, Dropbox, etc.) that can produce a shareable link will work here; upload the file, get a link, and send the link as the text.

**Tell the user when you do this.** A "anyone with the link" URL is unlisted, not private, and these documents can carry a customer's name, address, phone and dollar figures. They may want it revoked once the recipient has the file.

## Gotchas (from live use)

- **"delivery confirmed" was a lie, once.** A send of two attachments plus a caption reported success because the delivery check returned `True` on the first `is_sent=1` row it saw (the caption, which really did send) and never looked at the attachment rows underneath it, both `error=25`. Fixed: it now fails if **any** row in the window errored, and the window is 20 rows rather than 5. The lesson generalises: when one send produces several database rows, checking the newest row is not checking the send.
- **AppleScript `repeat with p in someList` binds a REFERENCE, not the value.** `POSIX file p as alias` throws `-1700`. Use `set thePath to contents of p` first. Coerce paths to aliases *outside* any `tell application "Messages"` block.
- **HARD RULE: anything that texts the user goes through `scripts/send_message.py`. Never raw `osascript`.** Alerts sent this way have died silently (`is_sent=0, error=4`) because `osascript` returns success the moment Messages.app ACCEPTS a message, while actual delivery fails later with nobody looking — including during a network outage, which is exactly the situation an alert exists to catch. A hand-rolled retry loop does NOT fix this: retries only catch `osascript` crashing, not undelivered mail. The shared script is the only path that pre-checks the network, queues what it cannot send, and drains the queue automatically later.
- **Photo attachments (screenshots someone texted) ARE readable.** The `￼` placeholders in message text are attachments; find the file via `message_attachment_join` → `attachment.filename` (paths start with `~`, files under `~/Library/Messages/Attachments/…`), then view the image with the Read tool. Filtering that query by handle joins can silently return nothing — the simplest reliable query is all attachments `ORDER BY m.date DESC`, then match by timestamp. Copy the file to a scratch/temp location before viewing, never into a synced repo (an auto-commit hook could sweep it up).
- **A client-file phone number is NOT necessarily a texting handle.** Approved texts sent to a number pulled from a client file can "send" per the script but silently fail (error 22) because that stored number is an office line, not the person's real cell. To confirm a handle, query it from a known message (`SELECT h.id FROM message m JOIN handle h ... JOIN chat ...`) — and always run the step-5 verification after sending.

## Limits (be honest about these)
- **1-on-1 is rock solid; group chats are flaky** (Apple's scripting limitation, not fixable here).
- Sending works best to people **already in a conversation / in Contacts**; brand-new numbers can fail to resolve.
- Texts from the iPhone only appear if **Messages in iCloud** stays on. If the database ever looks stale, that is the first thing to check.
- The Messages app must be signed in.

## Turning it off
- Quick off: rename this folder to `imessage.disabled` (one move, reversible).
- Full off: System Settings → Privacy & Security → Full Disk Access → turn off the app that has it (Terminal, VS Code, or whichever app is running this). That also cuts the Photos connection.

## Tech notes
- DB: `~/Library/Messages/chat.db`, opened `mode=ro` (read-only, respects the live WAL). Never opened writable.
- Dates: nanoseconds since 2001-01-01; converted in-query.
- `attributedBody` typedstream decoded for messages where the `text` column is NULL.
- Contact names: read-only from `~/Library/Application Support/AddressBook`.
- Sending: AppleScript via Messages.app (the only supported path; no direct DB write). First send may show a one-time macOS automation approval to click through.
