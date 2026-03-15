import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, RefreshControl, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import { getTransactionsFiltered } from '@/src/db/repository/transactions';
import { getAllCategories } from '@/src/db/repository/budgets';
import { TransactionCard } from '@/src/components/TransactionCard';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function TransactionsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  useEffect(() => {
    getAllCategories(db).then(setCategories);
  }, [db]);

  const loadData = useCallback(async () => {
    const txns = await getTransactionsFiltered(db, {
      type: typeFilter === 'all' ? undefined : typeFilter,
      categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
      limit: 100,
    });
    setTransactions(txns);
  }, [db, typeFilter, selectedCategoryIds]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  // Filter categories by selected type for the modal
  const visibleCategories = categories.filter((c: any) => {
    if (typeFilter === 'credit') return c.type === 'income';
    if (typeFilter === 'debit') return c.type === 'expense';
    return true;
  });

  const chipBg = isDark ? '#333' : '#e0e0e0';
  const chipText = colors.text;
  const hasCategoryFilter = selectedCategoryIds.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Filter Row */}
      <View style={styles.filterRow}>
        {(['all', 'credit', 'debit'] as const).map((f) => {
          const isActive = typeFilter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, { backgroundColor: isActive ? '#2f95dc' : chipBg }]}
              onPress={() => { setTypeFilter(f); setSelectedCategoryIds([]); }}
            >
              <Text style={[styles.filterText, { color: isActive ? '#fff' : chipText }]}>
                {f === 'all' ? 'All' : f === 'credit' ? 'Income' : 'Expense'}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Categories button */}
        <TouchableOpacity
          style={[styles.filterChip, { backgroundColor: hasCategoryFilter ? '#2f95dc' : chipBg }]}
          onPress={() => setShowCategoryModal(true)}
        >
          <Text style={[styles.filterText, { color: hasCategoryFilter ? '#fff' : chipText }]}>
            Categories{hasCategoryFilter ? ` (${selectedCategoryIds.length})` : ''}
          </Text>
        </TouchableOpacity>
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

      {/* Category Filter Modal */}
      <Modal visible={showCategoryModal} transparent animationType="fade" onRequestClose={() => setShowCategoryModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowCategoryModal(false)}>
          <View style={[styles.modal, { backgroundColor: isDark ? '#1e1e1e' : '#fff' }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Filter by Category</Text>

            <View style={styles.modalChipRow}>
              {visibleCategories.map((cat: any) => {
                const isSelected = selectedCategoryIds.includes(cat.id);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.modalChip, { backgroundColor: isSelected ? '#2f95dc' : chipBg }]}
                    onPress={() => toggleCategory(cat.id)}
                  >
                    <Text style={[styles.modalChipText, { color: isSelected ? '#fff' : chipText }]}>
                      {cat.icon} {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              {hasCategoryFilter && (
                <TouchableOpacity onPress={() => setSelectedCategoryIds([])}>
                  <Text style={styles.clearText}>Clear All</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.doneBtn} onPress={() => setShowCategoryModal(false)}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  modalChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modalChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  modalChipText: { fontSize: 14 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 20,
    gap: 16,
  },
  clearText: { fontSize: 14, color: '#e74c3c', fontWeight: '500' },
  doneBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#2f95dc',
    borderRadius: 8,
  },
  doneBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
