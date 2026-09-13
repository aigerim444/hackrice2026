import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../src/data/client';
import { shortDate } from '../src/domain/dates';
import { money } from '../src/domain/format';
import type { WrappedStats } from '../src/domain/wrapped';
import { scaleWidth } from '../src/theme/scale';
import { alpha, colors, GUTTER, RULE } from '../src/theme/tokens';
import { Kicker, T } from '../src/theme/type';
import { OutlineButton } from '../src/ui/controls';
import { FadeIn, Flexible, Row } from '../src/ui/primitives';

/**
 * Semester Wrapped — seven story cards, swiped like any other recap.
 *
 * Grounds alternate cream and ink so consecutive cards never blur together, and
 * every stat is something the ledger can actually prove. Money is either
 * *earned* or *saved*; the design refused to merge them into one triumphant
 * number, because they aren't the same thing.
 */

const CARD_COUNT = 7;

/** Which cards are drawn on ink. */
const DARK_CARDS = [false, true, true, true, false, true, false];

const HINTS = [
  'Tap → 2 of 7: the forecast',
  'Tap → 3 of 7: envelopes emptied',
  'Tap → 4 of 7: top category',
  'Tap → 5 of 7: your rhythm',
  'Tap → 6 of 7: friends',
  'Tap → 7 of 7: your card',
  "That's the semester.",
];

export default function WrappedScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<WrappedStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .getWrapped()
      .then((next) => {
        if (!cancelled) setStats(next);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load your recap.");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const dark = DARK_CARDS[index];
  const bg = dark ? colors.ink : colors.cream;
  const fg = dark ? colors.cream : colors.ink;
  const isLast = index === CARD_COUNT - 1;

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.cream,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}>
        <T w={800} size={20} center>
          Couldn&apos;t load Wrapped
        </T>
        <T w={600} size={14} color={colors.muted} center lh={1.4} style={{ marginTop: 8 }}>
          {error}
        </T>
        <View style={{ marginTop: 18, alignSelf: 'stretch', maxWidth: 200 }}>
          <OutlineButton label="Try again" height={46} onPress={() => setAttempt((n) => n + 1)} />
        </View>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top + 3 }}>
      <StatusBar style={dark ? 'light' : 'dark'} />

      {/* Progress dots. */}
      <Row style={{ paddingHorizontal: GUTTER, paddingTop: 10, gap: 4 }}>
        {Array.from({ length: CARD_COUNT }).map((_, dot) => (
          <View
            key={dot}
            style={{
              flex: 1,
              height: 4,
              backgroundColor:
                dot <= index ? fg : dark ? alpha.creamOn(0.3) : colors.sand,
            }}
          />
        ))}
      </Row>

      <Row style={{ paddingHorizontal: GUTTER, paddingTop: 14, zIndex: 3 }}>
        <Kicker color={fg} opacity={0.65}>
          {stats.semesterLabel} · Wrapped
        </Kicker>
        <Pressable onPress={() => router.replace('/you')} hitSlop={12}>
          <Kicker color={fg} opacity={0.65}>
            Close ✕
          </Kicker>
        </Pressable>
      </Row>

      <FadeIn replayKey={index} duration={250} style={{ flex: 1 }}>
        <Card index={index} stats={stats} fg={fg} dark={dark} />
      </FadeIn>

      <Row
        style={{
          paddingHorizontal: GUTTER,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 20) + 24,
        }}>
        <T w={600} size={13} color={fg} opacity={0.75}>
          {HINTS[index]}
        </T>
        <View style={{ borderWidth: RULE, borderColor: fg, paddingHorizontal: 12, paddingVertical: 6 }}>
          <T w={800} size={13} color={fg}>
            Share
          </T>
        </View>
      </Row>

      {/* Tap zones — back on the left third, forward on the rest. They stop short
          of the last card's buttons so those stay tappable. */}
      <Pressable
        accessibilityLabel="Previous card"
        onPress={() => setIndex((i) => Math.max(0, i - 1))}
        style={{ position: 'absolute', left: 0, top: 120, bottom: isLast ? 190 : 120, width: '40%' }}
      />
      <Pressable
        accessibilityLabel="Next card"
        onPress={() => setIndex((i) => Math.min(CARD_COUNT - 1, i + 1))}
        style={{ position: 'absolute', right: 0, top: 120, bottom: isLast ? 190 : 120, width: '60%' }}
      />
    </View>
  );
}

