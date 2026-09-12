import { daysBetween, monthlyDueDates, weeksBetween, addDays, type ISODate } from './dates';
import type { Bill, Fund, Job, SemesterSnapshot } from './types';

/**
 * The projection engine — the one piece of logic the whole product hangs off.
 *
 * A pure function of the snapshot: no dates read off the device, no state, no
 * I/O. That's what makes the what-if screens possible — the jobs slider and the
 * coach both just run `project()` against a modified copy of the snapshot and
 * compare run-out dates.
 */

export interface Projection {
  /** Everything that landed in August. */
  lump: number;
  /** Bills still to come — rent, phone, fees. Spoken for. */
  reserved: number;
  /** Carved out for the shared fund over the rest of the term. */
  fundTotal: number;
  /** Charged to the Free-to-spend envelope so far, today included. */
  spent: number;
  /** Charged today. */
  todaySpent: number;
  /** What's left in the only envelope that's yours. */
  free: number;
  /** `free` spread evenly over the days remaining. The number the app exists to give. */
  safeDaily: number;
  /** Today's allowance minus what today has already cost. */
  leftToday: number;
  /** Extra earnings unlocked by dragging hours above what's scheduled. */
  futureJobIncome: number;
  /** Day-of-semester index (0 = first day) on which Free-to-spend hits zero. */
  runOutIndex: number;
  runOutDate: ISODate;
  /** True when the money reaches the last day of the term. */
  madeIt: boolean;
  /** Days still to cover after the run-out date, at the current pace. */
  daysShort: number;
  /** 0-based index of today within the semester. */
  dayIndex: number;
  /** Inclusive length of the semester — the "111 days" on the cover. */
  totalDays: number;
  /** Days from today to the last day, inclusive of neither end. */
  daysLeft: number;
}

/** Charges for a bill that still fall between `from` (exclusive) and `to` (inclusive). */
export function remainingCharges(bill: Bill, from: ISODate, to: ISODate): number {
  if (bill.prepaid) return 0;
  if (bill.cadence === 'once') {
    return bill.dueDate && bill.dueDate > from && bill.dueDate <= to ? bill.amount : 0;
  }
  const due = monthlyDueDates(bill.dueDay ?? 1, addDays(from, 1), to);
  return due.length * bill.amount;
}

/** What the shared fund will have taken out of your runway by the time it's due. */
export function fundReserved(fund: Fund, today: ISODate): number {
  return fund.weeklyPledge * Math.max(0, weeksBetween(today, fund.occasion)) + fund.extraContributed;
}

/**
 * Earnings from hours dragged above what's actually scheduled, for the weeks of
 * term that still pay. Dragging *below* scheduled hours subtracts, which is what
 * makes the jobs slider honest in both directions.
 */
export function futureJobIncome(jobs: Job[], today: ISODate, lastPaidWeek: ISODate): number {
  const weeks = Math.max(0, weeksBetween(today, lastPaidWeek));
  return jobs.reduce(
    (sum, job) => sum + (job.hoursPerWeek - job.baselineHoursPerWeek) * job.hourlyRate * weeks,
    0,
  );
}

export function project(snapshot: SemesterSnapshot): Projection {
  const { semester, income, bills, fund, jobs } = snapshot;
  const { today, startDate, endDate } = semester;

  const totalDays = daysBetween(startDate, endDate) + 1;
  const dayIndex = daysBetween(startDate, today);
  const daysLeft = daysBetween(today, endDate);

  const lump = income.reduce((sum, source) => sum + source.amount, 0);
  const reserved = bills.reduce((sum, bill) => sum + remainingCharges(bill, today, endDate), 0);
  const fundTotal = fundReserved(fund, today);

  const todaySpent = snapshot.todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const spent = snapshot.priorFreeSpend + todaySpent;

  const free = lump - reserved - fundTotal - spent;
  const safeDaily = daysLeft > 0 ? free / daysLeft : free;

  const extra = futureJobIncome(jobs, today, semester.lastPaidWeek);

  // At the pace you're actually spending — not the pace you're allowed to — the
  // free envelope covers this many more days. Clamped to the term: it can't run
  // out before tomorrow, and "past the last day" reads as making it.
  const lastIndex = totalDays - 1;
  const runOutIndex = Math.max(
    dayIndex + 1,
    Math.min(lastIndex, dayIndex + Math.floor((free + extra) / snapshot.observedDailyPace)),
  );

  return {
    lump,
    reserved,
    fundTotal,
    spent,
    todaySpent,
    free,
    safeDaily,
    leftToday: Math.max(0, safeDaily - todaySpent),
    futureJobIncome: extra,
    runOutIndex,
    runOutDate: addDays(startDate, runOutIndex),
    madeIt: runOutIndex >= lastIndex,
    daysShort: lastIndex - runOutIndex,
    dayIndex,
    totalDays,
    daysLeft,
  };
}

/**
 * The same projection with every job back at its scheduled hours — the baseline
 * the what-if screens measure against.
 */
export function projectBaseline(snapshot: SemesterSnapshot): Projection {
  return project({
    ...snapshot,
    jobs: snapshot.jobs.map((job) => ({ ...job, hoursPerWeek: job.baselineHoursPerWeek })),
  });
}

/** Run-out index if you spent `amount` out of Free-to-spend right now. */
export function projectWithExtraSpend(snapshot: SemesterSnapshot, amount: number): Projection {
  return project({ ...snapshot, priorFreeSpend: snapshot.priorFreeSpend + amount });
}

/**
 * Where the heat strip's three bands sit: spent-so-far, covered-from-here, and
 * the hatched run-out zone. Returned as CSS-style percentage strings because
 * that's what both the design and React Native's layout take.
 */
export function heatStrip(p: Projection): { spent: `${number}%`; covered: `${number}%` } {
  const total = p.totalDays - 1;
  return {
    spent: `${Math.round((p.dayIndex / total) * 100)}%`,
    covered: `${Math.max(0, Math.round(((p.runOutIndex - p.dayIndex) / total) * 100))}%`,
  };
}
