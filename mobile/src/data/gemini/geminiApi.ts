import type {
  ChallengeDraft,
  Category,
  EnvelopeId,
  FundDraft,
  JobDraft,
  ParsedReceipt,
  SemesterSnapshot,
  SetupInput,
} from '../../domain/types';
import type { WrappedStats } from '../../domain/wrapped';
import type { RunwayApi } from '../api';
import { hasGemini } from './geminiClient';
import { parseReceiptWithGemini } from './receipts';

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
    return hasGemini;
  }

  async scanReceipt(input: { imageUri?: string; base64?: string }): Promise<ParsedReceipt> {
    if (!hasGemini || !input.base64) return this.inner.scanReceipt(input);
    try {
      return await parseReceiptWithGemini(input.base64);
    } catch (error) {
      // Log loudly in dev, degrade quietly in front of a judge.
      if (__DEV__) console.warn('[gemini] receipt scan fell back to the demo parse:', error);
      return this.inner.scanReceipt(input);
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
  askCoach(text: string) {
    return this.inner.askCoach(text);
  }
  contributeToFund(fundId: string, amount: number): Promise<SemesterSnapshot> {
    return this.inner.contributeToFund(fundId, amount);
  }
  getWrapped(): Promise<WrappedStats> {
    return this.inner.getWrapped();
  }
}
