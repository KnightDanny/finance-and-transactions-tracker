import React, { useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import { getAllAccounts, getTotalNetWorth } from '@/src/db/repository/accounts';
import { getRecentTransactions } from '@/src/db/repository/transactions';
import { TransactionCard } from '@/src/components/TransactionCard';
import { BalanceCard } from '@/src/components/BalanceCard';
import { ReconciliationBanner } from '@/src/components/ReconciliationBanner';
import { getUnresolvedGaps } from '@/src/reconciliation/engine';
import { syncSms } from '@/src/sms/sync';
import { SymbolView } from 'expo-symbols';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

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

  const loadData = useCallback(async () => {
    const [nw, accs, txns, gaps] = await Promise.all([
      getTotalNetWorth(db),
      getAllAccounts(db),
      getRecentTransactions(db, 5),
      getUnresolvedGaps(db),
    ]);
    setNetWorth(nw);
    setAccounts(accs);
    setRecentTxns(txns);
    setGapCount(gaps.length);
  }, [db]);

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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Net Worth */}
      <View style={[styles.netWorthCard, { backgroundColor: colorScheme === 'dark' ? '#1a3a5c' : '#1B4965' }]}>
        <Text style={styles.netWorthLabel}>Net Worth</Text>
        <Text style={styles.netWorthAmount}>ETB {netWorth.toLocaleString('en', { minimumFractionDigits: 2 })}</Text>
        <Text style={styles.netWorthSubtext}>{accounts.length} account{accounts.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Reconciliation Banner */}
      <ReconciliationBanner
        gapCount={gapCount}
        onPress={() => router.push('/reconciliation' as any)}
      />

      {/* Accounts */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Accounts</Text>
        {accounts.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.text }]}>
            No accounts yet. Sync SMS to get started.
          </Text>
        ) : (
          accounts.map((account: any) => (
            <TouchableOpacity
              key={account.id}
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
            <Text style={{ color: colors.tint }}>See All</Text>
          </TouchableOpacity>
        </View>
        {recentTxns.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.text }]}>
            No transactions yet.
          </Text>
        ) : (
          recentTxns.map((txn: any) => (
            <TouchableOpacity
              key={txn.id}
              onPress={() => router.push(`/transaction/${txn.id}` as any)}
            >
              <TransactionCard transaction={txn} />
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  netWorthCard: {
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  netWorthLabel: { color: '#BEE9E8', fontSize: 14, marginBottom: 4 },
  netWorthAmount: { color: '#fff', fontSize: 32, fontWeight: '700' },
  netWorthSubtext: { color: '#BEE9E8', fontSize: 12, marginTop: 4 },
  section: { marginHorizontal: 16, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  emptyText: { fontSize: 14, opacity: 0.6, textAlign: 'center', paddingVertical: 20 },
});
