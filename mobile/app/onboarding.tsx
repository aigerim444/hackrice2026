import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { weeksBetween } from '../src/domain/dates';
import { money, rateCompact } from '../src/domain/format';
import { remainingCharges } from '../src/domain/runway';
import { useLoadedRunway } from '../src/state/RunwayProvider';
import { colors, GUTTER, HOME_INDICATOR_GAP, RULE } from '../src/theme/tokens';
import { Kicker, T } from '../src/theme/type';
import { InkSlider, MoneyInput, PrimaryButton, SliderAxis } from '../src/ui/controls';
import { DashedBox, Flexible, Row, Screen } from '../src/ui/primitives';

/**
 * Onboarding — three quick steps, which is what the brief asked for.
 *
 * The cover states the problem, step 1 collects what landed in August and what
 * you earn, step 2 carves out anything you're saving for *before* the daily
 * number is calculated. That ordering is the product's whole argument: the trip
 * fund should never have to compete with boba.
 */
export default function OnboardingScreen() {
  const { snapshot, projection, setup, draftSetup, completeSetup, flash } = useLoadedRunway();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const { semester, jobs, fund } = snapshot;
  const weeksToTrip = Math.max(0, weeksBetween(semester.today, fund.occasion));
  const fundTotal = setup.fundWeeklyPledge * weeksToTrip;

  const rentBill = snapshot.bills.find((b) => b.id === 'bill-rent');
  const phoneBill = snapshot.bills.find((b) => b.id === 'bill-phone');
  const feesBill = snapshot.bills.find((b) => b.id === 'bill-fees');
  const rentTotal = rentBill ? remainingCharges(rentBill, semester.today, semester.endDate) : 0;
  const feesTotal =
    (phoneBill ? remainingCharges(phoneBill, semester.today, semester.endDate) : 0) +
    (feesBill ? remainingCharges(feesBill, semester.today, semester.endDate) : 0);

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

  return (
    <Screen>
      {/* Step meter. */}
      <Row style={{ paddingHorizontal: GUTTER, paddingTop: 10, gap: 6, justifyContent: 'flex-start' }}>
        <View style={{ flex: 1, height: 6, backgroundColor: colors.ink }} />
        {[1, 2].map((index) => (
          <View
            key={index}
            style={{
              flex: 1,
              height: 6,
              borderWidth: RULE,
              borderColor: colors.ink,
              backgroundColor: step >= index ? colors.ink : colors.cream,
            }}
          />
        ))}
      </Row>

      {step === 0 ? (
        <>
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
                  Rent · Fees · Trip fund — set aside first
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
            <PrimaryButton label="Sort my lump" trailing="→" onPress={() => setStep(1)} />
          </View>
        </>
      ) : null}

      {step === 1 ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 20, paddingBottom: 20 }}
            keyboardShouldPersistTaps="handled">
            <T w={700} size={12} color={colors.muted}>
              Step 1 of 2
            </T>
            <T w={800} size={30} tracking={-0.02} lh={1.05} style={{ marginTop: 4 }}>
              What landed in August?
            </T>

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

              {/* Two jobs, one sage group — pay cadence matters as much as the
                  rate, because it decides when the money actually lands. */}
              <View style={{ backgroundColor: colors.sage }}>
                {jobs.map((job, index) => (
                  <Row
                    key={job.id}
                    gap={10}
                    style={{
                      paddingHorizontal: 14,
                      paddingTop: index === 0 ? 12 : 0,
                      paddingBottom: 12,
                      ...(index > 0 ? { borderTopWidth: RULE, borderColor: colors.cream } : null),
                    }}>
                    <Flexible>
                      <T w={800} size={15}>
                        {job.name}
                      </T>
                      <T w={600} size={12} color={colors.muted}>
                        {rateCompact(job.hourlyRate)} · {job.hoursPerWeek} h/wk · {job.payCadence}
                      </T>
                    </Flexible>
                    <T w={800} size={14} color={colors.green} nowrap>
                      ~{money(job.hourlyRate * job.hoursPerWeek)}/wk
                    </T>
                  </Row>
                ))}
                <Row style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                  <T w={800} size={13} color={colors.muted}>
                    + another job
                  </T>
                  <T w={800} size={13} color={colors.green} nowrap>
                    ~{money(jobs.reduce((sum, j) => sum + j.hourlyRate * j.hoursPerWeek, 0))}/wk total
                  </T>
                </Row>
              </View>
            </View>

            <T w={700} size={12} color={colors.muted} style={{ marginTop: 20 }}>
              Bills you already know
            </T>
            <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <BillField
                label="Rent · monthly"
                value={setup.rentAmount}
                onChange={(rentAmount) => draftSetup({ rentAmount })}
              />
              <BillField
                label="Phone · monthly"
                value={setup.phoneAmount}
                onChange={(phoneAmount) => draftSetup({ phoneAmount })}
              />
              <View style={{ flexGrow: 1, flexBasis: '46%', backgroundColor: colors.sage, padding: 8, paddingHorizontal: 14 }}>
                <T w={600} size={12} color={colors.muted}>
                  Meal plan
                </T>
                <T w={800} size={22} lh={1.1}>
                  Paid
                </T>
              </View>
              <DashedBox style={{ flexGrow: 1, flexBasis: '46%', justifyContent: 'center' }}>
                <T w={800} size={14} color={colors.muted}>
                  + Add a bill
                </T>
              </DashedBox>
            </View>
          </ScrollView>

          <StepFooter
            kicker="Lump"
            value={money(projection.lump)}
            action="Next →"
            onPress={() => setStep(2)}
          />
        </KeyboardAvoidingView>
      ) : null}

      {step === 2 ? (
        <>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 20, paddingBottom: 20 }}>
            <T w={700} size={12} color={colors.muted}>
              Step 2 of 2
            </T>
            <T w={800} size={30} tracking={-0.02} lh={1.05} style={{ marginTop: 4 }}>
              Anything you&apos;re saving for?
            </T>
            <T w={600} size={14} color={colors.muted} style={{ marginTop: 6 }}>
              Set it aside now so it never competes with boba.
            </T>

            <View
              style={{
                marginTop: 16,
                backgroundColor: colors.sage,
                borderWidth: RULE,
                borderColor: colors.ink,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}>
              <Row>
                <Flexible>
                  <T w={800} size={15}>
                    {fund.label} · Nov 20
                  </T>
                  <T w={600} size={12} color={colors.muted}>
                    with {fund.members.filter((m) => !m.isYou).map((m) => m.name).join(' + ')}
                  </T>
                </Flexible>
                <T w={800} size={20} nowrap>
                  ${setup.fundWeeklyPledge}
                  <T w={600} size={12} color={colors.muted}>
                    /wk
                  </T>
                </T>
              </Row>
              <InkSlider
                value={setup.fundWeeklyPledge}
                min={0}
                max={60}
                step={5}
                onChange={(fundWeeklyPledge) => draftSetup({ fundWeeklyPledge })}
                style={{ marginTop: 6 }}
              />
              <SliderAxis labels={['$0', `${weeksToTrip} weeks → ${money(fundTotal)}`, '$60']} />
            </View>

            <DashedBox style={{ marginTop: 10, paddingHorizontal: 16 }}>
              <T w={800} size={14} color={colors.muted}>
                + Another goal
              </T>
            </DashedBox>

            <T w={700} size={12} color={colors.muted} style={{ marginTop: 24 }}>
              Your envelopes
            </T>
            <View style={{ marginTop: 8, gap: 8 }}>
              <EnvelopeRow label="Rent · Sep–Dec" value={money(rentTotal)} />
              <EnvelopeRow label="Phone + fees" value={money(feesTotal)} />
              <Row style={{ backgroundColor: colors.sage, paddingHorizontal: 14, paddingVertical: 10 }}>
                <T w={800} size={15}>
                  {fund.label}
                </T>
                <T w={800} size={15} nowrap>
                  {money(fundTotal)}
                </T>
              </Row>
            </View>
          </ScrollView>

          <StepFooter
            kicker="Free to spend"
            value={money(projection.safeDaily)}
            suffix="/day"
            action={saving ? 'Setting up…' : 'Start →'}
            onPress={saving ? undefined : finish}
          />
        </>
      ) : null}
    </Screen>
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

