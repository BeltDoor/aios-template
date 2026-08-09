---
name: install-brand
description: Build your brand guide from what you already have, then make Claude look at it before it creates anything. Claude reads your real website, logo and files to capture what is already true, interviews you about the gaps, builds you a rating page of options drawn only from your own material, and turns what you pick into a written law, a guide you can look at, a gate that stops visual work until it has been seen, and a checker that refuses the things you rejected. Use when you say "install brand", "set up my brand", "build my brand guide", "make Claude use my colors", "Claude keeps making things that look generic", "wire my brand into Claude", or type /install-brand, even if you never name the skill.
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, Skill, AskUserQuestion, WebFetch
disable-model-invocation: false
---

# /install-brand: make Claude build everything in your brand

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## What you get

Four things, working together by the end of this run:

- **Your brand law** — a short written file saying what your brand actually is, built from your real material and your own decisions.
- **A guide you can look at** — one page showing your colours, type, logo rules and the list of things that are banned.
- **A gate** — Claude cannot start visual work until it has looked at your guide. Once per session, then it goes quiet. It covers web pages and app screens, images, **and documents, decks and PDFs**, so a flyer built as a Word file is stopped just like one built as a web page.
- **A checker** — it refuses output containing the specific things you rejected.

One honest limit: a Word file and a PowerPoint are compressed archives, so the checker cannot read the colours inside a finished one. The gate still stops the work before it starts, and when a deck is built by a script the checker reads that script, which is where the colours are actually written.

The last two are the point. Writing brand rules down does not work on its own: the rules this system came from were written in three separate places and were still skipped on the day they were locked. A prose rule gets skipped. A failing check does not.

## Set expectations (read this first)

Claude does the work. Your jobs: answer an interview, rate a page of options in your browser, and approve the result. Budget about 60 to 90 minutes.

Two ground rules for the whole run:
- **Nothing about your brand gets invented.** Every option you rate is built from something you already have. Where you have nothing, the guide records an open decision rather than filling the blank with a guess.
- **Your corrections outrank the analysis.** Every time.

This run covers how your brand **looks**. How it *sounds* belongs to `/king-intelligence:install-email` (which builds your voice from your real sent email) and the `stop-slop` skill. Do not duplicate voice rules here; two files describing your voice will disagree the first time one is corrected.

## Before the steps (Claude checks these)

1. **Files here must persist.** Confirm this session lives in a real workspace, project folder, or repo that will still exist next conversation. If it will not (a throwaway chat window), stop and tell the user plainly to run /install-brand from Claude Code or another setup that keeps files.

2. **The picture tool is required.** The gate works by making Claude LOOK at the guide, not read it, so the guide has to become images. That needs the `playwright` **library**, installed in the user's workspace.

   **This is not the same thing as `/king-intelligence:install-playwright`**, which sets up the Playwright MCP *browser* for clicking around websites. Having that one does not give you this one. Check from the workspace root:

   ```bash
   node -e "import('playwright').then(()=>console.log('PICTURE TOOL OK')).catch(()=>console.log('PICTURE TOOL MISSING'))"
   ```

   If it is missing, install it in their workspace and wait for both commands to finish:

   ```bash
   npm install --save-dev playwright && npx playwright install chromium
   ```

   The browser download alone can take a couple of minutes on a first run. Do not proceed without it and do not quietly ship a weaker gate: reading the written rules is exactly what already failed.

3. **Find the config.** Run this and hold onto the printed CONFIG_PATH:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/adapt-context.mjs" "${CLAUDE_PLUGIN_ROOT}" "${CLAUDE_PLUGIN_DATA}"
   ```

   Your brand settings live in that file under `skills.brand`. Never edit any file under the plugin code folder itself; those are the shipped tools and updates overwrite them.

4. **Is this a re-run?** If `skills.brand` already exists, switch to **Re-running** at the bottom of this file. Do not start over, and do not overwrite their guide.

## The steps, in order

### Step 1 of 6: Capture what is already true

Read their real material and pull out **facts only**. Sources, in order of how much they prove:

1. Their live website — fetch it and read the actual stylesheet. Colours in use, fonts actually loaded, how headings are set.
2. Logo files in the workspace. Note every variant that exists and what background each is for.
3. Any brand document they already paid for (a PDF or deck from a designer). Ask them to point at it.
4. Past decks, proposals, social profiles, printed material they can photograph.

Rules for this step:
- **A colour used once is not a brand colour.** Report frequency, not presence.
- Record where each fact came from, so they can argue with it.
- If something contradicts (the site uses two different blues), do not pick a winner. Bring it to them in Step 2.

Show them what you found as a short list, and say plainly how thin or thick it is. A three-line capture is an honest result for a business with a logo and nothing else.

### Step 2 of 6: The interview

Ask through `AskUserQuestion`, **one question at a time**, waiting for each answer. Put a real recommendation first in every question. Cover:

1. The contradictions from Step 1 — which one is right.
2. What they would never use. Colours, styles, a look they hate. This becomes the dead list, and the dead list is what the checker enforces.
3. What a past designer or agency got wrong.
4. Where work for **their own customers** lives, if they do work for other people. That folder gets carved out: those deliverables carry the customer's brand, not theirs. Without this, an agency gets stopped on every file they build in a customer's colours, and they will switch the gate off.
5. Whether they generate images with a command Claude runs, and if so what it is.

### Step 3 of 6: One rating round

Build `brand/RATE-ME.html` in their workspace from `templates/rate-me.html`. It holds 10 to 15 options.

**Every option must be derived from their real material.** Their actual logo shape, colours already on their site, type already in use. Never a direction invented from nothing.

Where they have no material for a decision, do **not** manufacture options. Put the decision in the guide's open-decisions list instead, and tell them what it would take to close it.

Requirements the template already handles: it is one self-contained file they double-click, ratings save in their browser, and a "copy my ratings" button produces a digest they paste back to you.

Open it for them, wait for the digest, and read their notes as carefully as their stars. A killed option with a reason is the most valuable output of this whole run.

### Step 4 of 6: Lock it

1. **Write `brand/BRAND-LAW.md`** — their decisions in plain sentences. Each rule states what it is and why they chose it. Include an **Open decisions** section listing every gap, so the thin parts are visible rather than hidden.

2. **Build `brand/BRAND-GUIDE.html`** from `templates/guide.html`: one chapter per decided area, plus a final **dead list** chapter naming everything they rejected. Give every chapter a stable `id`, because the snapshot renderer captures by id.

3. **Render the pictures:**

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/brand-snapshots.mjs"
   ```

