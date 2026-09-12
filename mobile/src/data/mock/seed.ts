import type { SemesterSnapshot } from '../../domain/types';
import type { WrappedStats } from '../../domain/wrapped';

/**
 * The demo semester — Priya's Fall 2026.
 *
 * These are the numbers the design was drawn against, so the app reads exactly
 * like the handoff. Two of them are seeded independently rather than derived
 * from one ledger, and it's worth being explicit about why:
 *
 * - `priorCategoryTotals` ($940) is spending across *every* envelope — the books
 *   and fees that came out of the fees envelope included.
 * - `priorFreeSpend` ($880) is only the part charged to Free-to-spend, which is
 *   the part that moves the daily number.
 *
 * A real backend derives both from the same transaction feed and they reconcile
 * by construction. Here they're two constants, matching the design's figures.
 */
export const SEED_SNAPSHOT: SemesterSnapshot = {
  semester: {
    id: 'fall-2026',
    label: 'Fall 2026',
    startDate: '2026-08-24',
    endDate: '2026-12-12',
    today: '2026-09-11',
    // Shifts stop after the second week of November — extra hours dragged on the
    // jobs screen only earn up to here (nine more paid weeks).
    lastPaidWeek: '2026-11-13',
  },
  user: { id: 'u-priya', name: 'Priya N.', initial: 'P' },

  // Empty on a first run: you haven't added anyone yet. Friends are added in
  // the Friends tab, and only then can they be invited to anything.
  people: [],

  income: [
    {
      id: 'inc-aid',
      kind: 'aid',
      label: 'Aid refund',
      sublabel: 'grants after tuition',
      amount: 3800,
      receivedOn: '2026-08-24',
    },
    {
      id: 'inc-summer',
      kind: 'summer',
      label: 'Summer money',
      sublabel: "what's left of it",
      amount: 2440,
      receivedOn: '2026-08-24',
    },
  ],

  // Empty on purpose: campus jobs are entered during onboarding, because
  // whether you work none, one or three of them is the whole variable.
  jobs: [],

  bills: [
    { id: 'bill-rent', label: 'Rent', envelope: 'rent', amount: 520, cadence: 'monthly', dueDay: 1 },
    { id: 'bill-phone', label: 'Phone', envelope: 'fees', amount: 45, cadence: 'monthly', dueDay: 15 },
    {
      id: 'bill-fees',
      label: 'Campus fees',
      envelope: 'fees',
      amount: 195,
      cadence: 'once',
      dueDate: '2026-10-05',
    },
    {
      id: 'bill-meal',
      label: 'Meal plan',
      envelope: 'fees',
      amount: 0,
      cadence: 'once',
      prepaid: true,
    },
  ],

  // Nothing shared exists until you make it. The Austin trip in the design was
  // a populated example, not a starting state.
  funds: [],

  challenges: [],

  todayExpenses: [
    {
      id: 'exp-vending',
      merchant: 'Vending · Fondren',
      amount: 0.75,
      category: 'Other',
      envelope: 'free',
      occurredOn: '2026-09-11',
    },
  ],

  priorCategoryTotals: {
    'Eating out': 318,
    Groceries: 212,
    Delivery: 164,
    Books: 118,
    Drinks: 96,
    Other: 32,
  },
  priorFreeSpend: 880,
  observedDailyPace: 50,

  moves: [
    {
      id: 'mv-rent',
      deltaDays: -2,
      title: 'Dipped into Rent · $84',
      sublabel: 'Sep 3 · groceries came out of the wrong envelope',
      positive: false,
    },
    {
      id: 'mv-delivery',
      deltaDays: -2,
      title: 'Delivery ×3 · $71',
      sublabel: 'Tue–Thu · $19 of it was fees',
      positive: false,
    },
    {
      id: 'mv-shift',
      deltaDays: 2,
      title: 'Logged 14 h at work',
      sublabel: '$217 lands Sep 18 → Free to spend',
      positive: true,
    },
    {
      id: 'mv-textbook',
      deltaDays: -1,
      title: 'Textbook · $118',
      sublabel: 'One-off · bounces back if you stay on pace',
      positive: false,
    },
  ],

  chat: [
    { id: 'seed-1', role: 'user', text: 'can i afford the $40 concert sat?' },
    {
      id: 'seed-2',
      role: 'coach',
      text: "Yep — that's under a day of runway. Want me to hold $40 from Free-to-spend so it doesn't leak out as boba?",
    },
  ],

  setupComplete: false,
};

