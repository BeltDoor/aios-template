---
name: imessage
description: >
  Read iMessages and draft/send replies through the Mac's Messages app. Invoke when
  the user says "/messages", "check my texts/messages", "read my messages",
  "what did <person> text me", "any texts from <person>", "did <person> reply",
  "text <person> back", "reply to <person>", "send <person> a text", or otherwise
  wants to see or respond to iMessages. Reads the local Messages database (fully
  on-device, decodes the hidden attributedBody field so nothing is missed, resolves
  numbers to contact names) and sends via Messages.app. NEVER sends a text without
  showing the user the draft and getting an explicit yes first.
---

# /messages — read and reply to iMessages

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

Your iPhone messages sync down into the Mac's local Messages database. This skill reads them and, on your explicit say-so, sends replies as you. Built and verified on macOS 26.3.1.

## How it works
- **Reading** is 100% on this Mac. Your phone's texts ride iCloud into a local database; the skill queries a read-only copy of it. No new permission needed beyond Full Disk Access (already granted for the editor).
- **Replying** hands the Messages app the text and the recipient, and it sends as a real iMessage from your number.
- The only thing that ever leaves the Mac is whatever messages you ask to look at, which then go to the model to process, same as anything else you share.

## Reading — `scripts/read_messages.py`

Read-only. Always use this rather than a raw `sqlite3` query, because on modern macOS most message text is hidden in a binary `attributedBody` blob that a plain query silently skips. This script decodes it and resolves phone numbers to contact names.

```bash
python3 scripts/read_messages.py --recent 20                  # latest messages, all conversations
python3 scripts/read_messages.py --contact "Sam" --limit 30   # one thread by name / number / email
python3 scripts/read_messages.py --search "invoice"           # find messages containing a term
python3 scripts/read_messages.py --list-chats                 # recent conversations overview
```

Add `--json` for structured output. `--contact` accepts a contact name, a phone number, or an email.

## Replying — `scripts/send_message.py`

**HARD RULE: ALWAYS draft only. NEVER send anything without the user's explicit, per-message permission.** No exceptions. Even when the user says "reply to them" or "text them back," that is a request for a DRAFT, not a send. Produce the exact wording, show who it's going to, and wait for an explicit go on that exact text before running the send script. The flow is always:

1. Read the thread first (`--contact`) so the reply fits the conversation.
2. Draft the reply in the user's casual texting voice: short, plain, no corporate tone, no em-dashes.
3. Show the draft + who it's going to. Wait for an explicit go.
4. Only then send:

```bash
python3 scripts/send_message.py --to "<number-or-email>" --text "<approved text>"
python3 scripts/send_message.py --to "..." --text "..." --dry-run   # preview, sends nothing
```

5. Confirm it landed (re-read the thread or `--search`).

Use the recipient's actual handle from the thread (`--contact` output shows it via the number/email). For Apple-to-Apple it goes blue-bubble iMessage by default; `--sms` forces SMS (needs the iPhone relay and only reaches non-Apple numbers that way).

## Limits (be honest about these)

- **1-on-1 is rock solid; group chats are flaky** (Apple's scripting limitation, not fixable here).
- Sending works best to people **already in a conversation or in Contacts**; brand-new numbers can fail to resolve.
- Texts from the iPhone only appear if **Messages in iCloud** stays on. If the database ever looks stale, that is the first thing to check.
- The Messages app must be signed in.

## Turning it off

- Quick off: rename this folder to `imessage.disabled` (one move, reversible).
- Full off: System Settings → Privacy & Security → Full Disk Access → turn off your editor. That also cuts any other Full Disk Access the editor uses (e.g. Photos).

## Tech notes

- DB: `~/Library/Messages/chat.db`, opened `mode=ro` (read-only, respects the live WAL). Never opened writable.
- Dates: nanoseconds since 2001-01-01; converted in-query.
- `attributedBody` typedstream decoded for messages where the `text` column is NULL.
- Contact names: read-only from `~/Library/Application Support/AddressBook`.
- Sending: AppleScript via Messages.app (the only supported path; no direct DB write). First send may show a one-time macOS automation approval.
