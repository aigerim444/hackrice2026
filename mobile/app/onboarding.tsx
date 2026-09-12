import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { shortDate } from '../src/domain/dates';
import { money, rateCompact } from '../src/domain/format';
import { weeklyPay } from '../src/domain/payroll';
import { fundReserved, remainingCharges } from '../src/domain/runway';
import type { BillDraft, FundDraft, JobDraft, SetupInput } from '../src/domain/types';
import { useLoadedRunway } from '../src/state/RunwayProvider';
import { colors, GUTTER, HOME_INDICATOR_GAP, RULE } from '../src/theme/tokens';
import { Kicker, T } from '../src/theme/type';
import { MoneyInput, PrimaryButton } from '../src/ui/controls';
import { AddRow, BillForm, EditableRow, GoalForm, JobForm } from '../src/ui/forms';
import { Flexible, Row, Screen, Tap } from '../src/ui/primitives';

/**
 * Onboarding — one question per screen.
 *
 * The cover states the problem, then each step asks about exactly one thing:
 * what landed, what you earn, what you owe, what you're saving for. That order
 * is the product's argument — everything spoken for is carved out *before* the
 * daily number exists, so a goal never has to compete with boba.
 *
 * Jobs, bills and goals are lists you build rather than fixed rows, because
 * "two campus jobs" and "no campus job" are both completely normal.
 */

const STEP_TITLES = ['Money in', 'Jobs', 'Bills', 'Goals', 'Review'];
/** Steps are 1-indexed; 0 is the cover. */
const LAST_STEP = STEP_TITLES.length;

type Draft = (patch: Partial<SetupInput>) => void;

export default function OnboardingScreen() {
  const { snapshot, projection, setup, draftSetup, completeSetup, flash } = useLoadedRunway();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const today = snapshot.semester.today;
  const onLastStep = step === LAST_STEP;

  const goBack = useCallback(() => setStep((current) => Math.max(0, current - 1)), []);
  const goNext = useCallback(() => setStep((current) => Math.min(LAST_STEP, current + 1)), []);

  // Android's back gesture walks the steps rather than dropping the user out of
  // the app. On the cover there's nowhere to go, so the OS keeps its default.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0) return false;
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [step, goBack]);

  const finish = async () => {
    setSaving(true);
    try {
      await completeSetup(setup);
      router.replace('/');
      flash(
        `Envelopes set. ${money(projection.safeDaily)} a day is yours — everything else is spoken for.`,
      );
    } finally {
      setSaving(false);
    }
  };

  if (step === 0) {
    return (
      <Screen>
        <StepMeter step={step} />
        <View style={{ flex: 1, paddingHorizontal: GUTTER, paddingTop: 60 }}>
          <T w={600} size={15} color={colors.muted}>
            Semester Runway
          </T>
          <T w={800} size={56} tracking={-0.03} lh={1}>
            One lump.{'\n'}
            {projection.totalDays} days.
          </T>
          <T w={600} size={16} color={colors.muted} lh={1.45} style={{ marginTop: 18, maxWidth: 320 }}>
            Aid refunds and summer money land in August. Budget apps assume a monthly paycheck — you
            don&apos;t have one. We sort the lump into envelopes and tell you what today can cost.
          </T>

          <View style={{ marginTop: 36, gap: 8 }}>
            <View style={{ borderBottomWidth: RULE, borderColor: colors.ink, paddingVertical: 10 }}>
              <T w={700} size={14}>
                Rent · Fees · Goals — set aside first
              </T>
            </View>
            <View style={{ paddingVertical: 10 }}>
              <T w={800} size={14}>
                Free to spend — the only envelope that&apos;s yours
              </T>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: GUTTER, paddingBottom: 44 }}>
          <PrimaryButton label="Sort my lump" trailing="→" onPress={goNext} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StepMeter step={step} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled">
          <StepBack step={step} onBack={goBack} />

          {step === 1 ? <MoneyInStep setup={setup} draftSetup={draftSetup} /> : null}
          {step === 2 ? <JobsStep setup={setup} draftSetup={draftSetup} /> : null}
          {step === 3 ? <BillsStep setup={setup} draftSetup={draftSetup} /> : null}
          {step === 4 ? <GoalsStep setup={setup} draftSetup={draftSetup} today={today} /> : null}
          {step === 5 ? <ReviewStep /> : null}
        </ScrollView>

        <StepFooter
          kicker={onLastStep ? 'Free to spend' : 'Lump'}
          value={onLastStep ? money(projection.safeDaily) : money(projection.lump)}
          suffix={onLastStep ? '/day' : undefined}
          action={onLastStep ? (saving ? 'Setting up…' : 'Start →') : 'Next →'}
          onPress={onLastStep ? (saving ? undefined : finish) : goNext}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

