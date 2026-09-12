import { coachReply, userMessage } from '../../domain/coach';
import { completeJob } from '../../domain/payroll';
import type {
  Fund,
  FundDraft,
  JobDraft,
  ParsedReceipt,
  SemesterSnapshot,
  SetupInput,
} from '../../domain/types';
import type { WrappedStats } from '../../domain/wrapped';
import type { RunwayApi } from '../api';
import { SEED_SNAPSHOT, SEED_WRAPPED } from './seed';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The snapshot is plain JSON, so this is enough — and it works on every engine. */
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Latency the mock fakes, so the UI is exercised the way a network exercises it. */
const LATENCY = {
  read: 80,
  write: 120,
  /** The design holds "Reading…" for a beat before the parsed sheet slides up. */
  scan: 1100,
  coach: 600,
};

/**
 * In-memory implementation of `RunwayApi`.
 *
 * Holds one mutable snapshot and hands back a fresh copy on every call, so
 * nothing upstream can mutate server state by accident — the same discipline a
 * real client gets for free.
 */
export class MockRunwayApi implements RunwayApi {
  private snapshot: SemesterSnapshot = clone(SEED_SNAPSHOT);

  private commit(next: SemesterSnapshot): SemesterSnapshot {
    this.snapshot = next;
    return clone(next);
  }

  async getSnapshot(): Promise<SemesterSnapshot> {
    await wait(LATENCY.read);
    return clone(this.snapshot);
  }

  async completeSetup(input: SetupInput): Promise<SemesterSnapshot> {
    await wait(LATENCY.write);
    const s = this.snapshot;
    const today = s.semester.today;

    return this.commit({
      ...s,
      setupComplete: true,
      income: s.income.map((source) =>
        source.kind === 'aid'
          ? { ...source, amount: input.aidAmount }
          : source.kind === 'summer'
            ? { ...source, amount: input.summerAmount }
            : source,
      ),
      // The drafts replace whatever was there: onboarding is the whole truth
      // about what you earn, what you owe and what you're saving for.
      jobs: input.jobs.map((draft) => completeJob(draft, today)),
      bills: input.bills.map((draft) => ({ ...draft, envelope: draft.envelope ?? 'fees' })),
      funds: input.funds.map((draft) => this.hydrateFund(draft)),
    });
  }

  /** A goal you added is yours alone until someone else pays in. */
  private hydrateFund(draft: FundDraft): Fund {
    if (draft.members?.length) return draft as Fund;
    return {
      ...draft,
      members: [
        {
          id: this.snapshot.user.id,
          name: 'You',
          isYou: true,
          contributed: 0,
          weeklyPledge: draft.weeklyPledge,
          status: 'on track',
        },
      ],
    };
  }

  async addJob(draft: JobDraft): Promise<SemesterSnapshot> {
    await wait(LATENCY.write);
    return this.commit({
      ...this.snapshot,
      jobs: [...this.snapshot.jobs, completeJob(draft, this.snapshot.semester.today)],
    });
  }

  async addFund(draft: FundDraft): Promise<SemesterSnapshot> {
    await wait(LATENCY.write);
    return this.commit({
      ...this.snapshot,
      funds: [...this.snapshot.funds, this.hydrateFund(draft)],
    });
  }

  async resetSemester(): Promise<SemesterSnapshot> {
    await wait(LATENCY.write);
    return this.commit(clone(SEED_SNAPSHOT));
  }

  async setJobHours(jobId: string, hoursPerWeek: number): Promise<SemesterSnapshot> {
    await wait(LATENCY.write);
    return this.commit({
      ...this.snapshot,
      jobs: this.snapshot.jobs.map((job) => (job.id === jobId ? { ...job, hoursPerWeek } : job)),
    });
  }

  async logExpense(
    input: Parameters<RunwayApi['logExpense']>[0],
  ): Promise<SemesterSnapshot> {
    await wait(LATENCY.write);
    const s = this.snapshot;
    return this.commit({
      ...s,
      todayExpenses: [
        ...s.todayExpenses,
        {
          id: `exp-${Date.now()}`,
          merchant: input.merchant,
          amount: input.amount,
          category: input.category,
          envelope: input.envelope,
          occurredOn: s.semester.today,
        },
      ],
      // A charge in a challenge's category breaks that challenge. This is the
      // only direction a streak can be broken by evidence; the streak advancing
      // is inferred from the *absence* of a charge, server-side.
      challenges: s.challenges.map((c) =>
        c.category === input.category && !c.broken
          ? { ...c, broken: true, youStreakDays: 0 }
          : c,
      ),
    });
  }

  async scanReceipt(): Promise<ParsedReceipt> {
    await wait(LATENCY.scan);
    return {
      merchant: 'Tiger Sugar · Village',
      amount: 8.65,
      suggestedCategory: 'Drinks',
      confidence: 0.94,
    };
  }

  async askCoach(text: string) {
    const question = userMessage(text);
    this.snapshot = { ...this.snapshot, chat: [...this.snapshot.chat, question] };

    await wait(LATENCY.coach);

    const reply = coachReply(this.snapshot, text);
    const snapshot = this.commit({
      ...this.snapshot,
      chat: [...this.snapshot.chat, reply],
    });
    return { snapshot, reply };
  }

  async contributeToFund(fundId: string, amount: number): Promise<SemesterSnapshot> {
    await wait(LATENCY.write);
    const s = this.snapshot;
    return this.commit({
      ...s,
      funds: s.funds.map((fund) =>
        fund.id !== fundId
          ? fund
          : {
              ...fund,
              extraContributed: fund.extraContributed + amount,
              members: fund.members.map((m) =>
                m.isYou ? { ...m, contributed: m.contributed + amount } : m,
              ),
            },
      ),
    });
  }

  async getWrapped(): Promise<WrappedStats> {
    await wait(LATENCY.read);
    return clone(SEED_WRAPPED);
  }
}
