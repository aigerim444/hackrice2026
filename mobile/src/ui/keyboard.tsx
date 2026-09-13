import { InputAccessoryView, Keyboard, Platform, Pressable, View } from 'react-native';

import { colors, GUTTER, RULE } from '../theme/tokens';
import { T } from '../theme/type';

/**
 * Getting out of the keyboard.
 *
 * The trapped case is the numeric one: on iOS a `number-pad` or `decimal-pad`
 * keyboard has **no return key at all**, so a field asking for a dollar amount
 * gives you no way to put the keyboard away — it just sits over the rest of the
 * form, including the Save button you were reaching for.
 *
 * Three ways out, so whichever one you reach for first works:
 *
 * 1. A **Done** bar above numeric keyboards (this file). iOS only, because it's
 *    the only platform with the problem — Android has a system back gesture and
 *    web has Escape and click-away.
 * 2. **Return** dismisses text fields (`fieldProps` below).
 * 3. **Swiping down** over a scrolling form dismisses it
 *    (`keyboardDismissMode="on-drag"` on the ScrollView).
 */

const ACCESSORY_ID = 'runway-keyboard-done';

/** Whether this platform needs the accessory bar at all. */
const NEEDS_ACCESSORY = Platform.OS === 'ios';

/**
 * Spread onto a numeric `TextInput` to attach the Done bar.
 *
 * Empty off iOS, so it costs nothing and needs no branching at the call site.
 */
export const numericKeyboardProps = NEEDS_ACCESSORY
  ? ({ inputAccessoryViewID: ACCESSORY_ID } as const)
  : ({} as const);

/**
 * Spread onto a text `TextInput` so Return closes the keyboard rather than
 * doing nothing. `blurOnSubmit` is what actually dismisses it; `returnKeyType`
 * just makes the key say "Done" instead of "Return".
 */
export const textKeyboardProps = {
  returnKeyType: 'done',
  blurOnSubmit: true,
  onSubmitEditing: () => Keyboard.dismiss(),
} as const;

/**
 * The bar itself. Rendered **once**, at the root — `nativeID` has to be unique,
 * and a copy per screen would collide the moment two screens are mounted at the
 * same time.
 */
export function KeyboardDoneBar() {
  if (!NEEDS_ACCESSORY) return null;

  return (
    <InputAccessoryView nativeID={ACCESSORY_ID}>
      <View
        style={{
          backgroundColor: colors.cream,
          borderTopWidth: RULE,
          borderColor: colors.ink,
          paddingHorizontal: GUTTER,
          paddingVertical: 8,
          alignItems: 'flex-end',
        }}>
        <Pressable
          onPress={() => Keyboard.dismiss()}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Close the keyboard"
          style={({ pressed }) => ({
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderWidth: RULE,
            borderColor: colors.ink,
            backgroundColor: pressed ? colors.sand : colors.white,
          })}>
          <T w={800} size={14}>
            Done
          </T>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}
