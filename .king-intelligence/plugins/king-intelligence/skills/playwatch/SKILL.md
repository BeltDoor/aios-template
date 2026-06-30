---
name: playwatch
description: Actually watch a YouTube video, a Google Drive video, OR a local video file on disk end-to-end using Google Gemini's native video understanding API (visual frames + audio track processed together at native frame rate), NOT Playwright screenshots or transcript-only summaries. Use this skill whenever the user pastes a YouTube URL or a drive.google.com video URL with a question, points at a local video file path (e.g. a screen recording under ~/Videos), asks to "watch", "analyze", "summarize", or "review" a video, asks what something says/does/shows in a video, or wants shot-by-shot breakdown of visual style, transitions, motion, or on-screen text. Use proactively the moment a youtube.com, youtu.be, or drive.google.com video URL, or a local video file path, appears alongside any analytical question, even when the user does not explicitly say "watch". Refuse and explain when the URL is LinkedIn, Vimeo, TikTok, X/Twitter, or any other remote host because Gemini's URL preview supports YouTube, and Drive/local videos are handled through a Files-API upload path that does not generalize to other hosts.
---

# playwatch

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

This skill makes Claude pass a YouTube URL directly to Gemini's `generateContent` API, OR download a Google Drive video, upload it to Gemini's Files API, and then call `generateContent` against that upload. Gemini processes visual frames AND the audio track inside a single neural network and answers the user's question. This is materially different from Playwright + frame screenshots, which lose motion, transitions, audio prosody, and any timing-based nuance.

## When to invoke

The user does not need to say "use this skill". Trigger on ANY of:

- A YouTube URL pasted alongside a question, request, or instruction.
- A Google Drive video URL (`drive.google.com/file/d/...` or `drive.google.com/open?id=...`) pasted alongside a question.
- A **local video file path** (e.g. `~/Videos/screen-recording.mp4`) the user wants watched — e.g. confirming a recording looks smooth, summarizing a screen capture, reviewing an exported clip.
- Phrases like "watch this", "analyze this video", "summarize this clip", "what does this video say about X", "what transitions does this use", "list every product mentioned", "extract the agenda from this talk".
- Explicit `/playwatch` invocation.

Do NOT trigger on LinkedIn video URLs, Vimeo, TikTok, X/Twitter video, or remote direct .mp4 links. Three supported inputs: YouTube (native URL ingest), Google Drive (download + Files-API upload), and a **local video file path** (uploaded straight to the Files API, no Drive round-trip). The script refuses with exit code 2 for anything else. Fail fast: tell the user the limitation and ask if they can re-upload to YouTube, share via Drive, or point at a local file.

### Drive-specific prerequisites

The Drive path shells out to `gws` (Google Workspace CLI) to fetch metadata and download the file, then calls Gemini's Files API directly. Requirements:

- `gws` must be authenticated for the account that owns the Drive file.
- The Drive file's mimeType must start with `video/`. Non-video files are refused.
- The Drive file is downloaded to the OS temp dir, uploaded to Gemini (where it lives ~48h server-side), then the local copy is deleted. Drive sharing perms do not need to be loosened.

## How to invoke

The skill is a Node.js script. Call it via Bash. The script lives at:

```
${CLAUDE_PLUGIN_ROOT}/skills/playwatch/scripts/watch.mjs
```

Minimum required args:

```
node "${CLAUDE_PLUGIN_ROOT}/skills/playwatch/scripts/watch.mjs" \
  --url "<youtube-url, drive-url, OR local video file path>" \
  --question "<the user's actual question, in their own words>"
```

`--url` accepts all three input types. Drive URLs trigger the download + upload steps automatically; a **local video file path** is uploaded straight to the Gemini Files API (no Drive round-trip — this is the path for watching local recordings on disk). Example, checking a local recording for playback smoothness:

```
node "${CLAUDE_PLUGIN_ROOT}/skills/playwatch/scripts/watch.mjs" \
  --url "~/Videos/screen-recording.mp4" \
  --question "Does this play back smoothly or is there stutter/lag?" --fps 5
```

Optional args:

- `--start <offset>`: clip start, e.g. `0s`, `45s`, `2m30s`. Defaults to start of video.
- `--end <offset>`: clip end. Defaults to end of video.
- `--fps <n>`: visual sampling frame rate. Default `1`. See FPS guidance below.
- `--paid`: switch from free tier (Gemini 2.5 Pro) to paid tier (Gemini 3.1 Pro Preview). See paid gate below.
- `--model <id>`: explicit model override. Skip the auto free/paid choice.

