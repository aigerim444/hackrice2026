import type { SupabaseClient } from '@supabase/supabase-js';

import { coachReply, userMessage } from '../../domain/coach';
import { shortDate } from '../../domain/dates';
import { completeJob, draftId } from '../../domain/payroll';
import {
  CATEGORIES,
  type Category,
  type Challenge,
  type ChallengeDraft,
  type Expense,
  type Fund,
  type FundDraft,
  type FundMember,
  type ParsedReceipt,
  type Person,
  type SemesterSnapshot,
  type SetupInput,
} from '../../domain/types';
import type { WrappedStats } from '../../domain/wrapped';
import { ApiError, type RunwayApi } from '../api';
import { SEED_WRAPPED } from '../mock/seed';

/**
 * The real-backend implementation, against Supabase.
 *
 * Satisfies the wire contract in `httpApi.ts`'s header comment exactly — same
 * 15 operations, same "every mutation returns the whole snapshot" contract —
 * just talking to Postgres through supabase-js instead of over HTTP. A drop-in
 * alongside `mockApi` and `httpApi`; `RunwayApi` itself is untouched.
 *
 * Auth is whatever session is active on the injected `SupabaseClient` — RLS
 * (see `supabase/migrations/0001_init.sql`) does the actual scoping, this
 * class just never reads or writes another user's rows.
 *
 * `getWrapped()` is the one exception to "derive everything live": per
 * CLAUDE.md, Wrapped stays on the seeded recap until its own session, so it
 * returns the same constant `mockApi` does rather than a table.
 */
export class SupabaseRunwayApi implements RunwayApi {
  constructor(private readonly client: SupabaseClient) {}

  private async userId(): Promise<string> {
    const {
      data: { user },
      error,
    } = await this.client.auth.getUser();
    if (error) throw new ApiError(error.message);
    if (!user) throw new ApiError('not authenticated');
    return user.id;
  }

