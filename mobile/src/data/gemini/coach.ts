import { coachReply } from '../../domain/coach';
import { COACH_TOOLS, runCoachTool, type ToolOutcome } from '../../domain/tools';
import type { ChatMessage, SemesterSnapshot } from '../../domain/types';
import { ApiError } from '../api';
import {
  generate,
  GEMINI_MODEL,
  devWarn,
  partsOf,
  textOf,
  type GeminiContent,
  type GeminiFunctionDeclaration,
} from './geminiClient';

/**
 * The coach, grounded on the projection engine.
 *
 * Gemini is given the what-ifs in `domain/tools.ts` as callable functions and a
 * standing order: **you may not do arithmetic.** Every dollar figure and date
 * in its answer has to be a string a tool handed back. The model's job is to
 * work out *which* question the student is really asking, run it, and say the
 * answer like a person — the engine's job is to be right.
 *
 * That division is the whole design. It means the coach can be wrong about tone
 * or emphasis, but it cannot quote a number the home screen disagrees with,
 * because it never had the ability to produce one.
 */

const INSTRUCTION = `You are the money coach inside Semester Runway, a budgeting app for
university students whose aid refund and summer earnings arrive as ONE lump in August
and have to last the whole term.

## The one hard rule

You cannot do arithmetic. You have no calculator and you must not act as one.

Every dollar amount, date, and day count in your reply MUST be copied verbatim from a
tool result in this conversation. Do not add, subtract, round, convert, average or
estimate. Do not reformat: if a tool says "$36", write $36, not $36.00 or "about $35".

If you need a figure you do not have, call a tool. If a tool cannot give it to you, say
you don't know that one. Never fill a gap with a plausible number — a wrong number here
costs a real student real money.

## How to answer

Call the tools you need first, then answer in 1–3 short sentences. Lead with the answer,
not with the reasoning.

Talk like a level-headed friend who is good with money: plain, specific, never preachy.
Never moralise about a purchase and never call spending irresponsible. A student asking
"can I afford this" has already thought about it — they want the number and the
consequence, not a lecture.

Frame cost in days of runway, because that is what the app is for. "That's 5 days" lands;
"that's 7.4% of your discretionary budget" does not.

Do not use markdown, bullet points or headings. Plain sentences only.

## Suggesting alternatives

If something costs real runway, you may offer up to three concrete cheaper routes —
waiting for a payday, a used one, picking up a shift. Only attach a number to a route if
a tool gave you that number; otherwise describe the route without one.`;

const DECLARATIONS: GeminiFunctionDeclaration[] = COACH_TOOLS.map((tool) => ({
  name: tool.name,
  description: tool.description,
  parameters: tool.parameters as GeminiFunctionDeclaration['parameters'],
}));

/** Enough for a chained what-if ("buy this AND pick up hours") without looping forever. */
const MAX_TURNS = 5;

export interface GroundedReply {
  text: string;
  /** Which what-ifs actually ran, in order. Rendered under the reply. */
  trace: string[];
}

/**
 * Run the tool loop and return the model's answer plus what it ran to get there.
 *
 * The transcript is passed in so follow-ups work ("what about 15 hours instead?"),
 * but tool *results* are re-derived from the live snapshot every turn — the model
 * never gets to carry a stale number forward from earlier in the conversation.
 */
export async function askCoachWithGemini(
  snapshot: SemesterSnapshot,
  question: string,
  history: ChatMessage[] = [],
): Promise<GroundedReply> {
  const contents: GeminiContent[] = [
    // A short window: enough for a follow-up to make sense, not so much that
    // old figures crowd out fresh tool results.
    ...history.slice(-6).map((message) => ({
      role: (message.role === 'user' ? 'user' : 'model') as 'user' | 'model',
      parts: [{ text: message.text }],
    })),
    { role: 'user', parts: [{ text: question }] },
  ];

  const trace: string[] = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await generate(GEMINI_MODEL, {
      systemInstruction: { parts: [{ text: INSTRUCTION }] },
      contents,
      tools: [{ functionDeclarations: DECLARATIONS }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
    });

    const parts = partsOf(response);
    const calls = parts.flatMap((part) => (part.functionCall ? [part.functionCall] : []));

    if (!calls.length) {
      const text = textOf(response);
      if (!text) throw new ApiError('Gemini returned neither an answer nor a tool call');
      return { text, trace };
    }

    // Gemini can ask for several at once; run them all and answer in one turn.
    const outcomes: ToolOutcome[] = calls.map((call) =>
      runCoachTool(snapshot, call.name, call.args ?? {}),
    );
    outcomes.forEach((outcome) => trace.push(outcome.trace));

    contents.push({ role: 'model', parts: calls.map((call) => ({ functionCall: call })) });
    contents.push({
      role: 'user',
      parts: outcomes.map((outcome) => ({
        functionResponse: { name: outcome.name, response: outcome.values },
      })),
    });
  }

  throw new ApiError(`Gemini kept calling tools after ${MAX_TURNS} turns`);
}

/**
 * The coach as the app uses it: Gemini when it can, the built-in heuristic when
 * it can't.
 *
 * `domain/coach.ts` stays as the fallback rather than being replaced, and it is
 * genuinely good — it runs the same projections and produces the same structured
 * routes. The model buys better language and the ability to work out what you
 * meant; it doesn't buy correctness, because correctness was never its job.
 */
export async function groundedCoachReply(
  snapshot: SemesterSnapshot,
  question: string,
): Promise<ChatMessage> {
  const offline = coachReply(snapshot, question);
  try {
    const { text, trace } = await askCoachWithGemini(snapshot, question, snapshot.chat);
    return { ...offline, text, trace: trace.length ? trace : undefined };
  } catch (error) {
    devWarn('[gemini] coach fell back to the offline heuristic:', error);
    return offline;
  }
}
