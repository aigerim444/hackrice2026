import { useId } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import type { Projection } from '../domain/runway';
import { heatStrip } from '../domain/runway';
import { scaleWidth } from '../theme/scale';
import { alpha, colors, GUTTER, RULE } from '../theme/tokens';
import { Kicker, T } from '../theme/type';
import { Flexible, Row, Rule, Tap } from './primitives';

/**
 * The one filled block per screen. Ink ground, cream type, and whatever the
 * screen's hero number is. Never more than one on a screen — that rule is what
 * keeps the simplified design from turning back into a wall of cards.
 */
export function InkBlock({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ backgroundColor: colors.ink, paddingHorizontal: 20, paddingVertical: 16 }, style]}>
      {children}
    </View>
  );
}

/**
 * A home-screen section: a strong rule, an uppercase kicker, an arrow, and
 * whatever it summarises. Tapping it opens the detail screen.
 */
export function Section({
  kicker,
  onPress,
  children,
  arrow = true,
  style,
}: {
  kicker: string;
  onPress?: () => void;
  children: React.ReactNode;
  arrow?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Tap onPress={onPress} disabled={!onPress}>
      <Rule />
      <View style={[{ paddingHorizontal: GUTTER, paddingVertical: 18 }, style]}>
        <Row align="baseline">
          <Kicker style={{ letterSpacing: 11 * 0.06 }}>{kicker}</Kicker>
          {arrow ? (
            <T w={800} size={14} color={colors.tan}>
              →
            </T>
          ) : null}
        </Row>
        {children}
      </View>
    </Tap>
  );
}

/**
 * Diagonal hatching — the run-out zone. The design drew it with a repeating
 * linear gradient; React Native has no such thing, so it's an SVG pattern with
 * the same 3px-on, 4px-off rhythm at 45°.
 */
export function Hatch({
  color = colors.coral,
  height,
  style,
}: {
  color?: string;
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  const id = `hatch-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View style={[{ height, overflow: 'hidden' }, style]}>
      <Svg width="100%" height={height}>
        <Defs>
          <Pattern id={id} width={7} height={7} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Rect x={0} y={0} width={3} height={7} fill={color} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height={height} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * The runway heat strip: term start → today → run-out → finals. Solid for the
 * days you've spent, muted for the days the envelope still covers, hatched for
 * the stretch it doesn't reach.
 */
export function HeatStrip({
  projection,
  height = 8,
  tone = 'light',
}: {
  projection: Projection;
  height?: number;
  /** `light` on a cream ground, `dark` inside an ink block. */
  tone?: 'light' | 'dark';
}) {
  const { spent, covered } = heatStrip(projection);
  const spentFill = tone === 'dark' ? colors.cream : colors.ink;
  const coveredFill = tone === 'dark' ? alpha.creamOn(0.55) : colors.sand;

  return (
    <View
      style={{
        height,
        flexDirection: 'row',
        backgroundColor: tone === 'dark' ? alpha.creamOn(0.2) : 'transparent',
      }}>
      <View style={{ width: spent, backgroundColor: spentFill }} />
      <View style={{ width: covered, backgroundColor: coveredFill }} />
      <Hatch height={height} style={{ flex: 1 }} />
    </View>
  );
}

/** Aug 24 · today · Dec 12 — the strip's axis. */
export function StripAxis({
  start,
  end,
  tone = 'light',
}: {
  start: string;
  end: string;
  tone?: 'light' | 'dark';
}) {
  const color = tone === 'dark' ? colors.cream : colors.tan;
  const opacity = tone === 'dark' ? 0.75 : 1;
  return (
    <Row style={{ marginTop: 6 }}>
      {[start, 'today', end].map((label) => (
        <T key={label} w={700} size={11} color={color} opacity={opacity} nowrap>
          {label}
        </T>
      ))}
    </Row>
  );
}

/**
 * A labelled bar row: category on the left, bar in the middle, amount on the
 * right. Used on Home, Spend and in Wrapped's ranked list.
 */
export function BarRow({
  label,
  amount,
  width,
  top,
  labelWidth = 88,
  amountWidth = 48,
  barHeight = 10,
  fill,
  outlined = false,
  color = colors.ink,
  size = 14,
}: {
  label: string;
  amount: string;
  width: `${number}%`;
  top?: boolean;
  labelWidth?: number;
  amountWidth?: number;
  barHeight?: number;
  fill?: string;
  /** Wrapped draws the non-leading bars as outlines on the ink ground. */
  outlined?: boolean;
  color?: string;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <T w={top === undefined ? 700 : 600} size={size} color={color} style={{ width: scaleWidth(labelWidth) }} nowrap>
        {label}
      </T>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View
          style={{
            width,
            height: barHeight,
            ...(outlined
              ? { borderWidth: RULE, borderColor: fill ?? color }
              : { backgroundColor: fill ?? (top ? colors.ink : colors.sand) }),
          }}
        />
      </View>
      <T w={top === undefined ? 700 : 800} size={size} color={color} style={{ width: scaleWidth(amountWidth) }} right nowrap>
        {amount}
      </T>
    </View>
  );
}

/** A two-line list row separated by a soft rule — the design's list idiom. */
export function ListRow({
  title,
  sublabel,
  right,
  rightSublabel,
  rightColor = colors.ink,
  onPress,
  fill,
  last = false,
}: {
  title: string;
  sublabel?: string;
  right?: string;
  rightSublabel?: string;
  rightColor?: string;
  onPress?: () => void;
  /** Sage for rows that are money working for you. */
  fill?: string;
  last?: boolean;
}) {
  const body = (
    <Row
      gap={12}
      style={
        fill
          ? { backgroundColor: fill, paddingHorizontal: 14, paddingVertical: 12 }
          : {
              paddingVertical: 12,
              ...(last ? null : { borderBottomWidth: RULE, borderColor: colors.ruleSoft }),
            }
      }>
      <Flexible>
        <T w={800} size={14}>
          {title}
        </T>
        {sublabel ? (
          <T w={600} size={12} color={colors.muted}>
            {sublabel}
          </T>
        ) : null}
      </Flexible>
      {right ? (
        <View style={{ alignItems: 'flex-end' }}>
          <T w={800} size={16} color={rightColor} nowrap>
            {right}
          </T>
          {rightSublabel ? (
            <T w={600} size={11} color={colors.muted} nowrap>
              {rightSublabel}
            </T>
          ) : null}
        </View>
      ) : null}
    </Row>
  );

  return onPress ? <Tap onPress={onPress}>{body}</Tap> : body;
}

/** The back affordance at the top of every pushed screen. */
export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Tap
      onPress={onPress}
      hitSlop={12}
      style={{
        paddingHorizontal: GUTTER,
        paddingTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}>
      <T w={800} size={14}>
        ←
      </T>
      <T w={800} size={14}>
        {label}
      </T>
    </Tap>
  );
}

/** A section heading with a muted note on the right. */
export function SectionHeading({
  title,
  note,
  style,
}: {
  title: string;
  note?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Row align="baseline" style={[{ paddingHorizontal: GUTTER }, style]}>
      <T w={800} size={16}>
        {title}
      </T>
      {note ? (
        <T w={700} size={12} color={colors.muted} nowrap>
          {note}
        </T>
      ) : null}
    </Row>
  );
}
