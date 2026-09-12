import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SEED_SNAPSHOT } from '../data/mock/seed';
import { coachReply } from './coach';
import { shortDate, weeksBetween } from './dates';
import { cents, money } from './format';
import { project, projectBaseline } from './runway';
import { categoryBars } from './selectors';
import type { SemesterSnapshot } from './types';

/**
 * The projection engine's contract.
 *
 * Every expectation here is a number that appears on a screen in the Claude
 * Design handoff. They're pinned deliberately: the arithmetic is the product,
 * and a change that moves the run-out date by a day should be a decision, not a
 * surprise.
 *
 * Pure domain code with no React Native imports, so it runs on plain Node:
 *   npm test
 */

const load = (): SemesterSnapshot => JSON.parse(JSON.stringify(SEED_SNAPSHOT));

test('the semester frames 111 days, with Sep 11 as day 19', () => {
  const p = project(load());
  assert.equal(p.totalDays, 111);
  assert.equal(p.dayIndex + 1, 19);
  assert.equal(p.daysLeft, 92);
});

test('the lump is sorted into envelopes before anything is spendable', () => {
  const p = project(load());
  assert.equal(money(p.lump), '$6,240');
  // Rent ×3 + phone ×3 + one campus-fees charge still to come.
  assert.equal(money(p.reserved), '$1,890');
  assert.equal(money(p.fundTotal), '$200');
  assert.equal(money(p.spent), '$881');
  assert.equal(p.free, 3269.25);
});

test('the daily number is the free envelope over the days left', () => {
  const p = project(load());
  assert.equal(money(p.safeDaily), '$36');
  assert.equal(cents(p.leftToday), '$34.79');
});

test('at the observed pace the envelope empties on Nov 15, 27 days short', () => {
  const p = project(load());
  assert.equal(shortDate(p.runOutDate), 'Nov 15');
  assert.equal(p.daysShort, 27);
  assert.equal(p.madeIt, false);
});

test('scheduled hours are the baseline, so the what-if starts at zero delta', () => {
  const snapshot = load();
  assert.equal(project(snapshot).runOutIndex, projectBaseline(snapshot).runOutIndex);
});

test('extra shifts push the date out; fewer pull it in', () => {
  const more = load();
  more.jobs[0].hoursPerWeek = 18;
  assert.equal(shortDate(project(more).runOutDate), 'Dec 2');

  const fewer = load();
  fewer.jobs[0].hoursPerWeek = 6;
  assert.ok(project(fewer).runOutIndex < project(load()).runOutIndex);
});

test('logging a receipt comes out of today, not out of the date', () => {
  const snapshot = load();
  const before = project(snapshot);

  snapshot.todayExpenses.push({
    id: 'exp-boba',
    merchant: 'Tiger Sugar · Village',
    amount: 8.65,
    category: 'Drinks',
    envelope: 'free',
    occurredOn: snapshot.semester.today,
  });
  const after = project(snapshot);

  assert.equal(cents(after.leftToday), '$26.04');
  assert.equal(shortDate(after.runOutDate), shortDate(before.runOutDate));
});

test('moving money into the trip fund lowers the daily number', () => {
  const snapshot = load();
  snapshot.fund.extraContributed = 20;
  assert.equal(money(project(snapshot).safeDaily), '$35');
});

test('bill cadence decides what is still owed, not a flat multiplier', () => {
  const snapshot = load();
  // Rent lands Oct/Nov/Dec 1; the phone bill Sep/Oct/Nov 15 — Dec 15 is past
  // the end of term. Both come to three charges, but for different reasons.
  assert.equal(money(project(snapshot).reserved), '$1,890');

  snapshot.semester.endDate = '2026-12-16';
  assert.equal(money(project(snapshot).reserved), '$1,935');
});

test('the fund is pledged over the weeks left before the trip', () => {
  const snapshot = load();
  assert.equal(weeksBetween(snapshot.semester.today, snapshot.fund.occasion), 10);
});

test('spending bars rank by category and include today', () => {
  const snapshot = load();
  const bars = categoryBars(snapshot);
  assert.equal(bars[0].name, 'Eating out');
  assert.equal(bars[0].width, '100%');
  // Today's $0.75 vending machine lands in Other.
  assert.equal(bars.find((b) => b.name === 'Other')?.amount, 32.75);
});

test('the coach prices a purchase in days of runway', () => {
  const reply = coachReply(load(), 'if i buy the AirPods Pro for $249?');
  assert.match(reply.text, /Big swing/);
  assert.match(reply.text, /from Nov 15 to Nov 10/);
  assert.match(reply.text, /5 days of runway/);
  assert.equal(reply.routes?.length, 3);
});

test('a cheap what-if offers to take it out of today instead', () => {
  const reply = coachReply(load(), '$18 sushi tonight?');
  assert.match(reply.text, /Small\./);
  assert.equal(reply.routes?.[0].tone, 'good');
  assert.equal(reply.routes?.[0].delta, '0 d');
});

test('a question with no price asks for one', () => {
  const reply = coachReply(load(), 'should i go out tonight');
  assert.match(reply.text, /Give me a price/);
  assert.equal(reply.routes, undefined);
});