function Card({
  index,
  stats,
  fg,
  dark,
}: {
  index: number;
  stats: WrappedStats;
  fg: string;
  dark: boolean;
}) {
  switch (index) {
    case 0:
      return <LumpCard stats={stats} fg={fg} />;
    case 1:
      return <ForecastCard stats={stats} fg={fg} />;
    case 2:
      return <EnvelopesCard stats={stats} fg={fg} />;
    case 3:
      return <CategoryCard stats={stats} fg={fg} />;
    case 4:
      return <RhythmCard stats={stats} fg={fg} />;
    case 5:
      return <FriendsCard stats={stats} fg={fg} />;
    default:
      return <PosterCard stats={stats} fg={fg} dark={dark} />;
  }
}

/** 1 — the lump you started with. */
function LumpCard({ stats, fg }: { stats: WrappedStats; fg: string }) {
  const aidShare = `${Math.round((stats.aidAmount / stats.lump) * 100)}%` as const;

  return (
    <>
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 44 }}>
        <T w={600} size={15} color={fg} opacity={0.7}>
          On {shortDate(stats.startDate)} you had
        </T>
        <T w={800} size={96} tracking={-0.05} lh={0.95} color={fg} fit>
          {money(stats.lump)}
        </T>
        <T w={600} size={15} lh={1.4} color={fg} opacity={0.7} style={{ marginTop: 12, maxWidth: 300 }}>
          and {stats.totalDays} days to make it last. No paycheck coming — just this.
        </T>
      </View>

      <View
        style={{
          marginHorizontal: GUTTER,
          marginTop: 48,
          height: 72,
          flexDirection: 'row',
          borderWidth: RULE,
          borderColor: colors.ink,
        }}>
        <View style={{ width: aidShare, backgroundColor: colors.ink, padding: 8, paddingHorizontal: 10 }}>
          <T w={700} size={12} lh={1.2} color={colors.cream}>
            Aid refund
          </T>
          <T w={800} size={18} color={colors.cream}>
            {money(stats.aidAmount)}
          </T>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.white,
            padding: 8,
            paddingHorizontal: 10,
            borderLeftWidth: RULE,
            borderColor: colors.ink,
          }}>
          <T w={700} size={12} lh={1.2}>
            Summer
          </T>
          <T w={800} size={18}>
            {money(stats.summerAmount)}
          </T>
        </View>
      </View>

      <T
        w={600}
        size={15}
        lh={1.4}
        color={fg}
        opacity={0.7}
        style={{ marginHorizontal: GUTTER, marginTop: 12 }}>
        + two campus jobs that added{' '}
        <T w={800} size={15} color={colors.green}>
          {money(stats.campusEarnings)}
        </T>{' '}
        along the way — but you didn&apos;t know that yet.
      </T>
    </>
  );
}

/** 2 — the forecast, and how far it moved. */
function ForecastCard({ stats, fg }: { stats: WrappedStats; fg: string }) {
  const stepColor = { bad: colors.coral, flat: colors.cream, good: colors.mint };

  return (
    <>
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 30 }}>
        <T w={600} size={15} color={fg} opacity={0.8}>
          {shortDate(stats.forecastMadeOn)} we said you&apos;d run out
        </T>
        <T w={800} size={80} tracking={-0.04} lh={1} color={colors.coral}>
          {shortDate(stats.forecastRunOut)}
        </T>
        <T w={600} size={15} color={fg} opacity={0.8} style={{ marginTop: 26 }}>
          You ended with
        </T>
        <T w={800} size={80} tracking={-0.04} lh={1} color={colors.mint}>
          {shortDate(stats.actualRunOut)}
        </T>
      </View>

      <View style={{ marginHorizontal: GUTTER, marginTop: 32 }}>
        <Row>
          {['Sep', 'Oct', 'Nov', 'Dec'].map((month) => (
            <Kicker key={month} color={fg} opacity={0.65} style={{ letterSpacing: 11 * 0.06 }}>
              {month}
            </Kicker>
          ))}
        </Row>

        <View
          style={{
            marginTop: 8,
            height: 96,
            borderBottomWidth: RULE,
            borderColor: alpha.creamOn(0.35),
          }}>
          {stats.forecastSteps.map((step, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: `${step.left}%`,
                bottom: step.bottom,
                width: `${step.width}%`,
                height: 2,
                backgroundColor: stepColor[step.tone],
              }}
            />
          ))}
          {stats.forecastAnnotations.map((note) => (
            <T
              key={note.text}
              w={700}
              size={10}
              color={fg}
              opacity={0.8}
              nowrap
              style={{ position: 'absolute', left: `${note.left}%`, bottom: note.bottom }}>
              {note.text}
            </T>
          ))}
        </View>
      </View>

      <T w={600} size={17} lh={1.4} color={fg} opacity={0.9} style={{ marginHorizontal: GUTTER, marginTop: 28 }}>
        The date moved {stats.timesMoved} times. Twelve of them were shifts you logged.
      </T>
    </>
  );
}

