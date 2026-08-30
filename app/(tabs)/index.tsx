import React, { useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import { getAllAccounts, getTotalNetWorth } from '@/src/db/repository/accounts';
import { getRecentTransactions, getSpendingSummary, getSpendingByCategory, getMonthlySpendingByCategory } from '@/src/db/repository/transactions';
import { getBudgetsForMonth } from '@/src/db/repository/budgets';
import { TransactionCard } from '@/src/components/TransactionCard';
import { BalanceCard } from '@/src/components/BalanceCard';
import { BankGroupCard } from '@/src/components/BankGroupCard';
import { SpendingSummaryCards } from '@/src/components/SpendingSummaryCards';
import { SpendingPieChart } from '@/src/components/SpendingPieChart';
import { BudgetProgressBar } from '@/src/components/BudgetProgressBar';
import { ReconciliationBanner } from '@/src/components/ReconciliationBanner';
import { NetWorthCard } from '@/src/components/NetWorthCard';
import { LoansCard } from '@/src/components/LoansCard';
import { getUnresolvedGaps } from '@/src/reconciliation/engine';
import { getLoans, LoanWithProgress } from '@/src/db/repository/loans';
import { syncSms } from '@/src/sms/sync';
import { SymbolView } from 'expo-symbols';
import { Feather } from '@expo/vector-icons';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts, sectionLabel } from '@/constants/Type';
import { useBalancePrivacy, MASKED } from '@/src/state/balancePrivacy';
import { useDashboardPrefs, DashboardSectionKey } from '@/src/state/dashboardPrefs';

