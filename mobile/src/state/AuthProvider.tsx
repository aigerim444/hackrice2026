import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { createSupabaseClient } from '../data/supabase/client';
import { usesSupabase } from '../data/client';

/**
 * Gates the app on a Supabase session — magic link or a typed OTP code, both
 * from one `signInWithOtp` call, since Supabase's email template carries both
 * a link and a code and lets the person use whichever actually works for them
 * (the link needs the deep link to fire; the code always works).
 *
 * In mock mode (`usesSupabase` false) this is a no-op: `signedIn` is always
 * true and nothing here ever touches the network, so every existing screen
 * and the whole mock-backed flow behaves exactly as before this file existed.
 */

const REDIRECT_TO = 'semesterrunway://auth-callback';

interface AuthContextValue {
  /** True once the initial session check (or the mock no-op) has resolved. */
  ready: boolean;
  signedIn: boolean;
  error: string | null;
  /** Sends the email its magic link + code. Throws on failure. */
  sendCode: (email: string) => Promise<void>;
  /** Redeems the 6-digit code from that email. Throws on failure. */
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => (usesSupabase ? createSupabaseClient() : null), []);
  const [ready, setReady] = useState(!usesSupabase);
  const [signedIn, setSignedIn] = useState(!usesSupabase);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSignedIn(Boolean(data.session));
      setReady(true);
    });

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [client]);

  // A tapped magic link opens the app at semesterrunway://auth-callback?code=…
  // (PKCE) — exchange it for a session. Inert on web, where a custom scheme
  // never becomes the page's own location for supabase-js to read.
  useEffect(() => {
    if (!client) return;

    const handle = (url: string) => {
      if (!url.includes('auth-callback')) return;
      client.auth.exchangeCodeForSession(url).catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Could not complete sign-in.');
      });
    };

    Linking.getInitialURL().then((url) => {
      if (url) handle(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => subscription.remove();
  }, [client]);

  const sendCode = useCallback(
    async (email: string) => {
      if (!client) return;
      setError(null);
      const { error: err } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: REDIRECT_TO },
      });
      if (err) {
        setError(err.message);
        throw err;
      }
    },
    [client],
  );

  const verifyCode = useCallback(
    async (email: string, code: string) => {
      if (!client) return;
      setError(null);
      const { error: err } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
      if (err) {
        setError(err.message);
        throw err;
      }
    },
    [client],
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({ ready, signedIn, error, sendCode, verifyCode, signOut }),
    [ready, signedIn, error, sendCode, verifyCode, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