/** 3 — where the money actually went. */
function EnvelopesCard({ stats, fg }: { stats: WrappedStats; fg: string }) {
  return (
    <>
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 30 }}>
        <T w={600} size={15} color={fg} opacity={0.7}>
          Your envelopes, emptied
        </T>
        <T w={800} size={72} tracking={-0.04} lh={0.95} color={fg}>
          {shortDate(stats.actualRunOut)}
        </T>
        <T w={600} size={15} lh={1.4} color={fg} opacity={0.7} style={{ marginTop: 10 }}>
          {money(stats.freeLeftOver)} left in Free-to-spend.
        </T>
      </View>

      <View style={{ marginHorizontal: GUTTER, marginTop: 28, gap: 8 }}>
        {stats.ledger.map((row) => {
          const dashed = row.tone === 'dashed';
          const text = dashed ? fg : colors.ink;
          return (
            <Row
              key={row.label}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderWidth: RULE,
                ...(dashed
                  ? { borderStyle: 'dashed' as const, borderColor: colors.tan }
                  : {
                      borderColor: colors.ink,
                      backgroundColor: row.tone === 'sage' ? colors.sage : colors.white,
                    }),
              }}>
              <Flexible>
                <T w={800} size={15} color={text}>
                  {row.label}
                </T>
                <T w={600} size={12} color={dashed ? text : colors.muted} opacity={dashed ? 0.7 : 1}>
                  {row.sublabel}
                </T>
              </Flexible>
              <T w={800} size={18} nowrap color={row.tone === 'sage' ? colors.green : text}>
                {row.amount}
              </T>
            </Row>
          );
        })}
      </View>
    </>
  );
}

/** 4 — the biggest envelope after rent. */
function CategoryCard({ stats, fg }: { stats: WrappedStats; fg: string }) {
  return (
    <>
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 30 }}>
        <T w={600} size={15} color={fg} opacity={0.7}>
          Your biggest envelope after rent
        </T>
        <T w={800} size={56} tracking={-0.04} lh={1} color={fg}>
          {stats.topCategory}
        </T>
        <Row align="baseline" gap={10} style={{ marginTop: 6, justifyContent: 'flex-start' }}>
          <T w={800} size={40} tracking={-0.03} lh={1} color={fg}>
            {money(stats.topCategoryAmount)}
          </T>
          <T w={600} size={14} color={fg} opacity={0.7}>
            · {stats.topCategoryReceipts} receipts · ${stats.topCategoryAverage.toFixed(2)} avg
          </T>
        </Row>
      </View>

      <View style={{ marginHorizontal: GUTTER, marginTop: 28, gap: 6 }}>
        {stats.categoryRanking.map((row, i) => (
          <View key={row.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <T w={700} size={14} color={fg} style={{ width: scaleWidth(100) }} nowrap>
              {row.name}
            </T>
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <View
                style={{
                  width: i === 0 ? '100%' : (`${row.share}%` as const),
                  height: 22,
                  ...(i === 0
                    ? { backgroundColor: colors.cream }
                    : { borderWidth: RULE, borderColor: colors.cream }),
                }}
              />
            </View>
            <T w={700} size={14} color={fg} style={{ width: scaleWidth(56) }} right nowrap>
              {money(row.amount)}
            </T>
          </View>
        ))}
      </View>

      <View
        style={{
          marginHorizontal: GUTTER,
          marginTop: 24,
          borderWidth: RULE,
          borderColor: colors.cream,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}>
        <T w={600} size={14} lh={1.4} color={fg}>
          <T w={800} size={14} color={fg}>
            Most-visited:
          </T>{' '}
          {stats.mostVisited}
        </T>
      </View>
    </>
  );
}

