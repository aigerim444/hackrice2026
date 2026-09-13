import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import { parseReceiptWithGemini } from './receipts';

/**
 * Against a stubbed Gemini, same technique as coach.test.ts: this used to be
 * the failure mode nobody could see, since every read failure quietly became
 * the same canned demo receipt. These pin that each distinguishable case
 * actually throws its own message instead.
 */

const realFetch = globalThis.fetch;

function respondsWith(body: Record<string, unknown>) {
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(body) }] } }] }),
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_GEMINI_API_KEY = 'test-key';
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
});

test('a clean read returns a usable receipt', async () => {
  respondsWith({
    issue: 'none',
    merchant: 'Tiger Sugar',
    amount: 8.65,
    suggestedCategory: 'Drinks',
    confidence: 0.95,
  });
  const receipt = await parseReceiptWithGemini('base64');
  assert.equal(receipt.merchant, 'Tiger Sugar');
  assert.equal(receipt.amount, 8.65);
  assert.equal(receipt.suggestedCategory, 'Drinks');
});

test('not a receipt at all throws its own message, not a fake read', async () => {
  respondsWith({ issue: 'not_a_receipt', merchant: 'Unknown', amount: 0, suggestedCategory: 'Other', confidence: 0.1 });
  await assert.rejects(parseReceiptWithGemini('base64'), /doesn.t look like a receipt/i);
});

test('an illegible total throws its own message', async () => {
  respondsWith({
    issue: 'total_illegible',
    merchant: 'Some Cafe',
    amount: 0,
    suggestedCategory: 'Eating out',
    confidence: 0.2,
  });
  await assert.rejects(parseReceiptWithGemini('base64'), /total isn.t legible/i);
});

test('a future-dated receipt throws its own message', async () => {
  respondsWith({
    issue: 'future_date',
    merchant: 'Some Store',
    amount: 12,
    suggestedCategory: 'Other',
    confidence: 0.8,
  });
  await assert.rejects(parseReceiptWithGemini('base64'), /dated in the future/i);
});

test('issue "none" but no usable number still fails distinguishably, not silently', async () => {
  respondsWith({ issue: 'none', merchant: 'Somewhere', amount: 'not-a-number', suggestedCategory: 'Other', confidence: 0.3 });
  await assert.rejects(parseReceiptWithGemini('base64'), /total isn.t legible/i);
});

test('a network failure is distinguishable from a bad read', async () => {
  globalThis.fetch = (async () => {
    throw new TypeError('Network request failed');
  }) as unknown as typeof fetch;
  await assert.rejects(parseReceiptWithGemini('base64'), /no connection/i);
});

test('a timeout is distinguishable from a bad read', async () => {
  globalThis.fetch = (async () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    throw err;
  }) as unknown as typeof fetch;
  await assert.rejects(parseReceiptWithGemini('base64'), /didn.t respond in time/i);
});
