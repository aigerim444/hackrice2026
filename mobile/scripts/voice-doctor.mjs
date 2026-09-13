#!/usr/bin/env node
/**
 * Checks the ElevenLabs setup before a demo does it for you.
 *
 *   npm run voice:doctor
 *
 * Narration degrades silently by design — a bad key sounds exactly like the
 * device voice — so this is the only thing that tells you which tier you're
 * actually on. It also prints your remaining character allowance, which is the
 * number that ends demos: the free tier is small and one Wrapped run is about
 * a tenth of it.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(join(root, file), 'utf8').split('\n')) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
      }
    } catch {
      // No such file; the shell may still have the variables.
    }
  }
}

loadEnv();

const key = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY?.trim();
const voiceId = process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID?.trim();

if (!key) {
  console.error(`
✗ No EXPO_PUBLIC_ELEVENLABS_API_KEY found.

  1. Make a key at https://elevenlabs.io/app/settings/api-keys
     Permissions needed: Text to Speech. Add Voices (Read), Models and User
     if you want this script to check them too.
  2. Put it in mobile/.env.local:

       EXPO_PUBLIC_ELEVENLABS_API_KEY=your-key
       EXPO_PUBLIC_ELEVENLABS_VOICE_ID=a-voice-id

  Wrapped still narrates without this — it falls back to the device's own
  voice — so nothing is broken, it just sounds less good.
`);
  process.exit(1);
}

console.log(`✓ Key loaded (…${key.slice(-6)})`);

const headers = { 'xi-api-key': key };

/**
 * Listing voices is a *convenience*, not the feature.
 *
 * A key scoped to Text to Speech alone — which is all the app needs — gets a
 * 401 here while working perfectly. So a failure at this step is a note, never
 * a verdict: the only thing that settles it is speaking.
 */
let list = null;
const voices = await fetch('https://api.elevenlabs.io/v1/voices', { headers }).catch(() => null);

if (!voices) {
  console.log('· Could not reach ElevenLabs to list voices (network?).');
} else if (voices.status === 401) {
  console.log('· No Voices (Read) permission on this key — can\'t list them.');
  console.log('  Not a problem by itself: the app only needs Text to Speech.');
} else if (!voices.ok) {
  console.log(`· Listing voices failed (${voices.status}). Carrying on to the real test.`);
} else {
  ({ voices: list } = await voices.json());
  console.log(`✓ Reached ElevenLabs — ${list.length} voices available`);
}

if (list) {
  if (voiceId) {
    const match = list.find((voice) => voice.voice_id === voiceId);
    console.log(
      match
        ? `✓ Voice "${match.name}" (${voiceId}) is in your collection`
        : `✗ Voice id "${voiceId}" is not in your collection — add it in the Voice Library first.`,
    );
  }
  console.log('\nYour voices:');
  for (const voice of list) {
    console.log(`  ${voice.voice_id === voiceId ? '→' : ' '} ${voice.voice_id}  ${voice.name}`);
  }
}

/**
 * The actual test: say one word.
 *
 * Six characters out of a ~10,000/month allowance, and it's the only check
 * that proves the thing the app does. Everything above is diagnosis for when
 * this fails.
 */
if (!voiceId) {
  console.error(`
✗ No EXPO_PUBLIC_ELEVENLABS_VOICE_ID set — can't test speech without a voice.

  Get one at https://elevenlabs.io/app/voices — ⋯ menu on a voice → Copy voice ID.
  Then add to mobile/.env.local:

      EXPO_PUBLIC_ELEVENLABS_VOICE_ID=the-id
`);
  process.exit(1);
}

const model = process.env.EXPO_PUBLIC_ELEVENLABS_MODEL?.trim() ?? 'eleven_flash_v2_5';
console.log(`\nSpeaking one word to test the key end to end (model: ${model})…`);

const spoken = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
  method: 'POST',
  headers: { ...headers, 'content-type': 'application/json', accept: 'audio/mpeg' },
  body: JSON.stringify({ text: 'Testing.', model_id: model }),
}).catch((error) => {
  console.error(`✗ Could not reach ElevenLabs: ${error.message}`);
  process.exit(1);
});

if (!spoken.ok) {
  const body = await spoken.text();
  console.error(`✗ Text to speech failed — ${spoken.status}\n  ${body.slice(0, 400)}\n`);
  if (spoken.status === 401) {
    console.error('  A 401 here (unlike on the voices list) does mean the key is bad:');
    console.error('  wrong, revoked, auto-disabled as leaked, or missing Text to Speech.');
  }
  if (spoken.status === 404) {
    console.error('  A 404 usually means the voice id is wrong, or the model id has moved on.');
  }
  if (spoken.status === 429) {
    console.error('  429 is the quota: this period\'s characters are spent.');
  }
  process.exit(1);
}

const bytes = (await spoken.arrayBuffer()).byteLength;
console.log(`✓ Text to speech works — got ${bytes} bytes of audio back.\n`);

// The number that actually ends demos.
const sub = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers }).catch(
  () => null,
);
if (sub?.ok) {
  const { character_count: used, character_limit: limit } = await sub.json();
  const left = limit - used;
  console.log(`\nCharacters: ${used} used of ${limit} — ${left} left this period.`);
  console.log(`One full Wrapped narration is roughly 1,000, so that's about ${Math.floor(left / 1000)} more runs.`);
  if (left < 2000) {
    console.log('\n⚠ Running low. Generated audio is cached per line, so replaying costs nothing —');
    console.log('  but editing the script or clearing the app cache will regenerate.');
  }
} else {
  console.log('(Add the User permission to this key to also see characters remaining.)');
}
