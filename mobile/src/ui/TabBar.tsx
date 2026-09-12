import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, GUTTER, HOME_INDICATOR_GAP, RULE } from '../theme/tokens';
import { T } from '../theme/type';

export type TabId = 'home' | 'spend' | 'friends' | 'you';

const TABS: { id: TabId; label: string; href: '/' | '/spend' | '/friends' | '/you' }[] = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'spend', label: 'Spend', href: '/spend' },
  { id: 'friends', label: 'Friends', href: '/friends' },
  { id: 'you', label: 'You', href: '/you' },
];

/**
 * Four tabs, no icons — uppercase labels on a strong rule, the current one in
 * ink and the rest in tan. The design kept four tabs and moved everything else
 * behind the + button.
 *
 * Each tab screen renders this itself rather than sitting inside a tab
 * navigator: the bar is part of the screen in the design, and `replace` keeps
 * the four of them as peers instead of stacking.
 */
export function TabBar({ current }: { current: TabId }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        borderTopWidth: RULE,
        borderColor: colors.ink,
        backgroundColor: colors.cream,
        flexDirection: 'row',
        paddingTop: 12,
        paddingHorizontal: GUTTER,
        paddingBottom: insets.bottom > 0 ? insets.bottom + 4 : HOME_INDICATOR_GAP,
      }}>
      {TABS.map((tab) => {
        const focused = tab.id === current;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={tab.label}
            disabled={focused}
            onPress={() => router.replace(tab.href)}
            style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.6 : 1 })}>
            <T w={700} size={11} tracking={0.06} caps center color={focused ? colors.ink : colors.tan}>
              {tab.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
