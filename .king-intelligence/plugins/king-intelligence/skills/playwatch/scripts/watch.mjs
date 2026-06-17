#!/usr/bin/env node
// playwatch: ask Gemini to actually watch a YouTube OR Google Drive video and answer.
//
// Usage:
//   node watch.mjs --url <youtube-or-drive-url> --question "<question>" \
//       [--start 0s] [--end 45s] [--fps 1] [--paid] [--model <override>]
//
// Defaults:
//   model = gemini-2.5-pro (free tier, GEMINI_API_KEY)
//   --paid flips to gemini-3.1-pro-preview (paid tier, GEMINI_PAID_API_KEY)
//   --model overrides both
//
// URL handling:
//   YouTube (youtube.com / youtu.be): passed directly to Gemini as file_data.file_uri
//   Google Drive (drive.google.com): downloaded via gws, uploaded to Gemini Files API,
//     then file_data.file_uri points at the Gemini files/* URI. Requires gws CLI on PATH.
//   Other hosts: refused.
//
// Writes the response to last-result.md (resolved relative to this script, so it follows the skill if moved).
// Prints token usage and a rough USD cost at the end.

import { writeFile, mkdir, readFile, stat, unlink } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

function parseArgs(argv) {
  const args = { fps: 1, paid: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--paid') { args.paid = true; continue; }
    if (a === '--url') { args.url = argv[++i]; continue; }
    if (a === '--question') { args.question = argv[++i]; continue; }
    if (a === '--start') { args.start = argv[++i]; continue; }
    if (a === '--end') { args.end = argv[++i]; continue; }
    if (a === '--fps') { args.fps = Number(argv[++i]); continue; }
    if (a === '--model') { args.model = argv[++i]; continue; }
  }
  return args;
}

function isYouTubeUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return /(^|\.)youtube\.com$/i.test(u.hostname) || /(^|\.)youtu\.be$/i.test(u.hostname);
  } catch { return false; }
}

function isDriveUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return /(^|\.)drive\.google\.com$/i.test(u.hostname);
  } catch { return false; }
}

function extractDriveFileId(url) {
  // Supports: /file/d/{ID}/view, /file/d/{ID}, /open?id={ID}, /uc?id={ID}
  const u = new URL(url);
  const m = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  const idParam = u.searchParams.get('id');
  if (idParam) return idParam;
  throw new Error(`Could not extract Drive file ID from ${url}`);
}

function safeJsonParse(s) {
  // gws prepends "Using keyring backend: keyring" then the JSON; strip non-JSON prefix lines.
  const trimmed = s.split('\n').filter(l => l.trim().startsWith('{') || l.startsWith(' ') || l.startsWith('}') || l.startsWith('"') || l.startsWith(',') || l.startsWith('[') || l.startsWith(']') || l.trim() === '').join('\n').trim();
  return JSON.parse(trimmed);
}

// On Windows, gws is a .cmd shim that Node's spawn won't resolve without shell:true.
// Use shell:true on Windows and shell-quote the JSON params.
const GWS_USE_SHELL = process.platform === 'win32';
function shellQuote(s) {
  // Wrap in double quotes, escape internal double quotes. Args here are JSON or simple flags.
  return '"' + String(s).replace(/"/g, '\\"') + '"';
}
function runGws(args) {
  if (GWS_USE_SHELL) {
    const cmd = 'gws ' + args.map(shellQuote).join(' ');
    return execFileSync(cmd, { encoding: 'utf8', shell: true });
  }
  return execFileSync('gws', args, { encoding: 'utf8' });
}

function driveGetMetadata(fileId) {
  const out = runGws([
    'drive', 'files', 'get',
    '--params', JSON.stringify({ fileId, fields: 'id,name,mimeType,size' }),
  ]);
  return safeJsonParse(out);
}

function driveDownload(fileId, destPath) {
  runGws([
    'drive', 'files', 'get',
    '--params', JSON.stringify({ fileId, alt: 'media' }),
    '-o', destPath,
  ]);
}

async function geminiFilesUpload(apiKey, localPath, mimeType, displayName) {
  const bytes = statSync(localPath).size;
  const startRes = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!startRes.ok) throw new Error(`Files API start failed: ${startRes.status} ${await startRes.text()}`);
  const uploadUrl = startRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Files API did not return an upload URL');
  const data = await readFile(localPath);
  const upRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(bytes),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: data,
  });
  if (!upRes.ok) throw new Error(`Files API upload failed: ${upRes.status} ${await upRes.text()}`);
  const meta = await upRes.json();
  return meta.file;
}