Pass the user's question verbatim where possible. Gemini does better with the user's actual words than with a sanitized rewrite. Only rewrite the prompt to add structure when the user asks something open-ended like "tell me about it" and you want shot-by-shot output instead of a one-paragraph summary.

## Choosing the right FPS

Default 1 FPS works for talking-head content, podcast clips, lectures, demos with slow visuals, and most summary-style questions. The audio track is fully processed regardless of FPS, so dialogue and narration are captured even at 1 FPS.

Bump FPS to 5 when the user asks about:

- Transitions, cuts, edits, motion graphics, animation
- Visual style, color grading, on-screen text overlays
- Anything cinematographic ("shot-by-shot", "scene-by-scene", "how is this edited")

Bump FPS to 10 only for fast action: sports, fight scenes, rapid demos, sleight of hand. Higher FPS costs proportionally more tokens, so do not go above 5 unless the content needs it.

## Free vs paid: the cost gate

Two API keys are used:

- `GEMINI_API_KEY` (free tier). Default. Works on Gemini 2.5 Pro, plenty for transcript-style summaries and most analytical questions.
- `GEMINI_PAID_API_KEY` (paid tier). Required for `gemini-3.1-pro-preview`. Materially stronger at visual nuance (transitions, on-screen text, fine motion), but costs roughly $0.05-0.07 per 45-second deep-analysis call.

Use `--paid` ONLY when:

- The user explicitly says "use Gemini 3 Pro", "use the paid key", "use the strong model", or similar.
- The user is asking for visual nuance the free model is likely to miss (transitions, frame-accurate motion, fine on-screen text), AND no prior auth has been given. In that case, surface a cost gate via AskUserQuestion before running, with options like:
  - "Use paid Gemini 3.1 Pro (~$0.05-0.07 for this clip)" (recommended)
  - "Stick with free Gemini 2.5 Pro and accept it may miss some nuance"

Once the user authorizes paid for the current task, do not re-ask for follow-up calls in the same conversation.

## The shell wrapper for paid runs

On Windows, the paid env var lives at User scope and may not be visible in the bash session Claude Code runs. To pass it through, use this PowerShell wrapper pattern:

```
powershell -Command "$env:GEMINI_API_KEY = [Environment]::GetEnvironmentVariable('GEMINI_PAID_API_KEY','User'); node '${CLAUDE_PLUGIN_ROOT}/skills/playwatch/scripts/watch.mjs' --url '<url>' --question '<question>' --paid"
```

For free-tier runs, plain bash works because `GEMINI_API_KEY` is in the inherited env:

```
node "${CLAUDE_PLUGIN_ROOT}/skills/playwatch/scripts/watch.mjs" --url "<url>" --question "<question>"
```

Quoting: if the question contains apostrophes, single-quote it inside the powershell `--question '...'` argument, and double-escape internal single quotes as `''`. Or write a small helper `.ps1` file in `~/` with the args and invoke that.

## What to do with the response

The script prints:

1. The Gemini response (markdown).
2. Token usage breakdown.
3. A USD cost estimate.

It also saves a full record to `last-result.md` (next to the script, inside the skill folder) so you can reference it after the chat scrolls past.

After the script returns, surface the response to the user. Keep your wrapper commentary tight: lead with the answer, then offer next steps (e.g., "want me to re-run at higher FPS for more visual detail", or "want me to escalate to paid Gemini 3 Pro for nuance").

## Failure modes to watch for

- **`RESOURCE_EXHAUSTED` 429 on `gemini-3.1-pro-preview`**: the paid env var is not actually flowing through. Re-check with `powershell -Command "[Environment]::GetEnvironmentVariable('GEMINI_PAID_API_KEY','User').Length"` (should be 39).
- **`UND_ERR_HEADERS_TIMEOUT`**: Node's fetch headers timeout fired. Usually means the Gemini server is processing a long clip. Retry once before assuming a real failure.
- **HTTP 400 with "video too long"**: clip the request with `--start` and `--end`, or split into multiple calls.
- **HTTP 500 instantly on a YouTube URL**: often NOT a length/credits limit. The common cause is requesting a `--start`/`--end` offset PAST the video's actual end (e.g. asking for the "10-15 min mark" of a 5:46 video). ALWAYS check duration first: `yt-dlp --print "%(duration)s" <url>`; never assume length. To watch a long video locally, download + feed the local file: `yt-dlp --js-runtimes node <url>` (Node is already installed, NO `brew install deno` needed) to grab it (e.g. 480p), then `ffmpeg -ss -t` to clip, then feed the LOCAL file. (`--download-sections` + `--force-keyframes-at-cuts` failed with ffmpeg 222; use a plain `-ss -t` clip instead.) A genuine per-video ingest limit can also 500 on very long videos; the local-file path handles those too.
- **HTTP 400 with "video is private"**: only public YouTube videos work. Unlisted is treated as not public by the API. Tell the user to ask the uploader to make it public, or skip.
- **The response is "I cannot watch the video"**: this means the model received the prompt but no video data was attached. Double-check the URL is a valid YouTube watch URL and not a channel/playlist link.

