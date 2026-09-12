import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Builds the Supabase client from the project's URL + anon key.
 *
 * Reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`, the same
 * `EXPO_PUBLIC_` convention `client.ts` uses for `EXPO_PUBLIC_API_URL`. Session
 * persistence is off: there's no login screen yet (`httpApi.ts`'s `getToken`
 * still defaults to `() => null`, per STATE.md §4), so there's nothing to
 * restore a session into between app launches.
 */
export function createSupabaseClient(): SupabaseClient {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set to use SupabaseRunwayApi',
    );
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: true },
  });
}
