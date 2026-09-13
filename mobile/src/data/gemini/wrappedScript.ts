import { shortDate } from '../../domain/dates';
import { money } from '../../domain/format';
import type { WrappedStats } from '../../domain/wrapped';
import { generate, GEMINI_MODEL, hasGemini, jsonOf, type GeminiSchema } from './geminiClient';

/**
 * The words for Semester Wrapped, written by Gemini and spoken by ElevenLabs.
 *
 * Same discipline as the coach: **the ledger owns the numbers, the model owns
 * the sentence.** Each card's figures are formatted here and handed over as
 * strings the model is told to quote verbatim. It decides how to say "you were
 * forecast to run out on November 14th and made it to December 12th"; it does
 * not decide what those dates are.
 *
 * Kept short on purpose. The free ElevenLabs tier is ~10,000 characters a month
 * and this script is the whole budget — seven punchy lines is both better
 * narration and roughly a tenth of the allowance.
 */

/** A hard ceiling, enforced after generation. Roughly 12 seconds of speech. */
const MAX_LINE = 180;

const SCRIPT_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    lines: {
      type: 'array',
      description: 'Exactly seven narration lines, one per card, in order.',
      items: { type: 'string' },
    },
  },
  required: ['lines'],
};

const INSTRUCTION = `You narrate "Semester Wrapped" — an end-of-term recap in a student
budgeting app, in the spirit of Spotify Wrapped.

Write exactly seven lines, one per card, spoken aloud over the card as it appears.

Rules:
- One or two short sentences per line. Under 25 words. This is speech, not prose.
- Every number, date and name must be copied EXACTLY from the facts given for that
  card. Never invent, round or recalculate one. If a fact isn't given, don't mention it.
- Warm and a little proud of them, never smug and never a lecture. This is a student
  who made their money last, or nearly did.
- Say dates the way a person says them: "November 14th", not "Nov 14".
- No markdown, no emoji, no stage directions, no "card one". Just what's spoken.
- Vary the openings. Seven lines that all start "You" is a robot reading a spreadsheet.`;

/** Everything the model is allowed to know, already formatted. */
function facts(stats: WrappedStats): string[] {
  const topStreak = stats.streaks.find((streak) => streak.record) ?? stats.streaks[0];
  const secondCategory = stats.categoryRanking[1];

  return [
    `CARD 1 — the lump that had to last.
Total that landed: ${money(stats.lump)}. Aid refund ${money(stats.aidAmount)}, summer money ${money(stats.summerAmount)}, campus earnings ${money(stats.campusEarnings)}.
It had to cover ${stats.totalDays} days.`,

    `CARD 2 — the forecast that moved.
Back on ${shortDate(stats.forecastMadeOn)} the app forecast the money running out on ${shortDate(stats.forecastRunOut)}.
It actually lasted to ${shortDate(stats.actualRunOut)}. The date moved ${stats.timesMoved} times, ${stats.movesFromShifts} of those from picking up shifts.`,

    `CARD 3 — envelopes emptied.
Left over in the free-to-spend envelope at the end: ${money(stats.freeLeftOver)}.
Every bill was covered.`,

    `CARD 4 — where it went.
Biggest category: ${stats.topCategory}, ${money(stats.topCategoryAmount)} across ${stats.topCategoryReceipts} receipts, averaging ${money(stats.topCategoryAverage)}.
Runner-up: ${secondCategory?.name ?? 'nothing close'}${secondCategory ? ` at ${money(secondCategory.amount)}` : ''}.
Most visited place: ${stats.mostVisited}`,

    `CARD 5 — the rhythm of the term.
Priciest day of the week: ${stats.expensiveDay}, averaging ${money(stats.expensiveDayAverage)} — against ${stats.comparisonDay} as the quiet one.
Latest receipt of the whole term: ${stats.latestReceiptTime}, ${stats.latestReceiptNote}.
Cheapest week: ${money(stats.cheapestWeekAmount)}, ${stats.cheapestWeekNote}.`,

    `CARD 6 — the people in it.
${stats.fundLabel}: ${money(stats.fundTarget)} target, fully funded on ${shortDate(stats.fundedOn)}, ${stats.fundedEarlyBy} days early.
${stats.fundNote}
Longest streak: ${topStreak ? `${topStreak.label}, ${topStreak.days} days (${topStreak.sublabel})` : 'none this term'}.`,

    `CARD 7 — the sign-off.
Their name: ${stats.posterName}. Semester: ${stats.semesterLabel}.
The next lump lands ${shortDate(stats.nextLumpDate)}.
Send them off well. One warm sentence.`,
  ];
}

/**
 * Ask Gemini for the seven lines.
 *
 * Throws rather than returning a partial script — the caller has a written
 * fallback, and half a narration is worse than none.
 */
export async function wrappedScript(stats: WrappedStats): Promise<string[]> {
  if (!hasGemini()) throw new Error('No Gemini key: cannot write the narration');

  const response = await generate(GEMINI_MODEL, {
    systemInstruction: { parts: [{ text: INSTRUCTION }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Write the seven lines. The facts for each card:\n\n${facts(stats).join('\n\n')}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.8,
      responseMimeType: 'application/json',
      responseSchema: SCRIPT_SCHEMA,
      maxOutputTokens: 900,
    },
  });

  const { lines } = jsonOf<{ lines?: unknown }>(response) as { lines?: unknown };
  if (!Array.isArray(lines) || lines.length !== 7) {
    throw new Error(`Gemini returned ${Array.isArray(lines) ? lines.length : 0} lines, wanted 7`);
  }

  return lines.map((line, index) => {
    const text = String(line ?? '').trim();
    if (!text) throw new Error(`Gemini left card ${index + 1} empty`);
    // A runaway line would be expensive to speak and boring to hear.
    return text.length > MAX_LINE ? `${text.slice(0, MAX_LINE).trimEnd()}…` : text;
  });
}

/**
 * The script when there's no model — plain, correct, and free.
 *
 * Written from the same figures, so an unnarrated Wrapped and a narrated one
 * never disagree. This is also what gets spoken by the device voice when
 * ElevenLabs is unavailable but the cards still deserve a soundtrack.
 */
export function fallbackScript(stats: WrappedStats): string[] {
  const topStreak = stats.streaks.find((streak) => streak.record) ?? stats.streaks[0];
  return [
    `${money(stats.lump)} landed in August, and it had to last ${stats.totalDays} days.`,
    `You were forecast to run out on ${shortDate(stats.forecastRunOut)}. You made it to ${shortDate(stats.actualRunOut)}.`,
    `Every bill got covered, and ${money(stats.freeLeftOver)} was still sitting in free-to-spend at the end.`,
    `${stats.topCategory} took the most: ${money(stats.topCategoryAmount)} over ${stats.topCategoryReceipts} receipts.`,
    `${stats.expensiveDay} was your priciest day, averaging ${money(stats.expensiveDayAverage)}.`,
    topStreak
      ? `${stats.fundLabel} got funded ${stats.fundedEarlyBy} days early, and your longest streak ran ${topStreak.days} days.`
      : `${stats.fundLabel} got funded ${stats.fundedEarlyBy} days early.`,
    `That's ${stats.semesterLabel}, ${stats.posterName}. The next lump lands ${shortDate(stats.nextLumpDate)}.`,
  ];
}
