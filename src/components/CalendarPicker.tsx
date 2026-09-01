import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts } from '@/constants/Type';

interface Props {
  /** Selected day as YYYY-MM-DD, or null for no selection. */
  value: string | null;
  onChange: (iso: string) => void;
  /** Allow picking future dates (budget periods plan ahead). Default false —
   * sync starts and transaction dates live in the past. */
  allowFuture?: boolean;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const toIso = (y: number, monthIndex: number, d: number) =>
  `${y}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Month-grid date picker. Future days are disabled — it picks past dates
 * (sync start, loan dates), not appointments. */
export function CalendarPicker({ value, onChange, allowFuture = false }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const now = new Date();
  const todayIso = toIso(now.getFullYear(), now.getMonth(), now.getDate());

  const [visible, setVisible] = useState(() => {
    const base = value ? new Date(value) : now;
    return isNaN(base.getTime())
      ? { y: now.getFullYear(), m: now.getMonth() }
      : { y: base.getFullYear(), m: base.getMonth() };
  });

  // Follow external selection changes (e.g. preset chips) into their month
  useEffect(() => {
    if (!value) return;
    const d = new Date(value);
    if (!isNaN(d.getTime())) setVisible({ y: d.getFullYear(), m: d.getMonth() });
  }, [value]);

  const daysInMonth = new Date(visible.y, visible.m + 1, 0).getDate();
  const startPad = (new Date(visible.y, visible.m, 1).getDay() + 6) % 7; // Monday-first
  const cells: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const atCurrentMonth = !allowFuture && visible.y === now.getFullYear() && visible.m === now.getMonth();
  const shiftMonth = (delta: number) =>
    setVisible(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const monthLabel = new Date(visible.y, visible.m, 1).toLocaleDateString('en', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <View>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => shiftMonth(-1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.chevron}
        >
          <Feather name="chevron-left" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
        <TouchableOpacity
          onPress={() => shiftMonth(1)}
          disabled={atCurrentMonth}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.chevron, atCurrentMonth && { opacity: 0.25 }]}
        >
          <Feather name="chevron-right" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={[styles.weekday, { color: colors.textTertiary }]}>
            {w}
          </Text>
        ))}
      </View>

      {rows.map((row, ri) => (
        <View key={ri} style={styles.dayRow}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={styles.dayCell} />;
            const iso = toIso(visible.y, visible.m, day);
            const isFuture = !allowFuture && iso > todayIso;
            const isSelected = iso === value;
            const isToday = iso === todayIso;
            return (
              <TouchableOpacity
                key={ci}
                style={styles.dayCell}
                disabled={isFuture}
                onPress={() => onChange(iso)}
              >
                <View
                  style={[
                    styles.day,
                    isSelected && { backgroundColor: colors.gold },
                    !isSelected && isToday && { borderWidth: 1, borderColor: colors.gold },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color: isSelected
                          ? isDark ? '#0C0B09' : '#FFFDF8'
                          : colors.text,
                      },
                      isFuture && { color: colors.textTertiary, opacity: 0.45 },
                    ]}
                  >
                    {day}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  chevron: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontFamily: fonts.sansSemiBold, fontSize: 14 },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  dayRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  day: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontFamily: fonts.mono, fontSize: 12.5 },
});
