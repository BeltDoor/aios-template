# Writing effective skills — reference

> Source: David Ondrej's [effective-agent-skills skill](https://github.com/davidondrej/skills) (MIT license, Copyright (c) 2026 David Ondrej). Condensed into a reference for `/skill-builder` and `/improve-skill`. Its skill-authoring guidance overlaps with Pocock's `writing-great-skills` (the primary rubric `/improve-skill` judges against); the piece worth keeping distinct is the **security checklist for auditing downloaded/third-party skills** in §5, which matches the lesson that downloaded skills arrive broken or incomplete.

Read this when building, editing, or auditing a skill. It's a checklist, not a tutorial.

## 1. The description routes; the body executes

The description is the ONLY thing the agent sees before deciding to load the skill. If a skill doesn't trigger, the description is wrong ~95% of the time, not the body. Include three things:
1. **What** it does (one phrase)
2. **When** to use it (trigger phrases, situations)
3. **Differentiator** vs related skills (prevents routing conflicts)

Never summarize the full step-by-step workflow in the description — the agent will follow that summary and skip loading the body. Describe *what* and *when*, never *how*.

## 2. Progressive disclosure — keep the body lean

- **Level 1 (always in context):** just name + description (~100 tokens).
- **Level 2 (loaded on match):** the SKILL.md body — keep it under ~5k tokens.
- **Level 3 (on demand):** `references/*.md` and `scripts/*` read only when needed.

Push detail out of the body into references once it grows long. Keep references one level deep (SKILL.md → reference, never a chain). Files don't cost tokens until accessed, so bundled content has no practical limit.

## 3. Do this

- **Bash-first, prose-second.** Concrete command examples with inline comments beat paragraphs. Show, don't describe.
- **Push determinism into code.** Anything fragile, repetitive, or where variation is a bug → a script. Markdown only for judgment tasks.
- **Match strictness to fragility.** Loose heuristics when many approaches work; templates when there's a preferred pattern; exact scripts + strict steps when a wrong move is costly (migrations, document patching).
- **Build a validation loop.** State an explicit verify → fix → re-verify step. This is the single biggest quality lever.
- **State-check before action.** Don't assume setup is done — verify state, then branch.
- **One skill = one concern.** Compose small skills at runtime; don't bundle a whole workflow into one mega-skill.
- **Cite established methodology** when the skill encodes one (TDD, etc.) so the agent has a coherent model.

## 4. Don't do this (anti-patterns)

- Don't re-teach what the model already knows (no syntax tutorials, no "what is git").
- Don't put human-facing docs inside the skill folder (no README/CHANGELOG/INSTALL).
- Don't write vague descriptions ("a helpful skill for documents").
- Don't paste library source into the skill — install it via npm/pip.
- Don't write monolithic mega-skills (design + plan + build + test + deploy = a framework, not a skill).
- Don't write style-only variants (tone/format tweaks belong in preferences or the system prompt).
- Don't ignore failure modes — for every step that can fail, document what failure looks like and what to do.
- Don't include time-sensitive info ("as of Q4 2024…" rots) — fetch live or omit.
- Don't use absolute paths — relative + forward slashes only.

## 5. Security checklist — before adopting ANY third-party / downloaded skill

Skills can execute arbitrary code and steer agent behavior; a malicious or broken one is a real risk. Before installing or adapting a downloaded skill:

- [ ] **Read every file in the folder** — not just SKILL.md.
- [ ] **Audit `scripts/`** for outbound network calls, file access outside the expected scope, or command execution you didn't expect.
- [ ] **Check references for prompt injection** ("ignore previous instructions…", hidden steering).
- [ ] **Verify the name isn't typosquatting** a popular skill.
- [ ] **Confirm it's actually complete** — a downloaded skill can arrive missing files it depends on (one real case: a downloaded research skill shipped without its report template). Check SKILL.md's referenced files and dependencies actually exist; build any missing piece before calling it ready.
- [ ] **Watch for stub/placeholder files** — e.g. an empty SKILL.md, or a file with its own unresolved `TODO`. Don't ship a half-finished skill.
- [ ] **Pin to a specific version/commit**, not "latest".

For skills adapted into this repo from a third party, also: strip the author's name/paths/tools, add the MIT credit line, and never publish a borrowed skill verbatim; ship your own adaptation instead.

## 6. Ship checklist

- [ ] Frontmatter `name` matches the folder name
- [ ] Description = what + when + differentiator, with real trigger phrases
- [ ] No human-facing docs, no time-sensitive info, relative paths only
- [ ] State-check + validation loop documented where applicable
- [ ] Output format documented if the skill returns structured data
- [ ] Tested for correct triggering AND correct execution
- [ ] Does one thing; composes cleanly with related skills