/* ───────────────────────────── steps ───────────────────────────── */

interface StepProps {
  setup: SetupInput;
  draftSetup: Draft;
}

function MoneyInStep({ setup, draftSetup }: StepProps) {
  return (
    <>
      <StepHeading title="What landed in August?" note="The one pile that has to last the term." />
      <View style={{ marginTop: 16, gap: 10 }}>
        <MoneyField
          label="Aid refund"
          sublabel="grants after tuition"
          value={setup.aidAmount}
          onChange={(aidAmount) => draftSetup({ aidAmount })}
        />
        <MoneyField
          label="Summer money"
          sublabel="what's left of it"
          value={setup.summerAmount}
          onChange={(summerAmount) => draftSetup({ summerAmount })}
        />
      </View>
    </>
  );
}

function JobsStep({ setup, draftSetup }: StepProps) {
  const [adding, setAdding] = useState(setup.jobs.length === 0);

  const add = (draft: JobDraft) => {
    draftSetup({ jobs: [...setup.jobs, draft] });
    setAdding(false);
  };
  const remove = (id: string) => draftSetup({ jobs: setup.jobs.filter((job) => job.id !== id) });

  const total = setup.jobs.reduce((sum, job) => sum + weeklyPay(job), 0);

  return (
    <>
      <StepHeading
        title="Do you work on campus?"
        note="Add each job on its own — how often it pays matters as much as the rate."
      />

      <View style={{ marginTop: 16, gap: 10 }}>
        {setup.jobs.map((job) => (
          <EditableRow
            key={job.id}
            title={job.name}
            sublabel={`${rateCompact(job.hourlyRate)} · ${job.hoursPerWeek} h/wk · ${job.payCadence}`}
            right={`~${money(weeklyPay(job))}/wk`}
            onRemove={() => remove(job.id)}
          />
        ))}

        {adding ? (
          <JobForm onCancel={() => setAdding(false)} onSave={add} />
        ) : (
          <AddRow
            label={setup.jobs.length ? '+ Another job' : '+ Add a job'}
            onPress={() => setAdding(true)}
          />
        )}

        {setup.jobs.length > 1 ? (
          <Row style={{ paddingTop: 4 }}>
            <T w={700} size={12} color={colors.muted}>
              {setup.jobs.length} jobs
            </T>
            <T w={800} size={13} color={colors.green} nowrap>
              ~{money(total)}/wk together
            </T>
          </Row>
        ) : null}

        {!setup.jobs.length && !adding ? (
          <T w={600} size={13} lh={1.4} color={colors.muted}>
            No campus job? Skip it — the lump just has to stretch further.
          </T>
        ) : null}
      </View>
    </>
  );
}

