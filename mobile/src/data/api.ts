import type { WrappedStats } from '../domain/wrapped';
import type {
  Category,
  ChallengeDraft,
  ChatMessage,
  EnvelopeId,
  FundDraft,
  JobDraft,
  ParsedReceipt,
  SemesterSnapshot,
  SetupInput,
} from '../domain/types';

/**
 * The one boundary between the app and its data.
 *
 * Every screen goes through this interface; nothing imports a concrete
 * implementation except `client.ts`. Today it resolves to an in-memory mock.
 * Pointing `EXPO_PUBLIC_API_URL` at a server swaps in `httpApi` with no change
 * above this line.
 *
 * Mutations return the whole `SemesterSnapshot` rather than a patch. The
 * snapshot is small, and every mutation in this product ripples — logging a
 * $8.65 boba moves today's remainder, the run-out date, the category bars and
 * possibly a streak — so returning the new truth is both simpler and less
 * likely to drift than reconciling deltas client-side.
 */
export interface RunwayApi {
  /** The user's current semester. */
  getSnapshot(): Promise<SemesterSnapshot>;

  /** Finish onboarding: the lump, the known bills, the fund pledge. */
  completeSetup(input: SetupInput): Promise<SemesterSnapshot>;

  /** Re-run setup from the You tab. */
  resetSemester(): Promise<SemesterSnapshot>;

  /** Add a job after setup — a second campus gig mid-term. */
  addJob(draft: JobDraft): Promise<SemesterSnapshot>;

  /** Start saving for something new. */
  addFund(draft: FundDraft): Promise<SemesterSnapshot>;

  /** Start cutting something out. No money attached — the payoff is the streak. */
  addChallenge(draft: ChallengeDraft): Promise<SemesterSnapshot>;

  /** Add someone you know, so they can be invited to things. */
  addPerson(name: string): Promise<SemesterSnapshot>;

  /** Ask people to join a fund. They show as invited until they accept. */
  inviteToFund(fundId: string, personIds: string[]): Promise<SemesterSnapshot>;

  /** Ask people to join a challenge. */
  inviteToChallenge(challengeId: string, personIds: string[]): Promise<SemesterSnapshot>;

  /** Drag a job's hours. Persisted, because a schedule change is a real change. */
  setJobHours(jobId: string, hoursPerWeek: number): Promise<SemesterSnapshot>;

  /** Log a receipt against an envelope. Breaks a challenge if it matches one. */
  logExpense(input: {
    merchant: string;
    amount: number;
    category: Category;
    envelope: EnvelopeId;
  }): Promise<SemesterSnapshot>;

  /**
   * Read a receipt.
   *
   * `imageUri` is a local file from the camera, for the implementations that
   * upload bytes; `base64` is the same capture inline, for the ones that post
   * the image in a JSON body (Gemini). Callers pass whatever the camera gave
   * them and let the implementation choose. With neither, an implementation may
   * return a demo result — which is what keeps the scanner usable in a
   * simulator, and what a slow network looks like anyway.
   */
  scanReceipt(input: { imageUri?: string; base64?: string }): Promise<ParsedReceipt>;

  /** Ask the coach a what-if. Appends both turns to the thread. */
  askCoach(text: string): Promise<{ snapshot: SemesterSnapshot; reply: ChatMessage }>;

  /** Move real money into a fund, out of your spending money. */
  contributeToFund(fundId: string, amount: number): Promise<SemesterSnapshot>;

  /** End-of-semester recap. */
  getWrapped(): Promise<WrappedStats>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
