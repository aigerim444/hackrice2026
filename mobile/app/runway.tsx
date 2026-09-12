import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { shortDate } from '../src/domain/dates';
import { money, signedDays } from '../src/domain/format';
import { useLoadedRunway } from '../src/state/RunwayProvider';
import { scaleWidth } from '../src/theme/scale';
import { colors, GUTTER, RULE } from '../src/theme/tokens';
import { Kicker, T } from '../src/theme/type';
import { BackLink, HeatStrip, InkBlock, SectionHeading, StripAxis } from '../src/ui/blocks';
import { DashedBox, Flexible, Row, Screen } from '../src/ui/primitives';

/**
 * Runway — the Free-to-spend envelope, and why its date moved.
 *
 * The date alone is an accusation; the ledger under it is the useful part, so
 * every move is attributed to something you did, with the days it cost or
 * bought. The dashed row at the bottom is the fix, one tap from the diagnosis.
 */
export default function RunwayScreen() {
  const { snapshot, projection } = useLoadedRunway();
  const { semester, moves, observedDailyPace } = snapshot;

  const netDays = moves.reduce((sum, move) => sum + move.deltaDays, 0);
  const advice = projection.madeIt
    ? `You're covered through finals. Daily stays at ${money(projection.safeDaily)}.`
    : `Hold ${money(projection.safeDaily)}/day and it lasts to ${shortDate(semester.endDate)}. ` +
      `That's ${projection.daysShort} more days to cover at today's pace.`;

  return (
    <Screen>
      <BackLink label="Free-to-spend envelope" onPress={() => router.replace('/')} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <InkBlock style={{ marginHorizontal: GUTTER, marginTop: 16, paddingTop: 18 }}>
          <Kicker color={colors.cream} opacity={0.65}>
            At ${observedDailyPace}/day this envelope empties
          </Kicker>
          <T
            w={800}
            size={52}
            tracking={-0.04}
            lh={1}
            nowrap
            color={projection.madeIt ? colors.mint : colors.coral}>
            {projection.madeIt ? `${shortDate(semester.endDate)} ✓` : shortDate(projection.runOutDate)}
          </T>

          <View style={{ marginTop: 12 }}>
            <HeatStrip projection={projection} height={12} tone="dark" />
          </View>
          <StripAxis start={shortDate(semester.startDate)} end={shortDate(semester.endDate)} tone="dark" />

          <T w={600} size={14} lh={1.35} color={colors.cream} style={{ marginTop: 12 }}>
            {advice}
          </T>
        </InkBlock>

        <SectionHeading
          title="Why it moved this week"
          note={`net ${signedDays(netDays, 'days')}`}
          style={{ marginTop: 22 }}
        />

        <View style={{ marginHorizontal: GUTTER, marginTop: 8, gap: 8 }}>
          {moves.map((move) => (
            <Row
              key={move.id}
              gap={12}
              style={{
                backgroundColor: move.positive ? colors.sage : colors.white,
                borderBottomWidth: RULE,
                borderColor: colors.ruleSoft,
                paddingVertical: 12,
                justifyContent: 'flex-start',
              }}>
              <T
                w={800}
                size={15}
                color={move.positive ? colors.green : colors.red}
                style={{ minWidth: scaleWidth(50) }}>
                {signedDays(move.deltaDays)}
              </T>
              <Flexible>
                <T w={800} size={14}>
                  {move.title}
                </T>
                <T w={600} size={12} color={colors.muted}>
                  {move.sublabel}
                </T>
              </Flexible>
            </Row>
          ))}
        </View>

        <DashedBox
          onPress={() => router.push('/jobs')}
          style={{
            marginHorizontal: GUTTER,
            marginTop: 16,
            marginBottom: 24,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingVertical: 12,
          }}>
          {/* The one row in the design allowed to wrap — it's the argument, not a label. */}
          <T w={600} size={14} lh={1.35} style={{ flex: 1 }}>
            <T w={800} size={14}>
              Two extra shifts a week
            </T>{' '}
            refills this envelope to {shortDate(semester.endDate)}.
          </T>
          <View style={{ backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 8 }}>
            <T w={800} size={13} color={colors.cream} nowrap>
              Try it
            </T>
          </View>
        </DashedBox>
      </ScrollView>
    </Screen>
  );
}
