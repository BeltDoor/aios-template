#!/usr/bin/env python3
"""
read_messages.py — read-only reader for the local Messages database (~/Library/Messages/chat.db).

Handles the modern-macOS gotcha where message text is hidden in the `attributedBody`
binary blob (typedstream) instead of the `text` column, and resolves phone numbers /
emails to contact names from the macOS Address Book.

NEVER writes to the database. Opens read-only (mode=ro), respects the live WAL.

Usage:
  read_messages.py --recent 20                 # last N messages across all conversations
  read_messages.py --contact "Sam" --limit 30  # one thread, by name / number / email
  read_messages.py --search "invoice" --limit 30
  read_messages.py --list-chats                # recent conversations overview
  read_messages.py --selftest                  # privacy-preserving decoder check (no content printed)

Add --json for machine-readable output.
"""
import argparse
import json
import os
import re
import sqlite3
import sys

HOME = os.path.expanduser("~")
CHAT_DB = os.path.join(HOME, "Library", "Messages", "chat.db")
AB_GLOB = os.path.join(HOME, "Library", "Application Support", "AddressBook", "Sources")
APPLE_EPOCH = 978307200  # seconds between 1970-01-01 and 2001-01-01 UTC


# ---------- typedstream (attributedBody) decoding ----------
def _read_int(data, i):
    """Read a typedstream variable-length integer starting at i. Returns (value, new_i)."""
    b = data[i]
    i += 1
    if b == 0x81:  # next 2 bytes, little-endian unsigned short
        return int.from_bytes(data[i:i + 2], "little"), i + 2
    if b == 0x82:  # next 4 bytes, little-endian
        return int.from_bytes(data[i:i + 4], "little"), i + 4
    if b > 127:  # signed single byte
        return b - 256, i
    return b, i


def decode_attributed_body(data):
    """Extract the visible message text from an attributedBody typedstream blob.

    The visible text is the first NSString emitted after the class chain. In the
    typedstream it appears as: ...'NSString'... 0x2B (type '+') <length-varint> <utf-8 bytes>.
    """
    if not data:
        return None
    p = data.find(b"NSString")
    if p == -1:
        # Some blobs only carry NSMutableString
        p = data.find(b"NSMutableString")
        if p == -1:
            return None
    plus = data.find(b"\x2b", p)
    if plus == -1:
        return None
    i = plus + 1
    try:
        length, i = _read_int(data, i)
        if length <= 0 or length > len(data):
            return None
        raw = data[i:i + length]
        return raw.decode("utf-8", "replace")
    except (IndexError, ValueError):
        return None


def message_text(text, attributed_body):
    if text:
        return text
    return decode_attributed_body(attributed_body)


# ---------- contact-name resolution from Address Book ----------
def _norm_phone(s):
    digits = re.sub(r"\D", "", s or "")
    return digits[-10:] if len(digits) >= 10 else digits


def load_contacts():
    """Build a lookup {normalized-phone-or-lowercased-email: display name}."""
    lookup = {}
    if not os.path.isdir(AB_GLOB):
        return lookup
    for src in os.listdir(AB_GLOB):
        db = os.path.join(AB_GLOB, src, "AddressBook-v22.abcddb")
        if not os.path.exists(db):
            continue
        try:
            con = sqlite3.connect("file:%s?mode=ro" % db, uri=True)
            con.text_factory = lambda b: b.decode("utf-8", "replace")
            cur = con.cursor()
            # name parts live on ZABCDRECORD; phones/emails reference it via ZOWNER
            names = {}
            for rid, first, last, org in cur.execute(
                "SELECT Z_PK, ZFIRSTNAME, ZLASTNAME, ZORGANIZATION FROM ZABCDRECORD"
            ):
                name = " ".join(p for p in (first, last) if p) or org
                if name:
                    names[rid] = name.strip()
            for owner, num in cur.execute(
                "SELECT ZOWNER, ZFULLNUMBER FROM ZABCDPHONENUMBER WHERE ZFULLNUMBER IS NOT NULL"
            ):
                if owner in names and num:
                    lookup.setdefault(_norm_phone(num), names[owner])
            for owner, addr in cur.execute(
                "SELECT ZOWNER, ZADDRESS FROM ZABCDEMAILADDRESS WHERE ZADDRESS IS NOT NULL"
            ):
                if owner in names and addr:
                    lookup.setdefault(addr.strip().lower(), names[owner])
            con.close()
        except sqlite3.Error:
            continue
    return lookup


def name_for(handle, contacts):
    if not handle:
        return None
    if "@" in handle:
        return contacts.get(handle.strip().lower())
    return contacts.get(_norm_phone(handle))


# ---------- database access ----------
def connect():
    if not os.path.exists(CHAT_DB):
        sys.exit("No Messages database found at %s" % CHAT_DB)
    try:
        con = sqlite3.connect("file:%s?mode=ro" % CHAT_DB, uri=True)
    except sqlite3.OperationalError as e:
        sys.exit("Cannot open Messages database (Full Disk Access needed?): %s" % e)
    con.row_factory = sqlite3.Row
    return con


DATE_EXPR = "datetime(m.date/1000000000 + %d, 'unixepoch', 'localtime')" % APPLE_EPOCH


