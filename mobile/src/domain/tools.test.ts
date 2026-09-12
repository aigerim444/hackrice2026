import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SEED_SNAPSHOT } from '../data/mock/seed';
import { project } from './runway';
import { COACH_TOOLS, runCoachTool } from './tools';
import type { SemesterSnapshot } from './types';

/**
 * The coach's tool layer.
 *
 * These matter more than they look. A language model is pointed at these
 * functions and told it may quote their output and nothing else, so the
 * guarantee "the coach cannot state a wrong number" reduces entirely to: do
 * these return the same numbers the rest of the app shows, and do they refuse
 * bad input instead of inventing something?
 */

const load = (): SemesterSnapshot => ({
  ...(JSON.parse(JSON.stringify(SEED_SNAPSHOT)) as SemesterSnapshot),
  jobs: [
    {
      id: 'job-lib',
      name: 'Library desk',
      hourlyRate: 15.5,
      hoursPerWeek: 12,
      baselineHoursPerWeek: 12,
      payCadence: 'biweekly',
      nextPayDate: '2026-09-18',
      nextPayAmount: 372,
    },
  ],
  funds: [
    {
      id: 'fund-austin',
      label: 'Austin trip',
      occasion: '2026-11-20',
      targetAmount: 600,
      weeklyPledge: 20,
      extraContributed: 0,
      members: [
        { id: 'u-priya', name: 'You', isYou: true, contributed: 120, weeklyPledge: 20, status: 'on track' },
      ],
    },
  ],
});

test('every declared tool is actually implemented', () => {
  const snapshot = load();
  for (const tool of COACH_TOOLS) {
    const outcome = runCoachTool(snapshot, tool.name, {});
    assert.notEqual(outcome.values.error, `unknown tool "${tool.name}"`, tool.name);
  }
});

test('an unknown tool is an error the model can read, not a crash', () => {
  const outcome = runCoachTool(load(), 'transfer_all_my_money', { to: 'me' });
  assert.match(String(outcome.values.error), /unknown tool/);
});

test('the situation it reports is the one on the home screen', () => {
  const snapshot = load();
  const p = project(snapshot);
  const { values } = runCoachTool(snapshot, 'get_situation');

  // Pre-formatted, because the model is only allowed to quote — never reformat.
  assert.equal(values.daily_allowance, '$36');
  assert.equal(values.money_runs_out, 'Nov 15');
  assert.equal(values.days_short_of_end_of_term, p.daysShort);
  assert.equal(values.reaches_end_of_term, false);
});

test('a purchase is priced in days of runway', () => {
  const { values } = runCoachTool(load(), 'price_purchase', { amount: 249 });
  assert.equal(values.purchase, '$249');
  assert.equal(values.money_runs_out_before, 'Nov 15');
  assert.equal(values.money_runs_out, 'Nov 10');
  assert.equal(values.days_of_runway_it_costs, 5);
});

test('a nonsense price is refused rather than answered', () => {
  for (const amount of [-40, 0, 'a lot', null]) {
    const { values } = runCoachTool(load(), 'price_purchase', { amount });
    assert.match(String(values.error), /positive number/, String(amount));
  }
});

test('extra shifts buy runway; fewer shifts sell it', () => {
  const more = runCoachTool(load(), 'simulate_hours', { job: 'Library desk', hoursPerWeek: 18 });
  const fewer = runCoachTool(load(), 'simulate_hours', { job: 'Library desk', hoursPerWeek: 6 });

  assert.equal(more.values.extra_earned, '$837');
  assert.ok(Number(more.values.days_of_runway_it_buys) > 0);
  assert.ok(Number(fewer.values.days_of_runway_it_buys) < 0);
});

test('the job is found the way a student would name it', () => {
  for (const query of ['Library desk', 'library', 'the library desk job']) {
    const { values } = runCoachTool(load(), 'simulate_hours', { job: query, hoursPerWeek: 15 });
    assert.equal(values.job, 'Library desk', query);
  }
});

test('an unknown job comes back with the real list, so the model can retry', () => {
  const { values } = runCoachTool(load(), 'simulate_hours', { job: 'the quarry', hoursPerWeek: 40 });
  assert.equal(values.error, 'no such job');
  assert.equal(values.jobs_on_file, 'Library desk');
});

test('saving more per week lowers the daily number', () => {
  const { values } = runCoachTool(load(), 'simulate_pledge', { goal: 'Austin', weeklyPledge: 60 });
  assert.equal(values.weekly_pledge_now, '$20');
  assert.equal(values.weekly_pledge_tried, '$60');
  assert.equal(values.daily_allowance_before, '$36');
  // $40/wk more, over the 10 weeks to the trip, is $400 off a 92-day envelope.
  assert.equal(values.daily_allowance, '$31');
});

test('tools never mutate the snapshot they are given', () => {
  const snapshot = load();
  const before = JSON.stringify(snapshot);

  runCoachTool(snapshot, 'price_purchase', { amount: 900 });
  runCoachTool(snapshot, 'simulate_hours', { job: 'Library desk', hoursPerWeek: 40 });
  runCoachTool(snapshot, 'simulate_pledge', { goal: 'Austin trip', weeklyPledge: 200 });

  assert.equal(JSON.stringify(snapshot), before);
});

test('an empty semester lists nothing rather than throwing', () => {
  const empty = JSON.parse(JSON.stringify(SEED_SNAPSHOT)) as SemesterSnapshot;
  const { values } = runCoachTool(empty, 'list_commitments');
  assert.equal(values.jobs, 'none');
  assert.equal(values.goals, 'none');
});
