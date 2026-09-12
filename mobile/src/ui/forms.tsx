import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { addDays, weeksBetween } from '../domain/dates';
import { money } from '../domain/format';
import { draftId, weeklyPay } from '../domain/payroll';
import type { BillDraft, Category, ChallengeDraft, FundDraft, JobDraft, PayCadence } from '../domain/types';
import { CATEGORIES } from '../domain/types';
import { colors, fonts, RULE } from '../theme/tokens';
import { scaleFont } from '../theme/scale';
import { T } from '../theme/type';
import { InkSlider, OutlineButton, PrimaryButton, Segment, SliderAxis } from './controls';
import { DateField } from './DateField';
import { Flexible, Row } from './primitives';

/**
 * The add/edit forms.
 *
 * Everything you can own in this app — a job, a bill, a goal — is created
 * through one of these, whether that's during onboarding or later from the
 * screen that lists them. Keeping them here is what makes the `+` buttons real
 * rather than decorative.
 */

/** A labelled text field in the design's idiom: label above, 2px rule below. */
export function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType = 'default',
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  autoFocus?: boolean;
}) {
  return (
    <View style={{ flex: 1 }}>
      <T w={700} size={12} color={colors.muted}>
        {label}
      </T>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.tan}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        style={{
          borderBottomWidth: RULE,
          borderColor: colors.ink,
          paddingVertical: 6,
          paddingHorizontal: 0,
          fontFamily: fonts.extrabold,
          fontSize: scaleFont(20),
          color: colors.ink,
        }}
      />
    </View>
  );
}

/** The frame every form sits in: a sage panel with Cancel / Save. */
function FormCard({
  title,
  children,
  onCancel,
  onSave,
  saveLabel,
  canSave,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
  canSave: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.sage,
        borderWidth: RULE,
        borderColor: colors.ink,
        padding: 16,
        gap: 14,
      }}>
      <T w={800} size={16}>
        {title}
      </T>
      {children}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <OutlineButton label="Cancel" height={44} onPress={onCancel} style={{ flex: 1 }} />
        <View style={{ flex: 1, opacity: canSave ? 1 : 0.4 }} pointerEvents={canSave ? 'auto' : 'none'}>
          <PrimaryButton label={saveLabel} height={44} onPress={onSave} />
        </View>
      </View>
    </View>
  );
}

const CADENCES: { id: PayCadence; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Biweekly' },
  { id: 'monthly', label: 'Monthly' },
];

/**
 * A campus job: what it's called, what it pays, how many hours, and how often
 * the money actually lands — the last of which is why two jobs at the same rate
 * move your run-out date differently.
 */
