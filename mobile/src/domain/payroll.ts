import { addDays, monthlyDueDates, parseDate, toISODate, type ISODate } from './dates';
import type { Job, JobDraft, PayCadence } from './types';

/**
 * When a job next pays, and how much.
 *
 * Derived rather than stored, because cadence is the thing that actually
 * matters here: the same hourly rate lands very differently if one job pays
 * fortnightly and the other monthly, and that difference is what makes the
 * run-out date wander through the term.
 */

/** Weeks of work covered by one paycheck. */
const WEEKS_PER_PERIOD: Record<PayCadence, number> = {
  weekly: 1,
  biweekly: 2,
  monthly: 52 / 12,
};

/** The next date this cadence pays out, strictly after `from`. */
export function nextPayDate(cadence: PayCadence, from: ISODate): ISODate {
  if (cadence === 'monthly') {
    // Monthly payroll lands on the 1st.
    const [due] = monthlyDueDates(1, addDays(from, 1), addDays(from, 62));
    return due ?? addDays(from, 30);
  }

  // Weekly and fortnightly payroll lands on a Friday.
  const day = parseDate(from).getDay();
  const daysToFriday = ((5 - day + 7) % 7) || 7;
  return addDays(from, cadence === 'weekly' ? daysToFriday : daysToFriday + 7);
}

export function payAmount(rate: number, hoursPerWeek: number, cadence: PayCadence): number {
  return Math.round(rate * hoursPerWeek * WEEKS_PER_PERIOD[cadence]);
}

/** Fill in a drafted job's derived fields. */
export function completeJob(draft: JobDraft, today: ISODate): Job {
  return {
    ...draft,
    baselineHoursPerWeek: draft.hoursPerWeek,
    nextPayDate: nextPayDate(draft.payCadence, today),
    nextPayAmount: payAmount(draft.hourlyRate, draft.hoursPerWeek, draft.payCadence),
  };
}

/** What a job pays across a week, whatever its cadence. */
export function weeklyPay(job: { hourlyRate: number; hoursPerWeek: number }): number {
  return job.hourlyRate * job.hoursPerWeek;
}

/** A stable-enough id for something the user just created. */
export function draftId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Today, as the calendar sees it. */
export function todayISO(): ISODate {
  return toISODate(new Date());
}
