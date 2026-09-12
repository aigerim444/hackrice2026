import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { shortDate, weekdayDate, weeksBetween } from '../src/domain/dates';
import { cents, money, signedMoney } from '../src/domain/format';
import { fundProgress, categoryBars, homeStreaks } from '../src/domain/selectors';
import { useLoadedRunway } from '../src/state/RunwayProvider';
import { colors, GUTTER } from '../src/theme/tokens';
import { T } from '../src/theme/type';
import { AddButton, AddMenu } from '../src/ui/AddMenu';
import { BarRow, HeatStrip, Section, StripAxis } from '../src/ui/blocks';
import { Flexible, Row, Rule, Screen, Tap } from '../src/ui/primitives';
import { TabBar } from '../src/ui/TabBar';
import { Toast } from '../src/ui/Toast';

/**
 * Home.
 *
 * One hero number — what today can still cost — then four rule-separated
 * sections, each a summary that opens the screen behind it. This is the
 * simplified home the design landed on: no envelope bar, no activity feed, no
 * calendar strip, and whitespace plus rules where the cards used to be.
 */
export default function HomeScreen() {
  const { snapshot, projection, toast, dismissToast } = useLoadedRunway();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!snapshot.setupComplete) return <Redirect href="/onboarding" />;

  const { semester, fund, jobs } = snapshot;
  const bars = categoryBars(snapshot).slice(0, 4);
  const weeksToTrip = Math.max(0, weeksBetween(semester.today, fund.occasion));
  const progress = fundProgress(fund, weeksToTrip);
  const { delivery, boba } = homeStreaks(snapshot);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* The hero. Tapping the number is the same as tapping Runway — it's the
            same envelope, seen two ways. */}
        <Tap
          onPress={() => router.push('/runway')}
          style={{ paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 22 }}>
          <Row>
            <T w={700} size={12} color={colors.muted}>
              {weekdayDate(semester.today)}
            </T>
            <T w={700} size={12} color={colors.muted}>
              day {projection.dayIndex + 1} of {projection.totalDays}
            </T>
          </Row>

          <T w={600} size={15} color={colors.muted} style={{ marginTop: 26 }}>
            Left to spend today
          </T>
          <T w={800} size={96} tracking={-0.05} lh={0.95}>
            {cents(projection.leftToday)}
          </T>
          <T w={600} size={15} color={colors.muted} style={{ marginTop: 10 }}>
            of {money(projection.safeDaily)} safe · {cents(projection.todaySpent)} spent
          </T>
        </Tap>

        <Section kicker="Runway" onPress={() => router.push('/runway')}>
          <Row align="baseline" gap={10} style={{ marginTop: 8, justifyContent: 'flex-start' }}>
            <T
              w={800}
              size={34}
              tracking={-0.03}
              lh={1}
              nowrap
              color={projection.madeIt ? colors.green : colors.red}>
              {projection.madeIt ? `${shortDate(semester.endDate)} ✓` : shortDate(projection.runOutDate)}
            </T>
            <T w={600} size={13} color={colors.muted}>
              empties at ${snapshot.observedDailyPace}/day
            </T>
          </Row>
          <View style={{ marginTop: 12 }}>
            <HeatStrip projection={projection} />
          </View>
          <StripAxis start={shortDate(semester.startDate)} end={shortDate(semester.endDate)} />
        </Section>

        <Section kicker="Next paychecks" onPress={() => router.push('/jobs')}>
          <View style={{ marginTop: 10, gap: 8 }}>
            {jobs.map((job) => (
              <Row key={job.id} gap={12}>
                <Flexible>
                  <T w={600} size={15}>
                    {job.name} · {job.hoursPerWeek} h/wk
                  </T>
                </Flexible>
                <T w={800} size={15} color={colors.green} nowrap>
                  {signedMoney(job.nextPayAmount)} · {shortDate(job.nextPayDate)}
                </T>
              </Row>
            ))}
          </View>
        </Section>

        <Section kicker={`Spending · ${money(projection.spent)}`} onPress={() => router.push('/spend')}>
          <View style={{ marginTop: 12, gap: 7 }}>
            {bars.map((bar) => (
              <BarRow
                key={bar.name}
                label={bar.name}
                amount={bar.label}
                width={bar.width}
                top={bar.top}
              />
            ))}
          </View>
        </Section>

        <Section
          kicker={`${fund.label} · with ${fund.members.filter((m) => !m.isYou).map((m) => m.name).join(' + ')}`}
          onPress={() => router.push('/friends')}>
          <Row align="baseline" gap={10} style={{ marginTop: 8, justifyContent: 'flex-start' }}>
            <T w={800} size={34} tracking={-0.03} lh={1}>
              {money(progress.contributed)}
            </T>
            <T w={600} size={13} color={colors.muted}>
              of {money(fund.targetAmount)} · {weeksToTrip} weeks left
            </T>
          </Row>

          <View style={{ marginTop: 10, height: 8, flexDirection: 'row', backgroundColor: colors.ruleSoft }}>
            {progress.members.map((member, index) => (
              <View
                key={member.id}
                style={{
                  width: member.share,
                  backgroundColor: member.isYou ? colors.ink : index === 1 ? colors.green : colors.tan,
                }}
              />
            ))}
          </View>

          <T w={600} size={14} color={colors.muted} style={{ marginTop: 12 }}>
            {delivery?.label}{' '}
            <T w={800} size={14} color={colors.green}>
              {delivery?.youStreakDays} days
            </T>{' '}
            · {boba?.label.split(' · ')[0]}{' '}
            <T w={800} size={14} color={boba?.broken ? colors.red : colors.green}>
              {boba?.youStreakDays} days
            </T>
          </T>
        </Section>

        <Rule />
      </ScrollView>

      {toast ? <Toast message={toast} onDismiss={dismissToast} /> : null}

      <TabBar current="home" />

      {/* The menu and its button come last so the scrim dims the tab bar too. */}
      {menuOpen ? (
        <AddMenu
          bottom={164}
          onDismiss={() => setMenuOpen(false)}
          actions={[
            {
              id: 'scan',
              icon: 'camera',
              title: 'Scan a receipt',
              sublabel: 'price + envelope read for you',
              onPress: () => {
                setMenuOpen(false);
                router.push('/scan');
              },
            },
            {
              id: 'whatif',
              icon: '?',
              title: 'What if I…',
              sublabel: 'ask before you buy',
              onPress: () => {
                setMenuOpen(false);
                router.push('/chat');
              },
            },
            {
              id: 'fund',
              icon: '→',
              title: `Put $20 toward the trip`,
              sublabel: `${money(projection.safeDaily)}/day becomes ${money(
                (projection.free - 20) / projection.daysLeft,
              )}`,
              onPress: () => {
                setMenuOpen(false);
                router.push('/friends');
              },
            },
          ]}
        />
      ) : null}

      <AddButton open={menuOpen} bottom={96} onToggle={() => setMenuOpen((open) => !open)} />
    </Screen>
  );
}
