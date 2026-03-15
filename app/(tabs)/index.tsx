import React, { useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import { getAllAccounts, getTotalNetWorth } from '@/src/db/repository/accounts';
import { getRecentTransactions, getSpendingSummary, getSpendingByCategory, getMonthlySpendingByCategory } from '@/src/db/repository/transactions';
import { getBudgetsForMonth } from '@/src/db/repository/budgets';
import { TransactionCard } from '@/src/components/TransactionCard';
import { BalanceCard } from '@/src/components/BalanceCard';
import { SpendingSummaryCards } from '@/src/components/SpendingSummaryCards';
import { SpendingPieChart } from '@/src/components/SpendingPieChart';
import { BudgetProgressBar } from '@/src/components/BudgetProgressBar';
import { ReconciliationBanner } from '@/src/components/ReconciliationBanner';
import { getUnresolvedGaps } from '@/src/reconciliation/engine';
import { syncSms } from '@/src/sms/sync';
import { SymbolView } from 'expo-symbols';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthDateRange(month: string) {
  return { startDate: `${month}-01`, endDate: `${month}-31` };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function DashboardScreen() {
  const db = useDatabase();
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [netWorth, setNetWorth] = useState(0);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [gapCount, setGapCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [spending, setSpending] = useState({ totalIncome: 0, totalExpense: 0, incomeCount: 0, expenseCount: 0 });
  const [categorySpending, setCategorySpending] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [budgetSpending, setBudgetSpending] = useState<Record<string, number>>({});

  const currentMonth = getCurrentMonth();
  const { startDate, endDate } = getMonthDateRange(currentMonth);
  const monthLabel = MONTH_NAMES[new Date().getMonth()];

  const loadData = useCallback(async () => {
    const [nw, accs, txns, gaps, summary, catSpending, budgetData, monthSpending] = await Promise.all([
      getTotalNetWorth(db),
      getAllAccounts(db),
      getRecentTransactions(db, 5),
      getUnresolvedGaps(db),
      getSpendingSummary(db, startDate, endDate),
      getSpendingByCategory(db, startDate, endDate),
      getBudgetsForMonth(db, currentMonth),
      getMonthlySpendingByCategory(db, currentMonth),
    ]);
    setNetWorth(nw);
    setAccounts(accs);
    setRecentTxns(txns);
    setGapCount(gaps.length);
    setSpending(summary);
    setCategorySpending(catSpending);
    setBudgets(budgetData);
    const spMap: Record<string, number> = {};
    monthSpending.forEach((s: any) => {
      if (s.categoryId) spMap[s.categoryId] = s.total;
    });
    setBudgetSpending(spMap);
  }, [db, startDate, endDate, currentMonth]);

  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncSms(db);
      await loadData();
      if (result.gaps > 0) {
        Alert.alert(
          'Balance Gaps Detected',
          `${result.gaps} balance discrepancies found. Go to reconciliation to review.`
        );
      }
    } catch (e: any) {
      Alert.alert('Sync Failed', e.message);
    } finally {
      setIsSyncing(false);
    }
  }, [db, isSyncing, loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        isSyncing ? (
          <ActivityIndicator size="small" color={colors.tint} style={{ marginRight: 16 }} />
        ) : (
          <TouchableOpacity onPress={handleSync} style={{ marginRight: 16 }}>
            <SymbolView
              name={{ ios: 'arrow.trianglehead.2.clockwise', android: 'sync', web: 'sync' }}
              tintColor={colors.tint}
              size={24}
            />
          </TouchableOpacity>
        ),
    });
  }, [navigation, isSyncing, handleSync, colors.tint]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const netFlow = spending.totalIncome - spending.totalExpense;
  const netFlowColor = netFlow >= 0 ? colors.income : colors.expense;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />}
    >
      {/* Net Worth Hero Card */}
      <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>Total Balance</Text>
        <Text style={[styles.heroAmount, { color: colors.text }]}>
          ETB {netWorth.toLocaleString('en', { minimumFractionDigits: 2 })}
        </Text>
        <View style={styles.heroMeta}>
          <Text style={[styles.heroAccounts, { color: colors.textSecondary }]}>
            {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </Text>
          {(spending.totalIncome > 0 || spending.totalExpense > 0) && (
            <Text style={[styles.heroFlow, { color: netFlowColor }]}>
              {netFlow >= 0 ? '+' : ''}{netFlow.toLocaleString('en', { minimumFractionDigits: 2 })} this month
            </Text>
          )}
        </View>
      </View>

      {/* Reconciliation Banner */}
      <ReconciliationBanner
        gapCount={gapCount}
        onPress={() => router.push('/reconciliation' as any)}
      />

      {/* Monthly Summary Header */}
      <View style={styles.monthHeader}>
        <Text style={[styles.monthTitle, { color: colors.text }]}>{monthLabel} Summary</Text>
      </View>

      {/* Income / Expense Summary Cards */}
      <SpendingSummaryCards
        totalIncome={spending.totalIncome}
        totalExpense={spending.totalExpense}
        incomeCount={spending.incomeCount}
        expenseCount={spending.expenseCount}
      />

      {/* Spending by Category */}
      <SpendingPieChart
        data={categorySpending}
        totalExpense={spending.totalExpense}
      />

      {/* Budget Progress */}
      {budgets.length > 0 && (
        <View style={[styles.budgetSection, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.budgetSectionTitle, { color: colors.text }]}>Budgets</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/budgets' as any)}>
              <Text style={[styles.seeAll, { color: colors.accent }]}>Manage</Text>
            </TouchableOpacity>
          </View>
          {budgets.map((b: any) => (
            <BudgetProgressBar
              key={b.id}
              categoryName={b.categoryName}
              categoryIcon={b.categoryIcon}
              spent={budgetSpending[b.categoryId] ?? 0}
              limit={b.limitAmount}
              compact
            />
          ))}
        </View>
      )}

      {/* Accounts */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Accounts</Text>
        {accounts.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No accounts yet. Sync SMS to get started.
            </Text>
          </View>
        ) : (
          accounts.map((account: any) => (
            <TouchableOpacity
              key={account.id}
              activeOpacity={0.7}
              onPress={() => router.push(`/account/${account.id}` as any)}
            >
              <BalanceCard account={account} />
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Recent Transactions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/transactions' as any)}>
            <Text style={[styles.seeAll, { color: colors.accent }]}>See All</Text>
          </TouchableOpacity>
        </View>
        {recentTxns.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No transactions yet.
            </Text>
          </View>
        ) : (
          recentTxns.map((txn: any) => (
            <TouchableOpacity
              key={txn.id}
              activeOpacity={0.7}
              onPress={() => router.push(`/transaction/${txn.id}` as any)}
            >
              <TransactionCard transaction={txn} />
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroCard: {
    margin: 13,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  heroLabel: { fontSize: 13, marginBottom: 6 },
  heroAmount: { fontSize: 32, fontWeight: '700' },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  heroAccounts: { fontSize: 12 },
  heroFlow: { fontSize: 12, fontWeight: '600' },
  monthHeader: {
    marginHorizontal: 13,
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  budgetSection: {
    marginHorizontal: 13,
    marginBottom: 16,
    padding: 16,
    borderRadius: 15,
    borderWidth: 1,
  },
  budgetSectionTitle: { fontSize: 16, fontWeight: '700' },
  section: { marginHorizontal: 13, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  seeAll: { fontSize: 14, fontWeight: '500' },
  emptyCard: {
    padding: 24,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyText: { fontSize: 14, textAlign: 'center' },
});
