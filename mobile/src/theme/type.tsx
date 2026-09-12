import { Text, type TextProps, type TextStyle } from 'react-native';

import { MIN_LINE_HEIGHT, scaleFont } from './scale';
import { colors, fontFor, type FontWeight } from './tokens';

export type TProps = TextProps & {
  /** Baloo 2 face. Matches the design's font-weight values. */
  w?: FontWeight;
  /** The size as drawn in the design; scaled for the real screen on the way out. */
  size?: number;
  /** CSS `line-height` as a unitless multiplier — converted to px for RN. */
  lh?: number;
  /** CSS `letter-spacing` in em (e.g. -0.03) — converted to px for RN. */
  tracking?: number;
  color?: string;
  /** CSS `text-transform: uppercase`. */
  caps?: boolean;
  /** CSS `white-space: nowrap` — the design leans on this a lot. */
  nowrap?: boolean;
  /** Shrink to fit one line rather than truncate. For hero numbers. */
  fit?: boolean;
  center?: boolean;
  right?: boolean;
  opacity?: number;
};

/**
 * The one text component.
 *
 * React Native has no cascade, so type styling can't live on a container the way
 * it did in the design — every string carries its own size/weight. This wrapper
 * keeps that from being noisy and does the three corrections RN needs: sizes are
 * scaled for the real screen, unitless `line-height` and em `letter-spacing`
 * become px, and line height is floored so Baloo 2's taller glyphs aren't
 * clipped. That means values can be copied out of the design unchanged.
 */
export function T({
  w = 600,
  size = 15,
  lh,
  tracking,
  color = colors.ink,
  caps,
  nowrap,
  fit,
  center,
  right,
  opacity,
  style,
  ...rest
}: TProps) {
  const fontSize = scaleFont(size);

  const computed: TextStyle = {
    fontFamily: fontFor(w),
    fontSize,
    color,
    // The design's display type asks for line heights below 1em. Honour the
    // intent, but never below the point where the glyphs start losing their tops.
    lineHeight: Math.round(fontSize * Math.max(lh ?? MIN_LINE_HEIGHT, MIN_LINE_HEIGHT)),
    ...(tracking !== undefined ? { letterSpacing: Math.round(fontSize * tracking * 100) / 100 } : null),
    ...(caps ? { textTransform: 'uppercase' as const } : null),
    ...(center ? { textAlign: 'center' as const } : right ? { textAlign: 'right' as const } : null),
    ...(opacity !== undefined ? { opacity } : null),
  };

  return (
    <Text
      {...rest}
      numberOfLines={nowrap || fit ? 1 : rest.numberOfLines}
      adjustsFontSizeToFit={fit || undefined}
      minimumFontScale={fit ? 0.6 : undefined}
      style={[computed, style]}
    />
  );
}

/**
 * The small uppercase, letter-spaced label that heads every section and every
 * ink block ("RUNWAY", "NEXT PAYCHECKS", "FREE TO SPEND").
 */
export function Kicker({
  children,
  color = colors.muted,
  opacity,
  style,
  ...rest
}: Omit<TProps, 'size' | 'w' | 'caps' | 'tracking'>) {
  return (
    <T w={700} size={11} tracking={0.08} caps color={color} opacity={opacity} style={style} {...rest}>
      {children}
    </T>
  );
}
