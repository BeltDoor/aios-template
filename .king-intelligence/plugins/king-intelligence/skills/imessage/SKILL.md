---
name: imessage
description: Read the user's iMessages and draft/send replies through the Mac's Messages app. Invoke when the user says "/messages", "check my texts/messages", "read my messages", "what did <person> text me", "any texts from <person>", "did <person> reply", "text <person> back", "reply to <person>", "send <person> a text", or otherwise wants to see or respond to their iMessages. NEVER sends a text without showing the user the draft and getting an explicit yes first.
---

# /messages — read and reply to iMessages

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

Your iPhone messages sync down into the Mac's local Messages database. This skill reads them and, on your explicit say-so, sends replies as you.

## How it works (plain version)
- **Reading** is 100% on this Mac. Your phone's texts ride iCloud into a local database; the skill queries a read-only copy of it. No new permission needed if access was already granted for Photos.
- **Replying** hands the Messages app the text and the recipient, and it sends as a real iMessage from your number.
- The only thing that ever leaves the Mac is whatever messages you actually ask to look at, which then go to the model to process, same as anything else you show it.

## Reading — `scripts/read_messages.py`
Read-only. Always use this rather than a raw `sqlite3` query, because on modern macOS most message text is hidden in a binary `attributedBody` blob that a plain query silently skips. This script decodes it (verified extensively against real message data) and resolves phone numbers to contact names.

```bash
python3 scripts/read_messages.py --recent 20                 # latest messages, all conversations
python3 scripts/read_messages.py --contact "Riley" --limit 30 # one thread by name / number / email
python3 scripts/read_messages.py --search "invoice"          # find messages containing a term
python3 scripts/read_messages.py --list-chats                # recent conversations overview
```
Add `--json` for structured output. `--contact` accepts a contact name, a phone number, or an email.

## Replying — `scripts/send_message.py`
**HARD RULE (standing order): ALWAYS draft only. NEVER send anything without the user's explicit, per-message permission.** No exceptions, no "implied" yes. Even when the user says "reply to him" or "text him back," that is a request for a DRAFT, not a send. Produce the exact wording, show who it's going to, and wait for an explicit go on that exact text before running the send script. Texting as the user is an outward action and is never automatic. The flow is always:
1. Read the thread first (`--contact`) so the reply fits the conversation.
2. Draft the reply in **the user's casual texting voice**: short, plain, no corporate tone, no em-dashes (unless the user prefers otherwise). Texts are more casual than a written email; do not over-format.
3. Show the user the draft + who it's going to. Wait for an explicit go.
4. Only then send:
```bash
python3 scripts/send_message.py --to "<number-or-email>" --text "<approved text>"
python3 scripts/send_message.py --to "..." --text "..." --dry-run   # preview, sends nothing
```
5. Confirm it landed — and NOT by trusting the script. `send_message.py` prints "Sent" when AppleScript ACCEPTS the message, not when it actually delivered. Verify in the database:
```bash
sqlite3 "file:$HOME/Library/Messages/chat.db?mode=ro" "SELECT datetime(m.date/1000000000 + strftime('%s','2001-01-01'),'unixepoch','localtime'), h.id, m.is_sent, m.error FROM message m LEFT JOIN handle h ON h.ROWID=m.handle_id WHERE m.is_from_me=1 ORDER BY m.date DESC LIMIT 3;"
```
`is_sent=1` + `error=0` = actually sent. `error=22` with `is_sent=0` = silent failure (typically a number that isn't on iMessage).

**Send only to the handle from the person's ACTUAL thread** (`--contact` output shows it via the number/email), never a number pulled from a contact card in a file: office lines are often not iMessage handles and fail silently with error 22 (see gotcha below). For Apple-to-Apple it goes blue-bubble iMessage by default; `--sms` forces SMS (needs the iPhone relay and only reaches non-Apple numbers that way).

## Gotchas (from live use)
- **Photo attachments (screenshots someone texted) ARE readable.** The `￼` placeholders in message text are attachments; find the file via `message_attachment_join` → `attachment.filename` (paths start with `~`, files under `~/Library/Messages/Attachments/…`), then view the image with the Read tool. Filtering that query by handle joins can silently return nothing — the simplest reliable query is all attachments `ORDER BY m.date DESC`, then match by timestamp. Copy the file to a scratch/temp location before viewing, never into a tracked repo (an auto-commit hook could sweep it up).
- **A phone number on file is NOT necessarily a texting handle.** Two approved texts to a client "sent" per the script but silently failed (error 22): the number on file was the client's office line, not their real cell. To confirm a handle, query it from a known message (`SELECT h.id FROM message m JOIN handle h ... JOIN chat ...`) — and always run the step-5 verification after sending.

## Limits (be honest about these)
- **1-on-1 is rock solid; group chats are flaky** (Apple's scripting limitation, not fixable here).
- Sending works best to people **already in a conversation / in Contacts**; brand-new numbers can fail to resolve.
- Texts from the iPhone only appear if **Messages in iCloud** stays on. If the database ever looks stale, that is the first thing to check.
- The Messages app must be signed in.

## Turning it off
- Quick off: rename this folder to `imessage.disabled` (one move, reversible).
- Full off: System Settings → Privacy & Security → Full Disk Access → turn off whichever app is running Claude Code (Terminal, iTerm2, VS Code, etc.). That also cuts the Photos connection if it shared the same grant.

## Tech notes
- DB: `~/Library/Messages/chat.db`, opened `mode=ro` (read-only, respects the live WAL). Never opened writable.
- Dates: nanoseconds since 2001-01-01; converted in-query.
- `attributedBody` typedstream decoded for messages where the `text` column is NULL.
- Contact names: read-only from `~/Library/Application Support/AddressBook`.
- Sending: AppleScript via Messages.app (the only supported path; no direct DB write). First send may show a one-time macOS automation approval.
