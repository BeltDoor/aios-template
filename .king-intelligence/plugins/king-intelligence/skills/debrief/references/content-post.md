# Phase 6 — turn the meeting into a LinkedIn post

The brain for the LinkedIn-post offer that runs at the very END of every debrief, after the closing report. The user shares THEIR lesson from the work, in THEIR voice, with the client anonymized, and posts to their personal feed only on an explicit "post it." This never auto-fires. This whole phase is gated on the `socialPublishTool` from your settings (`## debrief` section of `references/king-intelligence-config.md`) — SKILL.md skips it when that's unset; the publish destination uses the `socialAccountId` and `socialIsPersonalFeed` from your settings.

**The contract:** one clean offer, never a nag. Always find the single most postable thing (a business lesson OR a human moment), lead with it, and stop. No "nothing here" hedge.

---

## Step 1 — Find the ONE angle (mine the ledger + summary, don't re-read the transcript)

You already built the Phase 2 signal ledger and the Phase 3B summary. Mine THOSE. Source priority, highest content potential first:

1. **Offer / strategy ideas (signal type 4)** — a sharp reframe of how the user runs their business/offer/pricing. The richest "here's what I learned" source.
2. **What Resonated** (summary) — a claim that visibly landed ("I said X and watched it click").
3. **Notable Quotes** (summary) — a line that reveals a transferable truth. **GUARD: only if diarization is high-confidence** (a misattributed quote is a reputational risk even anonymized; if the source line is garbled, skip the quote and use a lesson angle instead).
4. **Project work (type 5)** — a build/struggle told as a "story without the scar."
5. **A human / relatable moment** — the catch-all so there is ALWAYS something. Even a logistics-only check-in usually has one human beat (a shared frustration, a small win, a funny aside, something the owner said about their life). This is the "even if it's not business" lane.

