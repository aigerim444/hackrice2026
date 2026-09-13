#!/usr/bin/env node
/**
 * Checks the Gemini setup before you find out the hard way.
 *
 *   npm run gemini:doctor
 *
 * Answers the three questions that actually cost time at 3am: is the key
 * loaded, does the network let you out, and is the model id in
 * `src/data/gemini/geminiClient.ts` one this key can really reach. Google
 * rotates model ids faster than a semester, so the last one matters.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Read .env without a dependency — we need exactly two keys.
 *
 * Two details that both cause a "your key is invalid" report for a key that is
 * perfectly fine: split on CRLF as well as LF, because JavaScript's `.` excludes
 * `\r` and a Windows line ending makes the whole line fail to match; and trim
 * the value, because a trailing space is sent as part of the key.
 */
function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(join(root, file), 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=(.*)$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '').trim();
        }
      }
    } catch {
      // No such file. Environment variables may still be set in the shell.
    }
  }
}

loadEnv();

const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();
const wanted = process.env.EXPO_PUBLIC_GEMINI_MODEL?.trim() ?? 'gemini-2.5-flash';

if (!key) {
  console.error(`
✗ No EXPO_PUBLIC_GEMINI_API_KEY found.

  1. Get a key at https://aistudio.google.com/apikey
  2. Put it in mobile/.env.local:

       EXPO_PUBLIC_GEMINI_API_KEY=your-key-here

  .env.local is gitignored. Never commit the key.

  The app runs fine without it — receipts fall back to the demo parse and the
  coach uses the built-in heuristic — so this is not blocking, just less good.
`);
  process.exit(1);
}

console.log(`✓ Key loaded (…${key.slice(-6)})`);

const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
  headers: { 'x-goog-api-key': key },
}).catch((error) => {
  console.error(`✗ Could not reach Google: ${error.message}`);
  process.exit(1);
});

if (!response.ok) {
  console.error(`✗ Google said ${response.status}: ${(await response.text()).slice(0, 400)}`);
  process.exit(1);
}

const { models = [] } = await response.json();
const usable = models
  .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
  .map((model) => model.name.replace(/^models\//, ''));

console.log(`✓ Reached Google — ${usable.length} models support generateContent`);

if (usable.includes(wanted)) {
  console.log(`✓ Model "${wanted}" is available\n`);
} else {
  console.error(`
✗ Model "${wanted}" is NOT available to this key.

  Pick one below and set it in mobile/.env.local:

      EXPO_PUBLIC_GEMINI_MODEL=<id>

  A "flash" model is the right default: fast, cheap, multimodal, and it does
  function calling — which is everything this app asks of it.
`);
}

const interesting = usable.filter((id) => id.startsWith('gemini'));
console.log('Available Gemini models:');
for (const id of interesting) console.log(`  ${id === wanted ? '→' : ' '} ${id}`);
if (!interesting.length) console.log('  (none — check the key\'s project has the API enabled)');
