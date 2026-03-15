import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

interface Props {
  totalIncome: number;
  totalExpense: number;
  incomeCount: number;
  expenseCount: number;
}

export function SpendingSummaryCards({ totalIncome, totalExpense, incomeCount, expenseCount }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.row}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <View style={[styles.indicator, { backgroundColor: colors.income }]} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>Income</Text>
        <Text style={[styles.amount, { color: colors.income }]} numberOfLines={1} adjustsFontSizeToFit>
          +{formatCompact(totalIncome)}
        </Text>
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {incomeCount} transaction{incomeCount !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <View style={[styles.indicator, { backgroundColor: colors.expense }]} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>Expense</Text>
        <Text style={[styles.amount, { color: colors.expense }]} numberOfLines={1} adjustsFontSizeToFit>
          -{formatCompact(totalExpense)}
        </Text>
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {expenseCount} transaction{expenseCount !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

function formatCompact(amount: number): string {
  return `ETB ${amount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 13,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 15,
    borderWidth: 1,
  },
  indicator: {
    width: 32,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
  },
  count: {
    fontSize: 11,
    marginTop: 4,
  },
});
