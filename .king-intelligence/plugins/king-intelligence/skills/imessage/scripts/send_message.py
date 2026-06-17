#!/usr/bin/env python3
"""
send_message.py — send an iMessage (or SMS fallback) through the local Messages app.

Sending is done via AppleScript controlling Messages.app (the only supported path;
there is no direct database write). Messages.app must be signed in. The first send
may trigger a one-time macOS "allow automation" approval.

Usage:
  send_message.py --to "+13305551234" --text "On my way"
  send_message.py --to "riley@example.com" --text "Sounds good"
  send_message.py --to "+13305551234" --text "..." --sms     # force SMS service (needs iPhone relay)
  send_message.py --to "..." --text "..." --dry-run           # print the action, send nothing

Exit code 0 on success; non-zero with a message on failure.
"""
import argparse
import subprocess
import sys

OSA = """
on run {theText, theTo}
  tell application "Messages"
    set svc to 1st service whose service type = %s
    set theBuddy to buddy theTo of svc
    send theText to theBuddy
  end tell
end run
"""


def send(to, text, sms=False, dry_run=False):
    service = "SMS" if sms else "iMessage"
    if dry_run:
        print("DRY RUN — would send via %s to %s:\n  %s" % (service, to, text))
        return 0
    script = OSA % service
    proc = subprocess.run(
        ["osascript", "-e", script, text, to],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        err = (proc.stderr or "").strip()
        sys.stderr.write("Send failed (%s): %s\n" % (service, err))
        return proc.returncode
    print("Sent via %s to %s" % (service, to))
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--to", required=True)
    ap.add_argument("--text", required=True)
    ap.add_argument("--sms", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    sys.exit(send(args.to, args.text, sms=args.sms, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
