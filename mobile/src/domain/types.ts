import type { ISODate } from './dates';

/**
 * The domain model.
 *
 * These are the shapes the API returns and the screens read. They are
 * deliberately a little wider than today's mock needs (ids everywhere, pay
 * cadence on jobs, per-member fund pledges) because the whole point of the
 * envelope metaphor is that a real backend can fill them from a transaction
 * feed without the screens changing.
 */

export type EnvelopeId = 'rent' | 'fees' | 'fund' | 'free';

export type Category = 'Eating out' | 'Groceries' | 'Delivery' | 'Books' | 'Drinks' | 'Other';

export const CATEGORIES: Category[] = [
  'Eating out',
  'Groceries',
  'Delivery',
  'Books',
  'Drinks',
  'Other',
];

export interface Semester {
  id: string;
  label: string;
  startDate: ISODate;
  endDate: ISODate;
  /**
   * The day the app is reasoning about. Supplied by the server rather than read
   * off the device clock, so a projection is reproducible and a demo dataset
   * stays put — the handoff design is drawn on Fri, Sep 11.
   */
  today: ISODate;
  /**
   * Last week of the term that still pays shifts. Extra hours dragged on the
   * jobs screen only earn between today and this date.
   */
  lastPaidWeek: ISODate;
}

export interface IncomeSource {
  id: string;
  kind: 'aid' | 'summer' | 'other';
  label: string;
  sublabel: string;
  amount: number;
  receivedOn: ISODate;
}

export type PayCadence = 'weekly' | 'biweekly' | 'monthly';

export interface Job {
  id: string;
  name: string;
  hourlyRate: number;
  hoursPerWeek: number;
  /** Hours as actually scheduled. The what-if slider moves `hoursPerWeek` off this. */
  baselineHoursPerWeek: number;
  payCadence: PayCadence;
  nextPayDate: ISODate;
  nextPayAmount: number;
}

export interface Bill {
  id: string;
  label: string;
  /** Which envelope it is carved out of. */
  envelope: EnvelopeId;
  amount: number;
  cadence: 'monthly' | 'once';
  /** Day of month for `monthly` bills. */
  dueDay?: number;
  /** Due date for `once` bills. */
  dueDate?: ISODate;
  /** Already settled for the term (the meal plan) — reserved nothing, shows as "Paid". */
  prepaid?: boolean;
}

export interface FundMember {
  id: string;
  name: string;
  isYou?: boolean;
  contributed: number;
  weeklyPledge: number;
  status: 'ahead' | 'on track' | 'behind' | 'new';
}

/**
 * A shared fund is real money: each person pledges a weekly amount that is
 * carved out of their runway up front. Distinct from a challenge, which is a
 * streak with no dollars attached — that distinction is the thing the user
 * pushed for in the design conversation.
 */
export interface Fund {
  id: string;
  label: string;
  occasion: ISODate;
  targetAmount: number;
  members: FundMember[];
  /** Your own pledge, and anything you've moved in on top of it this week. */
  weeklyPledge: number;
  extraContributed: number;
}

export interface Challenge {
  id: string;
  label: string;
  /** Who you're doing it with / how long it runs. */
  sublabel: string;
  /** Sublabel shown once you've broken it today. */
  brokenSublabel?: string;
  category?: Category;
  youStreakDays: number;
  broken: boolean;
  leaderName: string;
  leaderDays: number;
  /** Right-hand caption under your streak count. */
  leaderCaption: string;
}

export interface Expense {
  id: string;
  merchant: string;
  amount: number;
  category: Category;
  envelope: EnvelopeId;
  occurredOn: ISODate;
}

/** One line of the "why it moved this week" ledger. */
export interface RunwayMove {
  id: string;
  /** Signed days, e.g. -2 or +2. */
  deltaDays: number;
  title: string;
  sublabel: string;
  /** True when the row reads as money coming in. */
  positive: boolean;
}

export interface ChatRoute {
  label: string;
  delta: string;
  /** `good` routes are the ones that don't cost runway. */
  tone: 'good' | 'neutral';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'coach';
  text: string;
  routes?: ChatRoute[];
}

export interface ParsedReceipt {
  merchant: string;
  amount: number;
  suggestedCategory: Category;
  /** 0–1. Below ~0.8 the sheet should ask rather than assert. */
  confidence: number;
}

/**
 * The whole of a user's semester, as one document. Small enough to fetch in one
 * request and to hold in context; a real backend would paginate `expenses`.
 */
export interface SemesterSnapshot {
  semester: Semester;
  user: { id: string; name: string; initial: string };
  income: IncomeSource[];
  jobs: Job[];
  bills: Bill[];
  fund: Fund;
  challenges: Challenge[];
  /** Everything logged today. Older spend is summarised below. */
  todayExpenses: Expense[];
  /**
   * Spending to date, by category, across every envelope.
   */
  priorCategoryTotals: Record<Category, number>;
  /**
   * Of that spending, the part charged to the Free-to-spend envelope — the only
   * part that moves the daily number.
   */
  priorFreeSpend: number;
  /** Observed $/day burn rate the run-out projection extrapolates. */
  observedDailyPace: number;
  moves: RunwayMove[];
  /** Seeded coach thread. */
  chat: ChatMessage[];
  /** Whether onboarding has been completed for this semester. */
  setupComplete: boolean;
}

/** What onboarding collects. */
export interface SetupInput {
  aidAmount: number;
  summerAmount: number;
  rentAmount: number;
  phoneAmount: number;
  fundWeeklyPledge: number;
}
