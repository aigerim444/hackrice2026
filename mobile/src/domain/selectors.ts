import { money, pct } from './format';
import type { Category, Fund, SemesterSnapshot } from './types';

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

/** The two challenges the home screen name-checks under the trip fund. */
export function homeStreaks(snapshot: SemesterSnapshot) {
  const delivery = snapshot.challenges.find((c) => c.id === 'ch-delivery');
  const boba = snapshot.challenges.find((c) => c.id === 'ch-boba');
  return { delivery, boba };
}