function BillsStep({ setup, draftSetup }: StepProps) {
  const [adding, setAdding] = useState(false);

  const patch = (id: string, amount: number) =>
    draftSetup({ bills: setup.bills.map((bill) => (bill.id === id ? { ...bill, amount } : bill)) });
  const remove = (id: string) => draftSetup({ bills: setup.bills.filter((bill) => bill.id !== id) });
  const add = (draft: BillDraft) => {
    draftSetup({ bills: [...setup.bills, draft] });
    setAdding(false);
  };

  return (
    <>
      <StepHeading
        title="What do you already owe?"
        note="Anything that leaves whether you like it or not."
      />

      <View style={{ marginTop: 16, gap: 10 }}>
        {setup.bills.map((bill) =>
          bill.prepaid ? (
            <Row
              key={bill.id}
              style={{ backgroundColor: colors.sage, paddingHorizontal: 14, paddingVertical: 12 }}>
              <T w={800} size={15}>
                {bill.label}
              </T>
              <T w={800} size={15} color={colors.green} nowrap>
                Paid
              </T>
            </Row>
          ) : (
            <Row
              key={bill.id}
              gap={10}
              style={{ borderBottomWidth: RULE, borderColor: colors.ruleSoft, paddingVertical: 12 }}>
              <Flexible>
                <T w={800} size={15}>
                  {bill.label}
                </T>
                <T w={600} size={12} color={colors.muted}>
                  {bill.cadence === 'monthly' ? `monthly · ${ordinal(bill.dueDay ?? 1)}` : 'one-off'}
                </T>
              </Flexible>
              <MoneyInput value={bill.amount} onChange={(amount) => patch(bill.id, amount)} />
              <Tap onPress={() => remove(bill.id)} hitSlop={12} accessibilityLabel={`Remove ${bill.label}`}>
                <T w={800} size={18} color={colors.muted}>
                  ✕
                </T>
              </Tap>
            </Row>
          ),
        )}

        {adding ? (
          <BillForm onCancel={() => setAdding(false)} onSave={add} />
        ) : (
          <AddRow label="+ Add a bill" onPress={() => setAdding(true)} />
        )}
      </View>
    </>
  );
}

function GoalsStep({ setup, draftSetup, today }: StepProps & { today: string }) {
  const [adding, setAdding] = useState(false);

  const add = (draft: FundDraft) => {
    draftSetup({ funds: [...setup.funds, draft] });
    setAdding(false);
  };
  const remove = (id: string) => draftSetup({ funds: setup.funds.filter((fund) => fund.id !== id) });

  return (
    <>
      <StepHeading
        title="Anything you're saving for?"
        note="Set it aside now so it never competes with boba."
      />

      <View style={{ marginTop: 16, gap: 10 }}>
        {setup.funds.map((fund) => (
          <EditableRow
            key={fund.id}
            title={`${fund.label} · ${shortDate(fund.occasion)}`}
            sublabel={
              (fund.shared ? 'shared · ' : '') +
              `$${fund.weeklyPledge}/wk · ${money(fund.targetAmount)} target`
            }
            right={`${money(fundReserved({ ...fund, members: [] }, today))} by then`}
            onRemove={() => remove(fund.id)}
          />
        ))}

        {adding ? (
          <GoalForm today={today} onCancel={() => setAdding(false)} onSave={add} />
        ) : (
          <AddRow
            label={setup.funds.length ? '+ Another goal' : '+ Add a goal'}
            onPress={() => setAdding(true)}
          />
        )}

        {!setup.funds.length && !adding ? (
          <T w={600} size={13} lh={1.4} color={colors.muted}>
            Nothing set aside means everything is spendable. You can add a goal later.
          </T>
        ) : null}
      </View>
    </>
  );
}

/** The last step: what the answers add up to, before anything is committed. */
function ReviewStep() {
  const { snapshot, projection } = useLoadedRunway();
  const { semester, bills, jobs, funds } = snapshot;

  const rentBill = bills.find((bill) => bill.id === 'bill-rent');
  const rentTotal = rentBill ? remainingCharges(rentBill, semester.today, semester.endDate) : 0;
  const otherBills = projection.reserved - rentTotal;
  const weekly = jobs.reduce((sum, job) => sum + weeklyPay(job), 0);

  return (
    <>
      <StepHeading title="Your envelopes" note="What's spoken for, and what's left." />

      <View style={{ marginTop: 16, gap: 8 }}>
        <ReviewRow label="Lump" value={money(projection.lump)} />
        {jobs.length ? (
          <ReviewRow
            label={`${jobs.length} job${jobs.length > 1 ? 's' : ''}`}
            value={`~${money(weekly)}/wk`}
            tone="good"
          />
        ) : null}
        {rentTotal ? <ReviewRow label="Rent · rest of term" value={money(rentTotal)} /> : null}
        {otherBills ? <ReviewRow label="Other bills + fees" value={money(otherBills)} /> : null}
        {funds.map((fund) => (
          <ReviewRow
            key={fund.id}
            label={fund.label}
            value={money(fundReserved({ ...fund, members: [] }, semester.today))}
            fill
          />
        ))}
      </View>

      <View style={{ marginTop: 22, borderTopWidth: RULE, borderColor: colors.ink, paddingTop: 14 }}>
        <T w={600} size={15} lh={1.45} color={colors.muted}>
          That leaves{' '}
          <T w={800} size={15}>
            {money(projection.free)}
          </T>{' '}
          in Free to spend, across {projection.daysLeft} days to {shortDate(semester.endDate)}.
        </T>
      </View>
    </>
  );
}

