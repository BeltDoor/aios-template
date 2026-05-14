#!/usr/bin/env node
// otter-pull.mjs — pull meeting transcripts from the connected Otter account.
// The post-meeting skill calls this to get a transcript to work from.
//
// Usage:
//   node otter-pull.mjs              # pull recent meetings, write them to state, list them
//   node otter-pull.mjs --latest     # same, but also print the single most recent in full
//
// Reads OTTER_API_KEY from the folder's .env (set by connect-otter.mjs).
// Otter response shape verified against the live API — see references/otter-api.md.

import { getEnv, log, writeState, STATE_DIR, ensureDir, fs, path } from './lib.mjs';

// Set the exit code without calling Node's process.exit() — doing that while a
// fetch socket is tearing down triggers a libuv assertion on Windows.
const exit = (code) => { process.exitCode = code; };

const LATEST = process.argv.includes('--latest');
const ENDPOINT = 'https://otter.ai/forward/api/public/speech/export';

async function main() {
  const key = getEnv('OTTER_API_KEY');
  if (!key) {
    log.fail(
      'No Otter key found.',
      'OTTER_API_KEY is not in your .env — Otter is not connected yet.',
      'Connect it first: node .claude/skills/connect-kit/scripts/connect-otter.mjs',
    );
    return exit(1);
  }

  let res;
  try {
    res = await fetch(ENDPOINT, { headers: { Authorization: `Bearer ${key}` } });
  } catch (err) {
    log.fail('Could not reach Otter.', err.message, 'Check your internet and try again.');
    return exit(2);
  }

  const ct = res.headers.get('content-type') || '';
  if (!res.ok || !ct.includes('application/json')) {
    // Otter's SPA returns 200 + HTML on a bad path or expired key — guard against it.
    log.fail(
      'Otter did not return your meetings.',
      `Got ${res.status} (${ct || 'no content type'}). The key may have expired.`,
      'Re-connect Otter: node .claude/skills/connect-kit/scripts/connect-otter.mjs',
    );
    return exit(3);
  }

  const speeches = await res.json();
  if (!Array.isArray(speeches)) {
    log.fail('Otter sent back something unexpected.', 'The response was not a list of meetings.', 'Try again, or re-connect Otter.');
    return exit(4);
  }

  // Trim each speech to the fields the post-meeting skill actually needs.
  const meetings = speeches
    .filter((s) => s && s.otid)
    .map((s) => ({
      otid: s.otid,
      title: s.title || 'Untitled meeting',
      url: s.url || '',
      guests: (s.calendar_guests || []).map((g) => ({ name: g?.name || '', email: g?.email || '' })),
      transcript: s.transcript || '',
      abstract_summary: s.abstract_summary || '',
      action_items: s.action_items || s.action_item || '',
    }));

  ensureDir(STATE_DIR);
  const outFile = path.join(STATE_DIR, 'otter-pull.json');
  fs.writeFileSync(outFile, JSON.stringify({ pulled_at: new Date().toISOString(), meetings }, null, 2));
  writeState('otter', { status: 'connected', last_pull: new Date().toISOString(), meeting_count: meetings.length });

  if (meetings.length === 0) {
    log.warn('No meetings found in your Otter account yet.');
    log.info('Record a meeting in Otter, then run this again.');
    return;
  }

  log.ok(`Pulled ${meetings.length} meeting(s). Saved to: ${path.relative(process.cwd(), outFile)}`);
  console.log('');
  meetings.slice(0, 10).forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.title}`);
    if (m.guests.length) console.log(`     with: ${m.guests.map((g) => g.name || g.email).filter(Boolean).join(', ')}`);
  });

  if (LATEST) {
    const latest = meetings[0];
    console.log('');
    log.step(`Most recent meeting: ${latest.title}`);
    console.log(latest.transcript ? latest.transcript.slice(0, 8000) : '(no transcript text on this meeting)');
    if (latest.transcript && latest.transcript.length > 8000) {
      console.log(`\n... (transcript continues — full text is in ${path.relative(process.cwd(), outFile)})`);
    }
  } else {
    console.log('');
    log.info('Full transcripts are in the saved file above — the post-meeting skill reads from there.');
  }
}

main().catch((err) => {
  log.fail('Pulling from Otter hit an unexpected error.', err.message, 'Show this to your guide.');
  return exit(99);
});