def fetch_recent(con, limit):
    sql = """
        SELECT %s AS when_local, m.is_from_me, m.text, m.attributedBody,
               h.id AS handle, c.display_name AS chat_name, c.chat_identifier
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
        LEFT JOIN chat c ON c.ROWID = cmj.chat_id
        WHERE m.associated_message_type = 0
        ORDER BY m.date DESC LIMIT ?
    """ % DATE_EXPR
    return list(con.execute(sql, (limit,)))


def resolve_contact_identifier(con, query, contacts):
    """Turn a name/number/email into the set of handle ids to match."""
    q = query.strip()
    if "@" in q or re.search(r"\d", q):
        return {q, _norm_phone(q)} if re.search(r"\d", q) else {q.lower()}
    # name -> find matching handles via the contacts map
    matches = set()
    qlow = q.lower()
    for key, nm in contacts.items():
        if qlow in nm.lower():
            matches.add(key)
    return matches


def fetch_thread(con, query, limit, contacts):
    keys = resolve_contact_identifier(con, query, contacts)
    rows = []
    sql = """
        SELECT %s AS when_local, m.is_from_me, m.text, m.attributedBody, h.id AS handle
        FROM message m
        JOIN handle h ON m.handle_id = h.ROWID
        WHERE m.associated_message_type = 0
        ORDER BY m.date DESC LIMIT 4000
    """ % DATE_EXPR
    for r in con.execute(sql):
        h = r["handle"] or ""
        if h in keys or _norm_phone(h) in keys or h.lower() in keys:
            rows.append(r)
        if len(rows) >= limit:
            break
    # also sweep sent messages (handle on row is null) by chat identifier
    return rows


def fetch_search(con, term, limit, contacts):
    out = []
    sql = """
        SELECT %s AS when_local, m.is_from_me, m.text, m.attributedBody, h.id AS handle
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        WHERE m.associated_message_type = 0
        ORDER BY m.date DESC LIMIT 8000
    """ % DATE_EXPR
    tl = term.lower()
    for r in con.execute(sql):
        txt = message_text(r["text"], r["attributedBody"]) or ""
        if tl in txt.lower():
            out.append((r, txt))
        if len(out) >= limit:
            break
    return out


def list_chats(con, contacts, limit=25):
    sql = """
        SELECT c.chat_identifier, c.display_name,
               MAX(m.date) AS last_date,
               %s AS when_local
        FROM chat c
        JOIN chat_message_join cmj ON cmj.chat_id = c.ROWID
        JOIN message m ON m.ROWID = cmj.message_id
        GROUP BY c.ROWID
        ORDER BY last_date DESC LIMIT ?
    """ % DATE_EXPR
    rows = []
    for r in con.execute(sql, (limit,)):
        ident = r["chat_identifier"]
        nm = r["display_name"] or name_for(ident, contacts) or ident
        rows.append({"name": nm, "identifier": ident, "last": r["when_local"]})
    return rows


# ---------- formatting ----------
def fmt_row(r, contacts):
    who = "Me" if r["is_from_me"] else (name_for(r["handle"], contacts) or r["handle"] or "Unknown")
    txt = message_text(r["text"], r["attributedBody"]) or "[no text / attachment]"
    return {"time": r["when_local"], "from": who, "text": txt}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--recent", type=int)
    ap.add_argument("--contact")
    ap.add_argument("--limit", type=int, default=25)
    ap.add_argument("--search")
    ap.add_argument("--list-chats", action="store_true")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    con = connect()

    if args.selftest:
        # Privacy-preserving: decode all blob-only messages, report stats, no content.
        rows = con.execute(
            "SELECT attributedBody FROM message WHERE (text IS NULL OR length(text)=0) "
            "AND attributedBody IS NOT NULL AND associated_message_type=0"
        ).fetchall()
        ok, fail, lengths = 0, 0, []
        for r in rows:
            t = decode_attributed_body(r["attributedBody"])
            if t and t.strip() and t.isprintable() or (t and "\n" in t):
                ok += 1
                lengths.append(len(t))
            else:
                fail += 1
        print(json.dumps({
            "blob_messages": len(rows),
            "decoded_ok": ok,
            "decode_failed": fail,
            "len_min": min(lengths) if lengths else 0,
            "len_max": max(lengths) if lengths else 0,
            "len_avg": round(sum(lengths) / len(lengths), 1) if lengths else 0,
        }, indent=2))
        return

    contacts = load_contacts()

    if args.list_chats:
        data = list_chats(con, contacts)
        _emit(data, args.json, lambda d: "\n".join("%s  —  %s" % (x["name"], x["last"]) for x in d))
        return

    if args.recent:
        rows = [fmt_row(r, contacts) for r in fetch_recent(con, args.recent)]
        rows.reverse()
        _emit(rows, args.json, _conv)
        return

    if args.contact:
        rows = [fmt_row(r, contacts) for r in fetch_thread(con, args.contact, args.limit, contacts)]
        rows.reverse()
        _emit(rows, args.json, _conv)
        return

    if args.search:
        res = fetch_search(con, args.search, args.limit, contacts)
        rows = [fmt_row(r, contacts) for r, _ in res]
        rows.reverse()
        _emit(rows, args.json, _conv)
        return

    ap.print_help()


def _conv(rows):
    return "\n".join("[%s] %s: %s" % (r["time"], r["from"], r["text"]) for r in rows)


def _emit(data, as_json, text_fn):
    if as_json:
        print(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        print(text_fn(data))


if __name__ == "__main__":
    main()
