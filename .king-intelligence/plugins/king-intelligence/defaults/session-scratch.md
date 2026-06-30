# Session scratchpad

Claude's in-session capture buffer. The moment Claude hits an error, blocker, or dead-end that took more than one attempt to solve, or that a future session could repeat, it appends one line here BEFORE moving on. `/king-intelligence:end-session` harvests these into their permanent homes (a folder's `## Gotchas`, the tool's reference file, or memory) and then resets this file to empty. It starts every session empty.

Format (one line each):
- `[GOTCHA] <folder or tool> | <what broke> -> <root cause / fix>`
- `[OPEN] <unresolved thread to carry forward>`
- `[NOTE] <thing to remember>`

---
<!-- entries below this line; /king-intelligence:end-session clears them after filing -->
