import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { shortDate, weeksBetween } from '../src/domain/dates';
import { money, pct } from '../src/domain/format';
import {
  challengeCaption,
  challengeWith,
  fundProgress,
  invitable,
  primaryFund,
} from '../src/domain/selectors';
import type { Challenge, ChallengeDraft, Fund, FundDraft, Person } from '../src/domain/types';
import { useLoadedRunway } from '../src/state/RunwayProvider';
import { colors, GUTTER, RULE } from '../src/theme/tokens';
import { T } from '../src/theme/type';
import { SectionHeading } from '../src/ui/blocks';
import { OutlineButton, PrimaryButton } from '../src/ui/controls';
import { AddRow, ChallengeForm, GoalForm, PeoplePicker } from '../src/ui/forms';
import { Flexible, Row, Screen, Tap } from '../src/ui/primitives';
import { TabBar } from '../src/ui/TabBar';
import { Toast } from '../src/ui/Toast';

const MOVE_AMOUNT = 20;

/**
 * Friends.
 *
 * Two different things, deliberately kept apart: a **fund** is real money —
 * pledged weekly and carved out of your runway up front — while a **challenge**
 * is a streak with no dollars attached. Skipping a boba doesn't pay for a trip.
 *
 * Both can have other people in them, and both say who put them there. Nobody
 * appears on this screen the app invented: they're in your list because you
 * invited them, or because they invited you.
 */
