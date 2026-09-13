import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import {
  addMonths,
  daysInMonth,
  mondayIndexOfFirst,
  monthLabel,
  parseDate,
  shortDate,
  startOfMonth,
  toISODate,
  type ISODate,
} from '../domain/dates';
import { colors, RULE } from '../theme/tokens';
import { T } from '../theme/type';
import { Row } from './primitives';

export interface DateFieldProps {
  label: string;
  value: ISODate;
  onChange: (next: ISODate) => void;
  /** Nothing earlier than this can be picked. */
  min?: ISODate;
  /** Today, so the calendar can mark it. Defaults to the device's date. */
  today?: ISODate;
}

/**
 * A date, picked off a calendar.
 *
 * Drawn rather than delegated to the platform picker: iOS's control is a
 * rounded grey chip that sits badly in a design with no radius anywhere, and
 * it has no web build, which meant maintaining two files for one field. This
 * is one component, identical on every platform, in the app's own idiom —
 * square cells, 2px rules, ink for the day you've chosen.
 */
export function DateField({ label, value, onChange, min, today }: DateFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <T w={700} size={12} color={colors.muted}>
        {label}
      </T>

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shortDate(value)}. Pick a date`}
        style={({ pressed }) => ({
          borderBottomWidth: RULE,
          borderColor: colors.ink,
          paddingVertical: 6,
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
          opacity: pressed ? 0.6 : 1,
        })}>
        <T w={800} size={20} nowrap>
          {shortDate(value)}
        </T>
        <CalendarGlyph />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          accessibilityLabel="Close calendar"
          style={{
            flex: 1,
            backgroundColor: 'rgba(30,26,23,0.45)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 22,
          }}>
          {/* Swallow taps on the card so they don't close the sheet. */}
          <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 360 }}>
            <Calendar
              value={value}
              min={min}
              today={today}
              onPick={(next) => {
                onChange(next);
                setOpen(false);
              }}
              onClose={() => setOpen(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function Calendar({
  value,
  min,
  today,
  onPick,
  onClose,
}: {
  value: ISODate;
  min?: ISODate;
  today?: ISODate;
  onPick: (next: ISODate) => void;
  onClose: () => void;
}) {
  // Open on the month the current value sits in, so the chosen date is in view.
  const [cursor, setCursor] = useState(() => startOfMonth(value));
  const now = today ?? toISODate(new Date());

  const total = daysInMonth(cursor);
  const lead = mondayIndexOfFirst(cursor);
  const year = parseDate(cursor).getFullYear();
  const month = parseDate(cursor).getMonth();

  const cells: (ISODate | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => toISODate(new Date(year, month, i + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={{ backgroundColor: colors.cream, borderWidth: RULE, borderColor: colors.ink }}>
      <Row
        style={{
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderBottomWidth: RULE,
          borderColor: colors.ink,
        }}>
        <Stepper label="←" accessibilityLabel="Previous month" onPress={() => setCursor(addMonths(cursor, -1))} />
        <T w={800} size={16} nowrap>
          {monthLabel(cursor)}
        </T>
        <Stepper label="→" accessibilityLabel="Next month" onPress={() => setCursor(addMonths(cursor, 1))} />
      </Row>

      <View style={{ flexDirection: 'row', paddingHorizontal: 10, paddingTop: 10 }}>
        {WEEKDAYS.map((day) => (
          <T key={day} w={700} size={11} center color={colors.tan} style={{ flex: 1 }}>
            {day}
          </T>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 10, paddingTop: 6 }}>
        {cells.map((day, index) => (
          <Day
            key={day ?? `blank-${index}`}
            day={day}
            selected={day === value}
            isToday={day === now}
            disabled={Boolean(day && min && day < min)}
            onPress={onPick}
          />
        ))}
      </View>

      <Pressable
        onPress={onClose}
        style={({ pressed }) => ({
          borderTopWidth: RULE,
          borderColor: colors.ink,
          paddingVertical: 12,
          alignItems: 'center',
          opacity: pressed ? 0.6 : 1,
        })}>
        <T w={800} size={14} color={colors.muted}>
          Cancel
        </T>
      </Pressable>
    </View>
  );
}

function Day({
  day,
  selected,
  isToday,
  disabled,
  onPress,
}: {
  day: ISODate | null;
  selected: boolean;
  isToday: boolean;
  disabled: boolean;
  onPress: (day: ISODate) => void;
}) {
  if (!day) return <View style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;

  return (
    <View style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
      <Pressable
        onPress={() => onPress(day)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={shortDate(day)}
        style={({ pressed }) => ({
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? colors.ink : 'transparent',
          // Today is outlined rather than filled, so it never competes with the
          // day you've actually chosen.
          ...(isToday && !selected ? { borderWidth: RULE, borderColor: colors.sand } : null),
          opacity: disabled ? 0.28 : pressed ? 0.5 : 1,
        })}>
        <T w={selected ? 800 : 600} size={15} color={selected ? colors.cream : colors.ink}>
          {parseDate(day).getDate()}
        </T>
      </Pressable>
    </View>
  );
}

function Stepper({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderWidth: RULE,
        borderColor: colors.ink,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.5 : 1,
      })}>
      <T w={800} size={16}>
        {label}
      </T>
    </Pressable>
  );
}

/** A small square-cornered calendar mark, so the field reads as pickable. */
function CalendarGlyph() {
  return (
    <View style={{ width: 16, height: 15, borderWidth: 2, borderColor: colors.tan }}>
      <View style={{ height: 3, backgroundColor: colors.tan }} />
    </View>
  );
}
