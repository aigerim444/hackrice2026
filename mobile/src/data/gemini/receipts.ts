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

const RECEIPT_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
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
  required: ['merchant', 'amount', 'suggestedCategory', 'confidence'],
};

const INSTRUCTION = `You read receipts for a student budgeting app.

Return the grand total that was actually charged — the bottom line after tax and
tip, never the subtotal. Amounts are US dollars as a number, so $8.65 is 8.65.

If the image is not a receipt, or the total is not legible, set confidence below
0.4 and give your best reading anyway. The app asks the student to confirm
before anything is recorded, so a low-confidence guess is useful and a refusal
is not.`;

/**
 * A captured photo, as base64. `expo-camera` hands this back directly with
 * `takePictureAsync({ base64: true })`, which is why there's no filesystem read
 * here and no extra dependency.
 */
export async function parseReceiptWithGemini(base64: string): Promise<ParsedReceipt> {
  const response = await generate(GEMINI_MODEL, {
    systemInstruction: { parts: [{ text: INSTRUCTION }] },
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
    merchant?: unknown;
    amount?: unknown;
    suggestedCategory?: unknown;
    confidence?: unknown;
    items?: unknown;
  }>(response);

  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError('Gemini could not read a total off that image');
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
