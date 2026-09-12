import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { shortDate, weeksBetween } from '../src/domain/dates';
import { money, pct } from '../src/domain/format';
import { fundProgress, primaryFund } from '../src/domain/selectors';
import type { ChallengeDraft, Fund, FundDraft } from '../src/domain/types';
import { useLoadedRunway } from '../src/state/RunwayProvider';
import { colors, GUTTER, RULE } from '../src/theme/tokens';
import { T } from '../src/theme/type';
import { ListRow, SectionHeading } from '../src/ui/blocks';
import { OutlineButton, PrimaryButton } from '../src/ui/controls';
import { AddRow, ChallengeForm, GoalForm } from '../src/ui/forms';
import { Flexible, Row, Screen } from '../src/ui/primitives';
import { TabBar } from '../src/ui/TabBar';
import { Toast } from '../src/ui/Toast';

const MOVE_AMOUNT = 20;

/**
 * Friends.
 *
 * Two different things, deliberately kept apart: a **fund** is real money —
 * pledged weekly and carved out of your runway up front — while a **challenge**
 * is a streak with no dollars attached. Skipping a boba doesn't pay for a trip,
 * and the design says so by never mixing the two.
 *
 * The soonest fund gets the full treatment; anything else you're saving for
 * lists underneath.
 */
export default function FriendsScreen() {
  const { snapshot, projection, contributeToFund, addFund, addChallenge, toast, dismissToast } =
    useLoadedRunway();
  const { challenges, semester, funds } = snapshot;

  const [moving, setMoving] = useState<string | null>(null);
  const [addingGoal, setAddingGoal] = useState(false);
  const [addingChallenge, setAddingChallenge] = useState(false);

  const featured = primaryFund(snapshot);
  const others = funds.filter((fund) => fund.id !== featured?.id);

  const move = async (fundId: string) => {
    if (moving) return;
    setMoving(fundId);
    try {
      await contributeToFund(fundId, MOVE_AMOUNT);
    } finally {
      setMoving(null);
    }
  };

  const saveGoal = async (draft: FundDraft) => {
    setAddingGoal(false);
    await addFund(draft);
  };

  const saveChallenge = async (draft: ChallengeDraft) => {
    setAddingChallenge(false);
    await addChallenge(draft);
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <T w={800} size={22} style={{ paddingHorizontal: GUTTER, paddingTop: 10 }}>
          Friends
        </T>

        {featured ? (
          <FeaturedFund
            fund={featured}
            today={semester.today}
            dailyAfter={money(projection.safeDaily)}
            busy={moving === featured.id}
            onMove={() => move(featured.id)}
          />
        ) : !addingGoal ? (
          <T
            w={600}
            size={15}
            lh={1.45}
            color={colors.muted}
            style={{ marginHorizontal: GUTTER, marginTop: 18 }}>
            Nothing set aside yet. A goal takes a weekly pledge out before your daily number, so the
            money is there when you need it.
          </T>
        ) : null}

        {others.length ? (
          <>
            <SectionHeading title="Also saving for" style={{ marginTop: 22 }} />
            <View style={{ marginHorizontal: GUTTER, marginTop: 8, gap: 10 }}>
              {others.map((fund) => (
                <OtherFund
                  key={fund.id}
                  fund={fund}
                  today={semester.today}
                  busy={moving === fund.id}
                  onMove={() => move(fund.id)}
                />
              ))}
            </View>
          </>
        ) : null}

        <View style={{ marginHorizontal: GUTTER, marginTop: 14 }}>
          {addingGoal ? (
            <GoalForm today={semester.today} onCancel={() => setAddingGoal(false)} onSave={saveGoal} />
          ) : (
            <AddRow
              label={funds.length ? '+ Another goal' : '+ Add a goal'}
              onPress={() => setAddingGoal(true)}
            />
          )}
        </View>

        <SectionHeading
          title="Challenges"
          note="streaks, not dollars"
          style={{ marginTop: 22 }}
        />

        <View style={{ marginHorizontal: GUTTER, marginTop: 8, gap: 8 }}>
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

          {addingChallenge ? (
            <ChallengeForm
              today={semester.today}
              onCancel={() => setAddingChallenge(false)}
              onSave={saveChallenge}
            />
          ) : (
            <AddRow label="+ Add a challenge" onPress={() => setAddingChallenge(true)} />
          )}
        </View>
      </ScrollView>

      {toast ? <Toast message={toast} onDismiss={dismissToast} /> : null}
      <TabBar current="friends" />
    </Screen>
  );
}

/** The soonest goal, in full: who's in, how far along, and the way to add to it. */
function FeaturedFund({
  fund,
  today,
  dailyAfter,
  busy,
  onMove,
}: {
  fund: Fund;
  today: string;
  dailyAfter: string;
  busy: boolean;
  onMove: () => void;
}) {
  const weeksLeft = Math.max(0, weeksBetween(today, fund.occasion));
  const progress = fundProgress(fund, weeksLeft);
  const you = fund.members.find((member) => member.isYou);

  return (
    <>
      <SectionHeading
        title={`${fund.label} · ${shortDate(fund.occasion)}`}
        note={fund.shared ? 'shared envelope' : 'your envelope'}
        style={{ marginTop: 14 }}
      />

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
            of {money(fund.targetAmount)}
            {fund.members.length > 1 ? ` · ${fund.members.length} people` : ''}
            {'\n'}
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
            label={busy ? 'Moving…' : `Put $${20} in now`}
            height={44}
            onPress={onMove}
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
          ? `You've put an extra ${money(fund.extraContributed)} toward ${fund.label} this week. It came ` +
            `out of your spending money, so your daily number is now ${dailyAfter}.`
          : `Your $${you?.weeklyPledge ?? fund.weeklyPledge}/wk is already taken out before we calculate ` +
            `your daily number.`}
      </T>
    </>
  );
}

/** Any other goal — the same idea, one row tall. */
function OtherFund({
  fund,
  today,
  busy,
  onMove,
}: {
  fund: Fund;
  today: string;
  busy: boolean;
  onMove: () => void;
}) {
  const saved = fund.members.reduce((sum, member) => sum + member.contributed, 0);
  const weeksLeft = Math.max(0, weeksBetween(today, fund.occasion));

  return (
    <View style={{ borderBottomWidth: RULE, borderColor: colors.ruleSoft, paddingBottom: 12 }}>
      <Row gap={12}>
        <Flexible>
          <T w={800} size={15}>
            {fund.label}
          </T>
          <T w={600} size={12} color={colors.muted}>
            ${fund.weeklyPledge}/wk · {weeksLeft} weeks to {shortDate(fund.occasion)}
          </T>
        </Flexible>
        <T w={800} size={16} nowrap>
          {money(saved)}
          <T w={600} size={12} color={colors.muted}>
            {' '}
            / {money(fund.targetAmount)}
          </T>
        </T>
      </Row>

      <View style={{ marginTop: 8, height: 8, backgroundColor: colors.ruleSoft, flexDirection: 'row' }}>
        <View style={{ width: pct(saved, fund.targetAmount, 0), backgroundColor: colors.ink }} />
      </View>

      <Pressable
        onPress={onMove}
        style={({ pressed }) => ({ marginTop: 10, alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}>
        <T w={800} size={13} color={colors.green}>
          {busy ? 'Moving…' : `+ Put $${MOVE_AMOUNT} in`}
        </T>
      </Pressable>
    </View>
  );
}
