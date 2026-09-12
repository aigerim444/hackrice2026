import { shortDate } from './dates';
import { money } from './format';
import { project, projectWithExtraSpend, type Projection } from './runway';
import type { SemesterSnapshot } from './types';

/**
 * The what-if tools, as pure functions over the projection engine.
 *
 * This is the file that makes a language model safe to point at someone's
 * money. The rule it enforces:
 *
 *   **The model chooses which question to ask. The engine answers it.**
 *
 * Every figure a tool returns is *pre-formatted* — `"$36"`, `"Nov 15"`, not
 * `36.02` and `"2026-11-15"`. The model is instructed to quote those strings
 * verbatim, so the worst it can do is quote the wrong true number; it cannot
 * invent one, and it cannot round, add or "estimate" its way into a figure the
 * rest of the app disagrees with. Arithmetic never leaves this file.
 *
 * Pure and dependency-free, so the same tools serve the Gemini path, the
 * offline heuristic, and the tests.
 */

export interface ToolSpec {
  name: string;
  description: string;
  parameters?: {
    type: 'object';
    properties: Record<
      string,
      { type: 'string' | 'number'; description: string; enum?: string[] }
    >;
    required?: string[];
  };
}

/** What a tool hands back: values for the model, plus a chip for the UI. */
export interface ToolOutcome {
  name: string;
  /** Pre-formatted values. The model may quote these and nothing else. */
  values: Record<string, string | number | boolean>;
  /** Shown under the reply, so a reader can see which what-if was actually run. */
  trace: string;
}

export const COACH_TOOLS: ToolSpec[] = [
  {
    name: 'get_situation',
    description:
      "The student's current position: daily allowance, what's left today, the " +
      'date the spending envelope empties, and how far short of the end of term that is. ' +
      'Call this first for any question about how they are doing.',
  },
  {
    name: 'price_purchase',
    description:
      'Price a one-off purchase in days of runway. Returns how far the run-out date moves ' +
      'if they buy it out of spending money. Use for any "can I afford / what if I buy" question.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Dollar cost of the thing, e.g. 249' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'simulate_hours',
    description:
      'Change the hours worked per week at one job and re-run the projection. ' +
      'Use for "what if I pick up / drop shifts" questions.',
    parameters: {
      type: 'object',
      properties: {
        job: { type: 'string', description: 'The job name as the student refers to it' },
        hoursPerWeek: { type: 'number', description: 'New hours per week to try' },
      },
      required: ['job', 'hoursPerWeek'],
    },
  },
  {
    name: 'simulate_pledge',
    description:
      'Change the weekly amount set aside for one savings goal and re-run the projection. ' +
      'Use for "can I afford to save more for X" questions.',
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'The goal label as the student refers to it' },
        weeklyPledge: { type: 'number', description: 'New dollars per week to set aside' },
      },
      required: ['goal', 'weeklyPledge'],
    },
  },
  {
    name: 'list_commitments',
    description:
      'The jobs and savings goals on file, with their current hours, rates and pledges. ' +
      'Call this when you need the exact name of a job or goal before simulating it.',
  },
];

/** The shape every projection is reported in. Formatted once, here. */
function report(p: Projection) {
  return {
    daily_allowance: money(p.safeDaily),
    left_to_spend_today: money(p.leftToday),
    money_runs_out: shortDate(p.runOutDate),
    reaches_end_of_term: p.madeIt,
    days_short_of_end_of_term: p.daysShort,
  };
}

/** Loose match, because the student says "the library" and the job is "Library desk". */
function find<T>(items: T[], label: (item: T) => string, query: string): T | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return (
    items.find((item) => label(item).toLowerCase() === q) ??
    items.find((item) => label(item).toLowerCase().includes(q)) ??
    items.find((item) => q.includes(label(item).toLowerCase()))
  );
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Run one tool call against a snapshot.
 *
 * Never throws: a bad argument comes back as an `error` value the model can
 * read and recover from, which is far more useful than an exception that kills
 * the turn. Nothing here mutates the snapshot — each simulation runs the
 * projection over a modified *copy*, the same discipline the jobs slider uses.
 */