/* ───────────────────────────── pieces ───────────────────────────── */

function StepMeter({ step }: { step: number }) {
  return (
    <Row style={{ paddingHorizontal: GUTTER, paddingTop: 10, gap: 6, justifyContent: 'flex-start' }}>
      {Array.from({ length: LAST_STEP }).map((_, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            height: 6,
            borderWidth: RULE,
            borderColor: colors.ink,
            backgroundColor: step > index ? colors.ink : colors.cream,
          }}
        />
      ))}
    </Row>
  );
}

/**
 * The step counter doubles as the way back. Onboarding is one route with
 * internal step state, so there's no navigation chrome to hang a back button
 * on — and nothing typed is lost, since the draft lives in the store.
 */
function StepBack({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <Tap
      onPress={onBack}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={step === 1 ? 'Back to the start' : `Back to ${STEP_TITLES[step - 2]}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
      <T w={800} size={16}>
        ←
      </T>
      <T w={700} size={12} color={colors.muted}>
        Step {step} of {LAST_STEP} · {STEP_TITLES[step - 1]}
      </T>
    </Tap>
  );
}

function StepHeading({ title, note }: { title: string; note: string }) {
  return (
    <>
      <T w={800} size={30} tracking={-0.02} lh={1.05} style={{ marginTop: 4 }}>
        {title}
      </T>
      <T w={600} size={14} lh={1.4} color={colors.muted} style={{ marginTop: 6 }}>
        {note}
      </T>
    </>
  );
}

function MoneyField({
  label,
  sublabel,
  value,
  onChange,
}: {
  label: string;
  sublabel: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <Row gap={10} style={{ borderBottomWidth: RULE, borderColor: colors.ruleSoft, paddingVertical: 12 }}>
      <Flexible>
        <T w={800} size={15}>
          {label}
        </T>
        <T w={600} size={12} color={colors.muted}>
          {sublabel}
        </T>
      </Flexible>
      <MoneyInput value={value} onChange={onChange} />
    </Row>
  );
}

function ReviewRow({
  label,
  value,
  tone,
  fill,
}: {
  label: string;
  value: string;
  tone?: 'good';
  fill?: boolean;
}) {
  return (
    <Row
      style={
        fill
          ? { backgroundColor: colors.sage, paddingHorizontal: 14, paddingVertical: 10 }
          : { borderBottomWidth: RULE, borderColor: colors.ruleSoft, paddingVertical: 10 }
      }>
      <T w={800} size={15}>
        {label}
      </T>
      <T w={800} size={15} nowrap color={tone === 'good' ? colors.green : colors.ink}>
        {value}
      </T>
    </Row>
  );
}

/** The ink block pinned above the fold: the running total, and the way forward. */
function StepFooter({
  kicker,
  value,
  suffix,
  action,
  onPress,
}: {
  kicker: string;
  value: string;
  suffix?: string;
  action: string;
  onPress?: () => void;
}) {
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingBottom: HOME_INDICATOR_GAP + 14 }}>
      <Row style={{ backgroundColor: colors.ink, paddingHorizontal: 20, paddingVertical: 14 }}>
        <View>
          <Kicker color={colors.cream} opacity={0.65}>
            {kicker}
          </Kicker>
          <T w={800} size={30} tracking={-0.03} lh={1} color={colors.cream} nowrap>
            {value}
            {suffix ? (
              <T w={800} size={14} color={colors.cream} opacity={0.7}>
                {suffix}
              </T>
            ) : null}
          </T>
        </View>
        <PrimaryButton
          label={action}
          tone="cream"
          height={46}
          onPress={onPress}
          style={{ paddingHorizontal: 18 }}
        />
      </Row>
    </View>
  );
}

function ordinal(day: number): string {
  const rest = day % 10;
  const suffix =
    rest === 1 && day !== 11 ? 'st' : rest === 2 && day !== 12 ? 'nd' : rest === 3 && day !== 13 ? 'rd' : 'th';
  return `${day}${suffix}`;
}