/** Group accounts by bank; richest bank first, richest account first within each. */
function groupAccountsByBank(accounts: any[]): { bank: string; bankAccounts: any[] }[] {
  const groups: { bank: string; bankAccounts: any[] }[] = [];
  for (const account of accounts) {
    const existing = groups.find((g) => g.bank === account.bank);
    if (existing) existing.bankAccounts.push(account);
    else groups.push({ bank: account.bank, bankAccounts: [account] });
  }
  const total = (g: { bankAccounts: any[] }) =>
    g.bankAccounts.reduce((sum, a) => sum + (a.latestBalance ?? 0), 0);
  for (const g of groups) {
    g.bankAccounts.sort((a, b) => (b.latestBalance ?? 0) - (a.latestBalance ?? 0));
  }
  return groups.sort((a, b) => total(b) - total(a));
}

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
  const [loans, setLoans] = useState<LoanWithProgress[]>([]);

  const currentMonth = getCurrentMonth();
  const { startDate, endDate } = getMonthDateRange(currentMonth);
  const monthLabel = MONTH_NAMES[new Date().getMonth()];

  const loadData = useCallback(async () => {
    const [nw, accs, txns, gaps, summary, catSpending, budgetData, monthSpending, loanList] = await Promise.all([
      getTotalNetWorth(db),
      getAllAccounts(db),
      getRecentTransactions(db, 5),
      getUnresolvedGaps(db),
      getSpendingSummary(db, startDate, endDate),
      getSpendingByCategory(db, startDate, endDate),
      getBudgetsForMonth(db, currentMonth),
      getMonthlySpendingByCategory(db, currentMonth),
      getLoans(db),
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
    setLoans(loanList);
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
  const { hidden, toggle } = useBalancePrivacy();
  const prefs = useDashboardPrefs();

  /** One dashboard section per key, rendered in the user's saved order. */
  const renderSection = (key: DashboardSectionKey): React.ReactNode => {
    switch (key) {
      case 'showNetWorth':
        return (
          <NetWorthCard
            cash={netWorth}
            lent={loans.filter((l) => l.direction === 'lent').reduce((t, l) => t + l.remaining, 0)}
            borrowed={loans.filter((l) => l.direction === 'borrowed').reduce((t, l) => t + l.remaining, 0)}
          />
        );

      case 'showAccounts':
        return (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 11 }]}>Accounts</Text>
            {accounts.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No accounts yet. Sync SMS to get started.
                </Text>
              </View>
            ) : (
              groupAccountsByBank(accounts).map(({ bank, bankAccounts }) =>
                bankAccounts.length > 1 ? (
                  <BankGroupCard key={bank} bank={bank} accounts={bankAccounts} />
                ) : (
                  <TouchableOpacity
                    key={bankAccounts[0].id}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/account/${bankAccounts[0].id}` as any)}
                  >
                    <BalanceCard account={bankAccounts[0]} />
                  </TouchableOpacity>
                )
              )
            )}
          </View>
        );

      case 'showLoans':
        return <LoansCard loans={loans} />;

      case 'showGaps':
        return (
          <ReconciliationBanner
            gapCount={gapCount}
            onPress={() => router.push('/reconciliation' as any)}
          />
        );

      case 'showSummary':
        return (
          <>
            <View style={styles.monthHeader}>
              <Text style={[styles.monthTitle, { color: colors.textSecondary }]}>{monthLabel} Summary</Text>
            </View>
            <SpendingSummaryCards
              totalIncome={spending.totalIncome}
              totalExpense={spending.totalExpense}
              incomeCount={spending.incomeCount}
              expenseCount={spending.expenseCount}
            />
          </>
        );

      case 'showSpendingPie':
        return (
          <SpendingPieChart
            data={categorySpending}
            totalExpense={spending.totalExpense}
          />
        );

      case 'showBudgets':
        if (budgets.length === 0) return null;
        return (
          <View style={[styles.budgetSection, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.budgetSectionTitle, { color: colors.textSecondary }]}>Budgets</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/budgets' as any)}>
                <Text style={[styles.seeAll, { color: colors.gold }]}>Manage</Text>
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
        );

      case 'showRecent':
        return (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Recent Transactions</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/transactions' as any)}>
                <Text style={[styles.seeAll, { color: colors.gold }]}>See All</Text>
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
        );
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />}
    >
      {/* Net Worth Hero — open composition, no card box */}
      <View style={styles.hero}>
        <View style={styles.heroLabelRow}>
          <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>Total Balance</Text>
          <TouchableOpacity
            onPress={toggle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.heroEye}
          >
            {/* Feather (font-based): the expo-symbols Android vector clips this
                wide glyph at its right edge */}
            <Feather
              name={hidden ? 'eye-off' : 'eye'}
              size={15}
              color={hidden ? colors.gold : colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
        <Text style={[styles.heroAmount, { color: colors.text }]}>
          <Text style={[styles.heroCurrency, { color: colors.textSecondary }]}>ETB </Text>
          {hidden ? MASKED : netWorth.toLocaleString('en', { minimumFractionDigits: 2 })}
        </Text>
        <View style={styles.heroMeta}>
          {(spending.totalIncome > 0 || spending.totalExpense > 0) && (
            <Text style={[styles.heroFlow, { color: hidden ? colors.textTertiary : netFlowColor }]}>
              {hidden ? '••••' : `${netFlow >= 0 ? '+' : ''}${netFlow.toLocaleString('en', { minimumFractionDigits: 2 })}`}
            </Text>
          )}
          <Text style={[styles.heroAccounts, { color: colors.textTertiary }]}>
            this month · {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={[styles.heroRule, { backgroundColor: colors.gold }]} />
      </View>

      {/* Dashboard sections — user-chosen visibility and order (customize-dashboard) */}
      {prefs.order.map(
        (key) =>
          prefs[key] && <React.Fragment key={key}>{renderSection(key)}</React.Fragment>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    marginTop: 22,
    marginBottom: 18,
    marginHorizontal: 13,
    alignItems: 'center',
  },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  heroEye: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  heroLabel: { ...sectionLabel },
  heroAmount: { fontFamily: fonts.monoMedium, fontSize: 33, letterSpacing: -0.5 },
  heroCurrency: { fontFamily: fonts.mono, fontSize: 16 },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 9,
  },
  heroAccounts: { fontFamily: fonts.sans, fontSize: 11.5 },
  heroFlow: { fontFamily: fonts.monoMedium, fontSize: 11.5 },
  heroRule: { height: 1, width: 56, marginTop: 16, opacity: 0.8 },
  monthHeader: {
    marginHorizontal: 16,
    marginBottom: 11,
  },
  monthTitle: { ...sectionLabel },
  budgetSection: {
    marginHorizontal: 13,
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  budgetSectionTitle: { ...sectionLabel },
  section: { marginHorizontal: 13, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  sectionTitle: { ...sectionLabel, marginLeft: 3 },
  seeAll: { fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  emptyCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, textAlign: 'center' },
});