/** 5 — the week's shape. */
function RhythmCard({ stats, fg }: { stats: WrappedStats; fg: string }) {
  const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const peak = Math.max(...stats.weekdayShares);

  return (
    <>
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 30 }}>
        <T w={600} size={15} color={fg} opacity={0.7}>
          Your expensive day is
        </T>
        <T w={800} size={72} tracking={-0.04} lh={1} color={fg}>
          {stats.expensiveDay}
        </T>
        <T w={600} size={15} color={fg} opacity={0.7} style={{ marginTop: 8 }}>
          ${stats.expensiveDayAverage} on average — 2× a {stats.comparisonDay}.
        </T>
      </View>

      <View
        style={{
          marginHorizontal: GUTTER,
          marginTop: 30,
          height: 130,
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 6,
        }}>
        {stats.weekdayShares.map((share, i) => (
          <View
            key={days[i]}
            style={{
              flex: 1,
              height: `${share}%`,
              backgroundColor: share === peak ? colors.ink : colors.sand,
            }}
          />
        ))}
      </View>
      <View style={{ marginHorizontal: GUTTER, marginTop: 6, flexDirection: 'row', gap: 6 }}>
        {days.map((day) => (
          <T key={day} w={700} size={11} center color={fg} opacity={0.7} style={{ flex: 1 }}>
            {day}
          </T>
        ))}
      </View>

      <View style={{ marginHorizontal: GUTTER, marginTop: 26, flexDirection: 'row', gap: 10 }}>
        <StatBox
          fg={fg}
          kicker="Latest receipt"
          value={stats.latestReceiptTime}
          note={stats.latestReceiptNote}
        />
        <StatBox
          fg={fg}
          kicker="Cheapest week"
          value={money(stats.cheapestWeekAmount)}
          note={stats.cheapestWeekNote}
        />
      </View>
    </>
  );
}

function StatBox({
  fg,
  kicker,
  value,
  note,
}: {
  fg: string;
  kicker: string;
  value: string;
  note: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        borderWidth: RULE,
        borderColor: colors.ink,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}>
      <T w={700} size={11} color={fg} opacity={0.65}>
        {kicker}
      </T>
      <T w={800} size={18} lh={1.1} color={fg}>
        {value}
      </T>
      <T w={600} size={12} color={fg} opacity={0.7}>
        {note}
      </T>
    </View>
  );
}

/** 6 — the fund, and the streaks. */
function FriendsCard({ stats, fg }: { stats: WrappedStats; fg: string }) {
  return (
    <>
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 30 }}>
        <T w={600} size={15} color={fg} opacity={0.7}>
          {stats.fundLabel}
        </T>
        <T w={800} size={64} tracking={-0.04} lh={1} color={fg}>
          Funded
        </T>
        <T w={600} size={15} color={fg} opacity={0.7} style={{ marginTop: 8 }}>
          {money(stats.fundTarget)} by {shortDate(stats.fundedOn)} — two days early. {stats.fundNote}
        </T>
      </View>

      <View
        style={{
          marginHorizontal: GUTTER,
          marginTop: 24,
          height: 48,
          flexDirection: 'row',
          borderWidth: RULE,
          borderColor: colors.cream,
        }}>
        {stats.fundSplit.map((member, i) => (
          <View
            key={member.name}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: i === 0 ? colors.cream : i === 1 ? colors.mint : 'transparent',
              ...(i > 0 ? { borderLeftWidth: RULE, borderColor: colors.cream } : null),
            }}>
            <T w={800} size={14} color={i === 2 ? fg : colors.ink}>
              {member.name} {money(member.amount)}
            </T>
          </View>
        ))}
      </View>

      <T w={700} size={12} color={fg} opacity={0.65} style={{ marginHorizontal: GUTTER, marginTop: 28 }}>
        Longest streaks
      </T>

      <View style={{ marginHorizontal: GUTTER, marginTop: 8, gap: 8 }}>
        {stats.streaks.map((streak) => (
          <Row
            key={streak.label + streak.sublabel}
            gap={12}
            style={{
              borderWidth: RULE,
              borderColor: colors.cream,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}>
            <Flexible>
              <T w={800} size={14} color={fg}>
                {streak.label}
              </T>
              <T w={600} size={12} color={fg} opacity={0.7}>
                {streak.sublabel}
              </T>
            </Flexible>
            <T w={800} size={18} nowrap color={streak.record ? colors.mint : fg}>
              {streak.days} days
            </T>
          </Row>
        ))}
      </View>
    </>
  );
}

