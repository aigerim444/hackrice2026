import { shortDate } from './dates';
import { money } from './format';
import { project, projectWithExtraSpend, type Projection } from './runway';
import type { ChatMessage, ChatRoute, SemesterSnapshot } from './types';

/**
 * The what-if coach.
 *
 * Kept here, client-side and pure, on purpose: every answer is arithmetic over
 * the same projection the home screen shows, so the coach can never quote a
 * number the rest of the app disagrees with. When this moves behind a real
 * model, `RunwayApi.askCoach` is the seam — this function stays as the fallback
 * and as the source of the structured `routes`, which a model should fill rather
 * than prose.
 */

const BIG_SWING = 200;
const SHOWS_UP = 60;

function priceIn(text: string): number | null {
  const match = text.match(/\$?\s?(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function routesFor(amount: number, days: number, p: Projection): ChatRoute[] {
  if (amount >= SHOWS_UP) {
    return [
      {
        label: `Wait 2 paychecks (Oct 2) — then it costs ${Math.max(1, Math.round(days / 4))} d`,
        delta: `−${Math.max(1, Math.round(days / 4))} d`,
        tone: 'good',
      },
      {
        label: `Refurb / used · ~$${Math.round(amount * 0.76)}`,
        delta: `−${Math.max(1, Math.round(days * 0.76))} d`,
        tone: 'neutral',
      },
      {
        label: 'Student price + trade-in',
        delta: `−${Math.max(1, Math.round(days * 0.6))} d`,
        tone: 'neutral',
      },
    ];
  }
  return [
    {
      label: `Take it from today's ${money(p.safeDaily)} — skip the drink`,
      delta: '0 d',
      tone: 'good',
    },
    { label: 'Log it, keep the date', delta: `−${days} d`, tone: 'neutral' },
  ];
}

let seq = 0;
const nextId = (role: string) => `${role}-${Date.now()}-${seq++}`;

export function userMessage(text: string): ChatMessage {
  return { id: nextId('user'), role: 'user', text };
}

/**
 * Answer a what-if. The shape of the reply is fixed — verdict, then the price in
 * days of runway, then cheaper routes — because that's the one thing a student
 * asking "can I afford this" actually needs, and it's what the design settled on
 * after the thread was reworked into short bubbles.
 */
export function coachReply(snapshot: SemesterSnapshot, text: string): ChatMessage {
  const amount = priceIn(text);

  if (amount === null) {
    return {
      id: nextId('coach'),
      role: 'coach',
      text: "Give me a price and I'll tell you what it does to your date. Or snap the tag.",
    };
  }

  const p = project(snapshot);
  const days = Math.max(1, Math.round(amount / snapshot.observedDailyPace));
  const after = projectWithExtraSpend(snapshot, amount);

  const verdict = amount >= BIG_SWING ? 'Big swing. ' : amount >= SHOWS_UP ? 'Doable, but it shows. ' : 'Small. ';

  return {
    id: nextId('coach'),
    role: 'coach',
    text:
      `${verdict}$${amount} out of Free-to-spend moves your empty date from ` +
      `${shortDate(p.runOutDate)} to ${shortDate(after.runOutDate)} — ` +
      `${days} ${days === 1 ? 'day' : 'days'} of runway.`,
    routes: routesFor(amount, days, p),
  };
}

/** The starter chips under the thread. */
export const QUICK_ASKS = [
  { text: 'if I buy AirPods Pro $249?', send: 'if i buy the AirPods Pro for $249?' },
  { text: '$18 sushi tonight?', send: '$18 sushi tonight?' },
  { text: 'a $90 concert in Oct?', send: 'a $90 concert in Oct?' },
] as const;