function BillField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: '46%',
        borderBottomWidth: RULE,
        borderColor: colors.ink,
        paddingVertical: 8,
      }}>
      <T w={600} size={12} color={colors.muted}>
        {label}
      </T>
      <MoneyInput value={value} onChange={onChange} size={22} width={70} underline={false} align="left" />
    </View>
  );
}

function EnvelopeRow({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ borderBottomWidth: RULE, borderColor: colors.ruleSoft, paddingVertical: 10 }}>
      <T w={800} size={15}>
        {label}
      </T>
      <T w={800} size={15} nowrap>
        {value}
      </T>
    </Row>
  );
}

/** The ink block pinned above the fold on steps 1 and 2: the running total, and the way forward. */
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
      <Row
        style={{
          backgroundColor: colors.ink,
          paddingHorizontal: 20,
          paddingVertical: 14,
        }}>
        <View>
          <Kicker color={colors.cream} opacity={0.65}>
            {kicker}
          </Kicker>
          <T w={800} size={30} tracking={-0.03} lh={1} color={colors.cream}>
            {value}
            {suffix ? (
              <T w={800} size={14} color={colors.cream} opacity={0.7}>
                {suffix}
              </T>
            ) : null}
          </T>
        </View>
        <PrimaryButton label={action} tone="cream" height={46} onPress={onPress} style={{ paddingHorizontal: 18 }} />
      </Row>
    </View>
  );
}
