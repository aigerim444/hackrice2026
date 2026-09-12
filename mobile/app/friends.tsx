import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { weeksBetween } from '../src/domain/dates';
import { money } from '../src/domain/format';
import { fundProgress } from '../src/domain/selectors';
import { useLoadedRunway } from '../src/state/RunwayProvider';
import { colors, GUTTER, RULE } from '../src/theme/tokens';
import { T } from '../src/theme/type';
import { ListRow, SectionHeading } from '../src/ui/blocks';
import { OutlineButton, PrimaryButton } from '../src/ui/controls';
import { Row, Screen } from '../src/ui/primitives';
import { TabBar } from '../src/ui/TabBar';
import { Toast } from '../src/ui/Toast';

const MOVE_AMOUNT = 20;

/**
 * Friends.
 *
 * Two different things, deliberately kept apart: a **fund** is real money —
 * everyone pledges weekly and it's carved out of their runway up front — while a
 * **challenge** is a streak with no dollars attached. Skipping a boba doesn't
 * pay for a trip, and the design says so by never mixing the two.
 */
export default function FriendsScreen() {
  const { snapshot, projection, contributeToFund, toast, dismissToast } = useLoadedRunway();
  const { fund, challenges, semester } = snapshot;
  const [moving, setMoving] = useState(false);

  const weeksLeft = Math.max(0, weeksBetween(semester.today, fund.occasion));
  const progress = fundProgress(fund, weeksLeft);
  const you = fund.members.find((m) => m.isYou);

  const move = async () => {
    if (moving) return;
    setMoving(true);
    try {
      await contributeToFund(MOVE_AMOUNT);
    } finally {
      setMoving(false);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Row style={{ paddingHorizontal: GUTTER, paddingTop: 10 }}>
          <T w={800} size={22}>
            Friends
          </T>
          <View
            style={{
              width: 36,
              height: 36,
              borderWidth: RULE,
              borderColor: colors.ink,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <T w={800} size={22} lh={1}>
              +
            </T>
          </View>
        </Row>

        <SectionHeading title={`${fund.label} · Nov 20`} note="shared envelope" style={{ marginTop: 14 }} />

        <View
          style={{
            marginHorizontal: GUTTER,
            marginTop: 8,
            backgroundColor: colors.sage,
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}>
          <Row align="baseline" gap={10} style={{ justifyContent: 'flex-start' }}>
            <T w={800} size={48} tracking={-0.04} lh={1} fit>
              {money(progress.contributed)}
            </T>
            <T w={600} size={14} color={colors.muted} lh={1.3}>
              of {money(fund.targetAmount)} · {fund.members.length} people{'\n'}
              {weeksLeft} weeks left
            </T>
          </Row>

          <View
            style={{
              marginTop: 10,
              height: 12,
              flexDirection: 'row',
              backgroundColor: colors.white,
              borderWidth: RULE,
              borderColor: colors.ink,
            }}>
            {progress.members.map((member, index) => (
              <View
                key={member.id}
                style={{
                  width: member.share,
                  backgroundColor: member.isYou ? colors.ink : index === 1 ? colors.green : colors.tan,
                  ...(index > 0 ? { borderLeftWidth: RULE, borderColor: colors.ink } : null),
                }}
              />
            ))}
          </View>

          <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
            {progress.members.map((member) => (
              <View key={member.id} style={{ flex: 1 }}>
                <T w={800} size={12}>
                  {member.name}
                </T>
                <T w={800} size={17}>
                  {money(member.amount)}
                </T>
                <T w={600} size={12} color={colors.muted}>
                  {member.caption}
                </T>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
            <PrimaryButton
              label={moving ? 'Moving…' : `Put $${MOVE_AMOUNT} in now`}
              height={44}
              onPress={move}
              style={{ flex: 1 }}
            />
            <OutlineButton
              label="Ask the coach"
              height={44}
              onPress={() => router.push('/chat')}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {/* Plain language, on purpose: "Free to spend" is jargon the first time
            you meet it on this sheet. */}
        <T
          w={600}
          size={12}
          lh={1.35}
          color={colors.muted}
          style={{ marginHorizontal: GUTTER, marginTop: 8 }}>
          {fund.extraContributed
            ? `You've put an extra ${money(fund.extraContributed)} toward the trip this week. It came out of ` +
              `your spending money, so your daily number is now ${money(projection.safeDaily)}.`
            : `Your $${you?.weeklyPledge}/wk is already taken out before we calculate your daily number.`}
        </T>

        <SectionHeading title="Challenges" note="streaks, not dollars" style={{ marginTop: 22 }} />

        <View style={{ marginHorizontal: GUTTER, marginTop: 8, marginBottom: 24, gap: 8 }}>
          {challenges.map((challenge) => (
            <ListRow
              key={challenge.id}
              title={challenge.label}
              sublabel={
                challenge.broken && challenge.brokenSublabel
                  ? challenge.brokenSublabel
                  : challenge.sublabel
              }
              right={`${challenge.youStreakDays} days`}
              rightColor={challenge.broken ? colors.red : colors.green}
              rightSublabel={challenge.leaderCaption}
            />
          ))}
        </View>
      </ScrollView>

      {toast ? <Toast message={toast} onDismiss={dismissToast} /> : null}
      <TabBar current="friends" />
    </Screen>
  );
}
