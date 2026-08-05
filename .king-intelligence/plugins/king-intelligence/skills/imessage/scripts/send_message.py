#!/usr/bin/env python3
"""
send_message.py — send an iMessage (or SMS fallback) through the local Messages app,
and REFUSE TO LIE ABOUT IT.

Sending is done via AppleScript controlling Messages.app (the only supported path;
there is no direct database write). Messages.app must be signed in. The first send
may trigger a one-time macOS "allow automation" approval.

WHY THIS IS MORE THAN A ONE-LINER (learned the hard way):
osascript returns 0 the instant Messages.app ACCEPTS a message. Actual delivery
happens later and can fail silently. During a Wi-Fi outage, multiple alerts in a
week died that way and the user was never told:

    2026-07-23 09:01:23  is_sent=0 error=4   <- a scheduled daily alert
    2026-07-23 08:45:05  is_sent=0 error=4   <- "the post did not go out"
    2026-07-17 08:03:13  is_sent=0 error=4

Every one of those logged "sent". The alarm went quiet in exactly the situation it
exists for: the network being down is BOTH the thing worth alerting about AND the
thing that eats the alert. Nothing retried.

So this script now: checks the network BEFORE claiming anything, queues what it
cannot send, drains the queue on every later run, and verifies real delivery in the
Messages database when it is allowed to read it.

Exit codes:
  0  actually sent (verified where verification is possible)
  75 could not send right now, safely QUEUED for the next run (EX_TEMPFAIL)
  >0 hard failure, nothing queued

Usage:
  send_message.py --to "+13305551234" --text "On my way"
  send_message.py --to "evan@example.com" --text "Sounds good"
  send_message.py --to "+13305551234" --text "..." --sms     # force SMS (needs iPhone relay)
  send_message.py --to "..." --text "..." --dry-run           # print the action, send nothing
  send_message.py --drain                                     # only flush the queue, send nothing new
"""
import argparse
import json
import os
import socket
import sqlite3
import subprocess
import sys
import time

# Queue lives outside any synced repo: message bodies can name people and money.
# NOT /tmp — the Mac wipes that on reboot, so nothing durable should point there.
QUEUE = os.path.expanduser("~/Library/Logs/king-imessage-queue.ndjson")
CHAT_DB = os.path.expanduser("~/Library/Messages/chat.db")

# A queued alert older than this is stale news, not worth waking someone for.
MAX_QUEUE_AGE_SEC = 24 * 3600
# How long to wait for Messages to actually push the message out before judging it.
DELIVERY_GRACE_SEC = 12

OSA = """
on run {theText, theTo}
  tell application "Messages"
    set svc to 1st service whose service type = %s
    set theBuddy to buddy theTo of svc
    send theText to theBuddy
  end tell
end run
"""

# Same send, with one or more files attached. The file goes FIRST so the text
# reads as a caption underneath it, which is how a person would send it.
OSA_ATTACH = """
on run {theTo, theText, filePaths}
  set pathList to paragraphs of filePaths
  set aliasList to {}
  repeat with p in pathList
    -- `contents of` is required: `repeat with x in list` binds a REFERENCE, and
    -- POSIX file cannot coerce a reference into an alias (error -1700).
    set thePath to contents of p
    if length of thePath > 0 then
      -- Coerced OUT HERE on purpose. Inside the Messages tell block, `POSIX file`
      -- resolves in Messages' own scripting scope and the resulting object fails
      -- to send with error 25 (7/24/26, two PDFs silently did not go).
      set end of aliasList to (POSIX file thePath as alias)
    end if
  end repeat
  tell application "Messages"
    set svc to 1st service whose service type = %s
    set theBuddy to buddy theTo of svc
    repeat with f in aliasList
      send (contents of f) to theBuddy
      delay 3
    end repeat
    if length of theText > 0 then send theText to theBuddy
  end tell
end run
"""


def network_up(timeout=4):
    """Is there a usable route out? Checked BEFORE sending so a dead network is
    reported as 'queued', never as 'sent'. Apple's push relay is the honest target:
    if Messages cannot reach it, an iMessage is not going anywhere."""
    for host, port in (("gateway.icloud.com", 443), ("1.1.1.1", 53)):
        try:
            with socket.create_connection((host, port), timeout=timeout):
                return True
        except OSError:
            continue
    return False


def _queue_read():
    if not os.path.exists(QUEUE):
        return []
    out = []
    with open(QUEUE) as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except ValueError:
                continue
    return out


def _queue_write(items):
    tmp = QUEUE + ".tmp"
    with open(tmp, "w") as fh:
        for it in items:
            fh.write(json.dumps(it) + "\n")
    os.replace(tmp, QUEUE)


def enqueue(to, text, sms):
    items = _queue_read()
    items.append({"to": to, "text": text, "sms": bool(sms), "queued_at": int(time.time())})
    _queue_write(items)
    print("QUEUED (not sent yet): %d message(s) waiting" % len(items))


