import Slider from '@react-native-community/slider';
import { Pressable, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, RULE } from '../theme/tokens';
import { T } from '../theme/type';

/** The solid ink action. Square, full-width, label left with the chevron right. */
export function PrimaryButton({
  label,
  onPress,
  trailing,
  height = 54,
  style,
  tone = 'ink',
}: {
  label: string;
  onPress?: () => void;
  trailing?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** `cream` is the inverted variant used inside ink blocks. */
  tone?: 'ink' | 'cream';
}) {
  const background = tone === 'ink' ? colors.ink : colors.cream;
  const foreground = tone === 'ink' ? colors.cream : colors.ink;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          height,
          backgroundColor: background,
          paddingHorizontal: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: trailing ? 'space-between' : 'center',
          opacity: pressed ? 0.82 : 1,
        },
        style,
      ]}>
      <T w={800} size={height >= 52 ? 16 : 15} color={foreground} nowrap>
        {label}
      </T>
      {trailing ? (
        <T w={800} size={16} color={foreground}>
          {trailing}
        </T>
      ) : null}
    </Pressable>
  );
}

/** The outlined counterpart — 2px ink border on white. */
export function OutlineButton({
  label,
  onPress,
  trailing,
  height = 54,
  style,
}: {
  label: string;
  onPress?: () => void;
  trailing?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          height,
          backgroundColor: colors.white,
          borderWidth: RULE,
          borderColor: colors.ink,
          paddingHorizontal: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: trailing ? 'space-between' : 'center',
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}>
      <T w={800} size={15} nowrap>
        {label}
      </T>
      {trailing ? (
        <T w={800} size={15}>
          {trailing}
        </T>
      ) : null}
    </Pressable>
  );
}

/**
 * A money field: a big ink `$` and an underlined number you can type over.
 * Onboarding is three of these and a slider, which is the whole point — the
 * design brief was three quick steps.
 */
export function MoneyInput({
  value,
  onChange,
  width = 82,
  size = 20,
  underline = true,
  align = 'right',
}: {
  value: number;
  onChange: (next: number) => void;
  width?: number;
  size?: number;
  underline?: boolean;
  align?: 'left' | 'right';
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <T w={800} size={size}>
        $
      </T>
      <TextInput
        value={value ? String(value) : ''}
        onChangeText={(text) => onChange(Number(text.replace(/[^0-9.]/g, '')) || 0)}
        keyboardType="number-pad"
        selectTextOnFocus
        style={{
          width,
          padding: 0,
          fontFamily: fonts.extrabold,
          fontSize: size,
          color: colors.ink,
          textAlign: align,
          ...(underline ? { borderBottomWidth: RULE, borderColor: colors.ink } : null),
        }}
      />
    </View>
  );
}

/** Thin wrapper so slider styling lives in one place. */
export function InkSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  style,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Slider
      value={value}
      minimumValue={min}
      maximumValue={max}
      step={step}
      onValueChange={onChange}
      minimumTrackTintColor={colors.ink}
      maximumTrackTintColor={colors.sand}
      thumbTintColor={colors.ink}
      style={[{ width: '100%', height: 36 }, style]}
    />
  );
}

/** A three-label axis under a slider. Evenly spaced, never collapsing. */
export function SliderAxis({ labels }: { labels: string[] }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {labels.map((label) => (
        <T key={label} w={700} size={11} color={colors.tan} nowrap>
          {label}
        </T>
      ))}
    </View>
  );
}

/** A square segmented control — job picker, receipt envelope picker. */
export function Segment({
  options,
  selectedId,
  onSelect,
  style,
}: {
  options: { id: string; label: string; disabled?: boolean }[];
  selectedId: string;
  onSelect: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', borderWidth: RULE, borderColor: colors.ink }, style]}>
      {options.map((option, index) => {
        const selected = option.id === selectedId;
        return (
          <Pressable
            key={option.id}
            disabled={option.disabled}
            onPress={() => onSelect(option.id)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 8,
              alignItems: 'center',
              backgroundColor: selected ? colors.ink : option.disabled ? 'transparent' : colors.white,
              opacity: pressed && !selected ? 0.7 : 1,
              ...(index > 0 ? { borderLeftWidth: RULE, borderColor: colors.ink } : null),
            })}>
            <T
              w={800}
              size={13}
              color={option.disabled ? colors.muted : selected ? colors.cream : colors.ink}
              nowrap>
              {option.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A bordered chip — the coach's quick asks. */
export function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderWidth: RULE,
        borderColor: colors.ink,
        backgroundColor: colors.white,
        paddingVertical: 6,
        paddingHorizontal: 12,
        opacity: pressed ? 0.7 : 1,
      })}>
      <T w={800} size={13} nowrap>
        {label}
      </T>
    </Pressable>
  );
}
