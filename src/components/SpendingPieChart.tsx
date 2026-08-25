import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts, sectionLabel } from '@/constants/Type';

interface CategorySpending {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  total: number;
  count: number;
}

interface Props {
  data: CategorySpending[];
  totalExpense: number;
}

const CHART_COLORS = [
  '#D4B96A', '#8FB573', '#C97B67', '#5E9BC9', '#8D6CAB',
  '#C99667', '#7FAEA3', '#B08EA2', '#98917F', '#6577A0',
];

export function SpendingPieChart({ data, totalExpense }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  if (data.length === 0 || totalExpense === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>Spending by Category</Text>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No spending data this month</Text>
        </View>
      </View>
    );
  }

  // Take top 6 categories, group rest into "Other"
  const sorted = [...data].sort((a, b) => b.total - a.total);
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6);

  if (rest.length > 0) {
    const otherTotal = rest.reduce((sum, c) => sum + c.total, 0);
    const otherCount = rest.reduce((sum, c) => sum + c.count, 0);
    top.push({
      categoryId: null,
      categoryName: 'Other',
      categoryIcon: '•',
      total: otherTotal,
      count: otherCount,
    });
  }

  // Build pie segments as a simple bar chart (horizontal stacked bar)
  const segments = top.map((cat, i) => ({
    ...cat,
    color: CHART_COLORS[i % CHART_COLORS.length],
    percentage: (cat.total / totalExpense) * 100,
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
      <Text style={[styles.title, { color: colors.textSecondary }]}>Spending by Category</Text>

      {/* Stacked progress bar */}
      <View style={[styles.barContainer, { backgroundColor: colors.surfaceVariant }]}>
        {segments.map((seg, i) => (
          <View
            key={i}
            style={[
              styles.barSegment,
              {
                backgroundColor: seg.color,
                flex: seg.percentage,
              },
              i === 0 && styles.barFirst,
              i === segments.length - 1 && styles.barLast,
            ]}
          />
        ))}
      </View>

      {/* Category list */}
      <View style={styles.list}>
        {segments.map((seg, i) => (
          <View key={i} style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.dot, { backgroundColor: seg.color }]} />
              <Text style={[styles.catLabel, { color: colors.text }]} numberOfLines={1}>
                {seg.categoryIcon ? `${seg.categoryIcon} ` : ''}{seg.categoryName}
              </Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.catAmount, { color: colors.text }]}>
                {seg.total.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.catPercent, { color: colors.textTertiary }]}>
                {seg.percentage.toFixed(1)}%
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 13,
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
  },
  title: {
    ...sectionLabel,
    marginBottom: 14,
  },
  barContainer: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
    gap: 2,
  },
  barSegment: {
    height: '100%',
  },
  barFirst: {
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
  },
  barLast: {
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 9,
  },
  catLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12.5,
    flex: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  catAmount: {
    fontFamily: fonts.monoMedium,
    fontSize: 12.5,
  },
  catPercent: {
    fontFamily: fonts.mono,
    fontSize: 10,
    marginTop: 1,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
  },
});
