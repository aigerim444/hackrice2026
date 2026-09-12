import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { shortDate, weeksBetween } from '../src/domain/dates';
import { money, rate as formatRate, signedMoney } from '../src/domain/format';
import { useLoadedRunway } from '../src/state/RunwayProvider';
import { colors, GUTTER, RULE } from '../src/theme/tokens';
import { Kicker, T } from '../src/theme/type';
import { BackLink, InkBlock } from '../src/ui/blocks';
import { InkSlider, OutlineButton, Segment, SliderAxis } from '../src/ui/controls';
import { Row, Screen } from '../src/ui/primitives';

const MAX_HOURS = 24;

/**
 * Jobs what-if.
 *
 * More than one campus job is the normal case, so hours are per-job: the slider
 * moves the selected job while the other stays put, and the summary always
 * reports across both. Cadence matters too — two paychecks landing on different
 * days is exactly what makes the run-out date wander.
 */
export default function JobsScreen() {
  const { snapshot, projection, baseline, setJobHours } = useLoadedRunway();
  const { jobs, semester, observedDailyPace } = snapshot;

  const [selectedId, setSelectedId] = useState(jobs[0]?.id ?? '');
  const selected = jobs.find((job) => job.id === selectedId) ?? jobs[0];
  const others = jobs.filter((job) => job.id !== selected.id);

  const paidWeeks = Math.max(1, weeksBetween(semester.today, semester.lastPaidWeek));
  const extraWeekly = jobs.reduce(
    (sum, job) => sum + (job.hoursPerWeek - job.baselineHoursPerWeek) * job.hourlyRate,
    0,
  );
  const totalHours = jobs.reduce((sum, job) => sum + job.hoursPerWeek, 0);
  const deltaDays = projection.runOutIndex - baseline.runOutIndex;

  const verdict = projection.madeIt
    ? `That covers you through finals, with ${money(
        projection.free + projection.futureJobIncome - observedDailyPace * projection.daysLeft,
      )} to spare.`
    : deltaDays > 0
      ? `Closer. About ${Math.ceil(
          (projection.daysShort * observedDailyPace) / (selected.hourlyRate * paidWeeks),
        )} more hours a week and you clear ${shortDate(semester.endDate)}.`
      : deltaDays < 0
        ? 'Fewer shifts pulls the date toward Halloween. Pair it with a no-delivery week to offset.'
        : 'Current schedule. Bump either slider to see what two extra shifts do.';

  return (
    <Screen>
      <BackLink label="Jobs" onPress={() => router.back()} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: GUTTER, paddingTop: 14 }}>
          <T w={800} size={30} tracking={-0.02} lh={1.05}>
            If I work more…
          </T>
          <T w={600} size={14} color={colors.muted} style={{ marginTop: 6 }}>
            Pick a job, drag its hours. The envelope refills.
          </T>
        </View>

        <Segment
          style={{ marginHorizontal: GUTTER, marginTop: 14 }}
          selectedId={selected.id}
          onSelect={setSelectedId}
          options={[...jobs.map((job) => ({ id: job.id, label: job.name })), { id: 'add', label: '+ Add', disabled: true }]}
        />

        <View style={{ marginHorizontal: GUTTER, marginTop: 10, paddingTop: 6 }}>
          <Row align="baseline">
            <T w={700} size={12} color={colors.muted}>
              {selected.name} · hours / week
            </T>
            <T w={800} size={40} tracking={-0.03} lh={1} nowrap>
              {selected.hoursPerWeek}
              <T w={600} size={14} color={colors.muted}>
                {' '}
                h
              </T>
            </T>
          </Row>

          <InkSlider
            value={selected.hoursPerWeek}
            min={0}
            max={MAX_HOURS}
            step={1}
            onChange={(hours) => setJobHours(selected.id, hours)}
            style={{ marginTop: 4, marginBottom: 2 }}
          />
          <SliderAxis
            labels={['0 h', `now: ${selected.baselineHoursPerWeek} h`, `${MAX_HOURS} h max`]}
          />

          <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, paddingVertical: 8 }}>
              <T w={700} size={11} color={colors.muted}>
                Rate
              </T>
              <T w={800} size={18} lh={1.1}>
                {formatRate(selected.hourlyRate)}
              </T>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.sage, paddingVertical: 8, paddingHorizontal: 12 }}>
              <T w={700} size={11} color={colors.muted}>
                Extra / week · all jobs
              </T>
              <T w={800} size={18} lh={1.1} color={colors.green}>
                {signedMoney(extraWeekly)}
              </T>
            </View>
          </View>

          <Row
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTopWidth: RULE,
              borderStyle: 'dashed',
              borderColor: colors.sand,
            }}>
            <T w={700} size={12} color={colors.muted} nowrap>
              {others
                .map(
                  (job) =>
                    `${job.name} stays at ${job.hoursPerWeek} h · ${money(
                      job.hoursPerWeek * job.hourlyRate,
                    )}/wk`,
                )
                .join(' · ')}
            </T>
            <T w={700} size={12} color={colors.muted} nowrap>
              All jobs: {totalHours} h
            </T>
          </Row>
        </View>

        <InkBlock style={{ marginHorizontal: GUTTER, marginTop: 14, paddingVertical: 14 }}>
          <Kicker color={colors.cream} opacity={0.65}>
            Free-to-spend empties
          </Kicker>
          <Row align="baseline" gap={12} style={{ justifyContent: 'flex-start' }}>
            <T
              w={800}
              size={44}
              tracking={-0.03}
              lh={1}
              nowrap
              color={projection.madeIt ? colors.mint : colors.coral}>
              {projection.madeIt ? `${shortDate(semester.endDate)} ✓` : shortDate(projection.runOutDate)}
            </T>
            <T w={600} size={14} color={colors.cream} opacity={0.8}>
              {deltaDays === 0
                ? 'same as now'
                : `${deltaDays > 0 ? '+' : '−'}${Math.abs(deltaDays)} days vs now`}
            </T>
          </Row>
          <T w={600} size={13} lh={1.35} color={colors.cream} opacity={0.9} style={{ marginTop: 8 }}>
            {verdict}
          </T>
        </InkBlock>

        <View style={{ paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 30 }}>
          <OutlineButton label="Keep this plan" trailing="→" onPress={() => router.replace('/')} />
        </View>
      </ScrollView>
    </Screen>
  );
}