export default function FriendsScreen() {
  const {
    snapshot,
    projection,
    contributeToFund,
    addFund,
    addChallenge,
    inviteToFund,
    inviteToChallenge,
    toast,
    dismissToast,
  } = useLoadedRunway();
  const { challenges, semester, funds, people } = snapshot;

  const [moving, setMoving] = useState<string | null>(null);
  const [addingGoal, setAddingGoal] = useState(false);
  const [addingChallenge, setAddingChallenge] = useState(false);
  /** Which fund or challenge has its invite picker open. */
  const [inviting, setInviting] = useState<string | null>(null);

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

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <T w={800} size={22} style={{ paddingHorizontal: GUTTER, paddingTop: 10 }}>
          Friends
        </T>

        {/* Who these people are, so no name on this screen comes from nowhere. */}
        <PeopleStrip people={people} />

        {featured ? (
          <FeaturedFund
            fund={featured}
            today={semester.today}
            dailyAfter={money(projection.safeDaily)}
            busy={moving === featured.id}
            onMove={() => move(featured.id)}
            invitable={invitable(snapshot, featured.members.map((m) => m.id))}
            inviteOpen={inviting === featured.id}
            onToggleInvite={() => setInviting(inviting === featured.id ? null : featured.id)}
            onInvite={async (ids) => {
              setInviting(null);
              await inviteToFund(featured.id, ids);
            }}
          />
        ) : !addingGoal ? (
          <T
            w={600}
            size={15}
            lh={1.45}
            color={colors.muted}
            style={{ marginHorizontal: GUTTER, marginTop: 18 }}>
            Nothing set aside yet. A goal takes a weekly pledge out before your daily number, so the
            money is there when you need it — on your own or split with someone.
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
            <GoalForm
              today={semester.today}
              people={people}
              onCancel={() => setAddingGoal(false)}
              onSave={async (draft: FundDraft) => {
                setAddingGoal(false);
                await addFund(draft);
              }}
            />
          ) : (
            <AddRow
              label={funds.length ? '+ Another goal' : '+ Add a goal'}
              onPress={() => setAddingGoal(true)}
            />
          )}
        </View>

        <SectionHeading title="Challenges" note="streaks, not dollars" style={{ marginTop: 22 }} />

        <View style={{ marginHorizontal: GUTTER, marginTop: 8, gap: 8 }}>
          {challenges.map((challenge) => (
            <ChallengeRow
              key={challenge.id}
              challenge={challenge}
              invitable={invitable(snapshot, challenge.participants.map((p) => p.id))}
              inviteOpen={inviting === challenge.id}
              onToggleInvite={() =>
                setInviting(inviting === challenge.id ? null : challenge.id)
              }
              onInvite={async (ids) => {
                setInviting(null);
                await inviteToChallenge(challenge.id, ids);
              }}
            />
          ))}

          {addingChallenge ? (
            <ChallengeForm
              today={semester.today}
              people={people}
              onCancel={() => setAddingChallenge(false)}
              onSave={async (draft: ChallengeDraft) => {
                setAddingChallenge(false);
                await addChallenge(draft);
              }}
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

/** The people you can pull into anything on this screen. */
function PeopleStrip({ people }: { people: Person[] }) {
  if (!people.length) return null;

  return (
    <View style={{ marginTop: 12 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 8, alignItems: 'center' }}>
        {people.map((person) => (
          <View key={person.id} style={{ alignItems: 'center', gap: 4, width: 46 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderWidth: RULE,
                borderColor: colors.ink,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <T w={800} size={15}>
                {person.initial}
              </T>
            </View>
            <T w={600} size={11} color={colors.muted} nowrap>
              {person.name}
            </T>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** A collapsible invite picker with its own confirm button. */
function InvitePanel({
  people,
  onCancel,
  onInvite,
}: {
  people: Person[];
  onCancel: () => void;
  onInvite: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <View
      style={{
        marginTop: 10,
        borderWidth: RULE,
        borderColor: colors.ink,
        backgroundColor: colors.white,
        padding: 14,
        gap: 12,
      }}>
      <PeoplePicker
        people={people}
        selected={selected}
        onToggle={(id) =>
          setSelected((current) =>
            current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
          )
        }
        emptyNote="Everyone you know is already in this one."
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <OutlineButton label="Cancel" height={40} onPress={onCancel} style={{ flex: 1 }} />
        <View
          style={{ flex: 1, opacity: selected.length ? 1 : 0.4 }}
          pointerEvents={selected.length ? 'auto' : 'none'}>
          <PrimaryButton label="Send invites" height={40} onPress={() => onInvite(selected)} />
        </View>
      </View>
    </View>
  );
}

/** The soonest goal, in full: who's in, how far along, and how to add to it. */
function FeaturedFund({
  fund,
  today,
  dailyAfter,
  busy,
  onMove,
  invitable: canInvite,
  inviteOpen,
  onToggleInvite,
  onInvite,
}: {
  fund: Fund;
  today: string;
  dailyAfter: string;
  busy: boolean;
  onMove: () => void;
  invitable: Person[];
  inviteOpen: boolean;
  onToggleInvite: () => void;
  onInvite: (ids: string[]) => void;
}) {
  const weeksLeft = Math.max(0, weeksBetween(today, fund.occasion));
  const progress = fundProgress(fund, weeksLeft);
  const you = fund.members.find((member) => member.isYou);
  const pending = fund.members.filter((member) => member.status === 'invited');

  return (
    <>
      <SectionHeading
        title={`${fund.label} · ${shortDate(fund.occasion)}`}
        note={fund.startedBy ? `${fund.startedBy} started this` : 'you started this'}
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

        <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {progress.members.map((member) => (
            <View key={member.id} style={{ minWidth: 92, flexGrow: 1, flexBasis: '28%' }}>
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
            label={busy ? 'Moving…' : `Put $${MOVE_AMOUNT} in now`}
            height={44}
            onPress={onMove}
            style={{ flex: 1 }}
          />
          <OutlineButton
            label={inviteOpen ? 'Close' : 'Invite'}
            height={44}
            onPress={onToggleInvite}
            style={{ flex: 1 }}
          />
        </View>

        {inviteOpen ? (
          <InvitePanel people={canInvite} onCancel={onToggleInvite} onInvite={onInvite} />
        ) : null}
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
        {pending.length
          ? ` Waiting on ${pending.map((member) => member.name).join(' and ')} to accept.`
          : ''}
      </T>

      <Tap onPress={() => router.push('/chat')} style={{ marginHorizontal: GUTTER, marginTop: 10 }}>
        <T w={800} size={13} color={colors.green}>
          Ask the coach about this →
        </T>
      </Tap>
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

/** One streak, with everyone running it and a way to pull more people in. */
function ChallengeRow({
  challenge,
  invitable: canInvite,
  inviteOpen,
  onToggleInvite,
  onInvite,
}: {
  challenge: Challenge;
  invitable: Person[];
  inviteOpen: boolean;
  onToggleInvite: () => void;
  onInvite: (ids: string[]) => void;
}) {
  const sub = [challengeWith(challenge), challenge.sublabel].filter(Boolean).join(' · ');

  return (
    <View style={{ borderBottomWidth: RULE, borderColor: colors.ruleSoft, paddingBottom: 12 }}>
      <Row gap={12} style={{ paddingTop: 12 }}>
        <Flexible>
          <T w={800} size={14}>
            {challenge.label}
          </T>
          <T w={600} size={12} color={colors.muted}>
            {challenge.broken ? `${sub} · you broke yours today` : sub}
          </T>
        </Flexible>
        <View style={{ alignItems: 'flex-end' }}>
          <T w={800} size={16} nowrap color={challenge.broken ? colors.red : colors.green}>
            {challenge.youStreakDays} days
          </T>
          <T w={600} size={11} color={colors.muted} nowrap>
            {challengeCaption(challenge)}
          </T>
        </View>
      </Row>

      <Tap onPress={onToggleInvite} hitSlop={8} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
        <T w={800} size={13} color={colors.green}>
          {inviteOpen ? 'Close' : '+ Invite someone'}
        </T>
      </Tap>

      {inviteOpen ? (
        <InvitePanel people={canInvite} onCancel={onToggleInvite} onInvite={onInvite} />
      ) : null}
    </View>
  );
}
