import { Text, type TextProps, type TextStyle } from 'react-native';

import { colors, fontFor, type FontWeight } from './tokens';

export type TProps = TextProps & {
  /** Baloo 2 face. Matches the design's font-weight values. */
  w?: FontWeight;
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
  center?: boolean;
  right?: boolean;
  opacity?: number;
};

/**
 * The one text component.
 *
 * React Native has no cascade, so type styling can't live on a container the way
 * it did in the design — every string carries its own size/weight. This wrapper
 * keeps that from being noisy and does the two unit conversions RN needs:
 * unitless `line-height` and em `letter-spacing` both become px, relative to the
 * font size, so the values can be copied out of the design unchanged.
 */
export function T({
  w = 600,
  size = 15,
  lh,
  tracking,
  color = colors.ink,
  caps,
  nowrap,
  center,
  right,
  opacity,
  style,
  ...rest
}: TProps) {
  const computed: TextStyle = {
    fontFamily: fontFor(w),
    fontSize: size,
    color,
    ...(lh !== undefined ? { lineHeight: Math.round(size * lh * 100) / 100 } : null),
    ...(tracking !== undefined ? { letterSpacing: Math.round(size * tracking * 100) / 100 } : null),
    ...(caps ? { textTransform: 'uppercase' as const } : null),
    ...(center ? { textAlign: 'center' as const } : right ? { textAlign: 'right' as const } : null),
    ...(opacity !== undefined ? { opacity } : null),
  };

  return <Text {...rest} numberOfLines={nowrap ? 1 : rest.numberOfLines} style={[computed, style]} />;
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
