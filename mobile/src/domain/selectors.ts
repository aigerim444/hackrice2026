import { money, pct } from './format';
import type { Category, Challenge, Fund, SemesterSnapshot } from './types';

/** The goal Home features: the one that comes due soonest. */
export function primaryFund(snapshot: SemesterSnapshot): Fund | undefined {
  return [...snapshot.funds].sort((a, b) => a.occasion.localeCompare(b.occasion))[0];
}

/** Spending by category — history plus anything logged today. */
export interface CategoryBar {
  name: Category;
  amount: number;
  label: string;
  /** Width as a share of the largest category. */
  width: `${number}%`;
  /** The leader is drawn in ink; the rest in sand. */
  top: boolean;
}

export function categoryBars(snapshot: SemesterSnapshot): CategoryBar[] {
  const totals = { ...snapshot.priorCategoryTotals };
  for (const expense of snapshot.todayExpenses) {
    totals[expense.category] = (totals[expense.category] ?? 0) + expense.amount;
  }

  const entries = Object.entries(totals) as [Category, number][];
  const max = Math.max(...entries.map(([, value]) => value));

  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount], index) => ({
      name,
      amount,
      label: money(amount),
      width: pct(amount, max),
      top: index === 0,
    }));
}

/** Today's receipts, newest first — the order they appear on the Spend screen. */
export function todayItems(snapshot: SemesterSnapshot) {
  return [...snapshot.todayExpenses].reverse();
}

export interface FundProgress {
  /** Everything all members have put in. */
  contributed: number;
  target: number;
  weeksLeft: number;
  members: { id: string; name: string; amount: number; share: `${number}%`; isYou: boolean; caption: string }[];
}

export function fundProgress(fund: Fund, weeksLeft: number): FundProgress {
  return {
    contributed: fund.members.reduce((sum, m) => sum + m.contributed, 0),
    target: fund.targetAmount,
    weeksLeft,
    members: fund.members.map((m) => ({
      id: m.id,
      name: m.name,
      amount: m.contributed,
      share: pct(m.contributed, fund.targetAmount, 0),
      isYou: Boolean(m.isYou),
      caption: `$${m.weeklyPledge}/wk · ${m.status}`,
    })),
  };
}

/**
 * The streaks the home screen name-checks under the trip fund: the two running
 * longest, so the line stays short and leads with the one worth protecting.
 * Empty until you've started a challenge, and the line is dropped when it is.
 */
export function homeStreaks(snapshot: SemesterSnapshot): Challenge[] {
  return [...snapshot.challenges]
    .sort((a, b) => Number(a.broken) - Number(b.broken) || b.youStreakDays - a.youStreakDays)
    .slice(0, 2);
}

/** Who else is in a challenge, best run first. Invitees aren't ranked yet. */
export function challengeRivals(challenge: Challenge) {
  return challenge.participants
    .filter((p) => !p.isYou && p.status === 'joined')
    .sort((a, b) => b.streakDays - a.streakDays);
}

/** People still to accept. */
export function challengePending(challenge: Challenge) {
  return challenge.participants.filter((p) => p.status === 'invited');
}

/** The right-hand caption under your streak: who you're up against. */
export function challengeCaption(challenge: Challenge): string {
  const rivals = challengeRivals(challenge);
  const pending = challengePending(challenge);
  if (!rivals.length) {
    return pending.length ? `${pending.length} invited` : 'just you';
  }
  const [leader] = rivals;
  if (leader.streakDays === challenge.youStreakDays) return `${leader.name} · tied`;
  return challenge.youStreakDays > leader.streakDays
    ? `next: ${leader.name} · ${leader.streakDays}`
    : `${leader.name} · ${leader.streakDays}`;
}

/** "with Maya", "with Dev + 2 others", "just you". */
export function challengeWith(challenge: Challenge): string {
  const names = challenge.participants.filter((p) => !p.isYou).map((p) => p.name);
  if (!names.length) return 'just you';
  if (names.length === 1) return `with ${names[0]}`;
  if (names.length === 2) return `with ${names[0]} + ${names[1]}`;
  return `with ${names[0]} + ${names.length - 1} others`;
}

/** People not already in this fund or challenge, so the picker only offers new ones. */
export function invitable(snapshot: SemesterSnapshot, alreadyIn: string[]) {
  return snapshot.people.filter((person) => !alreadyIn.includes(person.id));
}