export function JobForm({
  onCancel,
  onSave,
  initial,
}: {
  onCancel: () => void;
  onSave: (draft: JobDraft) => void;
  initial?: JobDraft;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [rate, setRate] = useState(initial ? String(initial.hourlyRate) : '');
  const [hours, setHours] = useState(initial ? String(initial.hoursPerWeek) : '');
  const [cadence, setCadence] = useState<PayCadence>(initial?.payCadence ?? 'biweekly');

  const rateNum = Number(rate) || 0;
  const hoursNum = Number(hours) || 0;
  const canSave = name.trim().length > 0 && rateNum > 0 && hoursNum > 0;

  return (
    <FormCard
      title={initial ? 'Edit job' : 'Add a job'}
      onCancel={onCancel}
      canSave={canSave}
      saveLabel={initial ? 'Save' : 'Add job'}
      onSave={() =>
        onSave({
          id: initial?.id ?? draftId('job'),
          name: name.trim(),
          hourlyRate: rateNum,
          hoursPerWeek: hoursNum,
          payCadence: cadence,
        })
      }>
      <Field label="What is it?" value={name} onChange={setName} placeholder="Library desk" autoFocus />

      <Row gap={14} align="flex-end">
        <Field label="Rate / hour" value={rate} onChange={setRate} placeholder="15.50" keyboardType="decimal-pad" />
        <Field label="Hours / week" value={hours} onChange={setHours} placeholder="12" keyboardType="number-pad" />
      </Row>

      <View>
        <T w={700} size={12} color={colors.muted} style={{ marginBottom: 6 }}>
          Paid
        </T>
        <Segment
          options={CADENCES}
          selectedId={cadence}
          onSelect={(id) => setCadence(id as PayCadence)}
        />
      </View>

      {canSave ? (
        <T w={800} size={14} color={colors.green}>
          ~{money(weeklyPay({ hourlyRate: rateNum, hoursPerWeek: hoursNum }))}/wk
        </T>
      ) : null}
    </FormCard>
  );
}

/** A bill you already know about. */
export function BillForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (draft: BillDraft) => void;
}) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [monthly, setMonthly] = useState(true);
  const [dueDay, setDueDay] = useState('1');

  const amountNum = Number(amount) || 0;
  const canSave = label.trim().length > 0 && amountNum > 0;

  return (
    <FormCard
      title="Add a bill"
      onCancel={onCancel}
      canSave={canSave}
      saveLabel="Add bill"
      onSave={() =>
        onSave({
          id: draftId('bill'),
          label: label.trim(),
          amount: amountNum,
          envelope: 'fees',
          cadence: monthly ? 'monthly' : 'once',
          ...(monthly
            ? { dueDay: Math.min(28, Math.max(1, Number(dueDay) || 1)) }
            : { dueDate: addDays(new Date().toISOString().slice(0, 10), 30) }),
        })
      }>
      <Field label="What is it?" value={label} onChange={setLabel} placeholder="Gym membership" autoFocus />

      <Row gap={14} align="flex-end">
        <Field label="Amount" value={amount} onChange={setAmount} placeholder="45" keyboardType="decimal-pad" />
        {monthly ? (
          <Field label="Day of month" value={dueDay} onChange={setDueDay} keyboardType="number-pad" />
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </Row>

      <Segment
        options={[
          { id: 'monthly', label: 'Every month' },
          { id: 'once', label: 'One-off' },
        ]}
        selectedId={monthly ? 'monthly' : 'once'}
        onSelect={(id) => setMonthly(id === 'monthly')}
      />
    </FormCard>
  );
}

/**
 * Something you're saving for. The weekly pledge is the intentional act — it's
 * carved out of the daily number up front, which is the whole difference
 * between a fund and a wish.
 */
export function GoalForm({
  onCancel,
  onSave,
  today,
}: {
  onCancel: () => void;
  onSave: (draft: FundDraft) => void;
  today: string;
}) {
  const [label, setLabel] = useState('');
  const [target, setTarget] = useState('');
  const [occasion, setOccasion] = useState(() => addDays(today, 70));
  const [pledge, setPledge] = useState(20);

  const targetNum = Number(target) || 0;
  const canSave = label.trim().length > 0 && targetNum > 0;
  // What the weekly pledge will actually have put aside by the date chosen.
  const weeks = Math.max(0, weeksBetween(today, occasion));
  const saved = pledge * weeks;

  return (
    <FormCard
      title="Add a goal"
      onCancel={onCancel}
      canSave={canSave}
      saveLabel="Add goal"
      onSave={() =>
        onSave({
          id: draftId('fund'),
          label: label.trim(),
          occasion,
          targetAmount: targetNum,
          weeklyPledge: pledge,
          extraContributed: 0,
        })
      }>
      <Field label="What for?" value={label} onChange={setLabel} placeholder="Austin trip" autoFocus />

      <Row gap={14} align="flex-start">
        <Field label="Target" value={target} onChange={setTarget} placeholder="600" keyboardType="number-pad" />
        <DateField label="Needed by" value={occasion} onChange={setOccasion} min={addDays(today, 7)} />
      </Row>

      <View>
        <Row align="baseline">
          <T w={700} size={12} color={colors.muted}>
            Set aside each week
          </T>
          <T w={800} size={16} nowrap>
            ${pledge}/wk
          </T>
        </Row>
        <InkSlider value={pledge} min={0} max={60} step={5} onChange={setPledge} />
        <SliderAxis labels={['$0', `${weeks} weeks → ${money(saved)}`, '$60']} />
      </View>

      {canSave && saved < targetNum ? (
        <T w={600} size={13} lh={1.35} color={colors.red}>
          At ${pledge}/wk you&apos;ll have {money(saved)} of {money(targetNum)} by then — about $
          {Math.ceil(targetNum / Math.max(1, weeks))}/wk gets you there.
        </T>
      ) : null}
      {canSave && saved >= targetNum ? (
        <T w={600} size={13} lh={1.35} color={colors.green}>
          That covers it with {money(saved - targetNum)} to spare.
        </T>
      ) : null}
    </FormCard>
  );
}

/** The dashed "+ …" row that opens one of the forms above. */
export function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        borderWidth: RULE,
        borderStyle: 'dashed',
        borderColor: colors.tan,
        paddingVertical: 12,
        paddingHorizontal: 14,
        opacity: pressed ? 0.6 : 1,
      })}>
      <T w={800} size={14} color={colors.muted}>
        {label}
      </T>
    </Pressable>
  );
}