async function geminiFilesWaitActive(apiKey, fileObj, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileObj.name}`, {
      headers: { 'x-goog-api-key': apiKey },
    });
    const meta = await r.json();
    if (meta.state === 'ACTIVE') return meta;
    if (meta.state === 'FAILED') throw new Error(`Files API processing FAILED: ${JSON.stringify(meta)}`);
    await new Promise(res => setTimeout(res, 2000));
  }
  throw new Error('Timed out waiting for Files API to mark file ACTIVE');
}

async function prepareDriveVideo(apiKey, url) {
  const fileId = extractDriveFileId(url);
  console.log(`Drive file id: ${fileId}`);
  const meta = driveGetMetadata(fileId);
  if (!meta.mimeType || !meta.mimeType.startsWith('video/')) {
    throw new Error(`Drive file ${fileId} is not a video (mimeType=${meta.mimeType})`);
  }
  const sizeBytes = Number(meta.size ?? 0);
  console.log(`Drive metadata: ${meta.name} (${meta.mimeType}, ${(sizeBytes / 1_000_000).toFixed(1)} MB)`);
  const ext = meta.name.includes('.') ? meta.name.slice(meta.name.lastIndexOf('.')) : '.bin';
  const tmpPath = join(tmpdir(), `playwatch_${fileId}${ext}`);
  console.log(`Downloading to ${tmpPath}...`);
  driveDownload(fileId, tmpPath);
  console.log(`Uploading to Gemini Files API...`);
  const uploaded = await geminiFilesUpload(apiKey, tmpPath, meta.mimeType, meta.name);
  console.log(`  uploaded as ${uploaded.name}, state=${uploaded.state}`);
  const active = await geminiFilesWaitActive(apiKey, uploaded);
  console.log(`  ACTIVE: ${active.uri}`);
  // Clean up local copy; the Gemini-side file lives ~48h server-side.
  try { await unlink(tmpPath); } catch {}
  return { mime_type: active.mimeType, file_uri: active.uri };
}

// Pricing reference (per 1M tokens, USD). Used for the cost estimate line.
// Sources: ai.google.dev pricing pages as of 2026-05.
const PRICING = {
  'gemini-2.5-pro':         { in: 1.25, out: 10.00 },
  'gemini-2.5-flash':       { in: 0.30, out:  2.50 },
  'gemini-3-flash-preview': { in: 0.30, out:  2.50 },
  'gemini-3.1-pro-preview': { in: 1.50, out: 12.00 },
};

function estimateCost(model, usage) {
  const p = PRICING[model];
  if (!p || !usage) return null;
  const inTok = usage.promptTokenCount ?? 0;
  const outTok = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
  const cost = (inTok * p.in + outTok * p.out) / 1_000_000;
  return { inTok, outTok, cost };
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.url || !args.question) {
    console.error('Usage: watch.mjs --url <youtube-or-drive-url> --question "<question>" [--start 0s] [--end 45s] [--fps 1] [--paid] [--model <override>]');
    process.exit(2);
  }

  const youtube = isYouTubeUrl(args.url);
  const drive = isDriveUrl(args.url);
  if (!youtube && !drive) {
    console.error(`Refusing: ${args.url} is not a YouTube or Google Drive URL.`);
    console.error('Supported hosts: youtube.com, youtu.be, drive.google.com. LinkedIn, Vimeo, TikTok, X/Twitter, and direct mp4 URLs will not work.');
    process.exit(2);
  }

  const model = args.model ?? (args.paid ? 'gemini-3.1-pro-preview' : 'gemini-2.5-pro');
  const keyVar = args.paid ? 'GEMINI_PAID_API_KEY' : 'GEMINI_API_KEY';
  const apiKey = process.env[keyVar];
  if (!apiKey) {
    console.error(`${keyVar} is not set in this process env.`);
    console.error('Set it as an env var and relaunch the shell, or inject it for this run.');
    process.exit(2);
  }

  const videoMetadata = {};
  if (args.start) videoMetadata.start_offset = args.start;
  if (args.end) videoMetadata.end_offset = args.end;
  if (args.fps && args.fps !== 1) videoMetadata.fps = args.fps;

  let filePart;
  if (drive) {
    const prepared = await prepareDriveVideo(apiKey, args.url);
    filePart = {
      file_data: prepared,
      ...(Object.keys(videoMetadata).length ? { video_metadata: videoMetadata } : {}),
    };
  } else {
    filePart = {
      file_data: { file_uri: args.url },
      ...(Object.keys(videoMetadata).length ? { video_metadata: videoMetadata } : {}),
    };
  }

  const body = {
    contents: [{
      parts: [
        { text: args.question },
        filePart,
      ],
    }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const clip = args.start || args.end ? ` [${args.start ?? '0s'} to ${args.end ?? 'end'}]` : '';
  console.log(`Calling ${model} on ${args.url}${clip} at ${args.fps} FPS (key: ${keyVar})...`);

  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (!res.ok) {
    const errText = await res.text();
    console.error(`\nHTTP ${res.status} after ${elapsed}s`);
    console.error(errText);
    process.exit(1);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '(empty response)';
  const usage = data?.usageMetadata ?? {};
  const finish = data?.candidates?.[0]?.finishReason ?? 'unknown';

  console.log(`\n=== ${model} response (${elapsed}s, finish=${finish}) ===\n`);
  console.log(text);

  const est = estimateCost(model, usage);
  console.log('\n=== Token usage ===');
  console.log(JSON.stringify(usage, null, 2));
  if (est) {
    console.log(`\n=== Cost estimate ===`);
    console.log(`Input: ${est.inTok.toLocaleString()} tokens`);
    console.log(`Output: ${est.outTok.toLocaleString()} tokens (incl. thinking)`);
    console.log(`Approx USD: $${est.cost.toFixed(4)}`);
  }

  const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'last-result.md');
  const md = [
    `# playwatch last result`,
    ``,
    `- URL: ${args.url}`,
    `- Question: ${args.question}`,
    `- Model: ${model} (key: ${keyVar})`,
    `- Clip: ${args.start ?? '0s'} to ${args.end ?? 'end'} at ${args.fps} FPS`,
    `- Elapsed: ${elapsed}s, finish=${finish}`,
    est ? `- Cost estimate: $${est.cost.toFixed(4)} (in=${est.inTok.toLocaleString()}, out=${est.outTok.toLocaleString()})` : '',
    ``,
    `## Response`,
    ``,
    text,
    ``,
    `## Usage metadata`,
    ``,
    '```json',
    JSON.stringify(usage, null, 2),
    '```',
    ``,
  ].filter(Boolean).join('\n');
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, md, 'utf8');
  console.log(`\nSaved to: ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
