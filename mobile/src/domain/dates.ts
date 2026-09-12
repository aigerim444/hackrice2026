/**
 * Calendar helpers.
 *
 * Dates cross the API boundary as `YYYY-MM-DD` strings — no timezone, because a
 * semester day is a calendar day, not an instant. Everything here works on local
 * midnight so day arithmetic never drifts by one across a DST boundary.
 */

export type ISODate = string;

const MS_PER_DAY = 86_400_000;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function parseDate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(date: Date): ISODate {
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from `from` to `to`. Negative when `to` precedes `from`. */
export function daysBetween(from: ISODate, to: ISODate): number {
  const a = parseDate(from).getTime();
  const b = parseDate(to).getTime();
  return Math.round((b - a) / MS_PER_DAY);
}

/** Whole weeks from `from` to `to`, rounded down. */
export function weeksBetween(from: ISODate, to: ISODate): number {
  return Math.floor(daysBetween(from, to) / 7);
}

/** "Nov 15" — the format every date in the design uses. */
export function shortDate(iso: ISODate): string {
  const d = parseDate(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Fri, Sep 11" — the home screen's dateline. */
export function weekdayDate(iso: ISODate): string {
  const d = parseDate(iso);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return `${day}, ${shortDate(iso)}`;
}

/**
 * Every date on or after `from` and on or before `to` on which a monthly charge
 * falling on `dayOfMonth` comes due. Months shorter than the day (a 31st in
 * February) charge on the last day of that month, which is what billers do.
 */
export function monthlyDueDates(dayOfMonth: number, from: ISODate, to: ISODate): ISODate[] {
  const start = parseDate(from);
  const end = parseDate(to);
  const out: ISODate[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const due = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(dayOfMonth, lastDay));
    if (due >= start && due <= end) out.push(toISODate(due));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

/** The 1st of the month `iso` falls in. */
export function startOfMonth(iso: ISODate): ISODate {
  const d = parseDate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** Shift by whole months, clamping to the end of a shorter month. */
export function addMonths(iso: ISODate, months: number): ISODate {
  const d = parseDate(iso);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return toISODate(target);
}

export function daysInMonth(iso: ISODate): number {
  const d = parseDate(iso);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/**
 * Which column the 1st sits in, counting Monday as 0 — the app shows weeks
 * Monday-first everywhere, including Wrapped's rhythm chart.
 */
export function mondayIndexOfFirst(iso: ISODate): number {
  return (parseDate(startOfMonth(iso)).getDay() + 6) % 7;
}

/** "November 2026". */
export function monthLabel(iso: ISODate): string {
  const d = parseDate(iso);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** The same calendar day, ignoring anything finer. */
export function isSameDay(a: ISODate, b: ISODate): boolean {
  return a === b;
}
