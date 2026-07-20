# playwatch troubleshooting

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

Error-to-fix map for `scripts/watch.mjs` runs. Read this whole file before retrying a failed run.

## Failure modes to watch for

- **`RESOURCE_EXHAUSTED` 429 on `gemini-3.1-pro-preview`**: the paid env var is not actually flowing through. Re-check with `printenv GEMINI_PAID_API_KEY | wc -c` (should be 39, plus a trailing newline).
- **`UND_ERR_HEADERS_TIMEOUT`**: Node's fetch headers timeout fired. Usually means the Gemini server is processing a long clip. Retry once before assuming a real failure.
- **HTTP 400 with "video too long"**: clip the request with `--start` and `--end`, or split into multiple calls.
- **HTTP 500 instantly on a YouTube URL**: often NOT a length/credits limit. The common cause is requesting a `--start`/`--end` offset PAST the video's actual end (e.g. asking for the "10-15 min mark" of a 5:46 video). ALWAYS check duration first: `yt-dlp --print "%(duration)s" <url>`; never assume length. To watch a long video locally, download + feed the local file: `yt-dlp --js-runtimes node <url>` (Node is already installed, NO `brew install deno` needed) to grab it (e.g. 480p), then `ffmpeg -ss -t` to clip, then feed the LOCAL file. (`--download-sections` + `--force-keyframes-at-cuts` failed with ffmpeg 222; use a plain `-ss -t` clip instead.) A genuine per-video ingest limit can also 500 on very long videos; the local-file path handles those too.
- **HTTP 400 with "video is private"**: only public YouTube videos work. Unlisted is treated as not public by the API. Tell the user to ask the uploader to make it public, or skip.
- **The response is "I cannot watch the video"**: this means the model received the prompt but no video data was attached. Double-check the URL is a valid YouTube watch URL and not a channel/playlist link.

## Drive-path failure modes

- **`spawnSync gws ENOENT`**: `gws` CLI isn't installed or not on PATH. Install via the Google Workspace CLI repo + run `gws auth login` once for your Google Workspace account.
- **`Drive file <id> is not a video`**: the file's mimeType doesn't start with `video/`. Confirm the link points at the actual video file (not a folder, doc, or slide deck).
- **`Files API processing FAILED`**: Gemini rejected the upload during async processing. Usually a codec issue. Re-encode to H.264 mp4 or upload to YouTube as unlisted and pass the YouTube URL instead.
- **`Timed out waiting for Files API to mark file ACTIVE`**: processing took longer than 2 minutes. Re-run; for very large files (>500 MB) the wait can stretch.
- **403 on the `gws drive files get`**: the authenticated `gws` account doesn't have read access to the file. Re-auth `gws` against the owner account, or have the owner share the file with the authenticated account.