/**
 * The recap, as of the end of term. In production this is computed server-side
 * once the semester closes; the client only ever reads it.
 */
export const SEED_WRAPPED: WrappedStats = {
  semesterLabel: 'Fall 2026',
  startDate: '2026-08-24',
  totalDays: 111,

  lump: 6240,
  aidAmount: 3800,
  summerAmount: 2440,
  campusEarnings: 3024,

  forecastMadeOn: '2026-09-11',
  forecastRunOut: '2026-11-14',
  actualRunOut: '2026-12-12',
  forecastSteps: [
    { left: 0, bottom: 14, width: 12, tone: 'bad' },
    { left: 12, bottom: 10, width: 16, tone: 'bad' },
    { left: 28, bottom: 26, width: 18, tone: 'flat' },
    { left: 46, bottom: 22, width: 14, tone: 'flat' },
    { left: 60, bottom: 44, width: 20, tone: 'good' },
    { left: 80, bottom: 58, width: 20, tone: 'good' },
  ],
  forecastAnnotations: [
    { left: 28, bottom: 2, text: '↑ picked up rec shifts' },
    { left: 60, bottom: 30, text: '↑ no-delivery October' },
  ],
  timesMoved: 14,
  movesFromShifts: 12,

  freeLeftOver: 61,
  ledger: [
    { label: 'Rent · 4 months', sublabel: 'never late', amount: '$2,080', tone: 'plain' },
    { label: 'Austin trip', sublabel: 'funded Nov 18 · 2 days early', amount: '$200', tone: 'plain' },
    { label: 'Two campus jobs', sublabel: '18 extra shifts · earned', amount: '+$3,024', tone: 'sage' },
    {
      label: 'Fewer bobas than August',
      sublabel: '11 of 16 weeks · saved',
      amount: '~$180',
      tone: 'dashed',
    },
  ],

  topCategory: 'Eating out',
  topCategoryAmount: 1140,
  topCategoryReceipts: 97,
  topCategoryAverage: 11.75,
  categoryRanking: [
    { name: 'Eating out', amount: 1140, share: 100 },
    { name: 'Groceries', amount: 868, share: 76 },
    { name: 'Delivery', amount: 436, share: 38 },
    { name: 'Drinks', amount: 312, share: 27 },
    { name: 'Books + fees', amount: 313, share: 27 },
  ],
  mostVisited: 'the taqueria on Kirby, 23 times. Tuesdays, mostly.',

  expensiveDay: 'Friday',
  expensiveDayAverage: 71,
  comparisonDay: 'Tuesday',
  weekdayShares: [44, 40, 52, 58, 100, 82, 48],
  latestReceiptTime: '2:41 AM',
  latestReceiptNote: 'Oct 30 · delivery',
  cheapestWeekAmount: 142,
  cheapestWeekNote: 'Oct 6–12 · midterms',

  fundLabel: 'Austin trip envelope',
  fundTarget: 600,
  fundedOn: '2026-11-18',
  fundedEarlyBy: 2,
  fundNote: 'Dev caught up in the last week.',
  fundSplit: [
    { name: 'You', amount: 200 },
    { name: 'Maya', amount: 200 },
    { name: 'Dev', amount: 200 },
  ],
  streaks: [
    { label: 'No delivery', sublabel: 'you · Oct 1–Nov 3', days: 34, record: true },
    { label: 'No new clothes', sublabel: 'Maya · the whole semester', days: 111, record: true },
    { label: 'No boba', sublabel: 'you · best of 4 tries', days: 9, record: false },
  ],

  posterName: 'Priya',
  nextLumpDate: '2027-01-12',
  envelopeSplit: [
    { label: 'Rent', share: 33, tone: 'ink' },
    { label: 'Fees', share: 5, tone: 'faded' },
    { label: 'Trip', share: 3, tone: 'mint' },
    { label: 'Free to spend', share: 59, tone: 'empty' },
  ],
};
