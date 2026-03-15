import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import { getTransactionsFiltered } from '@/src/db/repository/transactions';
import { TransactionCard } from '@/src/components/TransactionCard';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function TransactionsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [transactions, setTransactions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');

  const loadData = useCallback(async () => {
    const txns = await getTransactionsFiltered(db, {
      type: filter === 'all' ? undefined : filter,
      limit: 100,
    });
    setTransactions(txns);
  }, [db, filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {(['all', 'credit', 'debit'] as const).map((f) => {
          const isActive = filter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterChip,
                { backgroundColor: isActive
                    ? '#2f95dc'
                    : colorScheme === 'dark' ? '#333' : '#e0e0e0' },
              ]}
              onPress={() => setFilter(f)}
            >
              <Text style={[
                styles.filterText,
                { color: isActive ? '#fff' : colors.text },
              ]}>
                {f === 'all' ? 'All' : f === 'credit' ? 'Income' : 'Expense'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/transaction/${item.id}` as any)}>
            <TransactionCard transaction={item} />
          </TouchableOpacity>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.text }]}>
            No transactions yet. Pull down to sync SMS.
          </Text>
        }
        contentContainerStyle={transactions.length === 0 ? styles.emptyContainer : undefined}
      />

      {/* FAB for manual entry */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: '#2f95dc' }]}
        onPress={() => router.push('/transaction/add' as any)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: { flexDirection: 'row', padding: 12, gap: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  filterText: { fontSize: 14, fontWeight: '500' },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  emptyText: { fontSize: 14, opacity: 0.6, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30 },
});
