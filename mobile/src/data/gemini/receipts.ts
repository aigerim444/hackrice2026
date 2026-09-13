import type { Category, ParsedReceipt } from '../../domain/types';
import { CATEGORIES } from '../../domain/types';
import { ApiError } from '../api';
import { generate, GEMINI_MODEL, jsonOf, type GeminiSchema } from './geminiClient';

/**
 * Reading a receipt with Gemini.
 *
 * The interesting part isn't the OCR — it's that the model is asked for a
 * *decision* the app can act on (which envelope this belongs in, and how sure
 * it is), in a shape the domain already understands. `suggestedCategory` is
 * constrained by an enum to `Category`, so an unparseable answer is impossible
 * rather than merely unlikely, and `confidence` is what the scan sheet uses to
 * decide whether to assert or ask.
 */

/**
 * Distinguishable read failures, over and above the general "give me a
 * number" case. The app used to catch every failure the same way and quietly
 * hand back a canned demo receipt — which meant a genuinely unreadable photo
 * and a perfectly good one looked identical to the person holding the phone.
 * Now the model names what's actually wrong, so the sheet can say it.
 */
const ISSUES = ['none', 'not_a_receipt', 'total_illegible', 'future_date'] as const;
type Issue = (typeof ISSUES)[number];

const ISSUE_MESSAGES: Partial<Record<Issue, string>> = {
  not_a_receipt: 'That doesn’t look like a receipt.',
  total_illegible: 'The total isn’t legible in that photo.',
  future_date: 'That receipt is dated in the future — worth a second look.',
};

const RECEIPT_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    issue: {
      type: 'string',
      enum: [...ISSUES],
      description:
        "'not_a_receipt' if the image isn't a receipt at all — a random photo, a menu, a screenshot. " +
        "'total_illegible' if it is a receipt but the total can't be made out — blurry, cut off, faded. " +
        "'future_date' if the printed date is after today. 'none' if none of those apply.",
    },
    merchant: {
      type: 'string',
      description: 'Business name as printed. Include the location if the receipt shows one.',
    },
    amount: {
      type: 'number',
      description: 'The grand total actually charged, after tax and tip. Not the subtotal.',
    },
    suggestedCategory: {
      type: 'string',
      enum: CATEGORIES,
      description:
        'Which spending envelope this belongs in. Drinks covers coffee, boba and bars. ' +
        'Delivery is for a delivery service fee, not a restaurant you sat in. ' +
        'Books covers course materials and campus fees.',
    },
    confidence: {
      type: 'number',
      description: 'How sure you are of the total and the category, 0 to 1.',
    },
    items: {
      type: 'array',
      description: 'Line items, if legible. Omit rather than guess.',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          amount: { type: 'number' },
        },
        required: ['label', 'amount'],
      },
    },
  },
  required: ['issue', 'merchant', 'amount', 'suggestedCategory', 'confidence'],
};

function instructionFor(today: string): string {
  return `You read receipts for a student budgeting app. Today's date is ${today}.

Return the grand total that was actually charged — the bottom line after tax and
tip, never the subtotal. Amounts are US dollars as a number, so $8.65 is 8.65.

Set "issue" per its schema description. Even when it isn't "none", still give
your best guess at merchant, amount and category — the app shows that guess
alongside the problem, so a low-confidence read is useful context and a
refusal is not.`;
}

/**
 * A captured photo, as base64. `expo-camera` hands this back directly with
 * `takePictureAsync({ base64: true })`, which is why there's no filesystem read
 * here and no extra dependency.
 */
export async function parseReceiptWithGemini(base64: string): Promise<ParsedReceipt> {
  const today = new Date().toISOString().slice(0, 10);
  const response = await generate(GEMINI_MODEL, {
    systemInstruction: { parts: [{ text: instructionFor(today) }] },
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          { text: 'Read this receipt.' },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: RECEIPT_SCHEMA,
    },
  });

  const raw = jsonOf<{
    issue?: unknown;
    merchant?: unknown;
    amount?: unknown;
    suggestedCategory?: unknown;
    confidence?: unknown;
    items?: unknown;
  }>(response);

  const issue = ISSUES.includes(raw.issue as Issue) ? (raw.issue as Issue) : 'none';
  if (issue !== 'none') {
    throw new ApiError(ISSUE_MESSAGES[issue] ?? 'Couldn’t read that receipt.');
  }

  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    // The model said "none" but still didn't give a usable number — same
    // user-facing situation as total_illegible, so it gets the same message.
    throw new ApiError(ISSUE_MESSAGES.total_illegible ?? 'Couldn’t read that receipt.');
  }

  const category = CATEGORIES.includes(raw.suggestedCategory as Category)
    ? (raw.suggestedCategory as Category)
    : 'Other';

  const confidence = Number(raw.confidence);

  return {
    merchant: typeof raw.merchant === 'string' && raw.merchant.trim() ? raw.merchant.trim() : 'Unknown',
    // Money, so two decimals — a model that returns 8.6500000001 shouldn't
    // become a charge nobody can reconcile.
    amount: Math.round(amount * 100) / 100,
    suggestedCategory: category,
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
    items: parseItems(raw.items),
  };
}

function parseItems(value: unknown): ParsedReceipt['items'] {
  if (!Array.isArray(value)) return undefined;
  const items = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const { label, amount } = entry as { label?: unknown; amount?: unknown };
    const price = Number(amount);
    if (typeof label !== 'string' || !label.trim() || !Number.isFinite(price)) return [];
    return [{ label: label.trim(), amount: Math.round(price * 100) / 100 }];
  });
  return items.length ? items : undefined;
}
