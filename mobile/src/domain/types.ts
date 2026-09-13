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

/** Someone you know. The directory the invite pickers choose from. */
export interface Person {
  id: string;
  name: string;
  /** Single letter for the avatar square. */
  initial: string;
}

export interface FundMember {
  id: string;
  name: string;
  isYou?: boolean;
  contributed: number;
  weeklyPledge: number;
  /** `invited` means they haven't accepted yet, so their pledge isn't counted. */
  status: 'ahead' | 'on track' | 'behind' | 'new' | 'invited';
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
  /** True for a fund other people are also paying into. */
  shared?: boolean;
  occasion: ISODate;
  targetAmount: number;
  members: FundMember[];
  /** Your own pledge, and anything you've moved in on top of it this week. */
  weeklyPledge: number;
  extraContributed: number;
  /** Whose idea it was. Absent when it was yours. */
  startedBy?: string;
}

export interface ChallengeParticipant {
  id: string;
  name: string;
  isYou?: boolean;
  streakDays: number;
  /** `invited` until they accept — they don't appear on the leaderboard yet. */
  status: 'joined' | 'invited';
}

export interface Challenge {
  id: string;
  label: string;
  /** Extra context: what it's for, when it ends. */
  sublabel?: string;
  category?: Category;
  /** Optional end date. */
  until?: ISODate;
  /** Everyone in it, you included. */
  participants: ChallengeParticipant[];
  /** Your own run, denormalised so screens don't recompute it. */
  youStreakDays: number;
  broken: boolean;
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
  /**
   * Which what-ifs the coach ran against the projection engine to answer, in
   * order. Shown under the reply: the coach isn't allowed to do arithmetic, and
   * this is the receipt proving it didn't — every figure above came out of one
   * of these.
   */
  trace?: string[];
}

export interface ParsedReceipt {
  merchant: string;
  amount: number;
  suggestedCategory: Category;
  /** 0–1. Below ~0.8 the sheet should ask rather than assert. */
  confidence: number;
  /**
   * What was on it, when the lines were legible. Shown under the total as
   * evidence: it's the difference between "a number appeared" and "it read my
   * receipt", and it's how you catch a misread before it becomes a charge.
   */
  items?: { label: string; amount: number }[];
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
  /** Everything you're setting money aside for. The first is the one Home features. */
  funds: Fund[];
  /** People you can invite to a fund or a challenge. */
  people: Person[];
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

/** A job as typed in — the next payday and its amount are derived from cadence. */
export type JobDraft = Omit<Job, 'nextPayDate' | 'nextPayAmount' | 'baselineHoursPerWeek'>;

/** A bill as typed in. */
export type BillDraft = Omit<Bill, 'envelope'> & { envelope?: EnvelopeId };

/**
 * A challenge as typed in.
 *
 * Deliberately has no money on it. A challenge is a habit you're cutting out,
 * and its payoff is the streak — "$600 toward no boba" would be nonsense, since
 * you aren't saving up for anything. The category is the useful part: a charge
 * in it is the only evidence that can break the streak.
 */
export interface ChallengeDraft {
  id: string;
  label: string;
  category?: Category;
  /** Optional end date, so "No boba until Thanksgiving" can say so. */
  until?: ISODate;
  /** People to invite. They join as `invited` until they accept. */
  inviteIds?: string[];
}

/** A goal as typed in. Yours alone unless someone else is already paying in. */
export type FundDraft = Omit<Fund, 'members'> & {
  members?: FundMember[];
  /** People to invite. They join as `invited` until they accept. */
  inviteIds?: string[];
};

/**
 * What onboarding collects.
 *
 * Jobs, bills and goals are lists the user builds rather than fields over
 * fixed rows — you can work two campus jobs or none, and the app shouldn't
 * assume which.
 */
export interface SetupInput {
  aidAmount: number;
  summerAmount: number;
  jobs: JobDraft[];
  bills: BillDraft[];
  funds: FundDraft[];
}