  private displayName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
    const metaName = user.user_metadata?.name;
    if (typeof metaName === 'string' && metaName.trim()) return metaName.trim();
    return user.email?.split('@')[0] ?? 'You';
  }

  /** The current semester row, provisioning a fresh one on a user's first read. */
  private async ensureSemester(userId: string): Promise<SemesterRow> {
    const { data: existing, error: readError } = await this.client
      .from('semesters')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (readError) throw new ApiError(readError.message);
    if (existing) return existing as SemesterRow;

    const {
      data: { user },
      error: userError,
    } = await this.client.auth.getUser();
    if (userError) throw new ApiError(userError.message);
    const name = this.displayName(user ?? {});

    const { data: created, error: insertError } = await this.client
      .from('semesters')
      .insert({
        user_id: userId,
        label: 'Fall 2026',
        start_date: '2026-08-24',
        end_date: '2026-12-12',
        today: '2026-09-11',
        last_paid_week: '2026-11-13',
        user_name: name,
        user_initial: name.slice(0, 1).toUpperCase(),
        observed_daily_pace: 0,
        setup_complete: false,
      })
      .select('*')
      .single();
    if (insertError) throw new ApiError(insertError.message);
    const semester = created as SemesterRow;

    // The lump: aid + summer, seeded at the same starting figures seed.sql
    // uses, so a user who reaches the app before seed.sql runs against their
    // account sees the same onboarding pre-fill either way.
    const { error: incomeError } = await this.client.from('income_sources').insert([
      {
        user_id: userId,
        semester_id: semester.id,
        kind: 'aid',
        label: 'Aid refund',
        sublabel: 'grants after tuition',
        amount: 3800,
        received_on: semester.start_date,
      },
      {
        user_id: userId,
        semester_id: semester.id,
        kind: 'summer',
        label: 'Summer money',
        sublabel: "what's left of it",
        amount: 2440,
        received_on: semester.start_date,
      },
    ]);
    if (incomeError) throw new ApiError(incomeError.message);

    // The four standing bills — facts about the term, per STATE.md §3.
    const { error: billsError } = await this.client.from('bills').insert([
      {
        id: draftId('bill'),
        user_id: userId,
        semester_id: semester.id,
        label: 'Rent',
        envelope: 'rent',
        amount: 520,
        cadence: 'monthly',
        due_day: 1,
        due_date: null,
        prepaid: false,
      },
      {
        id: draftId('bill'),
        user_id: userId,
        semester_id: semester.id,
        label: 'Phone',
        envelope: 'fees',
        amount: 45,
        cadence: 'monthly',
        due_day: 15,
        due_date: null,
        prepaid: false,
      },
      {
        id: draftId('bill'),
        user_id: userId,
        semester_id: semester.id,
        label: 'Campus fees',
        envelope: 'fees',
        amount: 195,
        cadence: 'once',
        due_day: null,
        due_date: '2026-10-05',
        prepaid: false,
      },
      {
        id: draftId('bill'),
        user_id: userId,
        semester_id: semester.id,
        label: 'Meal plan',
        envelope: 'fees',
        amount: 0,
        cadence: 'once',
        due_day: null,
        due_date: null,
        prepaid: true,
      },
    ]);
    if (billsError) throw new ApiError(billsError.message);

    return semester;
  }

  private async personLookup(userId: string, ids: string[]): Promise<Map<string, Person>> {
    if (ids.length === 0) return new Map();
    const { data, error } = await this.client
      .from('people')
      .select('id, name, initial')
      .eq('user_id', userId)
      .in('id', ids);
    if (error) throw new ApiError(error.message);
    return new Map((data ?? []).map((p) => [p.id, { id: p.id, name: p.name, initial: p.initial }]));
  }

  /**
   * A goal starts with you in it, plus anyone invited — as `invited`, since
   * they haven't agreed to a weekly pledge yet. Mirrors `mockApi`'s
   * `hydrateFund` exactly.
   */
  private async hydrateFund(
    userId: string,
    draft: FundDraft,
  ): Promise<{ fund: Omit<Fund, 'members'>; members: FundMember[] }> {
    const { members: _ignored, inviteIds, ...rest } = draft;
    if (draft.members?.length) {
      return { fund: rest, members: draft.members };
    }
    const people = await this.personLookup(userId, inviteIds ?? []);
    const members: FundMember[] = [
      {
        id: userId,
        name: 'You',
        isYou: true,
        contributed: 0,
        weeklyPledge: draft.weeklyPledge,
        status: 'on track',
      },
      ...(inviteIds ?? []).flatMap((id) => {
        const person = people.get(id);
        return person
          ? [{ id: person.id, name: person.name, contributed: 0, weeklyPledge: 0, status: 'invited' as const }]
          : [];
      }),
    ];
    return { fund: { ...rest, shared: Boolean(inviteIds?.length) }, members };
  }

  private async loadSnapshot(userId: string): Promise<SemesterSnapshot> {
    const semester = await this.ensureSemester(userId);

    const [
      income, jobs, bills, people, funds, fundMembers, challenges, participants, todayExpenses, priorExpenses, moves, chat,
      invitedFundRows, invitedChallengeRows,
    ] = await Promise.all([
        this.client.from('income_sources').select('*').eq('semester_id', semester.id),
        this.client.from('jobs').select('*').eq('semester_id', semester.id),
        this.client.from('bills').select('*').eq('semester_id', semester.id),
        this.client.from('people').select('*').eq('user_id', userId),
        this.client.from('funds').select('*').eq('semester_id', semester.id),
        this.client.from('fund_members').select('*').eq('user_id', userId),
        this.client.from('challenges').select('*').eq('semester_id', semester.id),
        this.client.from('challenge_participants').select('*').eq('user_id', userId),
        this.client.from('expenses').select('*').eq('semester_id', semester.id).eq('occurred_on', semester.today),
        this.client
          .from('expenses')
          .select('category, amount, envelope')
          .eq('semester_id', semester.id)
          .lt('occurred_on', semester.today),
        this.client.from('moves').select('*').eq('semester_id', semester.id),
        this.client.from('chat_messages').select('*').eq('semester_id', semester.id).order('created_at'),
        // Funds/challenges I don't own but was invited to — these live under
        // someone else's semester_id, so the queries above never see them.
        // RLS only lets this come back with my own membership row embedded
        // with its parent (see 0002_invites.sql), never anyone else's.
        this.client.from('fund_members').select('*, funds(*)').eq('invited_user_id', userId),
        this.client.from('challenge_participants').select('*, challenges(*)').eq('invited_user_id', userId),
      ]);

    for (const result of [
      income, jobs, bills, people, funds, fundMembers, challenges, participants, todayExpenses, priorExpenses, moves, chat,
      invitedFundRows, invitedChallengeRows,
    ]) {
      if (result.error) throw new ApiError(result.error.message);
    }

    // The invited rows only carry an id for whoever started the fund/
    // challenge — profiles is the name-only lookup for that (0002_invites.sql),
    // never a query against auth.users directly.
    const ownerIds = new Set<string>();
    for (const row of invitedFundRows.data ?? []) if (row.funds) ownerIds.add(row.funds.user_id);
    for (const row of invitedChallengeRows.data ?? []) if (row.challenges) ownerIds.add(row.challenges.user_id);
    let ownerNames = new Map<string, string>();
    if (ownerIds.size > 0) {
      const { data: profileRows, error: profileError } = await this.client
        .from('profiles')
        .select('id, name')
        .in('id', [...ownerIds]);
      if (profileError) throw new ApiError(profileError.message);
      ownerNames = new Map((profileRows ?? []).map((p) => [p.id, p.name as string]));
    }

    // Only my own membership row is visible for a fund/challenge I don't
    // own (RLS), so isYou is unconditionally true here — unlike the owned
    // funds below, where the stored is_you column already reflects the
    // owner's own perspective correctly and multiple members are visible.
    const invitedFunds: SemesterSnapshot['funds'] = (invitedFundRows.data ?? []).flatMap((row) => {
      const f = row.funds;
      if (!f) return [];
      return [
        {
          id: f.id,
          label: f.label,
          shared: f.shared,
          occasion: f.occasion,
          targetAmount: Number(f.target_amount),
          members: [
            {
              id: row.member_id,
              name: row.name,
              isYou: true,
              contributed: Number(row.contributed),
              weeklyPledge: Number(row.weekly_pledge),
              status: row.status,
            },
          ],
          // Not this viewer's own pledge — runway.ts's fundsReserved() sums
          // fund-level weeklyPledge/extraContributed straight into *this*
          // viewer's reserved total, with no idea whose fund it actually is.
          // Zeroing them here is what keeps an invite from silently taking a
          // bite out of someone else's daily number before they've even
          // accepted it. The member row above still carries their own real
          // weeklyPledge/contributed, for once there's a UI that shows it.
          weeklyPledge: 0,
          extraContributed: 0,
          startedBy: ownerNames.get(f.user_id) ?? 'someone else',
        },
      ];
    });

    // youStreakDays/broken stay at their just-invited defaults rather than
    // the owner's — there's no per-participant "broken" tracking today (see
    // STATE.md §5.4, untouched by this change), so an invited challenge
    // simply hasn't been broken from the invitee's own side yet.
    //
    // `startedBy` isn't a field Challenge declares (unlike Fund, which has
    // exactly this for exactly this reason) — src/domain/types.ts is
    // untouchable, so it can't gain one. Attaching it here anyway, on an
    // intentionally wider local type, is how friends.tsx tells "a challenge
    // I own" from "one I've accepted an invite to" apart, since nothing in
    // the declared Challenge shape can: a challenge you created and one
    // you've joined both settle at participants.length === 1, status
    // 'joined'. It's structurally still a valid Challenge wherever the
    // stricter type is expected — this is a widening, not a workaround.
    const invitedChallenges: (Challenge & { startedBy?: string })[] = (invitedChallengeRows.data ?? []).flatMap((row) => {
      const c = row.challenges;
      if (!c) return [];
      return [
        {
          id: c.id,
          label: c.label,
          sublabel: c.sublabel ?? undefined,
          category: c.category ?? undefined,
          until: c.until_date ?? undefined,
          participants: [
            {
              id: row.participant_id,
              name: row.name,
              isYou: true,
              streakDays: row.streak_days,
              status: row.status,
            },
          ],
          youStreakDays: row.streak_days,
          startedBy: ownerNames.get(c.user_id) ?? 'someone else',
          broken: false,
        },
      ];
    });

    const membersByFund = new Map<string, FundMember[]>();
    for (const m of fundMembers.data ?? []) {
      const list = membersByFund.get(m.fund_id) ?? [];
      list.push({
        id: m.member_id,
        name: m.name,
        isYou: m.is_you || undefined,
        contributed: Number(m.contributed),
        weeklyPledge: Number(m.weekly_pledge),
        status: m.status,
      });
      membersByFund.set(m.fund_id, list);
    }

    const participantsByChallenge = new Map<string, Challenge['participants']>();
    for (const p of participants.data ?? []) {
      const list = participantsByChallenge.get(p.challenge_id) ?? [];
      list.push({
        id: p.participant_id,
        name: p.name,
        isYou: p.is_you || undefined,
        streakDays: p.streak_days,
        status: p.status,
      });
      participantsByChallenge.set(p.challenge_id, list);
    }

    // priorCategoryTotals and priorFreeSpend are the STATE.md §4 fix: both
    // derived here from the same `expenses` feed instead of stored as two
    // independent constants, so they reconcile by construction.
    const priorCategoryTotals = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
    let priorFreeSpend = 0;
    for (const e of priorExpenses.data ?? []) {
      priorCategoryTotals[e.category as Category] += Number(e.amount);
      if (e.envelope === 'free') priorFreeSpend += Number(e.amount);
    }

    return {
      semester: {
        id: semester.id,
        label: semester.label,
        startDate: semester.start_date,
        endDate: semester.end_date,
        today: semester.today,
        lastPaidWeek: semester.last_paid_week,
      },
      user: { id: userId, name: semester.user_name, initial: semester.user_initial },
      people: (people.data ?? []).map((p) => ({ id: p.id, name: p.name, initial: p.initial })),
      income: (income.data ?? []).map((i) => ({
        id: i.id,
        kind: i.kind,
        label: i.label,
        sublabel: i.sublabel,
        amount: Number(i.amount),
        receivedOn: i.received_on,
      })),
      jobs: (jobs.data ?? []).map((j) => ({
        id: j.id,
        name: j.name,
        hourlyRate: Number(j.hourly_rate),
        hoursPerWeek: Number(j.hours_per_week),
        baselineHoursPerWeek: Number(j.baseline_hours_per_week),
        payCadence: j.pay_cadence,
        nextPayDate: j.next_pay_date,
        nextPayAmount: Number(j.next_pay_amount),
      })),
      bills: (bills.data ?? []).map((b) => ({
        id: b.id,
        label: b.label,
        envelope: b.envelope,
        amount: Number(b.amount),
        cadence: b.cadence,
        dueDay: b.due_day ?? undefined,
        dueDate: b.due_date ?? undefined,
        prepaid: b.prepaid,
      })),
      funds: [
        ...(funds.data ?? []).map((f) => ({
          id: f.id,
          label: f.label,
          shared: f.shared,
          occasion: f.occasion,
          targetAmount: Number(f.target_amount),
          members: membersByFund.get(f.id) ?? [],
          weeklyPledge: Number(f.weekly_pledge),
          extraContributed: Number(f.extra_contributed),
          startedBy: f.started_by ?? undefined,
        })),
        ...invitedFunds,
      ],
      challenges: [
        ...(challenges.data ?? []).map((c) => ({
          id: c.id,
          label: c.label,
          sublabel: c.sublabel ?? undefined,
          category: c.category ?? undefined,
          until: c.until_date ?? undefined,
          participants: participantsByChallenge.get(c.id) ?? [],
          youStreakDays: c.you_streak_days,
          broken: c.broken,
        })),
        ...invitedChallenges,
      ],
      todayExpenses: (todayExpenses.data ?? []).map(rowToExpense),
      priorCategoryTotals,
      priorFreeSpend,
      observedDailyPace: Number(semester.observed_daily_pace),
      moves: (moves.data ?? []).map((m) => ({
        id: m.id,
        deltaDays: m.delta_days,
        title: m.title,
        sublabel: m.sublabel,
        positive: m.positive,
      })),
      chat: (chat.data ?? []).map((c) => ({
        id: c.id,
        role: c.role,
        text: c.text,
        routes: c.routes ?? undefined,
      })),
      setupComplete: semester.setup_complete,
    };
  }

  async getSnapshot(): Promise<SemesterSnapshot> {
    const userId = await this.userId();
    return this.loadSnapshot(userId);
  }

  async completeSetup(input: SetupInput): Promise<SemesterSnapshot> {
    const userId = await this.userId();
    const semester = await this.ensureSemester(userId);

    const { error: aidError } = await this.client
      .from('income_sources')
      .update({ amount: input.aidAmount })
      .eq('semester_id', semester.id)
      .eq('kind', 'aid');
    if (aidError) throw new ApiError(aidError.message);

    const { error: summerError } = await this.client
      .from('income_sources')
      .update({ amount: input.summerAmount })
      .eq('semester_id', semester.id)
      .eq('kind', 'summer');
    if (summerError) throw new ApiError(summerError.message);

    // Onboarding is the whole truth about jobs, bills and goals: the drafts
    // replace whatever was there, same as mockApi.completeSetup.
    await this.replaceJobs(userId, semester, input.jobs);
    await this.replaceBills(userId, semester, input.bills);
    await this.replaceFunds(userId, semester, input.funds);

    const { error: setupError } = await this.client
      .from('semesters')
      .update({ setup_complete: true })
      .eq('id', semester.id);
    if (setupError) throw new ApiError(setupError.message);

    return this.loadSnapshot(userId);
  }

  private async replaceJobs(userId: string, semester: SemesterRow, drafts: SetupInput['jobs']) {
    const { error: deleteError } = await this.client.from('jobs').delete().eq('semester_id', semester.id);
    if (deleteError) throw new ApiError(deleteError.message);
    if (drafts.length === 0) return;

    const rows = drafts.map((draft) => {
      const job = completeJob(draft, semester.today);
      return {
        id: job.id,
        user_id: userId,
        semester_id: semester.id,
        name: job.name,
        hourly_rate: job.hourlyRate,
        hours_per_week: job.hoursPerWeek,
        baseline_hours_per_week: job.baselineHoursPerWeek,
        pay_cadence: job.payCadence,
        next_pay_date: job.nextPayDate,
        next_pay_amount: job.nextPayAmount,
      };
    });
    const { error } = await this.client.from('jobs').insert(rows);
    if (error) throw new ApiError(error.message);
  }

  private async replaceBills(userId: string, semester: SemesterRow, drafts: SetupInput['bills']) {
    const { error: deleteError } = await this.client.from('bills').delete().eq('semester_id', semester.id);
    if (deleteError) throw new ApiError(deleteError.message);
    if (drafts.length === 0) return;

    const rows = drafts.map((draft) => ({
      id: draft.id,
      user_id: userId,
      semester_id: semester.id,
      label: draft.label,
      envelope: draft.envelope ?? 'fees',
      amount: draft.amount,
      cadence: draft.cadence,
      due_day: draft.dueDay ?? null,
      due_date: draft.dueDate ?? null,
      prepaid: draft.prepaid ?? false,
    }));
    const { error } = await this.client.from('bills').insert(rows);
    if (error) throw new ApiError(error.message);
  }

  private async replaceFunds(userId: string, semester: SemesterRow, drafts: SetupInput['funds']) {
    const { error: deleteError } = await this.client.from('funds').delete().eq('semester_id', semester.id);
    if (deleteError) throw new ApiError(deleteError.message);
    if (drafts.length === 0) return;

    for (const draft of drafts) {
      const { fund, members } = await this.hydrateFund(userId, draft);
      const { error: fundError } = await this.client.from('funds').insert({
        id: fund.id,
        user_id: userId,
        semester_id: semester.id,
        label: fund.label,
        shared: fund.shared ?? false,
        occasion: fund.occasion,
        target_amount: fund.targetAmount,
        weekly_pledge: fund.weeklyPledge,
        extra_contributed: fund.extraContributed,
        started_by: fund.startedBy ?? null,
      });
      if (fundError) throw new ApiError(fundError.message);

      const { error: memberError } = await this.client.from('fund_members').insert(
        members.map((m) => ({
          fund_id: fund.id,
          member_id: m.id,
          user_id: userId,
          name: m.name,
          is_you: Boolean(m.isYou),
          contributed: m.contributed,
          weekly_pledge: m.weeklyPledge,
          status: m.status,
        })),
      );
      if (memberError) throw new ApiError(memberError.message);
    }
  }

  async resetSemester(): Promise<SemesterSnapshot> {
    const userId = await this.userId();
    // Cascades everything hung off the semester — jobs, bills, funds and their
    // members, challenges and their participants, expenses, moves, chat.
    const { error } = await this.client.from('semesters').delete().eq('user_id', userId);
    if (error) throw new ApiError(error.message);
    return this.loadSnapshot(userId);
  }

  async addJob(draft: Parameters<RunwayApi['addJob']>[0]): Promise<SemesterSnapshot> {
    const userId = await this.userId();
    const semester = await this.ensureSemester(userId);
    const job = completeJob(draft, semester.today);
    const { error } = await this.client.from('jobs').insert({
      id: job.id,
      user_id: userId,
      semester_id: semester.id,
      name: job.name,
      hourly_rate: job.hourlyRate,
      hours_per_week: job.hoursPerWeek,
      baseline_hours_per_week: job.baselineHoursPerWeek,
      pay_cadence: job.payCadence,
      next_pay_date: job.nextPayDate,
      next_pay_amount: job.nextPayAmount,
    });
    if (error) throw new ApiError(error.message);
    return this.loadSnapshot(userId);
  }

  async addFund(draft: FundDraft): Promise<SemesterSnapshot> {
    const userId = await this.userId();
    const semester = await this.ensureSemester(userId);
    const { fund, members } = await this.hydrateFund(userId, draft);

    const { error: fundError } = await this.client.from('funds').insert({
      id: fund.id,
      user_id: userId,
      semester_id: semester.id,
      label: fund.label,
      shared: fund.shared ?? false,
      occasion: fund.occasion,
      target_amount: fund.targetAmount,
      weekly_pledge: fund.weeklyPledge,
      extra_contributed: fund.extraContributed,
      started_by: fund.startedBy ?? null,
    });
    if (fundError) throw new ApiError(fundError.message);

    const { error: memberError } = await this.client.from('fund_members').insert(
      members.map((m) => ({
        fund_id: fund.id,
        member_id: m.id,
        user_id: userId,
        name: m.name,
        is_you: Boolean(m.isYou),
        contributed: m.contributed,
        weekly_pledge: m.weeklyPledge,
        status: m.status,
      })),
    );
    if (memberError) throw new ApiError(memberError.message);

    return this.loadSnapshot(userId);
  }

  async addChallenge(draft: ChallengeDraft): Promise<SemesterSnapshot> {
    const userId = await this.userId();
    const semester = await this.ensureSemester(userId);
    const people = await this.personLookup(userId, draft.inviteIds ?? []);

    const { error: challengeError } = await this.client.from('challenges').insert({
      id: draft.id,
      user_id: userId,
      semester_id: semester.id,
      label: draft.label,
      category: draft.category ?? null,
      until_date: draft.until ?? null,
      sublabel: draft.until ? `until ${shortDate(draft.until)}` : null,
      you_streak_days: 0,
      broken: false,
    });
    if (challengeError) throw new ApiError(challengeError.message);

    const participantRows = [
      { challenge_id: draft.id, participant_id: userId, user_id: userId, name: 'You', is_you: true, streak_days: 0, status: 'joined' as const },
      ...(draft.inviteIds ?? []).flatMap((id) => {
        const person = people.get(id);
        return person
          ? [{ challenge_id: draft.id, participant_id: person.id, user_id: userId, name: person.name, is_you: false, streak_days: 0, status: 'invited' as const }]
          : [];
      }),
    ];
    const { error: participantError } = await this.client.from('challenge_participants').insert(participantRows);
    if (participantError) throw new ApiError(participantError.message);

    return this.loadSnapshot(userId);
  }

  async addPerson(name: string): Promise<SemesterSnapshot> {
    const userId = await this.userId();
    const trimmed = name.trim();
    const { error } = await this.client.from('people').insert({
      id: draftId('person'),
      user_id: userId,
      name: trimmed,
      initial: trimmed.slice(0, 1).toUpperCase(),
    });
    if (error) throw new ApiError(error.message);
    return this.loadSnapshot(userId);
  }

  async inviteToFund(fundId: string, personIds: string[]): Promise<SemesterSnapshot> {
    const userId = await this.userId();
    const { data: existingMembers, error: existingError } = await this.client
      .from('fund_members')
      .select('member_id')
      .eq('fund_id', fundId);
    if (existingError) throw new ApiError(existingError.message);
    const already = new Set((existingMembers ?? []).map((m) => m.member_id));

    const toInvite = personIds.filter((id) => !already.has(id));
    if (toInvite.length > 0) {
      const people = await this.personLookup(userId, toInvite);
      const rows = toInvite.flatMap((id) => {
        const person = people.get(id);
        return person
          ? [{ fund_id: fundId, member_id: person.id, user_id: userId, name: person.name, is_you: false, contributed: 0, weekly_pledge: 0, status: 'invited' as const }]
          : [];
      });
      if (rows.length > 0) {
        const { error: insertError } = await this.client.from('fund_members').insert(rows);
        if (insertError) throw new ApiError(insertError.message);
      }
      const { error: sharedError } = await this.client.from('funds').update({ shared: true }).eq('id', fundId);
      if (sharedError) throw new ApiError(sharedError.message);
    }

    return this.loadSnapshot(userId);
  }

  async inviteToChallenge(challengeId: string, personIds: string[]): Promise<SemesterSnapshot> {
    const userId = await this.userId();
    const { data: existingParticipants, error: existingError } = await this.client
      .from('challenge_participants')
      .select('participant_id')
      .eq('challenge_id', challengeId);
    if (existingError) throw new ApiError(existingError.message);
    const already = new Set((existingParticipants ?? []).map((p) => p.participant_id));

    const toInvite = personIds.filter((id) => !already.has(id));
    if (toInvite.length > 0) {
      const people = await this.personLookup(userId, toInvite);
      const rows = toInvite.flatMap((id) => {
        const person = people.get(id);
        return person
          ? [{ challenge_id: challengeId, participant_id: person.id, user_id: userId, name: person.name, is_you: false, streak_days: 0, status: 'invited' as const }]
          : [];
      });
      if (rows.length > 0) {
        const { error } = await this.client.from('challenge_participants').insert(rows);
        if (error) throw new ApiError(error.message);
      }
    }

    return this.loadSnapshot(userId);
  }

  // ——— real cross-user invites — additive, not on RunwayApi ———
  //
  // Everything above invites from the owner's own `people` table, which
  // mock/http both have their own version of. These four don't: a second
  // real Supabase account (found by id, named via `profiles`, never email)
  // is a Supabase-only concept, so they live only on this class. friends.tsx
  // reaches them via `supabaseExtras` in client.ts, guarded by `usesSupabase`.

  /** Invite a real account by user id — not a `people` row. */
  async inviteUserToFund(fundId: string, inviteeUserId: string): Promise<SemesterSnapshot> {
    const userId = await this.userId();
    const { data: profile, error: profileError } = await this.client
      .from('profiles')
      .select('name')
      .eq('id', inviteeUserId)
      .maybeSingle();
    if (profileError) throw new ApiError(profileError.message);
    if (!profile) throw new ApiError('No account with that id.');

    const { error } = await this.client.from('fund_members').insert({
      fund_id: fundId,
      member_id: inviteeUserId,
      user_id: userId,
      invited_user_id: inviteeUserId,
      name: profile.name,
      is_you: false,
      contributed: 0,
      weekly_pledge: 0,
      status: 'invited',
    });
    if (error) throw new ApiError(error.message);

    const { error: sharedError } = await this.client.from('funds').update({ shared: true }).eq('id', fundId);
    if (sharedError) throw new ApiError(sharedError.message);

    return this.loadSnapshot(userId);
  }

  /** Invite a real account by user id — not a `people` row. */
  async inviteUserToChallenge(challengeId: string, inviteeUserId: string): Promise<SemesterSnapshot> {
    const userId = await this.userId();
    const { data: profile, error: profileError } = await this.client
      .from('profiles')
      .select('name')
      .eq('id', inviteeUserId)
      .maybeSingle();
    if (profileError) throw new ApiError(profileError.message);
    if (!profile) throw new ApiError('No account with that id.');

    const { error } = await this.client.from('challenge_participants').insert({
      challenge_id: challengeId,
      participant_id: inviteeUserId,
      user_id: userId,
      invited_user_id: inviteeUserId,
      name: profile.name,
      is_you: false,
      streak_days: 0,
      status: 'invited',
    });
    if (error) throw new ApiError(error.message);

    return this.loadSnapshot(userId);
  }

  /**
   * The invited user's own accept. Only `status` moves — RLS's update policy
   * scopes this to a row where the caller is the invited user (or the
   * owner), and 0002_invites.sql's trigger rejects any other column changing
   * on a non-owner's update, so there's nothing else this method needs to
   * guard against client-side.
   */
  async acceptFundInvite(fundId: string): Promise<SemesterSnapshot> {
    const userId = await this.userId();
    const { error } = await this.client
      .from('fund_members')
      .update({ status: 'on track' })
      .eq('fund_id', fundId)
      .eq('member_id', userId);
    if (error) throw new ApiError(error.message);
    return this.loadSnapshot(userId);
  }

  async acceptChallengeInvite(challengeId: string): Promise<SemesterSnapshot> {
    const userId = await this.userId();
    const { error } = await this.client
      .from('challenge_participants')
      .update({ status: 'joined' })
      .eq('challenge_id', challengeId)
      .eq('participant_id', userId);
    if (error) throw new ApiError(error.message);
    return this.loadSnapshot(userId);
  }

  async setJobHours(jobId: string, hoursPerWeek: number): Promise<SemesterSnapshot> {
    const userId = await this.userId();
    const { error } = await this.client
      .from('jobs')
      .update({ hours_per_week: hoursPerWeek })
      .eq('id', jobId)
      .eq('user_id', userId);
    if (error) throw new ApiError(error.message);
    return this.loadSnapshot(userId);
  }

  async logExpense(input: Parameters<RunwayApi['logExpense']>[0]): Promise<SemesterSnapshot> {
    const userId = await this.userId();
    const semester = await this.ensureSemester(userId);

    const { error: expenseError } = await this.client.from('expenses').insert({
      user_id: userId,
      semester_id: semester.id,
      merchant: input.merchant,
      amount: input.amount,
      category: input.category,
      envelope: input.envelope,
      occurred_on: semester.today,
    });
    if (expenseError) throw new ApiError(expenseError.message);

    // A charge in a challenge's category breaks that challenge — the only
    // direction a streak can be broken by evidence, same as mockApi.logExpense.
    const { data: toBreak, error: findError } = await this.client
      .from('challenges')
      .select('id')
      .eq('semester_id', semester.id)
      .eq('category', input.category)
      .eq('broken', false);
    if (findError) throw new ApiError(findError.message);

    const breakIds = (toBreak ?? []).map((c) => c.id);
    if (breakIds.length > 0) {
      const { error: breakError } = await this.client
        .from('challenges')
        .update({ broken: true, you_streak_days: 0 })
        .in('id', breakIds);
      if (breakError) throw new ApiError(breakError.message);

      const { error: participantError } = await this.client
        .from('challenge_participants')
        .update({ streak_days: 0 })
        .in('challenge_id', breakIds)
        .eq('is_you', true);
      if (participantError) throw new ApiError(participantError.message);
    }

    return this.loadSnapshot(userId);
  }

  /**
   * Same canned response as mockApi — OCR is a stub regardless of which
   * backend is behind it, per STATE.md §4. A real version posts the image to
   * an OCR service and is future work, not part of this backend.
   */
  async scanReceipt(): Promise<ParsedReceipt> {
    return {
      merchant: 'Tiger Sugar · Village',
      amount: 8.65,
      suggestedCategory: 'Drinks',
      confidence: 0.94,
    };
  }

  async askCoach(text: string) {
    const userId = await this.userId();
    const semester = await this.ensureSemester(userId);
    const question = userMessage(text);

    const { error: questionError } = await this.client.from('chat_messages').insert({
      id: question.id,
      user_id: userId,
      semester_id: semester.id,
      role: question.role,
      text: question.text,
    });
    if (questionError) throw new ApiError(questionError.message);

    const snapshotForReply = await this.loadSnapshot(userId);
    const reply = coachReply(snapshotForReply, text);

    const { error: replyError } = await this.client.from('chat_messages').insert({
      id: reply.id,
      user_id: userId,
      semester_id: semester.id,
      role: reply.role,
      text: reply.text,
      routes: reply.routes ?? null,
    });
    if (replyError) throw new ApiError(replyError.message);

    const snapshot = await this.loadSnapshot(userId);
    return { snapshot, reply };
  }

  async contributeToFund(fundId: string, amount: number): Promise<SemesterSnapshot> {
    const userId = await this.userId();

    const { data: fund, error: fundReadError } = await this.client
      .from('funds')
      .select('extra_contributed')
      .eq('id', fundId)
      .single();
    if (fundReadError) throw new ApiError(fundReadError.message);

    const { error: fundError } = await this.client
      .from('funds')
      .update({ extra_contributed: Number(fund.extra_contributed) + amount })
      .eq('id', fundId);
    if (fundError) throw new ApiError(fundError.message);

    const { data: member, error: memberReadError } = await this.client
      .from('fund_members')
      .select('contributed')
      .eq('fund_id', fundId)
      .eq('is_you', true)
      .single();
    if (memberReadError) throw new ApiError(memberReadError.message);

    const { error: memberError } = await this.client
      .from('fund_members')
      .update({ contributed: Number(member.contributed) + amount })
      .eq('fund_id', fundId)
      .eq('is_you', true);
    if (memberError) throw new ApiError(memberError.message);

    return this.loadSnapshot(userId);
  }

  /**
   * Wrapped stays on the seeded recap until its own session (CLAUDE.md) — not
   * derived from live data as a side effect of standing up the backend.
   */
  async getWrapped(): Promise<WrappedStats> {
    return SEED_WRAPPED;
  }
}

interface SemesterRow {
  id: string;
  user_id: string;
  label: string;
  start_date: string;
  end_date: string;
  today: string;
  last_paid_week: string;
  user_name: string;
  user_initial: string;
  observed_daily_pace: number;
  setup_complete: boolean;
  created_at: string;
}

function rowToExpense(row: {
  id: string;
  merchant: string;
  amount: number;
  category: Category;
  envelope: Expense['envelope'];
  occurred_on: string;
}): Expense {
  return {
    id: row.id,
    merchant: row.merchant,
    amount: Number(row.amount),
    category: row.category,
    envelope: row.envelope,
    occurredOn: row.occurred_on,
  };
}
