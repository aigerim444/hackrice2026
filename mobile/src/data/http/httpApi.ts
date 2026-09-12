import type {
  ChallengeDraft,
  FundDraft,
  JobDraft,
  ParsedReceipt,
  SemesterSnapshot,
  SetupInput,
} from '../../domain/types';
import type { WrappedStats } from '../../domain/wrapped';
import { ApiError, type RunwayApi } from '../api';

/**
 * The real-backend implementation.
 *
 * Nothing is wired to a server yet — there isn't one — but this is a working
 * client, not a placeholder: it defines the wire contract the backend has to
 * meet, and switching to it is a matter of setting `EXPO_PUBLIC_API_URL`. Each
 * method maps to one endpoint, and every mutation responds with the updated
 * snapshot, exactly as `RunwayApi` promises.
 *
 *   GET  /semesters/current                 → SemesterSnapshot
 *   POST /semesters/current/setup           → SemesterSnapshot
 *   POST /semesters/current/reset           → SemesterSnapshot
 *   PATCH /jobs/:id                         → SemesterSnapshot
 *   POST /expenses                          → SemesterSnapshot
 *   POST /receipts:scan  (multipart)        → ParsedReceipt
 *   POST /coach/messages                    → { snapshot, reply }
 *   POST /funds/:id/contributions           → SemesterSnapshot
 *   GET  /semesters/current/wrapped         → WrappedStats
 *
 * Auth is a bearer token on every request; there is no session state.
 */
export class HttpRunwayApi implements RunwayApi {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => string | null = () => null,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body instanceof FormData ? null : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : null),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw new ApiError(
        `${init?.method ?? 'GET'} ${path} failed: ${response.status}`,
        response.status,
      );
    }
    return (await response.json()) as T;
  }

  private post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  }

  getSnapshot(): Promise<SemesterSnapshot> {
    return this.request('/semesters/current');
  }

  completeSetup(input: SetupInput): Promise<SemesterSnapshot> {
    return this.post('/semesters/current/setup', input);
  }

  resetSemester(): Promise<SemesterSnapshot> {
    return this.post('/semesters/current/reset', {});
  }

  addJob(draft: JobDraft): Promise<SemesterSnapshot> {
    return this.post('/jobs', draft);
  }

  addFund(draft: FundDraft): Promise<SemesterSnapshot> {
    return this.post('/funds', draft);
  }

  addChallenge(draft: ChallengeDraft): Promise<SemesterSnapshot> {
    return this.post('/challenges', draft);
  }

  inviteToFund(fundId: string, personIds: string[]): Promise<SemesterSnapshot> {
    return this.post(`/funds/${encodeURIComponent(fundId)}/invites`, { personIds });
  }

  inviteToChallenge(challengeId: string, personIds: string[]): Promise<SemesterSnapshot> {
    return this.post(`/challenges/${encodeURIComponent(challengeId)}/invites`, { personIds });
  }

  setJobHours(jobId: string, hoursPerWeek: number): Promise<SemesterSnapshot> {
    return this.request(`/jobs/${encodeURIComponent(jobId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ hoursPerWeek }),
    });
  }

  logExpense(input: Parameters<RunwayApi['logExpense']>[0]): Promise<SemesterSnapshot> {
    return this.post('/expenses', input);
  }

  /** The photo is uploaded; OCR, price and category all happen server-side. */
  async scanReceipt({ imageUri }: { imageUri?: string }): Promise<ParsedReceipt> {
    if (!imageUri) throw new ApiError('scanReceipt needs a captured image');

    const form = new FormData();
    form.append('receipt', {
      uri: imageUri,
      name: 'receipt.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);

    return this.request('/receipts:scan', { method: 'POST', body: form });
  }

  askCoach(text: string) {
    return this.post<Awaited<ReturnType<RunwayApi['askCoach']>>>('/coach/messages', { text });
  }

  contributeToFund(fundId: string, amount: number): Promise<SemesterSnapshot> {
    return this.post(`/funds/${encodeURIComponent(fundId)}/contributions`, { amount });
  }

  getWrapped(): Promise<WrappedStats> {
    return this.request('/semesters/current/wrapped');
  }
}
