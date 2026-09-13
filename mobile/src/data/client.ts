import { GeminiAugmentedApi } from './gemini/geminiApi';
import { hasGemini } from './gemini/geminiClient';
import { HttpRunwayApi } from './http/httpApi';
import { MockRunwayApi } from './mock/mockApi';
import { createSupabaseClient } from './supabase/client';
import { SupabaseRunwayApi } from './supabase/supabaseApi';
import type { RunwayApi } from './api';

/**
 * Picks the implementation.
 *
 * Independent switches:
 *
 * - `EXPO_PUBLIC_USE_MOCK` decides **where state lives** — defaults to the
 *   in-memory mock (true unless explicitly set to `"false"`), so the app
 *   still runs with zero setup. Turned off, it talks to the real Supabase
 *   backend in `src/data/supabase/` instead — which needs a signed-in
 *   session, so `app/_layout.tsx` gates on `AuthProvider` before this ever
 *   gets called. `EXPO_PUBLIC_API_URL` is the older httpApi contract client;
 *   it only still applies inside the mock branch, and nothing points it at a
 *   real server today.
 * - `EXPO_PUBLIC_GEMINI_API_KEY` decides **whether the app can see and
 *   reason** — receipts get read for real, and the coach answers with a
 *   model instead of the built-in heuristic. Composes with either store
 *   above, unchanged.
 */
const useMock = process.env.EXPO_PUBLIC_USE_MOCK !== 'false';
const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

const store: RunwayApi = useMock
  ? baseUrl
    ? new HttpRunwayApi(baseUrl)
    : new MockRunwayApi()
  : new SupabaseRunwayApi(createSupabaseClient());

export const api: RunwayApi = hasGemini() ? new GeminiAugmentedApi(store) : store;

/** True only while the in-memory mock is the actual store — gates its dev-only controls. */
export const isMockApi = useMock && !baseUrl;

/** True when the app needs a signed-in Supabase session to do anything. */
export const usesSupabase = !useMock;

/** True when the AI paths are live. Screens badge themselves honestly with it. */
export const isAiEnabled = hasGemini();