4. **Build the ban list.** Every entry traces to something real:
   - Exact colours they killed in the rating round → `bannedHexes`, each with the reason in its own words
   - A whole family they rejected → `bannedColorFamilies` (hue range) and `bannedNamedColors`
   - Anything else they named → `bannedPatterns`

   The universal AI tells (glow balls, fake procedural texture) are already built in and need no configuration.

   **Do not add a ban you cannot trace to something they said.** A checker that cries wolf gets switched off, and then they have nothing.

### Step 5 of 6: Wire it

1. Merge into the config at CONFIG_PATH under `skills.brand`, leaving every other skill's wiring untouched:

   ```json
   {
     "lawPath": "brand/BRAND-LAW.md",
     "guidePath": "brand/BRAND-GUIDE.html",
     "snapshotDir": "brand/guide-snapshots",
     "ratingFilePath": "brand/RATE-ME.html",
     "baselinePath": "brand/brand-check-baseline.json",
     "requiredSnapshots": ["00-overview.png", "99-dead-list.png"],
     "chapters": [{ "id": "c2", "file": "01-colors.png", "label": "colours" }],
     "carveOut": ["clients"],
     "palette": { "primary": "#XXXXXX", "sanctioned": ["#XXXXXX"], "driftRadius": 22 },
     "bannedHexes": [{ "hex": "#XXXXXX", "why": "their words" }],
     "bannedColorFamilies": [],
     "bannedNamedColors": [],
     "bannedPatterns": [],
     "imageGenPatterns": [],
     "gateDocuments": true,
     "enforce": true
   }
   ```

   Set top-level `"_status": "CONFIGURED"`, `mkdir -p` the data folder, save. This config file is the only plugin-side file this run ever writes.

2. **Grandfather what already exists.** Their old files predate these rules, and failing on all of them makes the checker noise:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/brand-check.mjs" --update-baseline
   ```

   Tell them the number plainly: their existing files are recorded as-is, and from here the checker only stops **new** breaks.

3. **Write the pointer into their own standing instructions** (their CLAUDE.md or equivalent) so it survives this session: where the law lives, that visual work starts by looking at the guide, and that the dead list is enforced.

### Step 6 of 6: Live test, required

Build one real surface with them right now — whatever they actually need next. Then confirm, out loud, three things happened:

1. **The gate fired.** Claude was stopped and had to look at the guide first.
2. **The checker passed.** Run it on the file you just made.
3. **They looked at the result and it is theirs.**

If any of the three did not happen, fix it in this session. A gate that did not fire on its first real test is not installed, whatever the config says.

Then **offer** (do not require) the last step: push their brand as design cards to their claude.ai project with `DesignSync`, so their look follows them into Cowork and the phone app. If they decline or the login is a problem, the run is still complete.

## Re-running

Their hand-edits are the most valuable thing in the file, because they came from real work going wrong. So a re-run never overwrites:

1. Read the existing law, guide and config.
2. Show what you would change and why, as a short list.
3. Write only what they approve, and leave everything else exactly as it is.
4. Re-render the pictures afterwards, or the gate will correctly refuse them as stale.

## Standing rules this run leaves behind

- Visual work starts by looking at the guide. Every time, not just the first.
- Never invent a brand fact. An unknown is an open decision, not a guess.
- When they correct something Claude made, update the law or the ban list in the same session, so they never give the same correction twice.
- The checker's rules only ever grow from real corrections. Never pad the list.
- Work for their own customers uses the **customer's** brand, never theirs.

## If you hit a snag

- **The gate will not go quiet.** It wants the two required pictures actually read with the Read tool, by their configured filenames. Check the names in the config match what is on disk.
- **The gate fires on something that is not visual work.** Tighten the scope in their config's `carveOut`. Do not disable the gate and do not widen it until it stops meaning anything.
- **The checker flags something correct.** Fix the specific rule in their config. A false positive is a rule that is too broad, not a reason to turn the checker off.
- **Snapshots keep going stale.** That is working as designed: the guide changed after the pictures were taken. Re-render.
- **They have almost no brand.** That is a normal outcome, not a failure. A short honest law with a visible list of open decisions beats a padded one, and they can close the decisions later by re-running.
