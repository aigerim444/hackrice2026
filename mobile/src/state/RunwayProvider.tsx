import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { api } from '../data/client';
import { money } from '../domain/format';
import { project, projectBaseline, type Projection } from '../domain/runway';
import type {
  Category,
  ChatMessage,
  EnvelopeId,
  ParsedReceipt,
  SemesterSnapshot,
  SetupInput,
} from '../domain/types';

/**
 * The app's one store.
 *
 * Holds the server snapshot and derives the projection from it. Mutations are
 * optimistic where the design demands immediacy — a slider has to track your
 * thumb and the run-out date has to move with it — and awaited everywhere else.
 * The server's response always wins, so an optimistic guess that turns out
 * wrong corrects itself on the next tick rather than sticking.
 */

interface RunwayContextValue {
  snapshot: SemesterSnapshot | null;
  projection: Projection | null;
  /** The projection with jobs at their scheduled hours — what a what-if is measured against. */
  baseline: Projection | null;
  loading: boolean;
  error: string | null;

  toast: string | null;
  flash: (message: string) => void;
  dismissToast: () => void;

  completeSetup: (input: SetupInput) => Promise<void>;
  resetSemester: () => Promise<void>;
  /** Local-only edits during onboarding, before setup is committed. */
  draftSetup: (patch: Partial<SetupInput>) => void;
  setup: SetupInput;

  setJobHours: (jobId: string, hours: number) => void;
  logExpense: (input: {
    merchant: string;
    amount: number;
    category: Category;
    envelope: EnvelopeId;
  }) => Promise<void>;
  scanReceipt: (input: { imageUri?: string }) => Promise<ParsedReceipt>;
  askCoach: (text: string) => Promise<void>;
  contributeToFund: (amount: number) => Promise<void>;
  /** True while the coach is composing, so the thread can show it. */
  coachThinking: boolean;
}

const RunwayContext = createContext<RunwayContextValue | null>(null);

const TOAST_MS = 3600;

/** Pull the editable setup values back out of a snapshot. */
function setupFrom(snapshot: SemesterSnapshot | null): SetupInput {
  if (!snapshot) {
    return { aidAmount: 0, summerAmount: 0, rentAmount: 0, phoneAmount: 0, fundWeeklyPledge: 0 };
  }
  return {
    aidAmount: snapshot.income.find((i) => i.kind === 'aid')?.amount ?? 0,
    summerAmount: snapshot.income.find((i) => i.kind === 'summer')?.amount ?? 0,
    rentAmount: snapshot.bills.find((b) => b.id === 'bill-rent')?.amount ?? 0,
    phoneAmount: snapshot.bills.find((b) => b.id === 'bill-phone')?.amount ?? 0,
    fundWeeklyPledge: snapshot.fund.weeklyPledge,
  };
}

/** Apply a draft setup to a snapshot so onboarding's totals update as you type. */
function withSetup(snapshot: SemesterSnapshot, setup: SetupInput): SemesterSnapshot {
  return {
    ...snapshot,
    income: snapshot.income.map((source) =>
      source.kind === 'aid'
        ? { ...source, amount: setup.aidAmount }
        : source.kind === 'summer'
          ? { ...source, amount: setup.summerAmount }
          : source,
    ),
    bills: snapshot.bills.map((bill) =>
      bill.id === 'bill-rent'
        ? { ...bill, amount: setup.rentAmount }
        : bill.id === 'bill-phone'
          ? { ...bill, amount: setup.phoneAmount }
          : bill,
    ),
    fund: { ...snapshot.fund, weeklyPledge: setup.fundWeeklyPledge },
  };
}