/** A saved thing in a list, with a way to remove it. */
export function EditableRow({
  title,
  sublabel,
  right,
  onRemove,
}: {
  title: string;
  sublabel: string;
  right?: string;
  onRemove: () => void;
}) {
  return (
    <Row gap={12} style={{ backgroundColor: colors.sage, paddingHorizontal: 14, paddingVertical: 12 }}>
      <Flexible>
        <T w={800} size={15}>
          {title}
        </T>
        <T w={600} size={12} color={colors.muted}>
          {sublabel}
        </T>
      </Flexible>
      {right ? (
        <T w={800} size={14} color={colors.green} nowrap>
          {right}
        </T>
      ) : null}
      <Pressable
        onPress={onRemove}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${title}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
        <T w={800} size={18} color={colors.muted}>
          ✕
        </T>
      </Pressable>
    </Row>
  );
}

/**
 * Something you're cutting out.
 *
 * No money on this form on purpose. A challenge isn't saving up — there's no
 * target to hit, so "$600 toward no boba" would be meaningless. The payoff is
 * the streak, and the category is what makes it checkable: a charge in it is
 * the only evidence that can break the run.
 */
export function ChallengeForm({
  onCancel,
  onSave,
  today,
}: {
  onCancel: () => void;
  onSave: (draft: ChallengeDraft) => void;
  today: string;
}) {
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<Category | undefined>('Drinks');
  const [until, setUntil] = useState(() => addDays(today, 30));

  const canSave = label.trim().length > 0;

  return (
    <FormCard
      title="Add a challenge"
      onCancel={onCancel}
      canSave={canSave}
      saveLabel="Start streak"
      onSave={() => onSave({ id: draftId('ch'), label: label.trim(), category, until })}>
      <Field
        label="What are you cutting out?"
        value={label}
        onChange={setLabel}
        placeholder="No boba"
        autoFocus
      />

      <View>
        <T w={700} size={12} color={colors.muted} style={{ marginBottom: 6 }}>
          Breaks when you spend on
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map((option) => {
            const selected = option === category;
            return (
              <Pressable
                key={option}
                onPress={() => setCategory(selected ? undefined : option)}
                style={({ pressed }) => ({
                  borderWidth: RULE,
                  borderColor: colors.ink,
                  backgroundColor: selected ? colors.ink : colors.white,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  opacity: pressed && !selected ? 0.7 : 1,
                })}>
                <T w={800} size={13} color={selected ? colors.cream : colors.ink} nowrap>
                  {option}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Row gap={14} align="flex-start">
        <DateField label="Until" value={until} onChange={setUntil} min={addDays(today, 1)} />
        <View style={{ flex: 1 }} />
      </Row>

      <T w={600} size={13} lh={1.35} color={colors.muted}>
        {category
          ? `Every day without a ${category.toLowerCase()} charge adds to the streak. One breaks it.`
          : 'No category, so nothing can break this automatically — it runs on the honour system.'}
      </T>
    </FormCard>
  );
}
