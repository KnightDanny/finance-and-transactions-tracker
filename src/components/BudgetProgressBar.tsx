import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { formatCurrency } from '@/src/utils/currency';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts } from '@/constants/Type';

interface Props {
  categoryName: string;
  categoryIcon?: string;
  spent: number;
  limit: number;
  compact?: boolean;
}

// Thin-track budget bar: sage on track → gold approaching → terracotta over.
export function BudgetProgressBar({ categoryName, categoryIcon, spent, limit, compact }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const progress = limit > 0 ? Math.min(spent / limit, 1.3) : 0;
  const displayProgress = Math.min(progress, 1);
  const isOverBudget = spent > limit;
  const isWarning = progress > 0.8 && !isOverBudget;

  const barColor = isOverBudget ? colors.expense : isWarning ? colors.gold : colors.income;
  const remaining = limit - spent;

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <Text style={[styles.compactName, { color: colors.text }]} numberOfLines={1}>
            {categoryIcon ? `${categoryIcon} ` : ''}{categoryName}
          </Text>
          <Text style={[styles.compactAmount, { color: isOverBudget ? colors.expense : colors.textTertiary }]}>
            {Math.round(displayProgress * 100)}%
          </Text>
        </View>
        <View style={[styles.barBg, { backgroundColor: colors.surfaceVariant }]}>
          <View style={[styles.barFill, { width: `${displayProgress * 100}%`, backgroundColor: barColor }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
      <View style={styles.header}>
        <Text style={[styles.name, { color: colors.text }]}>
          {categoryIcon ? `${categoryIcon} ` : ''}{categoryName}
        </Text>
        <Text style={[styles.amounts, { color: colors.textTertiary }]}>
          <Text style={{ color: colors.text }}>{formatCurrency(spent)}</Text> / {formatCurrency(limit)}
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
        ) : isWarning ? (
          <Text style={[styles.footerText, { color: colors.gold }]}>Approaching limit</Text>
        ) : (
          <Text style={[styles.footerText, { color: colors.income }]}>
            {formatCurrency(remaining)} remaining
          </Text>
        )}
        <Text style={[styles.percentText, { color: isOverBudget ? colors.expense : colors.textTertiary }]}>
          {Math.round(progress * 100)}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 13,
    marginBottom: 10,
    paddingHorizontal: 15,
    paddingTop: 14,
    paddingBottom: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 11,
  },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, flex: 1 },
  amounts: { fontFamily: fonts.mono, fontSize: 11.5 },
  barBg: {
    height: 3,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
    borderRadius: 3,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  footerText: { fontFamily: fonts.sans, fontSize: 10.5 },
  percentText: { fontFamily: fonts.mono, fontSize: 10.5 },
  compactContainer: {
    marginBottom: 12,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  compactName: { fontFamily: fonts.sansMedium, fontSize: 12.5, flex: 1 },
  compactAmount: { fontFamily: fonts.mono, fontSize: 11 },
});