export function RunwayProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<SemesterSnapshot | null>(null);
  const [setup, setSetup] = useState<SetupInput>(() => setupFrom(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [coachThinking, setCoachThinking] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jobTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    let cancelled = false;
    api
      .getSnapshot()
      .then((next) => {
        if (cancelled) return;
        setSnapshot(next);
        setSetup(setupFrom(next));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your semester.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timers = jobTimers.current;
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const flash = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const draftSetup = useCallback((patch: Partial<SetupInput>) => {
    setSetup((current) => ({ ...current, ...patch }));
  }, []);

  const completeSetup = useCallback(
    async (input: SetupInput) => {
      const next = await api.completeSetup(input);
      setSnapshot(next);
      setSetup(setupFrom(next));
    },
    [],
  );

  const resetSemester = useCallback(async () => {
    const next = await api.resetSemester();
    setSnapshot(next);
    setSetup(setupFrom(next));
    dismissToast();
  }, [dismissToast]);

  /**
   * Optimistic by necessity: this is driven by a slider, so the date under it
   * has to move on the same frame. The write is debounced — a drag is one
   * schedule change, not forty.
   */
  const setJobHours = useCallback((jobId: string, hours: number) => {
    setSnapshot((current) =>
      current
        ? {
            ...current,
            jobs: current.jobs.map((job) =>
              job.id === jobId ? { ...job, hoursPerWeek: hours } : job,
            ),
          }
        : current,
    );

    const timers = jobTimers.current;
    if (timers[jobId]) clearTimeout(timers[jobId]);
    timers[jobId] = setTimeout(() => {
      api.setJobHours(jobId, hours).then(setSnapshot).catch(() => {
        /* The next snapshot read reconciles; a dropped hours write isn't worth a modal. */
      });
    }, 400);
  }, []);

  const logExpense = useCallback<RunwayContextValue['logExpense']>(async (input) => {
    const next = await api.logExpense(input);
    setSnapshot(next);
  }, []);

  const scanReceipt = useCallback((input: { imageUri?: string }) => api.scanReceipt(input), []);

  const askCoach = useCallback(async (text: string) => {
    // Show the question immediately — waiting on the round trip to echo your own
    // words back is the one thing that makes a chat feel broken.
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, role: 'user', text };
    setSnapshot((current) =>
      current ? { ...current, chat: [...current.chat, optimistic] } : current,
    );
    setCoachThinking(true);
    try {
      const { snapshot: next } = await api.askCoach(text);
      setSnapshot(next);
    } finally {
      setCoachThinking(false);
    }
  }, []);

  const contributeToFund = useCallback(async (amount: number) => {
    const next = await api.contributeToFund(amount);
    setSnapshot(next);
    const after = project(next);
    flash(
      `$${amount} set aside for the trip. Your daily spending money is now ${money(after.safeDaily)}.`,
    );
  }, [flash]);

  // Onboarding edits the draft, not the server, so the projection it shows has
  // to reflect the draft. Everywhere else `setup` already equals the snapshot.
  const effective = useMemo(
    () => (snapshot ? (snapshot.setupComplete ? snapshot : withSetup(snapshot, setup)) : null),
    [snapshot, setup],
  );

  const projection = useMemo(() => (effective ? project(effective) : null), [effective]);
  const baseline = useMemo(() => (effective ? projectBaseline(effective) : null), [effective]);

  const value = useMemo<RunwayContextValue>(
    () => ({
      snapshot: effective,
      projection,
      baseline,
      loading,
      error,
      toast,
      flash,
      dismissToast,
      completeSetup,
      resetSemester,
      draftSetup,
      setup,
      setJobHours,
      logExpense,
      scanReceipt,
      askCoach,
      contributeToFund,
      coachThinking,
    }),
    [
      effective,
      projection,
      baseline,
      loading,
      error,
      toast,
      flash,
      dismissToast,
      completeSetup,
      resetSemester,
      draftSetup,
      setup,
      setJobHours,
      logExpense,
      scanReceipt,
      askCoach,
      contributeToFund,
      coachThinking,
    ],
  );

  return <RunwayContext.Provider value={value}>{children}</RunwayContext.Provider>;
}

export function useRunway(): RunwayContextValue {
  const value = useContext(RunwayContext);
  if (!value) throw new Error('useRunway must be used inside <RunwayProvider>');
  return value;
}

/**
 * For the screens that can't render without data. Every route below the root
 * layout is only mounted once the snapshot has loaded, so this is safe there and
 * saves a null check in every component.
 */
export function useLoadedRunway() {
  const value = useRunway();
  if (!value.snapshot || !value.projection || !value.baseline) {
    throw new Error('Runway data is not loaded yet');
  }
  return value as RunwayContextValue & {
    snapshot: SemesterSnapshot;
    projection: Projection;
    baseline: Projection;
  };
}