def verify_delivered(text, since_epoch):
    """Look the message up in the Messages database and report what REALLY happened.

    Returns True (confirmed sent), False (confirmed failed), or None (cannot tell).
    None is the honest answer when the Messages database is unreadable — under
    launchd this needs Full Disk Access, which the caller may not have. A None must
    never be treated as success, but it also must not be treated as failure, or a
    perfectly good alert would get queued and re-sent forever.
    """
    if not os.path.exists(CHAT_DB):
        return None
    # Apple epoch: seconds since 2001-01-01, stored in nanoseconds.
    apple_since = (since_epoch - 978307200) * 1000000000
    try:
        con = sqlite3.connect("file:%s?mode=ro" % CHAT_DB, uri=True)
        rows = con.execute(
            "SELECT is_sent, error FROM message "
            "WHERE is_from_me=1 AND date >= ? ORDER BY date DESC LIMIT 20",
            (apple_since,),
        ).fetchall()
        con.close()
    except sqlite3.Error:
        return None  # no Full Disk Access, or db locked — unknowable, not failed
    if not rows:
        return None
    # Check EVERY row in the window, do not stop at the first success.
    # 7/24/26: a send of two PDFs plus a caption reported "delivery confirmed"
    # because the caption (is_sent=1) was the newest row, while both attachments
    # underneath it had error=25 and never went. One failure in the window means
    # the send failed, no matter what else succeeded.
    if any(error not in (0, None) for _is_sent, error in rows):
        return False
    if any(is_sent == 1 for is_sent, _error in rows):
        return True
    return None


def _osa_send(to, text, sms, files=None):
    svc = "SMS" if sms else "iMessage"
    if files:
        missing = [f for f in files if not os.path.exists(f)]
        if missing:
            return False, "file(s) not found: %s" % ", ".join(missing)
        script = OSA_ATTACH % svc
        argv = ["osascript", "-e", script, to, text, "\n".join(os.path.abspath(f) for f in files)]
    else:
        script = OSA % svc
        argv = ["osascript", "-e", script, text, to]
    proc = subprocess.run(argv, capture_output=True, text=True)
    if proc.returncode != 0:
        return False, (proc.stderr or "").strip()
    return True, ""


def attempt(to, text, sms, verify=True, files=None):
    """One real send attempt. Returns 'sent', 'unsent', or 'unknown'."""
    if not network_up():
        return "unsent"
    started = int(time.time())
    ok, err = _osa_send(to, text, sms, files)
    if not ok:
        sys.stderr.write("Messages refused the send: %s\n" % err)
        return "unsent"
    if not verify:
        return "unknown"
    time.sleep(DELIVERY_GRACE_SEC)
    result = verify_delivered(text, started)
    if result is True:
        return "sent"
    if result is False:
        return "unsent"
    return "unknown"


def drain():
    """Flush anything queued by an earlier run. Runs before every new send, so a
    recovered network automatically delivers the backlog with no one intervening."""
    items = _queue_read()
    if not items:
        return 0
    now = int(time.time())
    fresh = [i for i in items if now - i.get("queued_at", now) < MAX_QUEUE_AGE_SEC]
    dropped = len(items) - len(fresh)
    if dropped:
        print("Dropped %d queued message(s) older than 24h (stale)" % dropped)
    if fresh and not network_up():
        _queue_write(fresh)
        print("Still offline, %d message(s) still waiting" % len(fresh))
        return len(fresh)
    left = []
    for it in fresh:
        age_min = (now - it.get("queued_at", now)) // 60
        body = it["text"]
        if age_min >= 2:
            body = "[delayed %d min, network was down]\n%s" % (age_min, body)
        state = attempt(it["to"], body, it.get("sms", False))
        if state == "unsent":
            left.append(it)
        else:
            print("Delivered a queued message (%d min late)" % age_min)
    _queue_write(left)
    if left:
        print("%d queued message(s) still undelivered" % len(left))
    return len(left)


def send(to, text, sms=False, dry_run=False, files=None):
    service = "SMS" if sms else "iMessage"
    if dry_run:
        print("DRY RUN - would send via %s to %s:" % (service, to))
        for f in (files or []):
            print("  [attachment] %s%s" % (f, "" if os.path.exists(f) else "   <-- MISSING"))
        print("  %s" % text)
        return 0
    drain()  # never let a new alert jump ahead of an older undelivered one
    state = attempt(to, text, sms, files=files)
    if state == "sent":
        print("Sent via %s to %s (delivery confirmed)" % (service, to))
        return 0
    if state == "unknown":
        # Messages accepted it and we could not read the database to check.
        # Report it honestly rather than claiming confirmation.
        print("Sent via %s to %s (delivery NOT verifiable from here)" % (service, to))
        return 0
    if files:
        print("NOT SENT: attachments are not queued, because the file may be gone "
              "by the time the queue drains. Re-run this command when back online.")
        return 75
    enqueue(to, text, sms)
    return 75  # EX_TEMPFAIL - caller should log "queued", never "sent"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--to")
    ap.add_argument("--text")
    ap.add_argument("--sms", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--drain", action="store_true", help="only flush the queue")
    ap.add_argument("--file", action="append", default=[],
                    help="attach a file (repeatable). Sent before the text.")
    args = ap.parse_args()
    if args.drain:
        left = drain()
        print("Queue drained." if not left else "Queue still holds %d." % left)
        sys.exit(0)
    if not args.to or args.text is None:
        ap.error("--to and --text are required (or use --drain)")
    sys.exit(send(args.to, args.text, sms=args.sms, dry_run=args.dry_run,
                  files=args.file or None))


if __name__ == "__main__":
    main()
