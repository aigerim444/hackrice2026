import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  View,
  type PressableProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, GUTTER, RULE, STATUS_BAR_GAP } from '../theme/tokens';

/**
 * A screen. Cream ground, content starting below the status bar at the same
 * distance the design left for it.
 */
export function Screen({
  children,
  background = colors.cream,
  style,
  edges = 'top',
}: {
  children: React.ReactNode;
  background?: string;
  style?: StyleProp<ViewStyle>;
  /** `none` for the full-bleed screens (the camera) that draw under the clock. */
  edges?: 'top' | 'none';
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        { flex: 1, backgroundColor: background },
        edges === 'top' ? { paddingTop: insets.top + STATUS_BAR_GAP } : null,
        style,
      ]}>
      {children}
    </View>
  );
}

/** Horizontal page padding — the design's 22px gutter. */
export function Gutter({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[{ paddingHorizontal: GUTTER }, style]} {...rest}>
      {children}
    </View>
  );
}

/**
 * A rule. The system has exactly two weights of the same 2px line: `strong`
 * between major sections, `soft` between rows of a list. Whitespace plus rules
 * is what replaced boxes when the design was simplified.
 */
export function Rule({
  tone = 'strong',
  dashed = false,
  color,
  style,
}: {
  tone?: 'strong' | 'soft';
  dashed?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          borderTopWidth: RULE,
          borderColor: color ?? (tone === 'strong' ? colors.ink : colors.ruleSoft),
          ...(dashed ? { borderStyle: 'dashed' as const } : null),
        },
        style,
      ]}
    />
  );
}

/** A row with its two ends pushed apart — the shape most of this design is made of. */
export function Row({
  children,
  align = 'center',
  gap,
  style,
  ...rest
}: ViewProps & { align?: ViewStyle['alignItems']; gap?: number }) {
  return (
    <View
      style={[
        { flexDirection: 'row', justifyContent: 'space-between', alignItems: align },
        gap !== undefined ? { gap } : null,
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

/**
 * The left half of a split row. Takes the slack and is allowed to wrap; the
 * right half stays on one line. Getting this wrong is what caused most of the
 * clipped-text rounds in the design review.
 */
export function Flexible({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[{ flex: 1, minWidth: 0 }, style]} {...rest}>
      {children}
    </View>
  );
}

/** A dashed ink-on-cream affordance: "+ Add a bill", "+ Another goal", "Redo setup". */
export function DashedBox({
  children,
  style,
  ...rest
}: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      style={({ pressed }) => [
        {
          borderWidth: RULE,
          borderStyle: 'dashed',
          borderColor: colors.tan,
          paddingVertical: 10,
          paddingHorizontal: 14,
          opacity: pressed ? 0.6 : 1,
        },
        style,
      ]}
      {...rest}>
      {children}
    </Pressable>
  );
}

/** A pressable that dims rather than highlights — there are no rounded ripples here. */
export function Tap({
  children,
  style,
  ...rest
}: PressableProps & { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.62 : 1 }, style]} {...rest}>
      {children}
    </Pressable>
  );
}

/**
 * The design's one animation: 6px up, fade in. Used for anything that arrives —
 * a parsed receipt, a chat bubble, a toast, a new Wrapped card.
 */
export function FadeIn({
  children,
  duration = 220,
  offset = 6,
  style,
  /** Change this to replay the animation (the Wrapped card index does). */
  replayKey,
}: {
  children: React.ReactNode;
  duration?: number;
  offset?: number;
  style?: StyleProp<ViewStyle>;
  replayKey?: string | number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [progress, duration, replayKey]);

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) },
          ],
        },
        style,
      ]}>
      {children}
    </Animated.View>
  );
}
