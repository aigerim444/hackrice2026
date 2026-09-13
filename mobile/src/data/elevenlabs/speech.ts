import { Directory, File, Paths } from 'expo-file-system';

/**
 * Text to speech, via ElevenLabs.
 *
 * Returns a local file URI rather than bytes, because that's what `expo-audio`
 * can play — and because writing the mp3 to disk is what makes the *second*
 * play instant and free.
 *
 * That caching isn't a nicety. The free tier is about 10,000 characters a
 * month and one full Wrapped run is roughly 1,000, so a handful of dev cycles
 * would burn the month. Every line is keyed by its own text: change the words
 * and it regenerates, replay the same words and it never calls the API again.
 */

const ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech';

/** Where the generated mp3s live. Cache, not documents: it's all reproducible. */
const CACHE_DIR = 'wrapped-narration';

export const elevenLabsKey = (): string | null =>
  process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY?.trim() || null;

export const elevenLabsVoice = (): string | null =>
  process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID?.trim() || null;

/** Both halves are needed — a key with no voice can't say anything. */
export const hasElevenLabs = (): boolean => Boolean(elevenLabsKey() && elevenLabsVoice());

/**
 * `eleven_flash_v2_5` is the low-latency model: a Wrapped card should start
 * speaking as you land on it, and a second of lag reads as a bug. Override if
 * the id moves — `npm run voice:doctor` lists what your key can reach.
 */
const MODEL = process.env.EXPO_PUBLIC_ELEVENLABS_MODEL ?? 'eleven_flash_v2_5';

/** Long enough for a slow venue network, short enough not to strand a card. */
const TIMEOUT_MS = 20000;

/**
 * A stable filename for a given line.
 *
 * Hashing the text (rather than the card index) means editing one line only
 * invalidates that line, and re-running with identical copy costs nothing.
 * FNV-1a: not cryptographic, but this is a cache key, not a secret.
 */
function cacheKey(text: string, voice: string): string {
  let hash = 0x811c9dc5;
  for (const char of `${voice}:${MODEL}:${text}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `line-${hash.toString(16)}.mp3`;
}

function cacheDir(): Directory {
  const dir = new Directory(Paths.cache, CACHE_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Speak one line, and hand back a playable file URI.
 *
 * Throws on any failure — callers decide whether to fall back to the device
 * voice or run the card silently, since that choice belongs to the screen.
 */
export async function speak(text: string): Promise<string> {
  const key = elevenLabsKey();
  const voice = elevenLabsVoice();
  if (!key || !voice) {
    throw new Error('No ElevenLabs config: set EXPO_PUBLIC_ELEVENLABS_API_KEY and _VOICE_ID');
  }

  const file = new File(cacheDir(), cacheKey(text, voice));
  if (file.exists) return file.uri;

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${ENDPOINT}/${voice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        // Slightly above the defaults on stability, because this is narration
        // over fixed copy rather than conversation — consistent beats lively.
        voice_settings: { stability: 0.55, similarity_boost: 0.75 },
      }),
      signal: abort.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ElevenLabs ${response.status}: ${body.slice(0, 200)}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) throw new Error('ElevenLabs returned no audio');

    // Written whole rather than streamed: these are a few seconds each, and a
    // half-written file in the cache would be a silent failure on every later run.
    file.write(bytes);
    return file.uri;
  } catch (error) {
    // Never leave a partial file behind to be trusted as a cache hit.
    try {
      if (file.exists) file.delete();
    } catch {
      /* Best effort. */
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('ElevenLabs timed out');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** How much of the free monthly allowance a script will cost, before spending it. */
export function characterCost(lines: string[]): number {
  return lines.reduce((sum, line) => sum + line.length, 0);
}

/** Throw away the generated audio — for when the copy changes wholesale. */
export function clearNarrationCache(): void {
  try {
    const dir = new Directory(Paths.cache, CACHE_DIR);
    if (dir.exists) dir.delete();
  } catch {
    /* Nothing worth interrupting anyone for: it regenerates. */
  }
}