/** 7 — the shareable card, and the hook into next semester. */
function PosterCard({ stats, fg, dark }: { stats: WrappedStats; fg: string; dark: boolean }) {
  const tone = {
    ink: colors.cream,
    faded: alpha.creamOn(0.6),
    mint: colors.mint,
    empty: 'transparent',
  };

  return (
    <>
      <View
        style={{
          marginHorizontal: GUTTER,
          marginTop: 22,
          backgroundColor: colors.ink,
          paddingHorizontal: 20,
          paddingTop: 22,
          paddingBottom: 20,
        }}>
        <Row>
          <Kicker color={colors.cream} opacity={0.65}>
            Semester Runway
          </Kicker>
          <Kicker color={colors.cream} opacity={0.65}>
            {stats.semesterLabel}
          </Kicker>
        </Row>

        <T w={600} size={15} color={colors.cream} opacity={0.7} style={{ marginTop: 22 }}>
          {stats.posterName} made {money(stats.lump)} last
        </T>
        <T w={800} size={64} tracking={-0.04} lh={0.95} color={colors.cream}>
          {stats.totalDays} days
        </T>

        <View style={{ marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, columnGap: 16 }}>
          <PosterStat
            label={`Forecast · ${shortDate(stats.forecastMadeOn)}`}
            value={shortDate(stats.forecastRunOut)}
            color={colors.coral}
          />
          <PosterStat label="Actual" value={shortDate(stats.actualRunOut)} color={colors.mint} />
          <PosterStat label="Earned on campus" value={money(stats.campusEarnings)} />
          <PosterStat
            label="Longest streak"
            value={`${stats.streaks[0]?.days ?? 0} days`}
          />
        </View>

        <View
          style={{
            marginTop: 20,
            height: 12,
            flexDirection: 'row',
            borderWidth: RULE,
            borderColor: colors.cream,
          }}>
          {stats.envelopeSplit.map((slice, i) => (
            <View
              key={slice.label}
              style={{
                width: i === stats.envelopeSplit.length - 1 ? undefined : (`${slice.share}%` as const),
                flex: i === stats.envelopeSplit.length - 1 ? 1 : undefined,
                backgroundColor: tone[slice.tone],
                ...(i > 0 ? { borderLeftWidth: RULE, borderColor: colors.cream } : null),
              }}
            />
          ))}
        </View>
        <Row style={{ marginTop: 6 }}>
          {stats.envelopeSplit.map((slice) => (
            <T key={slice.label} w={700} size={11} color={colors.cream} opacity={0.65} nowrap>
              {slice.label}
            </T>
          ))}
        </Row>
      </View>

      <T
        w={600}
        size={14}
        lh={1.4}
        color={fg}
        opacity={0.8}
        style={{ marginHorizontal: GUTTER, marginTop: 28 }}>
        Spring lump lands {shortDate(stats.nextLumpDate)}. Want your envelopes pre-sorted from this
        semester?
      </T>

      <View style={{ flex: 1 }} />

      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: GUTTER, zIndex: 3 }}>
        <Pressable
          style={({ pressed }) => ({
            flex: 1,
            height: 52,
            backgroundColor: colors.ink,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}>
          <T w={800} size={15} color={colors.cream}>
            Share card
          </T>
        </Pressable>
        <Pressable
          onPress={() => router.replace('/onboarding')}
          style={({ pressed }) => ({
            flex: 1,
            height: 52,
            borderWidth: RULE,
            borderColor: dark ? colors.cream : colors.ink,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}>
          <T w={800} size={15} color={fg}>
            Set up spring
          </T>
        </Pressable>
      </View>
    </>
  );
}

function PosterStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ width: '46%' }}>
      <T w={700} size={11} color={colors.cream} opacity={0.65}>
        {label}
      </T>
      <T w={800} size={20} lh={1.1} color={color ?? colors.cream}>
        {value}
      </T>
    </View>
  );
}
