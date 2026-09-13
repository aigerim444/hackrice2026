import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { isMockApi } from '../src/data/client';
import { getFailureRate, setFailureRate } from '../src/data/mock/mockApi';
import { shortDate } from '../src/domain/dates';
import { money, rateCompact } from '../src/domain/format';
import { useLoadedRunway } from '../src/state/RunwayProvider';
import { colors, GUTTER, RULE } from '../src/theme/tokens';
import { Kicker, T } from '../src/theme/type';
import { InkBlock } from '../src/ui/blocks';
import { Segment } from '../src/ui/controls';
import { DashedBox, Flexible, Row, Screen, Tap } from '../src/ui/primitives';
import { TabBar } from '../src/ui/TabBar';
import { Toast } from '../src/ui/Toast';

/**
 * You — the setup behind the numbers, and the way into Wrapped.
 *
 * Everything here is editable input rather than output: what landed, what you
 * earn, what's owed. If a number on Home looks wrong, this is where it's wrong.
 */
export default function YouScreen() {
  const { snapshot, resetSemester, toast, flash, dismissToast } = useLoadedRunway();
  const { user, semester, income, jobs, bills } = snapshot;

  const [resetting, setResetting] = useState(false);
  const [flaky, setFlaky] = useState(() => getFailureRate() > 0);

  const rent = bills.find((b) => b.id === 'bill-rent');
  const phone = bills.find((b) => b.id === 'bill-phone');

  const redoSetup = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await resetSemester();
      router.replace('/onboarding');
    } catch (e) {
      flash(e instanceof Error ? e.message : "Couldn't redo setup — try again.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <T w={800} size={22} style={{ paddingHorizontal: GUTTER, paddingTop: 10 }}>
          You
        </T>

        <Row
          style={{
            marginHorizontal: GUTTER,
            marginTop: 16,
            borderBottomWidth: RULE,
            borderColor: colors.ruleSoft,
            paddingVertical: 12,
          }}>
          <Flexible>
            <T w={800} size={15}>
              {user.name}
            </T>
            <T w={600} size={12} color={colors.muted}>
              {semester.label} · {shortDate(semester.startDate)} → {shortDate(semester.endDate)}
            </T>
          </Flexible>
          <View
            style={{
              width: 40,
              height: 40,
              borderWidth: RULE,
              borderColor: colors.ink,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <T w={800} size={16}>
              {user.initial}
            </T>
          </View>
        </Row>

        <Tap onPress={() => router.push('/wrapped')} style={{ marginHorizontal: GUTTER, marginTop: 12 }}>
          <InkBlock>
            <Row>
              <Flexible>
                <Kicker color={colors.cream} opacity={0.65}>
                  Preview
                </Kicker>
                <T w={800} size={22} lh={1.1} color={colors.cream}>
                  Semester Wrapped
                </T>
                <T w={600} size={12} color={colors.cream} opacity={0.75} style={{ marginTop: 2 }}>
                  7 cards · how {shortDate(semester.endDate)} would look
                </T>
              </Flexible>
              <T w={800} size={22} color={colors.cream}>
                →
              </T>
            </Row>
          </InkBlock>
        </Tap>

        <T w={800} size={16} style={{ marginHorizontal: GUTTER, marginTop: 22 }}>
          Income + jobs
        </T>
        <View style={{ marginHorizontal: GUTTER, marginTop: 8, gap: 8 }}>
          {income.map((source) => (
            <Row
              key={source.id}
              style={{ borderBottomWidth: RULE, borderColor: colors.ruleSoft, paddingVertical: 12 }}>
              <T w={700} size={14}>
                {source.label}
              </T>
              <T w={700} size={14} nowrap>
                {money(source.amount)}
              </T>
            </Row>
          ))}
          {jobs.map((job) => (
            <Tap key={job.id} onPress={() => router.push('/jobs')}>
              <Row style={{ backgroundColor: colors.sage, paddingHorizontal: 14, paddingVertical: 12 }}>
                <T w={700} size={14}>
                  {job.name} · {job.hoursPerWeek} h/wk
                </T>
                <T w={700} size={14} nowrap>
                  {rateCompact(job.hourlyRate)} →
                </T>
              </Row>
            </Tap>
          ))}
        </View>

        <T w={800} size={16} style={{ marginHorizontal: GUTTER, marginTop: 22 }}>
          Bills
        </T>
        <View style={{ marginHorizontal: GUTTER, marginTop: 8, marginBottom: 24, gap: 8 }}>
          <Row style={{ borderBottomWidth: RULE, borderColor: colors.ruleSoft, paddingVertical: 12 }}>
            <T w={700} size={14}>
              Rent · 1st of month
            </T>
            <T w={700} size={14} nowrap>
              {money(rent?.amount ?? 0)}
            </T>
          </Row>
          <Row style={{ borderBottomWidth: RULE, borderColor: colors.ruleSoft, paddingVertical: 12 }}>
            <T w={700} size={14}>
              Phone · 15th
            </T>
            <T w={700} size={14} nowrap>
              {money(phone?.amount ?? 0)}
            </T>
          </Row>
          <DashedBox onPress={redoSetup}>
            <T w={800} size={14} color={colors.muted}>
              {resetting ? 'Redoing setup…' : 'Redo setup'}
            </T>
          </DashedBox>
        </View>

        {/* Mock-only: a way to actually see the loading/error states without a
            real network, rather than trusting they're right from reading the
            code. Never shown once a real backend is behind the app. */}
        {isMockApi ? (
          <View style={{ marginHorizontal: GUTTER, marginBottom: 24, gap: 8 }}>
            <T w={800} size={16}>
              Developer
            </T>
            <T w={600} size={12} lh={1.35} color={colors.muted}>
              Simulates a bad connection: every save has a 1-in-10 chance of failing after its
              delay, so loading and error states are things you can actually see.
            </T>
            <Segment
              options={[
                { id: 'normal', label: 'Normal' },
                { id: 'flaky', label: 'Flaky (10%)' },
              ]}
              selectedId={flaky ? 'flaky' : 'normal'}
              onSelect={(id) => {
                const next = id === 'flaky';
                setFlaky(next);
                setFailureRate(next ? 0.1 : 0);
              }}
            />
          </View>
        ) : null}
      </ScrollView>

      {toast ? <Toast message={toast} onDismiss={dismissToast} /> : null}
      <TabBar current="you" />
    </Screen>
  );
}