**Pick exactly ONE.** Score candidates on: transferability (does it teach a stranger something), user-centricity (is it THEIR lesson, not the client's content), anonymizability (does it survive name/number stripping and still land). Take the single highest. Do NOT present three angles here, the three-hook pick happens inside `/content-unit`.

**Gold vs human (sets the tone of the offer, not whether you offer):**
- **Gold** = a type-4 reframe, or a resonance with a specific reaction, or a principle the user articulated. Lead with conviction.
- **Human** = logistics-heavy meeting with no business lesson. Lead honestly: "Nothing business-y jumped out, but the human angle is X."

---

## Step 2 — Offer it (the stanza, below the closing report)

Print ONE short stanza after the closing report:

```
LinkedIn post (optional):
  Angle: <the lesson/moment in one line, already anonymized>
  Draft it? (yes / "name them" to keep the client in / skip)
```

Thin/human version:
```
LinkedIn post (optional):
  Nothing business-y jumped out of this one. The human angle: <X>.
  Draft it? (yes / skip)
```

If the user says skip, stop. If "name them," carry the real name through (they've confirmed the client is fine with it). Default is anonymized.

---

## Step 3 — Anonymize BEFORE the handoff (belt + suspenders)

Debrief is the only layer that knows who the client is, so strip identity HERE, before `/content-unit` ever sees the material:
- No client name, no company name. "A contractor I work with," not "Dana at Maple Builders."
- No identifying numbers (their revenue, headcount, the exact deal size). Generalize ("a few tools," not "$4,200 of software").
- No detail that fingers them by combination (their exact niche + city + a unique fact).
- **Override:** if the user said "name them," keep the real name/details. They own that call.

---

## Step 4 — Hand the angle to `/content-unit` (via the Skill tool)

Invoke the `content-unit` skill with the anonymized angle + the supporting beats as the raw material. Notes:
- **Voice:** pass NO voice-profile path. Its default already IS the user's profile (the `voiceGuidePath` from your settings). That's what we want.
- **Anonymized flag:** prepend the material with: *"This input is anonymized by default. Keep it that way: no client name, company, or identifying numbers. If anything identifying slips in, generalize it."*
- **Auto-pick the hook (do NOT surface content-unit's hook question).** In this debrief flow, tell content-unit to "just pick the strongest hook, don't ask" so its AskUserQuestion never fires. The browser preview is the review surface, not a hook gate — one less click; the user reviews the finished post in the preview.
- **Capture the output:** content-unit emits a `── CONTENT UNIT ──` block + a Hook/Retain/Reward breakdown. Capture ONLY the text inside the delimiters as the post body. **Never re-edit it after capture** (that bypasses the stop-slop gate it already passed).
- **Format it airy for LinkedIn.** Put each sentence on its own line with a BLANK line between them (the LinkedIn-native whitespace look). Write the body to the temp `.txt` that way before previewing/publishing, so the posted caption carries the gaps. The card pull-quote auto-breaks its sentences too (render-card.mjs handles that).

---

## Step 5 — Make the image (the swappable plug + rotating queue)

1. **Pick the style:** `node scripts/pick-style.mjs` prints the next style in the rotation and advances the cursor. (Use `--peek` when re-rendering after a reject so you don't burn a rotation slot.)
2. **Derive the card pull-quote** from the finished post: a SHORT punchy line (≤ ~12 words, usually the hook or its sharpest sentence) for the big headline, plus the 2-4 word phrase to highlight in gold. The card is a teaser, not the whole post.
3. **Render:**
   ```
   node scripts/render-card.mjs --style <style> --quote "<short pull-quote>" \
     --highlight "<phrase>" --out "<your temp dir>/li-preview/<slug>/card.png"
   ```
   Prints the PNG path. Rendered locally via headless Chrome, using your brand colors and logo.

**The seam:** `render-card.mjs` is the single integration point with any parallel image work. It renders templates from a local branded-styles library (configured via `LAB_DIR` at the top of the script). If you productionize a different renderer or new styles, repoint `LAB_DIR` (or the queue) and nothing else in Phase 6 changes. Add a style = drop a `<name>.tpl.html` (standard `{{TOKENS}}`) + append the name to `state/image-queue.json` "queue".

---

## Step 6 — Preview in the user's browser (WYSIWYG, before anything fires)

Write the captured post body to a temp `.txt` (avoids shell-quoting multi-paragraph posts), then:
```
node scripts/preview-post.mjs --text-file "<...>/post.txt" --image "<...>/card.png" \
  --style <style> --queue "<N of M>" --open
```
This builds a mock LinkedIn post (their avatar, name, the words, the card) and opens it in their native browser. They react:
- **"post it"** → Step 7.
- **"different style"** → `pick-style.mjs --peek` won't help (it's the same); instead pick another render-ready style (see `pick-style.mjs --list`), re-render, re-preview.
- **"tweak the hook"** / edit → adjust, re-run content-unit's relevant step if needed, re-preview. Never publish an edit that skipped the stop-slop gate.

---

## Step 7 — Publish to the user's PERSONAL LinkedIn, only on "post it"

**Primary path: the `socialPublishTool` from your settings** (e.g. the Blotato MCP — a chat-callable path that posts IMAGES to a personal LinkedIn). Their LinkedIn account = the `socialAccountId` from your settings.
1. Upload the card PNG to get a public URL: `blotato_create_presigned_upload_url` → PUT the bytes → (or `blotato_create_source`) to obtain a hosted media URL.
2. `blotato_create_post` to LinkedIn, **account = the `socialAccountId` from your settings, OMIT pageId** when `socialIsPersonalFeed` from your settings is true (omitting pageId = personal feed; a pageId would post a company page). Caption = the captured post body; media = the uploaded card URL.
3. **Confirm it landed:** report the returned post id/URL. If the create call errors or media upload fails, fall back to Playwright.

**Fallback path: Playwright** (reliable, handles anything the primary tool chokes on). Drive the user's logged-in LinkedIn via a persistent browser profile: open the feed, start a post, attach the local card PNG directly (no public URL needed), paste the caption, publish. (Recovery if the profile is wedged: kill playwright chrome procs + remove the lock file.)

**Gate + caveats:**
- Fire ONLY on an explicit "post it." Never auto-publish (matches debrief rule 5 — nothing outward without the user's trigger).
- **No auto-comment fires on this path.** Keep any pricing auto-comment logic on its own direct-OAuth path if you have one; a Blotato/Playwright post goes out clean. That's intended for "here's what I learned" posts.
- **No API delete.** Once it's live there's no programmatic undo (manual removal in the LinkedIn app only). On the FIRST live post, say so plainly in the gate: "Once this fires it's live on your LinkedIn and there's no undo button on my end. Good to go?" The first real post IS the production test.

---

## Hard rules for Phase 6
- One clean offer, never a nag. One angle. Stop after the offer if they skip.
- Anonymize by default. "name them" is the only override, and only from the user.
- Never quote a client off low-confidence diarization. Downgrade to a lesson or human angle.
- Capture content-unit's delimited block verbatim; never re-edit post-gate.
- Never publish without an explicit "post it." Personal feed (the `socialAccountId` from your settings when `socialIsPersonalFeed` is true / a persistent logged-in browser profile), never a company page unless the user says so.
