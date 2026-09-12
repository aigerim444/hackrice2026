import { coachReply, userMessage } from '../../domain/coach';
import type { ParsedReceipt, SemesterSnapshot, SetupInput } from '../../domain/types';
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
      bills: s.bills.map((bill) =>
        bill.id === 'bill-rent'
          ? { ...bill, amount: input.rentAmount }
          : bill.id === 'bill-phone'
            ? { ...bill, amount: input.phoneAmount }
            : bill,
      ),
      fund: {
        ...s.fund,
        weeklyPledge: input.fundWeeklyPledge,
        members: s.fund.members.map((m) =>
          m.isYou ? { ...m, weeklyPledge: input.fundWeeklyPledge } : m,
        ),
      },
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

  async contributeToFund(amount: number): Promise<SemesterSnapshot> {
    await wait(LATENCY.write);
    const s = this.snapshot;
    return this.commit({
      ...s,
      fund: {
        ...s.fund,
        extraContributed: s.fund.extraContributed + amount,
        members: s.fund.members.map((m) =>
          m.isYou ? { ...m, contributed: m.contributed + amount } : m,
        ),
      },
    });
  }

  async getWrapped(): Promise<WrappedStats> {
    await wait(LATENCY.read);
    return clone(SEED_WRAPPED);
  }
}
