import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { cents } from '../src/domain/format';
import { projectWithCharge } from '../src/domain/runway';
import { challengeRivals } from '../src/domain/selectors';
import type { Category } from '../src/domain/types';
import { CATEGORIES } from '../src/domain/types';
import { useLoadedRunway } from '../src/state/RunwayProvider';
import { colors, GUTTER, RULE } from '../src/theme/tokens';
import { T } from '../src/theme/type';
import { OutlineButton, PrimaryButton } from '../src/ui/controls';
import { Field } from '../src/ui/forms';
import { DismissKeyboardArea } from '../src/ui/keyboard';
import { Flexible, Row, Screen } from '../src/ui/primitives';

/**
 * Logging a spend by hand.
 *
 * Most money doesn't come with a receipt you can photograph — a tap at the
 * vending machine, splitting a dinner over Venmo, a card charge you only see
 * later. The scanner is the fast path, not the only one, and an app that can
 * only take input through a camera is an app that quietly stops matching your
 * actual spending after a week.
 *
 * Same mutation as the scanner, same arithmetic, same consequences: this screen
 * differs only in where the number comes from. It also doubles as the way in
 * when the camera or the network isn't cooperating.
 */
export default function LogScreen() {
  const { projection, snapshot, logExpense, flash } = useLoadedRunway();

  const [merchant, setMerchant] = useState('');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<Category>('Eating out');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Tolerate "$12", "12.50 ", "12,50" — people type money the way they say it.
  const amount = Number(amountText.replace(/[^0-9.]/g, ''));
  const valid = Number.isFinite(amount) && amount > 0;

  // Previewed through the engine rather than by subtraction, so the figure here
  // is the one the home screen shows a second later. Charging today shrinks the
  // daily allowance too, which arithmetic on `leftToday` alone misses.
  const after = valid ? projectWithCharge(snapshot, amount) : projection;
  const afterToday = after.leftToday;
  const overspends = valid && amount > projection.leftToday;

  const streak = snapshot.challenges.find((c) => c.category === category && !c.broken);

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await logExpense({
        merchant: merchant.trim() || category,
        amount,
        category,
        envelope: 'free',
      });
      router.replace('/');
      const [rival] = streak ? challengeRivals(streak) : [];
      flash(
        `${cents(amount)} logged to Free · ${category}.` +
          (streak
            ? rival
              ? ` Streak reset — ${rival.name}'s still at ${rival.streakDays}.`
              : ' Streak reset.'
            : ' Date unchanged.'),
      );
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't log that — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <DismissKeyboardArea>
        <Row
          style={{
            paddingHorizontal: GUTTER,
            paddingTop: 8,
            paddingBottom: 10,
            borderBottomWidth: RULE,
            borderColor: colors.ink,
          }}>
          <T w={800} size={18}>
            Log a spend
          </T>
          <Pressable onPress={() => router.replace('/')} hitSlop={12}>
            <T w={800} size={14} color={colors.muted}>
              Cancel
            </T>
          </Pressable>
        </Row>

        <ScrollView
          contentContainerStyle={{ padding: GUTTER, gap: 16 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <T w={600} size={14} lh={1.4} color={colors.muted}>
            No receipt needed. This lands in the same envelope a scan would, and moves the same
            numbers.
          </T>

          <Field
            label="Amount"
            value={amountText}
            onChange={setAmountText}
            placeholder="8.65"
            keyboardType="decimal-pad"
            autoFocus
          />

          <Field
            label="What was it? (optional)"
            value={merchant}
            onChange={setMerchant}
            placeholder="Tiger Sugar"
          />

          <View>
            <T w={700} size={12} color={colors.muted} style={{ marginBottom: 6 }}>
              Envelope
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORIES.map((option) => {
                const on = option === category;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setCategory(option)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Envelope ${option}`}
                    style={({ pressed }) => ({
                      borderWidth: RULE,
                      borderColor: colors.ink,
                      backgroundColor: on ? colors.ink : colors.white,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      opacity: pressed && !on ? 0.7 : 1,
                    })}>
                    <T w={800} size={14} color={on ? colors.cream : colors.ink}>
                      {option}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* The consequence, live as you type — the same sentence the scan
              sheet shows, because it's the same charge either way. */}
          <View
            style={{
              borderTopWidth: RULE,
              borderColor: colors.ruleSoft,
              paddingTop: 12,
              gap: 6,
            }}>
            <Row gap={10}>
              <Flexible>
                <T w={600} size={14}>
                  Today after this
                </T>
              </Flexible>
              <T w={600} size={14} nowrap>
                <T w={800} size={14} color={overspends ? colors.red : colors.ink}>
                  {cents(afterToday)}
                </T>{' '}
                left · date unchanged
              </T>
            </Row>

            {overspends ? (
              <T w={600} size={12} lh={1.35} color={colors.muted}>
                That&apos;s more than today had left. It comes out of the same envelope either way —
                tomorrow just gets a little tighter.
              </T>
            ) : null}
          </View>

          {streak && valid ? (
            <View style={{ backgroundColor: colors.blush, paddingHorizontal: 14, paddingVertical: 10 }}>
              <T w={600} size={13} lh={1.35}>
                This breaks your{' '}
                <T w={800} size={13}>
                  {streak.label}
                </T>{' '}
                streak (day {streak.youStreakDays}).
              </T>
            </View>
          ) : null}

          {saveError ? (
            <T w={600} size={13} lh={1.35} color={colors.red}>
              {saveError}
            </T>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View
              style={{ flex: 1, opacity: valid && !saving ? 1 : 0.4 }}
              pointerEvents={valid && !saving ? 'auto' : 'none'}>
              <PrimaryButton label={saving ? 'Logging…' : 'Log it'} height={52} onPress={save} />
            </View>
            <OutlineButton
              label="Scan instead"
              height={52}
              onPress={() => router.replace('/scan')}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
        </DismissKeyboardArea>
      </KeyboardAvoidingView>
    </Screen>
  );
}
