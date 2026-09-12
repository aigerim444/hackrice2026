import { GeminiAugmentedApi } from './gemini/geminiApi';
import { hasGemini } from './gemini/geminiClient';
import { HttpRunwayApi } from './http/httpApi';
import { MockRunwayApi } from './mock/mockApi';
import type { RunwayApi } from './api';

/**
 * Picks the implementation.
 *
 * Two independent switches, which is the whole point of keeping them separate:
 *
 * - `EXPO_PUBLIC_API_URL` decides **where state lives** — unset, it's the
 *   in-memory mock; set, it's a real server. This is the state seam.
 * - `EXPO_PUBLIC_GEMINI_API_KEY` decides **whether the app can see and reason**
 *   — receipts get read for real, and the coach answers with a model instead of
 *   the built-in heuristic. This is the intelligence seam.
 *
 * They compose: Gemini wraps whichever store is underneath, so you can run real
 * OCR against the demo semester, which is exactly what you want on a laptop.
 */
const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

const store: RunwayApi = baseUrl ? new HttpRunwayApi(baseUrl) : new MockRunwayApi();

export const api: RunwayApi = hasGemini() ? new GeminiAugmentedApi(store) : store;

export const isMockApi = !baseUrl;

/** True when the AI paths are live. Screens badge themselves honestly with it. */
export const isAiEnabled = hasGemini();