export function runCoachTool(
  snapshot: SemesterSnapshot,
  name: string,
  args: Record<string, unknown> = {},
): ToolOutcome {
  const now = project(snapshot);

  switch (name) {
    case 'get_situation':
      return {
        name,
        values: {
          ...report(now),
          days_left_in_term: now.daysLeft,
          spending_money_left: money(now.free),
          recent_daily_pace: money(snapshot.observedDailyPace),
        },
        trace: 'checked your position',
      };

    case 'price_purchase': {
      const amount = num(args.amount);
      if (amount === null || amount <= 0) {
        return { name, values: { error: 'amount must be a positive number' }, trace: 'bad amount' };
      }
      const after = projectWithExtraSpend(snapshot, amount);
      return {
        name,
        values: {
          purchase: money(amount),
          ...report(after),
          money_runs_out_before: shortDate(now.runOutDate),
          days_of_runway_it_costs: Math.max(0, now.runOutIndex - after.runOutIndex),
        },
        trace: `priced ${money(amount)}`,
      };
    }

    case 'simulate_hours': {
      const hours = num(args.hoursPerWeek);
      const job = find(snapshot.jobs, (j) => j.name, String(args.job ?? ''));
      if (!job) {
        return {
          name,
          values: {
            error: 'no such job',
            jobs_on_file: snapshot.jobs.map((j) => j.name).join(', ') || 'none',
          },
          trace: 'no such job',
        };
      }
      if (hours === null || hours < 0) {
        return { name, values: { error: 'hoursPerWeek must be zero or more' }, trace: 'bad hours' };
      }
      const after = project({
        ...snapshot,
        jobs: snapshot.jobs.map((j) => (j.id === job.id ? { ...j, hoursPerWeek: hours } : j)),
      });
      return {
        name,
        values: {
          job: job.name,
          hours_per_week_now: job.hoursPerWeek,
          hours_per_week_tried: hours,
          extra_earned: money(after.futureJobIncome - now.futureJobIncome),
          ...report(after),
          money_runs_out_before: shortDate(now.runOutDate),
          days_of_runway_it_buys: after.runOutIndex - now.runOutIndex,
        },
        trace: `${job.name} at ${hours} hrs/wk`,
      };
    }

    case 'simulate_pledge': {
      const pledge = num(args.weeklyPledge);
      const fund = find(snapshot.funds, (f) => f.label, String(args.goal ?? ''));
      if (!fund) {
        return {
          name,
          values: {
            error: 'no such goal',
            goals_on_file: snapshot.funds.map((f) => f.label).join(', ') || 'none',
          },
          trace: 'no such goal',
        };
      }
      if (pledge === null || pledge < 0) {
        return { name, values: { error: 'weeklyPledge must be zero or more' }, trace: 'bad pledge' };
      }
      const after = project({
        ...snapshot,
        funds: snapshot.funds.map((f) =>
          f.id === fund.id ? { ...f, weeklyPledge: pledge } : f,
        ),
      });
      return {
        name,
        values: {
          goal: fund.label,
          weekly_pledge_now: money(fund.weeklyPledge),
          weekly_pledge_tried: money(pledge),
          ...report(after),
          daily_allowance_before: money(now.safeDaily),
        },
        trace: `${fund.label} at ${money(pledge)}/wk`,
      };
    }

    case 'list_commitments':
      return {
        name,
        values: {
          jobs:
            snapshot.jobs
              .map((j) => `${j.name} (${j.hoursPerWeek} hrs/wk at ${money(j.hourlyRate)}/hr)`)
              .join('; ') || 'none',
          goals:
            snapshot.funds
              .map((f) => `${f.label} (${money(f.weeklyPledge)}/wk toward ${money(f.targetAmount)})`)
              .join('; ') || 'none',
          streaks: snapshot.challenges.map((c) => c.label).join('; ') || 'none',
        },
        trace: 'looked up your jobs and goals',
      };

    default:
      return { name, values: { error: `unknown tool "${name}"` }, trace: 'unknown tool' };
  }
}
