// The two rules that decide what happens to a member's command files.
//
// They live in their own module for ONE reason: they are the only file-DELETING decision the
// toolkit makes on a paying member's own computer, and until 8/28/26 they were proven by
// reading them. An audit that ran the real loop watched it delete a member's CLAUDE.md.
//
// `sync-commands.mjs` runs `main()` the moment it is imported, so nothing there can be
// tested without arranging a whole member machine and a live door. Here there is no main, no
// network and no filesystem: just the judgement, so the failing questions can be asked
// directly. `stub-rules.test.mjs` asks them.
//
// Created 08/28/26 - 05:20 EDT.

/**
 * Does this file still look like a stub WE wrote?
 *
 * Ownership is judged by CONTENT, never by name. Tracking a name meant that once one of the
 * forty skill names had ever been ours it was ours for ever: a member who later wrote their
 * own /email had it silently overwritten and could never take the name back. The moment a
 * member edits a stub, it is theirs.
 */
export function looksLikeOurStub(text) {
  if (typeof text !== "string") return false;
  return /^---\n?description: /.test(text) && /use_skill with name "/.test(text);
}

/**
 * Should the OLD un-namespaced copy of a stub be retired? (8/28/26)
 *
 * Commands moved from `.claude/commands/<name>.md` to
 * `.claude/commands/king-intelligence/<name>.md`, so every one of ours now reads as
 * `/king-intelligence:<name>`. Nothing in `stubsToRemove` can clean up after that move:
 * it only removes names the door has STOPPED listing, and every name here is still
 * listed. Left alone, the flat file stays for ever and the member has both `/email` and
 * `/king-intelligence:email` doing the same thing, which is worse than the problem the
 * namespace was for.
 *
 * The same three questions as every other delete here, and all three must hold:
 *   1. the name is safe (this list comes out of a JSON file in the member's own repo);
 *   2. we are already tracking the name, so this is a file we created;
 *   3. the file on disk still LOOKS like a stub we wrote.
 * A member who edited that file, or wrote their own command at that name, keeps it. They
 * then have their `/email` beside our `/king-intelligence:email`, which is exactly right.
 *
 * No floor is needed here, unlike `stubsToRemove`: this never runs off a shrunken door
 * response. Each retirement is paired with a namespaced file just written in its place,
 * so the command survives the move under its new name.
 */
export function shouldRetireFlatStub(name, tracked, text) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(String(name))) return false;
  if (!tracked.has(name)) return false;
  return looksLikeOurStub(text);
}

/**
 * Which of our stubs should be deleted?
 *
 * `readStub(name)` returns the file's current text, or null when it is not on disk.
 */
export function stubsToRemove(managed, desired, readStub) {
  const list = Array.isArray(managed) ? managed : [];

  // 1. VALIDATE THE NAME. This list comes from a JSON file sitting in the member's own repo,
  //    so a name like "../../CLAUDE" turned this into an arbitrary file-delete primitive on
  //    their disk, running every session, in silence. A bad merge, a restored backup or a
  //    shared folder is enough to put one there. Never delete a path you have not validated,
  //    however trustworthy the list looks.
  const SAFE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
  const doomed = list.filter((n) => !desired.has(n) && SAFE_NAME.test(n));

  // 2. A FLOOR. If the door ever answers with nothing, or with a small fraction of what it
  //    said last time, this would erase every command the member has. The door is hardened
  //    against answering empty, but that leaves the member's machine relying on the door
  //    never having a bug, and one shrunken response would be one wiped machine. A real
  //    retirement drops a skill or two. It does not drop thirty.
  //    The `list.length >= 5` this used to carry switched the floor OFF for the smallest
  //    machines, which is the one place its own arithmetic would have caught a total wipe:
  //    with four commands and all four dropped, `4 > max(3, 2)` is true and the floor would
  //    have held, and that clause was the only thing stopping it. A member who has switched
  //    most skills off is not less entitled to the protection, they are the member with the
  //    least left to lose. Removing it changes exactly one case, and that case is a wipe.
  if (doomed.length > Math.max(3, list.length / 2)) return [];

  // 3. OWNERSHIP. The member most likely to be standing here is one who switched a skill off
  //    in order to write their own replacement, and switching it off is exactly what brings
  //    them here. If the file no longer looks like ours, it is theirs, and it stays.
  return doomed.filter((name) => {
    const text = readStub(name);
    return text === null || looksLikeOurStub(text);
  });
}
