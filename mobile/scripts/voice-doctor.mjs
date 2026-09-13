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

const voices = await fetch('https://api.elevenlabs.io/v1/voices', { headers }).catch((error) => {
  console.error(`✗ Could not reach ElevenLabs: ${error.message}`);
  process.exit(1);
});

if (voices.status === 401) {
  console.error('✗ 401 — the key is wrong, revoked, or lacks the Voices (Read) permission.');
  process.exit(1);
}
if (!voices.ok) {
  console.error(`✗ ElevenLabs said ${voices.status}: ${(await voices.text()).slice(0, 300)}`);
  process.exit(1);
}

const { voices: list = [] } = await voices.json();
console.log(`✓ Reached ElevenLabs — ${list.length} voices available`);

if (!voiceId) {
  console.error('\n✗ No EXPO_PUBLIC_ELEVENLABS_VOICE_ID set. Pick one from below.\n');
} else {
  const match = list.find((voice) => voice.voice_id === voiceId);
  console.log(
    match
      ? `✓ Voice "${match.name}" (${voiceId}) is available\n`
      : `\n✗ Voice id "${voiceId}" is not in your collection. Pick one from below,\n  or add it to your voices in the ElevenLabs Voice Library first.\n`,
  );
}

console.log('Your voices:');
for (const voice of list) {
  console.log(`  ${voice.voice_id === voiceId ? '→' : ' '} ${voice.voice_id}  ${voice.name}`);
}

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
  console.log('\n(Add the User permission to this key to also see characters remaining.)');
}
