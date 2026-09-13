import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The app's one Supabase client — a singleton, because auth state has to be
 * shared: `AuthProvider` listens on it and signs in through it, and
 * `SupabaseRunwayApi` (in `client.ts`) reads whatever session is active on the
 * same instance. Two separate clients would mean two separate sessions.
 *
 * `flowType: 'pkce'` is what makes `semesterrunway://auth-callback` work as a
 * deep link: the magic-link email points there with a `?code=`, and
 * `AuthProvider` exchanges it via `exchangeCodeForSession`. `AsyncStorage`
 * persists that session across restarts — this is unrelated to STATE.md's "no
 * AsyncStorage" note, which is about app *data* (the semester snapshot);
 * auth's own session token needs somewhere to live regardless.
 */
let client: SupabaseClient | null = null;

export function createSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set to use SupabaseRunwayApi',
    );
  }

  client = createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      // The redirect target is a custom scheme (semesterrunway://…), which a
      // browser location bar never actually becomes — so there's no URL for
      // supabase-js to auto-detect a session in, on any platform. AuthProvider
      // handles the deep link itself via expo-linking + exchangeCodeForSession.
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
  return client;
}
