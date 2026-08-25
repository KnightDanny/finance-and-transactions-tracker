import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts } from '@/constants/Type';

interface Props {
  totalIncome: number;
  totalExpense: number;
  incomeCount: number;
  expenseCount: number;
}

export function SpendingSummaryCards({ totalIncome, totalExpense, incomeCount, expenseCount }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <View style={styles.row}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        <View style={[styles.topBar, { backgroundColor: colors.income }]} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>Income</Text>
        <Text style={[styles.amount, { color: colors.income }]} numberOfLines={1} adjustsFontSizeToFit>
          +{formatCompact(totalIncome)}
        </Text>
        <Text style={[styles.count, { color: colors.textTertiary }]}>
          {incomeCount} transaction{incomeCount !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        <View style={[styles.topBar, { backgroundColor: colors.expense }]} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>Expense</Text>
        <Text style={[styles.amount, { color: colors.expense }]} numberOfLines={1} adjustsFontSizeToFit>
          −{formatCompact(totalExpense)}
        </Text>
        <Text style={[styles.count, { color: colors.textTertiary }]}>
          {expenseCount} transaction{expenseCount !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

function formatCompact(amount: number): string {
  return amount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 13,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 2,
  },
  label: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  amount: {
    fontFamily: fonts.monoMedium,
    fontSize: 16,
  },
  count: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    marginTop: 4,
  },
});
