import type { ISODate } from './dates';
import type { Category } from './types';

/**
 * Semester Wrapped.
 *
 * Every figure here is something the app can actually know from its own ledger —
 * that constraint came out of the design conversation and it's worth keeping.
 * "41 skipped bobas" is a guess; "11 of 16 weeks with fewer bobas than August"
 * is a comparison against your own August rate, so it's the one that ships.
 * Money is labelled `earned` or `saved`, never merged into a single `+$`.
 */

export interface WrappedLedgerRow {
  label: string;
  sublabel: string;
  amount: string;
  tone: 'plain' | 'sage' | 'dashed';
}

export interface WrappedCategoryRow {
  name: Category | string;
  amount: number;
  /** Bar width as a share of the top category. */
  share: number;
}

export interface WrappedStreak {
  label: string;
  sublabel: string;
  days: number;
  /** The mint-highlighted rows are the records. */
  record: boolean;
}

export interface WrappedStats {
  semesterLabel: string;
  startDate: ISODate;
  totalDays: number;

  /** Card 1 — the lump. */
  lump: number;
  aidAmount: number;
  summerAmount: number;
  campusEarnings: number;

  /** Card 2 — the forecast that moved. */
  forecastMadeOn: ISODate;
  forecastRunOut: ISODate;
  actualRunOut: ISODate;
  /** Six segments of the term's forecast, as a step chart: left %, bottom px, width %. */
  forecastSteps: { left: number; bottom: number; width: number; tone: 'bad' | 'flat' | 'good' }[];
  forecastAnnotations: { left: number; bottom: number; text: string }[];
  timesMoved: number;
  movesFromShifts: number;

  /** Card 3 — envelopes emptied. */
  freeLeftOver: number;
  ledger: WrappedLedgerRow[];

  /** Card 4 — top category. */
  topCategory: Category;
  topCategoryAmount: number;
  topCategoryReceipts: number;
  topCategoryAverage: number;
  categoryRanking: WrappedCategoryRow[];
  mostVisited: string;

  /** Card 5 — your rhythm. */
  expensiveDay: string;
  expensiveDayAverage: number;
  comparisonDay: string;
  /** Mon–Sun, as a share of the biggest day. */
  weekdayShares: number[];
  latestReceiptTime: string;
  latestReceiptNote: string;
  cheapestWeekAmount: number;
  cheapestWeekNote: string;

  /** Card 6 — friends. */
  fundLabel: string;
  fundTarget: number;
  fundedOn: ISODate;
  fundedEarlyBy: number;
  fundNote: string;
  fundSplit: { name: string; amount: number }[];
  streaks: WrappedStreak[];

  /** Card 7 — the card. */
  posterName: string;
  nextLumpDate: ISODate;
  envelopeSplit: { label: string; share: number; tone: 'ink' | 'faded' | 'mint' | 'empty' }[];
}
