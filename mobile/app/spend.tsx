import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { cents, money } from '../src/domain/format';
import { categoryBars, todayItems } from '../src/domain/selectors';
import { useLoadedRunway } from '../src/state/RunwayProvider';
import { colors, GUTTER, RULE } from '../src/theme/tokens';
import { T } from '../src/theme/type';
import { BarRow } from '../src/ui/blocks';
import { DashedBox, FadeIn, Flexible, Row, Screen } from '../src/ui/primitives';
import { TabBar } from '../src/ui/TabBar';
import { Toast } from '../src/ui/Toast';

/**
 * Spend.
 *
 * Categories as bars, today as a list, and one observation at the bottom. The
 * pattern line is the point of the screen — a total tells you nothing you can
 * act on, "Fridays cost you $71, mostly delivery after 10 PM" does.
 */
export default function SpendScreen() {
  const { snapshot, projection, toast, dismissToast } = useLoadedRunway();
  const bars = categoryBars(snapshot);
  const today = todayItems(snapshot);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Row align="baseline" style={{ paddingHorizontal: GUTTER, paddingTop: 10 }}>
          <T w={800} size={22}>
            Spend
          </T>
          <T w={700} size={12} color={colors.muted} nowrap>
            {projection.dayIndex + 1} days · {money(projection.spent)}
          </T>
        </Row>

        <View style={{ marginHorizontal: GUTTER, marginTop: 16, gap: 6 }}>
          {bars.map((bar) => (
            <BarRow
              key={bar.name}
              label={bar.name}
              amount={bar.label}
              width={bar.width}
              top={bar.top}
              labelWidth={96}
              amountWidth={52}
              barHeight={12}
            />
          ))}
        </View>

        <T w={800} size={16} style={{ marginHorizontal: GUTTER, marginTop: 22 }}>
          Today
        </T>

        <View style={{ marginHorizontal: GUTTER, marginTop: 8, gap: 8 }}>
          {today.length === 0 ? (
            <T w={600} size={14} lh={1.4} color={colors.muted}>
              Nothing logged today yet.
            </T>
          ) : null}
          {today.map((item) => (
            <FadeIn key={item.id}>
              <Row style={{ borderBottomWidth: RULE, borderColor: colors.ruleSoft, paddingVertical: 12 }}>
                <Flexible>
                  <T w={800} size={14}>
                    {item.merchant}
                  </T>
                  <T w={600} size={12} color={colors.muted}>
                    Free · {item.category}
                  </T>
                </Flexible>
                <T w={800} size={16} nowrap>
                  {cents(item.amount)}
                </T>
              </Row>
            </FadeIn>
          ))}

          <DashedBox onPress={() => router.push('/scan')}>
            <T w={800} size={14} color={colors.muted}>
              + Scan a receipt
            </T>
          </DashedBox>
        </View>

        <View
          style={{
            marginHorizontal: GUTTER,
            marginTop: 22,
            marginBottom: 24,
            borderTopWidth: RULE,
            borderColor: colors.ink,
            paddingTop: 12,
          }}>
          <T w={600} size={14} lh={1.4}>
            <T w={800} size={14}>
              Pattern:
            </T>{' '}
            Fridays cost you $71 on average — 2× a Tuesday. Most of it is delivery after 10 PM.
          </T>
        </View>
      </ScrollView>

      {toast ? <Toast message={toast} onDismiss={dismissToast} /> : null}
      <TabBar current="spend" />
    </Screen>
  );
}