### Drive-path failure modes

- **`spawnSync gws ENOENT`**: `gws` CLI isn't installed or not on PATH. Install via the Google Workspace CLI repo + run `gws auth login` once for your Google account.
- **`Drive file <id> is not a video`**: the file's mimeType doesn't start with `video/`. Confirm the link points at the actual video file (not a folder, doc, or slide deck).
- **`Files API processing FAILED`**: Gemini rejected the upload during async processing. Usually a codec issue. Re-encode to H.264 mp4 or upload to YouTube as unlisted and pass the YouTube URL instead.
- **`Timed out waiting for Files API to mark file ACTIVE`**: processing took longer than 2 minutes. Re-run; for very large files (>500 MB) the wait can stretch.
- **403 on the `gws drive files get`**: the authenticated `gws` account doesn't have read access to the file. Re-auth `gws` against the owner account, or have the owner share the file with the authenticated account.

## Voice rules for the wrapped response

When relaying the model's response:

- No em-dashes anywhere in your wrapper text. Use commas, periods, or colons.
- Be tight. Do not pad. If the model wrote a long structured analysis, surface it as is. If you must summarize, lead with the answer in one sentence, then the structured part.

## Example invocations

### Quick summary of a podcast clip (free tier, default)

User pastes a YouTube link and asks "what's the main argument here?"

```
node "${CLAUDE_PLUGIN_ROOT}/skills/playwatch/scripts/watch.mjs" \
  --url "https://www.youtube.com/watch?v=XXXXX" \
  --question "What is the main argument the speaker makes in this clip?"
```

### Transition / visual style analysis (paid tier, bumped FPS)

User pastes a creator's intro and says "I want to copy the smooth transitions, walk me through how they do them in the first 45 seconds":

First call AskUserQuestion to confirm paid cost. Then:

```
powershell -Command "$env:GEMINI_API_KEY = [Environment]::GetEnvironmentVariable('GEMINI_PAID_API_KEY','User'); node '${CLAUDE_PLUGIN_ROOT}/skills/playwatch/scripts/watch.mjs' --url 'https://www.youtube.com/watch?v=XXXXX' --question 'For each distinct shot in the first 45 seconds, name the transition technique that gets you into it (whip pan, match cut, alpha matte text wipe, slide and crop, etc.) and describe how to replicate it in After Effects. Also identify any glassmorphism / motion-graphic style choices.' --start 0s --end 45s --fps 5 --paid"
```

### Specific timestamp range, not the whole video

User asks "what does the speaker say about pricing in this clip" but the video is 40 minutes long and pricing is around minute 12.

Ask the user to pin the rough range. Then:

```
node "${CLAUDE_PLUGIN_ROOT}/skills/playwatch/scripts/watch.mjs" \
  --url "<url>" \
  --question "What does the speaker say about pricing, and what numbers does he reference?" \
  --start 11m0s --end 14m0s
```

### Drive video identification or summary (free tier, default)

User pastes a Drive video link and asks what it shows. No flag change needed; the script handles Drive automatically.

```
node "${CLAUDE_PLUGIN_ROOT}/skills/playwatch/scripts/watch.mjs" \
  --url "https://drive.google.com/file/d/1tjV13QXYYnvWxyktaa3AB3jYbKi9BTk7/view?usp=drivesdk" \
  --question "In one sentence, what does this short clip actually show?"
```

Drive URLs print extra progress lines (file id, download path, Files API upload, ACTIVE state) before the model response, which is normal.

## What this skill is NOT for

- Generating videos (Gemini does not generate; that is Veo / Sora territory).
- LinkedIn / Vimeo / TikTok / X / direct .mp4 URL analysis (the script refuses anything that isn't YouTube or `drive.google.com`).
- Real-time / streaming video (only finished, fully-uploaded clips).
- Audio-only files / podcasts (use Whisper instead).
- Drive files that aren't videos (the script's mimeType check refuses anything that doesn't start with `video/`).
