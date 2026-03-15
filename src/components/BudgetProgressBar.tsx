import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { formatCurrency } from '@/src/utils/currency';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

interface Props {
  categoryName: string;
  categoryIcon?: string;
  spent: number;
  limit: number;
  compact?: boolean;
}

export function BudgetProgressBar({ categoryName, categoryIcon, spent, limit, compact }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const progress = limit > 0 ? Math.min(spent / limit, 1.3) : 0;
  const displayProgress = Math.min(progress, 1);
  const isOverBudget = spent > limit;
  const isWarning = progress > 0.8 && !isOverBudget;

  const barColor = isOverBudget ? colors.expense : isWarning ? '#E6A23C' : colors.income;
  const remaining = limit - spent;

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <Text style={[styles.compactName, { color: colors.text }]} numberOfLines={1}>
            {categoryIcon ? `${categoryIcon} ` : ''}{categoryName}
          </Text>
          <Text style={[styles.compactAmount, { color: isOverBudget ? colors.expense : colors.textSecondary }]}>
            {Math.round((displayProgress) * 100)}%
          </Text>
        </View>
        <View style={[styles.barBg, { backgroundColor: colors.surfaceVariant, height: 6 }]}>
          <View style={[styles.barFill, { width: `${displayProgress * 100}%`, backgroundColor: barColor, height: 6 }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <View style={styles.header}>
        <Text style={[styles.name, { color: colors.text }]}>
          {categoryIcon ? `${categoryIcon} ` : ''}{categoryName}
        </Text>
        <Text style={[styles.amounts, { color: colors.textSecondary }]}>
          {formatCurrency(spent)} / {formatCurrency(limit)}
        </Text>
      </View>
      <View style={[styles.barBg, { backgroundColor: colors.surfaceVariant }]}>
        <View style={[styles.barFill, { width: `${displayProgress * 100}%`, backgroundColor: barColor }]} />
      </View>
      <View style={styles.footer}>
        {isOverBudget ? (
          <Text style={[styles.footerText, { color: colors.expense }]}>
            Over by {formatCurrency(spent - limit)}
          </Text>
        ) : (
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            {formatCurrency(remaining)} remaining
          </Text>
        )}
        <Text style={[styles.percentText, { color: isOverBudget ? colors.expense : colors.textSecondary }]}>
          {Math.round(progress * 100)}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 13,
    marginBottom: 8,
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  name: { fontSize: 15, fontWeight: '600', flex: 1 },
  amounts: { fontSize: 12 },
  barBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  footerText: { fontSize: 12 },
  percentText: { fontSize: 12, fontWeight: '600' },
  compactContainer: {
    marginBottom: 10,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  compactName: { fontSize: 13, fontWeight: '500', flex: 1 },
  compactAmount: { fontSize: 12, fontWeight: '600' },
});
