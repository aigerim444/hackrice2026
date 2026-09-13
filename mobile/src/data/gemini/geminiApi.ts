import type {
  ChallengeDraft,
  Category,
  ChatMessage,
  EnvelopeId,
  FundDraft,
  JobDraft,
  ParsedReceipt,
  SemesterSnapshot,
  SetupInput,
} from '../../domain/types';
import type { WrappedStats } from '../../domain/wrapped';
import { ApiError, type RunwayApi } from '../api';
import { groundedCoachReply } from './coach';
import { devWarn, hasGemini } from './geminiClient';
import { parseReceiptWithGemini } from './receipts';

/**
 * Swap the coach's turn in the thread for the grounded one.
 *
 * The inner API has already appended its own reply; this replaces that entry in
 * place rather than appending a second, so the transcript reads as one answer.
 */
function replaceLastCoachTurn(snapshot: SemesterSnapshot, reply: ChatMessage): SemesterSnapshot {
  const index = snapshot.chat.map((m) => m.role).lastIndexOf('coach');
  if (index === -1) return { ...snapshot, chat: [...snapshot.chat, reply] };
  const chat = [...snapshot.chat];
  chat[index] = reply;
  return { ...snapshot, chat };
}

/**
 * The AI layer, as a decorator over whichever `RunwayApi` holds the state.
 *
 * Only the methods that are genuinely intelligence — reading a receipt, and
 * answering a what-if — are overridden; everything else is delegated
 * untouched. That keeps one rule intact: **Gemini never owns state and never
 * owns arithmetic.** It reads images and writes sentences. The snapshot stays
 * with the inner API and every number stays with the projection engine.
 *
 * Every override falls back to the inner implementation if the model errors,
 * times out or isn't configured. That isn't just politeness — a hackathon demo
 * runs on venue wifi, and an app that answers slightly worse offline beats one
 * that shows a spinner in front of a judge.
 */
export class GeminiAugmentedApi implements RunwayApi {
  constructor(private readonly inner: RunwayApi) {}

  /** Whether the AI path is actually live, for the UI to badge honestly. */
  static get enabled() {
    return hasGemini();
  }

  async scanReceipt(input: { imageUri?: string; base64?: string }): Promise<ParsedReceipt> {
    // No key configured, or nothing was captured (no working camera): there's
    // no scan attempt to fail, so the demo parse is the right answer, same as
    // it always was.
    if (!hasGemini() || !input.base64) return this.inner.scanReceipt(input);
    try {
      return await parseReceiptWithGemini(input.base64);
    } catch (error) {
      // A configured key that still can't read the photo is a real failure to
      // show — not a reason to quietly hand back a fake demo receipt. Every
      // case this can throw (offline, timed out, not a receipt, illegible,
      // future-dated) already carries its own message; see receipts.ts.
      devWarn('[gemini] receipt scan failed:', error);
      throw error instanceof ApiError ? error : new ApiError('Couldn’t read that receipt.');
    }
  }

  // ——— everything below is state, and belongs to the inner API ———

  getSnapshot(): Promise<SemesterSnapshot> {
    return this.inner.getSnapshot();
  }
  completeSetup(input: SetupInput): Promise<SemesterSnapshot> {
    return this.inner.completeSetup(input);
  }
  resetSemester(): Promise<SemesterSnapshot> {
    return this.inner.resetSemester();
  }
  addJob(draft: JobDraft): Promise<SemesterSnapshot> {
    return this.inner.addJob(draft);
  }
  addFund(draft: FundDraft): Promise<SemesterSnapshot> {
    return this.inner.addFund(draft);
  }
  addChallenge(draft: ChallengeDraft): Promise<SemesterSnapshot> {
    return this.inner.addChallenge(draft);
  }
  addPerson(name: string): Promise<SemesterSnapshot> {
    return this.inner.addPerson(name);
  }
  inviteToFund(fundId: string, personIds: string[]): Promise<SemesterSnapshot> {
    return this.inner.inviteToFund(fundId, personIds);
  }
  inviteToChallenge(challengeId: string, personIds: string[]): Promise<SemesterSnapshot> {
    return this.inner.inviteToChallenge(challengeId, personIds);
  }
  setJobHours(jobId: string, hoursPerWeek: number): Promise<SemesterSnapshot> {
    return this.inner.setJobHours(jobId, hoursPerWeek);
  }
  logExpense(input: {
    merchant: string;
    amount: number;
    category: Category;
    envelope: EnvelopeId;
  }): Promise<SemesterSnapshot> {
    return this.inner.logExpense(input);
  }
  /**
   * The only other method Gemini owns.
   *
   * The inner API still records both turns, so the thread and its history stay
   * where all the other state lives; Gemini only supplies better words for the
   * coach's turn, swapped into the transcript in place. The reply keeps the id
   * the inner API minted, so nothing downstream sees two different messages.
   */
  async askCoach(text: string) {
    const asked = await this.inner.askCoach(text);
    if (!hasGemini()) return asked;
    try {
      const grounded = await groundedCoachReply(asked.snapshot, text);
      const reply = { ...grounded, id: asked.reply.id };
      return { snapshot: replaceLastCoachTurn(asked.snapshot, reply), reply };
    } catch (error) {
      devWarn('[gemini] coach fell back to the offline heuristic:', error);
      return asked;
    }
  }
  contributeToFund(fundId: string, amount: number): Promise<SemesterSnapshot> {
    return this.inner.contributeToFund(fundId, amount);
  }
  getWrapped(): Promise<WrappedStats> {
    return this.inner.getWrapped();
  }
}
