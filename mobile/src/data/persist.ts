import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SemesterSnapshot } from '../domain/types';

/**
 * Keeping the semester across restarts.
 *
 * The whole of a user's state is one JSON-serializable `SemesterSnapshot`,
 * which is what makes this fifteen lines instead of a migration story. It's a
 * cache in front of the API, not a second source of truth: whatever the API
 * returns is written here, and what's here is only ever used to render
 * *immediately* on launch while the real read is in flight.
 *
 * That ordering matters. If the two disagree the API wins, always — so a stale
 * cache can make the first frame briefly out of date, but it can never make the
 * app wrong.
 *
 * Storage is per-device and unencrypted. Nothing here is a credential; if this
 * ever holds anything more sensitive than a semester's spending, it belongs in
 * `expo-secure-store` instead.
 */

const KEY = 'semester-runway:snapshot:v1';

export async function loadCachedSnapshot(): Promise<SemesterSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SemesterSnapshot;
    // A shape check, not a validation: enough to reject a cache written by an
    // older build rather than crash a screen reading `semester.today`.
    return parsed?.semester?.today && Array.isArray(parsed.bills) ? parsed : null;
  } catch {
    // Corrupt, unreadable, or storage unavailable (private browsing). The API
    // read is already in flight; losing the cache costs a spinner, nothing more.
    return null;
  }
}

export async function cacheSnapshot(snapshot: SemesterSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // Full disk, or a browser refusing storage. Not worth interrupting anyone.
  }
}

export async function clearCachedSnapshot(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* See above. */
  }
}
