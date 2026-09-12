import { TextInput, View } from 'react-native';

import { toISODate, parseDate, type ISODate } from '../domain/dates';
import { scaleFont } from '../theme/scale';
import { colors, fonts, RULE } from '../theme/tokens';
import { T } from '../theme/type';

export interface DateFieldProps {
  label: string;
  value: ISODate;
  onChange: (next: ISODate) => void;
  /** Nothing earlier than this can be picked. */
  min?: ISODate;
}

/**
 * Web fallback for the date field.
 *
 * `@react-native-community/datetimepicker` has no web build, so Metro resolves
 * this file on web and `DateField.native.tsx` on a device. Typing the date is a
 * fair stand-in for a browser; the phone gets the real wheel.
 */
export function DateField({ label, value, onChange, min }: DateFieldProps) {
  const commit = (text: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return;
    const parsed = parseDate(text);
    if (Number.isNaN(parsed.getTime())) return;
    onChange(min && text < min ? min : toISODate(parsed));
  };

  return (
    <View style={{ flex: 1 }}>
      <T w={700} size={12} color={colors.muted}>
        {label}
      </T>
      <TextInput
        defaultValue={value}
        onChangeText={commit}
        placeholder="2026-11-20"
        placeholderTextColor={colors.tan}
        style={{
          borderBottomWidth: RULE,
          borderColor: colors.ink,
          paddingVertical: 6,
          paddingHorizontal: 0,
          fontFamily: fonts.extrabold,
          fontSize: scaleFont(20),
          color: colors.ink,
        }}
      />
    </View>
  );
}
