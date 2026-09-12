import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { parseDate, shortDate, toISODate } from '../domain/dates';
import { colors, RULE } from '../theme/tokens';
import { T } from '../theme/type';
import type { DateFieldProps } from './DateField';

/**
 * A real date, picked the way the platform picks dates.
 *
 * iOS renders the compact picker inline — it's already a tappable chip, so it
 * needs no open state of its own. Android has no inline form, so the value is a
 * button that raises the system dialog.
 */
export function DateField({ label, value, onChange, min }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const date = parseDate(value);
  const minimumDate = min ? parseDate(min) : undefined;

  const handle = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') setOpen(false);
    if (event.type === 'dismissed' || !selected) return;
    onChange(toISODate(selected));
  };

  return (
    <View style={{ flex: 1 }}>
      <T w={700} size={12} color={colors.muted}>
        {label}
      </T>

      {Platform.OS === 'ios' ? (
        <View
          style={{
            borderBottomWidth: RULE,
            borderColor: colors.ink,
            paddingVertical: 4,
            alignItems: 'flex-start',
          }}>
          <DateTimePicker
            value={date}
            mode="date"
            display="compact"
            minimumDate={minimumDate}
            accentColor={colors.ink}
            themeVariant="light"
            onChange={handle}
          />
        </View>
      ) : (
        <>
          <Pressable
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${shortDate(value)}. Change`}
            style={({ pressed }) => ({
              borderBottomWidth: RULE,
              borderColor: colors.ink,
              paddingVertical: 6,
              opacity: pressed ? 0.6 : 1,
            })}>
            <T w={800} size={20} nowrap>
              {shortDate(value)}
            </T>
          </Pressable>
          {open ? (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              minimumDate={minimumDate}
              onChange={handle}
            />
          ) : null}
        </>
      )}
    </View>
  );
}
