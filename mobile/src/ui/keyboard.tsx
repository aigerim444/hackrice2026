import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';

import { colors, GUTTER, RULE } from '../theme/tokens';
import { T } from '../theme/type';

/**
 * Getting out of the keyboard.
 *
 * The trapped case is numeric: a `number-pad` or `decimal-pad` keyboard has
 * **no return key**, so a field asking for a dollar amount left you with the
 * keyboard sitting over the rest of the form — including the Save button you
 * were reaching for.
 *
 * This was first built on `InputAccessoryView`, which is the "correct" iOS
 * answer and turned out not to show up reliably: it's iOS-only, and it depends
 * on where in the tree it's mounted relative to the input. Replaced with a
 * plain floating chip positioned off the real keyboard events — no platform
 * branch, no nativeID wiring, and it's visible on Android and web too.
 *
 * Three ways out, so whichever one you reach for first works:
 *
 * 1. The **Done** chip above the keyboard (this file).
 * 2. **Return** on text fields (`textKeyboardProps`).
 * 3. **Swiping down** over a scrolling form
 *    (`keyboardDismissMode="on-drag"` on the ScrollView).
 */

/**
 * Spread onto a text `TextInput` so Return closes the keyboard rather than
 * doing nothing. `blurOnSubmit` is what dismisses it; `returnKeyType` just
 * makes the key say "Done".
 */
export const textKeyboardProps = {
  returnKeyType: 'done',
  blurOnSubmit: true,
  onSubmitEditing: () => Keyboard.dismiss(),
} as const;

/**
 * Kept as an empty object so numeric inputs still have a spread point. The
 * accessory-view approach it used to carry is gone; the floating chip needs
 * nothing at the input.
 */
export const numericKeyboardProps = {} as const;

/** Where the keyboard's top edge is, or 0 when it's down. */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // `will*` fires early enough on iOS to animate with the keyboard; Android
    // only has `did*`.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (event) =>
      setHeight(event.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

/**
 * The chip. Mounted once at the root so it floats over every screen, and only
 * rendered while a keyboard is actually up.
 */
export function KeyboardDoneBar() {
  const keyboardHeight = useKeyboardHeight();
  if (!keyboardHeight) return null;

  return (
    <View
      // Only the chip itself is tappable; the rest of this row must not eat
      // taps meant for the form behind it.
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: keyboardHeight,
        paddingHorizontal: GUTTER,
        paddingVertical: 8,
        alignItems: 'flex-end',
        zIndex: 20,
      }}>
      <Pressable
        onPress={() => Keyboard.dismiss()}
        hitSlop={16}
        accessibilityRole="button"
        accessibilityLabel="Close the keyboard"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderWidth: RULE,
          borderColor: colors.ink,
          backgroundColor: pressed ? colors.sand : colors.cream,
        })}>
        <T w={800} size={14}>
          Done
        </T>
        <T w={800} size={14} color={colors.muted}>
          ✕
        </T>
      </Pressable>
    </View>
  );
}

/**
 * Wraps a screen so tapping any empty area puts the keyboard away — the thing
 * most people try first. `box-none` keeps it out of the way of everything
 * that's actually interactive.
 */
export function DismissKeyboardArea({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponder={() => {
        Keyboard.dismiss();
        // Never claim the gesture: this only listens, so buttons and scrolling
        // underneath keep working exactly as they did.
        return false;
      }}>
      {children}
    </View>
  );
}
