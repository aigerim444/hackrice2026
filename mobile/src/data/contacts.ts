/**
 * Where friend suggestions come from.
 *
 * A real build reads the address book (expo-contacts) or the server's "people
 * you know" list; both are async and permissioned, so this is a seam rather
 * than a constant. The demo answers instantly with a fixed list — the names the
 * design's screens use — and the caller can always type someone else instead.
 */
export interface Contact {
  /** Stable across calls, so a suggestion tapped twice is the same person. */
  id: string;
  name: string;
}

const DEMO_CONTACTS: Contact[] = [
  { id: 'contact-maya', name: 'Maya' },
  { id: 'contact-dev', name: 'Dev' },
  { id: 'contact-sam', name: 'Sam' },
  { id: 'contact-jo', name: 'Jo' },
  { id: 'contact-ren', name: 'Ren' },
  { id: 'contact-alex', name: 'Alex' },
];

export function suggestedContacts(): Contact[] {
  return DEMO_CONTACTS;
}
