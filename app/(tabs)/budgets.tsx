import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity } from 'react-native';
import dayjs from 'dayjs';
import { useDatabase } from '@/src/db/provider';
import { getBudgetsForMonth } from '@/src/db/repository/budgets';
import { getMonthlySpendingByCategory } from '@/src/db/repository/transactions';
import { BudgetProgressBar } from '@/src/components/BudgetProgressBar';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function BudgetsScreen() {
  const db = useDatabase();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [currentMonth, setCurrentMonth] = useState(dayjs().format('YYYY-MM'));
  const [budgets, setBudgets] = useState<any[]>([]);
  const [spending, setSpending] = useState<Record<string, number>>({});

  const loadData = useCallback(async () => {
    const [budgetData, spendingData] = await Promise.all([
      getBudgetsForMonth(db, currentMonth),
      getMonthlySpendingByCategory(db, currentMonth),
    ]);
    setBudgets(budgetData);
    const spendingMap: Record<string, number> = {};
    spendingData.forEach((s: any) => {
      if (s.categoryId) spendingMap[s.categoryId] = s.total;
    });
    setSpending(spendingMap);
  }, [db, currentMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalBudgeted = budgets.reduce((sum: number, b: any) => sum + b.limitAmount, 0);
  const totalSpent = budgets.reduce((sum: number, b: any) => sum + (spending[b.categoryId] ?? 0), 0);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Month Selector */}
      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={() => setCurrentMonth(dayjs(currentMonth).subtract(1, 'month').format('YYYY-MM'))}>
          <Text style={[styles.monthArrow, { color: colors.tint }]}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={[styles.monthText, { color: colors.text }]}>
          {dayjs(currentMonth).format('MMMM YYYY')}
        </Text>
        <TouchableOpacity onPress={() => setCurrentMonth(dayjs(currentMonth).add(1, 'month').format('YYYY-MM'))}>
          <Text style={[styles.monthArrow, { color: colors.tint }]}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={[styles.summaryCard, { backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#f5f5f5' }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.text }]}>Total Budgeted</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>ETB {totalBudgeted.toLocaleString('en', { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.text }]}>Total Spent</Text>
          <Text style={[styles.summaryValue, { color: totalSpent > totalBudgeted ? '#e74c3c' : colors.text }]}>
            ETB {totalSpent.toLocaleString('en', { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      {/* Budget Items */}
      {budgets.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.text }]}>
          No budgets set for this month.{'\n'}Tap + to create one.
        </Text>
      ) : (
        budgets.map((budget: any) => (
          <BudgetProgressBar
            key={budget.id}
            categoryName={budget.categoryName}
            categoryIcon={budget.categoryIcon}
            spent={spending[budget.categoryId] ?? 0}
            limit={budget.limitAmount}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 24,
  },
  monthArrow: { fontSize: 20, fontWeight: '600', paddingHorizontal: 12 },
  monthText: { fontSize: 18, fontWeight: '600' },
  summaryCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 14, opacity: 0.6, textAlign: 'center', paddingVertical: 40 },
});
