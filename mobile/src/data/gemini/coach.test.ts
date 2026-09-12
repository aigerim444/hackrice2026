import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import { SEED_SNAPSHOT } from '../mock/seed';
import type { SemesterSnapshot } from '../../domain/types';
import { askCoachWithGemini, groundedCoachReply } from './coach';

/**
 * The tool loop, against a stubbed Gemini.
 *
 * Worth testing precisely because its failure mode is *silent*: every error path
 * falls back to the offline heuristic, so a broken loop looks exactly like a
 * model that didn't feel like calling a tool. These pin the wire shape — that a
 * `functionCall` comes back as a `functionResponse` with the engine's real
 * numbers in it — without spending a token.
 */

const snapshot = (): SemesterSnapshot => ({
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
});

const realFetch = globalThis.fetch;
const sent: any[] = [];

/** Replies the stub hands back, in order. */
function scriptGemini(...turns: unknown[]) {
  let turn = 0;
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    sent.push(JSON.parse(init.body));
    const parts = turns[Math.min(turn++, turns.length - 1)];
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { role: 'model', parts } }] }),
    };
  }) as unknown as typeof fetch;
}

const says = (text: string) => [{ text }];
const calls = (name: string, args: Record<string, unknown> = {}) => [{ functionCall: { name, args } }];

beforeEach(() => {
  process.env.EXPO_PUBLIC_GEMINI_API_KEY = 'test-key';
  sent.length = 0;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
});

test('a tool call is executed and its real numbers are handed back', async () => {
  scriptGemini(calls('price_purchase', { amount: 249 }), says('That costs you 5 days.'));

  const reply = await askCoachWithGemini(snapshot(), 'can i buy airpods for $249?');

  assert.equal(reply.text, 'That costs you 5 days.');
  assert.deepEqual(reply.trace, ['priced $249']);

  // The second request must carry the engine's answer, not the model's guess.
  const [, second] = sent;
  const result = second.contents.at(-1).parts[0].functionResponse;
  assert.equal(result.name, 'price_purchase');
  // No savings goal on this snapshot, so the envelope is fatter than the
  // design's and the date starts at Nov 19 rather than Nov 15. Either way the
  // purchase costs the same five days.
  assert.equal(result.response.money_runs_out_before, 'Nov 19');
  assert.equal(result.response.money_runs_out, 'Nov 14');
  assert.equal(result.response.days_of_runway_it_costs, 5);
});

test('the tools are actually offered, with their schemas', async () => {
  scriptGemini(says('Hello.'));
  await askCoachWithGemini(snapshot(), 'hi');

  const names = sent[0].tools[0].functionDeclarations.map((d: { name: string }) => d.name);
  assert.ok(names.includes('price_purchase'));
  assert.ok(names.includes('simulate_hours'));

  const priced = sent[0].tools[0].functionDeclarations.find(
    (d: { name: string }) => d.name === 'price_purchase',
  );
  assert.deepEqual(priced.parameters.required, ['amount']);
});

test('several tool calls in one turn all run, and all get answered', async () => {
  scriptGemini(
    [
      { functionCall: { name: 'price_purchase', args: { amount: 60 } } },
      { functionCall: { name: 'simulate_hours', args: { job: 'library', hoursPerWeek: 18 } } },
    ],
    says('Both together still clears the term.'),
  );

  const reply = await askCoachWithGemini(snapshot(), 'if i buy this and pick up shifts?');

  assert.deepEqual(reply.trace, ['priced $60', 'Library desk at 18 hrs/wk']);
  assert.equal(sent[1].contents.at(-1).parts.length, 2);
});

test('a tool error is reported to the model rather than thrown at the screen', async () => {
  scriptGemini(calls('simulate_hours', { job: 'the quarry', hoursPerWeek: 40 }), says('No such job.'));

  const reply = await askCoachWithGemini(snapshot(), 'what if i work at the quarry');

  assert.equal(reply.text, 'No such job.');
  const result = sent[1].contents.at(-1).parts[0].functionResponse;
  assert.equal(result.response.error, 'no such job');
  assert.equal(result.response.jobs_on_file, 'Library desk');
});

test('a model that only ever calls tools is cut off, not looped forever', async () => {
  scriptGemini(calls('get_situation'));
  await assert.rejects(
    () => askCoachWithGemini(snapshot(), 'how am i doing'),
    /kept calling tools/,
  );
});

test('when Gemini fails the coach still answers, offline', async () => {
  globalThis.fetch = (async () => ({ ok: false, status: 503, text: async () => 'unavailable' })) as
    unknown as typeof fetch;

  const reply = await groundedCoachReply(snapshot(), 'if i buy the AirPods Pro for $249?');

  // The built-in heuristic's answer, with its structured routes intact.
  assert.match(reply.text, /Big swing/);
  assert.equal(reply.routes?.length, 3);
  assert.equal(reply.trace, undefined);
});

test('a grounded answer keeps the heuristic routes and gains a trace', async () => {
  scriptGemini(calls('price_purchase', { amount: 249 }), says('Five days of runway.'));

  const reply = await groundedCoachReply(snapshot(), 'if i buy the AirPods Pro for $249?');

  assert.equal(reply.text, 'Five days of runway.');
  assert.deepEqual(reply.trace, ['priced $249']);
  assert.equal(reply.routes?.length, 3);
});
