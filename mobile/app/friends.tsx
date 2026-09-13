import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { supabaseExtras, usesSupabase } from '../src/data/client';
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
import { colors, fonts, GUTTER, RULE } from '../src/theme/tokens';
import { T } from '../src/theme/type';
import { SectionHeading } from '../src/ui/blocks';
import { OutlineButton, PrimaryButton } from '../src/ui/controls';
import { AddRow, ChallengeForm, FriendForm, GoalForm, PeoplePicker } from '../src/ui/forms';
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
    addPerson,
    inviteToFund,
    inviteToChallenge,
    toast,
    dismissToast,
    flash,
    refetch,
  } = useLoadedRunway();
  const { semester, people } = snapshot;

  const [moving, setMoving] = useState<string | null>(null);
  const [addingGoal, setAddingGoal] = useState(false);
  const [addingChallenge, setAddingChallenge] = useState(false);
  /** Which fund or challenge has its invite picker open. */
  const [inviting, setInviting] = useState<string | null>(null);
  const [addingFriend, setAddingFriend] = useState(false);

  const [savingFriend, setSavingFriend] = useState(false);
  const [friendError, setFriendError] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [savingChallenge, setSavingChallenge] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [invitingBusy, setInvitingBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // A fund/challenge whose only visible member is me, still 'invited', is
  // one I haven't accepted — an owner's own row never starts 'invited'
  // (hydrateFund/addChallenge always give it 'on track'/'joined'), so this
  // is reliable without a separate "who owns this" field on either type.
  const isPendingFund = (fund: Fund) => fund.members.find((m) => m.isYou)?.status === 'invited';
  const isPendingChallenge = (challenge: Challenge) =>
    challenge.participants.find((p) => p.isYou)?.status === 'invited';

  // Challenge has no startedBy field to declare (unlike Fund) — supabaseApi
  // still attaches one informally for exactly this read (see loadSnapshot).
  // Mock snapshots never set it, so this is always undefined there — every
  // mock challenge is "owned", which already matches how mock has always
  // behaved.
  const startedByOf = (challenge: Challenge) => (challenge as Challenge & { startedBy?: string }).startedBy;
  const isOwnFund = (fund: Fund) => !fund.startedBy;
  const isOwnChallenge = (challenge: Challenge) => !startedByOf(challenge);

  const pendingFunds = snapshot.funds.filter(isPendingFund);
  const pendingChallenges = snapshot.challenges.filter(isPendingChallenge);
  const funds = snapshot.funds.filter((f) => !isPendingFund(f));
  const challenges = snapshot.challenges.filter((c) => !isPendingChallenge(c));

  // primaryFund is a domain selector (untouched) — it has no idea what
  // "pending" means, so it only ever sees funds that are already mine to
  // act on. A fund I haven't accepted yet can't become "the" featured fund
  // with a live contribute button on it.
  const featured = primaryFund({ ...snapshot, funds });
  const others = funds.filter((fund) => fund.id !== featured?.id);

  const acceptFund = async (fundId: string) => {
    if (!supabaseExtras || accepting) return;
    setAccepting(fundId);
    setAcceptError(null);
    try {
      await supabaseExtras.acceptFundInvite(fundId);
      await refetch();
    } catch (e) {
      setAcceptError(e instanceof Error ? e.message : "Couldn't accept — try again.");
    } finally {
      setAccepting(null);
    }
  };

  const acceptChallenge = async (challengeId: string) => {
    if (!supabaseExtras || accepting) return;
    setAccepting(challengeId);
    setAcceptError(null);
    try {
      await supabaseExtras.acceptChallengeInvite(challengeId);
      await refetch();
    } catch (e) {
      setAcceptError(e instanceof Error ? e.message : "Couldn't accept — try again.");
    } finally {
      setAccepting(null);
    }
  };

  const extras = supabaseExtras;
  const inviteUserToFund = extras
    ? async (fundId: string, userId: string) => {
        await extras.inviteUserToFund(fundId, userId);
        await refetch();
      }
    : undefined;

  const inviteUserToChallenge = extras
    ? async (challengeId: string, userId: string) => {
        await extras.inviteUserToChallenge(challengeId, userId);
        await refetch();
      }
    : undefined;

  const move = async (fundId: string) => {
    if (moving) return;
    setMoving(fundId);
    try {
      await contributeToFund(fundId, MOVE_AMOUNT);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Couldn't move that — try again.");
    } finally {
      setMoving(null);
    }
  };

  const saveFriend = async (name: string) => {
    setSavingFriend(true);
    setFriendError(null);
    try {
      await addPerson(name);
      setAddingFriend(false);
    } catch (e) {
      setFriendError(e instanceof Error ? e.message : "Couldn't add them — try again.");
    } finally {
      setSavingFriend(false);
    }
  };

  const saveGoal = async (draft: FundDraft) => {
    setSavingGoal(true);
    setGoalError(null);
    try {
      await addFund(draft);
      setAddingGoal(false);
    } catch (e) {
      setGoalError(e instanceof Error ? e.message : "Couldn't add that goal — try again.");
    } finally {
      setSavingGoal(false);
    }
  };

  const saveChallenge = async (draft: ChallengeDraft) => {
    setSavingChallenge(true);
    setChallengeError(null);
    try {
      await addChallenge(draft);
      setAddingChallenge(false);
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : "Couldn't start that — try again.");
    } finally {
      setSavingChallenge(false);
    }
  };

  const sendFundInvites = async (fundId: string, ids: string[]) => {
    setInvitingBusy(true);
    setInviteError(null);
    try {
      await inviteToFund(fundId, ids);
      setInviting(null);
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Couldn't send those invites — try again.");
    } finally {
      setInvitingBusy(false);
    }
  };

  const sendChallengeInvites = async (challengeId: string, ids: string[]) => {
    setInvitingBusy(true);
    setInviteError(null);
    try {
      await inviteToChallenge(challengeId, ids);
      setInviting(null);
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Couldn't send those invites — try again.");
    } finally {
      setInvitingBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <T w={800} size={22} style={{ paddingHorizontal: GUTTER, paddingTop: 10 }}>
          Friends
        </T>

        {/* Everyone here is someone you added. Nothing arrives on its own. */}
        <SectionHeading
          title="Your people"
          note={people.length ? `${people.length} added` : undefined}
          style={{ marginTop: 16 }}
        />
        <PeopleStrip people={people} />
        <View style={{ marginHorizontal: GUTTER, marginTop: 10 }}>
          {addingFriend ? (
            <FriendForm
              known={people.map((person) => person.name)}
              onCancel={() => setAddingFriend(false)}
              onSave={saveFriend}
              saving={savingFriend}
              error={friendError}
            />
          ) : (
            <AddRow
              label={people.length ? '+ Add another friend' : '+ Add a friend'}
              onPress={() => setAddingFriend(true)}
            />
          )}
        </View>

        {usesSupabase && (pendingFunds.length || pendingChallenges.length) ? (
          <>
            <SectionHeading title="Invited you" style={{ marginTop: 22 }} />
            <View style={{ marginHorizontal: GUTTER, marginTop: 8, gap: 8 }}>
              {pendingFunds.map((fund) => (
                <PendingInviteRow
                  key={fund.id}
                  label={fund.label}
                  sublabel={
                    (fund.startedBy ? `${fund.startedBy} started this · ` : '') +
                    `${money(fund.targetAmount)} goal`
                  }
                  busy={accepting === fund.id}
                  onAccept={() => acceptFund(fund.id)}
                />
              ))}
              {pendingChallenges.map((challenge) => (
                <PendingInviteRow
                  key={challenge.id}
                  label={challenge.label}
                  sublabel={
                    startedByOf(challenge) ? `${startedByOf(challenge)} started this streak` : 'a streak challenge'
                  }
                  busy={accepting === challenge.id}
                  onAccept={() => acceptChallenge(challenge.id)}
                />
              ))}
              {acceptError ? (
                <T w={600} size={13} lh={1.35} color={colors.red}>
                  {acceptError}
                </T>
              ) : null}
            </View>
          </>
        ) : null}

        {featured ? (
          <FeaturedFund
            fund={featured}
            today={semester.today}
            dailyAfter={money(projection.safeDaily)}
            busy={moving === featured.id}
            onMove={() => move(featured.id)}
            invitable={isOwnFund(featured) ? invitable(snapshot, featured.members.map((m) => m.id)) : []}
            inviteOpen={inviting === featured.id}
            onToggleInvite={() => {
              setInviteError(null);
              setInviting(inviting === featured.id ? null : featured.id);
            }}
            onInvite={(ids) => sendFundInvites(featured.id, ids)}
            inviteBusy={invitingBusy}
            inviteError={inviteError}
            onInviteById={
              isOwnFund(featured) && inviteUserToFund ? (userId) => inviteUserToFund(featured.id, userId) : undefined
            }
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
              inviteNote={people.length ? undefined : 'Add a friend above to split this with someone.'}
              onCancel={() => setAddingGoal(false)}
              onSave={saveGoal}
              saving={savingGoal}
              error={goalError}
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
              invitable={
                isOwnChallenge(challenge) ? invitable(snapshot, challenge.participants.map((p) => p.id)) : []
              }
              inviteOpen={inviting === challenge.id}
              onToggleInvite={() => {
                setInviteError(null);
                setInviting(inviting === challenge.id ? null : challenge.id);
              }}
              onInvite={(ids) => sendChallengeInvites(challenge.id, ids)}
              inviteBusy={invitingBusy}
              inviteError={inviteError}
              onInviteById={
                isOwnChallenge(challenge) && inviteUserToChallenge
                  ? (userId) => inviteUserToChallenge(challenge.id, userId)
                  : undefined
              }
            />
          ))}

          {addingChallenge ? (
            <ChallengeForm
              today={semester.today}
              people={people}
              inviteNote={people.length ? undefined : 'Add a friend above to run this against someone.'}
              onCancel={() => setAddingChallenge(false)}
              onSave={saveChallenge}
              saving={savingChallenge}
              error={challengeError}
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
  if (!people.length) {
    return (
      <T
        w={600}
        size={14}
        lh={1.45}
        color={colors.muted}
        style={{ marginHorizontal: GUTTER, marginTop: 8 }}>
        Nobody yet. Add a friend and you can split a goal with them, or run a streak against each
        other.
      </T>
    );
  }

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
  busy,
  error,
  onInviteById,
}: {
  people: Person[];
  onCancel: () => void;
  onInvite: (ids: string[]) => void;
  busy?: boolean;
  error?: string | null;
  /** Real accounts (found by id, never email) — Supabase mode only. */
  onInviteById?: (userId: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [rawId, setRawId] = useState('');
  const [idBusy, setIdBusy] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);
  const canSend = selected.length > 0 && !busy;

  const sendById = async () => {
    if (!onInviteById || !rawId.trim() || idBusy) return;
    setIdBusy(true);
    setIdError(null);
    try {
      await onInviteById(rawId.trim());
      setRawId('');
    } catch (e) {
      setIdError(e instanceof Error ? e.message : "Couldn't invite that id — try again.");
    } finally {
      setIdBusy(false);
    }
  };

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
      {error ? (
        <T w={600} size={13} lh={1.35} color={colors.red}>
          {error}
        </T>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, opacity: busy ? 0.5 : 1 }} pointerEvents={busy ? 'none' : 'auto'}>
          <OutlineButton label="Cancel" height={40} onPress={onCancel} />
        </View>
        <View style={{ flex: 1, opacity: canSend ? 1 : 0.4 }} pointerEvents={canSend ? 'auto' : 'none'}>
          <PrimaryButton
            label={busy ? 'Sending…' : 'Send invites'}
            height={40}
            onPress={() => onInvite(selected)}
          />
        </View>
      </View>

      {onInviteById ? (
        <View style={{ borderTopWidth: RULE, borderColor: colors.ruleSoft, paddingTop: 12, gap: 8 }}>
          <T w={700} size={12} color={colors.muted}>
            Or invite a real account by user id
          </T>
          <Row gap={8}>
            <Flexible>
              <TextInput
                value={rawId}
                onChangeText={setRawId}
                placeholder="user id"
                placeholderTextColor={colors.tan}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  borderBottomWidth: RULE,
                  borderColor: colors.ink,
                  paddingVertical: 6,
                  fontFamily: fonts.semibold,
                  fontSize: 14,
                  color: colors.ink,
                }}
              />
            </Flexible>
            <View style={{ opacity: rawId.trim() && !idBusy ? 1 : 0.4 }} pointerEvents={rawId.trim() && !idBusy ? 'auto' : 'none'}>
              <PrimaryButton label={idBusy ? 'Inviting…' : 'Invite'} height={40} onPress={() => void sendById()} />
            </View>
          </Row>
          {idError ? (
            <T w={600} size={13} lh={1.35} color={colors.red}>
              {idError}
            </T>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** A fund or challenge you haven't accepted yet — one line, one button. */
function PendingInviteRow({
  label,
  sublabel,
  busy,
  onAccept,
}: {
  label: string;
  sublabel: string;
  busy: boolean;
  onAccept: () => void;
}) {
  return (
    <Row gap={12} style={{ backgroundColor: colors.sage, paddingHorizontal: 14, paddingVertical: 12 }}>
      <Flexible>
        <T w={800} size={15}>
          {label}
        </T>
        <T w={600} size={12} color={colors.muted}>
          {sublabel}
        </T>
      </Flexible>
      <View style={{ opacity: busy ? 0.5 : 1 }} pointerEvents={busy ? 'none' : 'auto'}>
        <OutlineButton label={busy ? 'Accepting…' : 'Accept'} height={36} onPress={onAccept} />
      </View>
    </Row>
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
  inviteBusy,
  inviteError,
  onInviteById,
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
  inviteBusy?: boolean;
  inviteError?: string | null;
  onInviteById?: (userId: string) => Promise<void>;
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
          {/* contributeToFund only ever moves the owner's own row today (see
              supabaseApi.ts) — offering it on a fund I've merely accepted an
              invite to would fail every time, confusingly. */}
          {!fund.startedBy ? (
            <PrimaryButton
              label={busy ? 'Moving…' : `Put $${MOVE_AMOUNT} in now`}
              height={44}
              onPress={onMove}
              style={{ flex: 1 }}
            />
          ) : null}
          {canInvite.length || inviteOpen || onInviteById ? (
            <OutlineButton
              label={inviteOpen ? 'Close' : 'Invite'}
              height={44}
              onPress={onToggleInvite}
              style={{ flex: 1 }}
            />
          ) : (
            <OutlineButton
              label="Ask the coach"
              height={44}
              onPress={() => router.push('/chat')}
              style={{ flex: 1 }}
            />
          )}
        </View>

        {inviteOpen ? (
          <InvitePanel
            people={canInvite}
            onCancel={onToggleInvite}
            onInvite={onInvite}
            busy={inviteBusy}
            error={inviteError}
            onInviteById={onInviteById}
          />
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

      {!fund.startedBy ? (
        <Pressable
          onPress={onMove}
          style={({ pressed }) => ({ marginTop: 10, alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}>
          <T w={800} size={13} color={colors.green}>
            {busy ? 'Moving…' : `+ Put $${MOVE_AMOUNT} in`}
          </T>
        </Pressable>
      ) : null}
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
  inviteBusy,
  inviteError,
  onInviteById,
}: {
  challenge: Challenge;
  invitable: Person[];
  inviteOpen: boolean;
  onToggleInvite: () => void;
  onInvite: (ids: string[]) => void;
  inviteBusy?: boolean;
  inviteError?: string | null;
  onInviteById?: (userId: string) => Promise<void>;
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

      {canInvite.length || inviteOpen || onInviteById ? (
        <Tap onPress={onToggleInvite} hitSlop={8} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
          <T w={800} size={13} color={colors.green}>
            {inviteOpen ? 'Close' : '+ Invite someone'}
          </T>
        </Tap>
      ) : null}

      {inviteOpen ? (
        <InvitePanel
          people={canInvite}
          onCancel={onToggleInvite}
          onInvite={onInvite}
          busy={inviteBusy}
          error={inviteError}
          onInviteById={onInviteById}
        />
      ) : null}
    </View>
  );
}
