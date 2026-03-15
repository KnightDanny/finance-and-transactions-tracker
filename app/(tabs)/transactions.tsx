import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, RefreshControl, Modal, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import { getTransactionsFiltered, getSpendingSummary } from '@/src/db/repository/transactions';
import { getAllCategories } from '@/src/db/repository/budgets';
import { TransactionCard } from '@/src/components/TransactionCard';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function generateMonths(count: number): { key: string; label: string; startDate: string; endDate: string }[] {
  const months = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const key = `${yyyy}-${mm}`;
    months.push({
      key,
      label: i === 0 ? 'This Month' : `${MONTH_NAMES[d.getMonth()]} ${yyyy}`,
      startDate: `${key}-01`,
      endDate: `${key}-31`,
    });
  }
  return months;
}

export default function TransactionsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, incomeCount: 0, expenseCount: 0 });

  const months = generateMonths(12);
  const selectedMonth = months[selectedMonthIdx];
  const monthScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    getAllCategories(db).then(setCategories);
  }, [db]);

  const loadData = useCallback(async () => {
    const [txns, sum] = await Promise.all([
      getTransactionsFiltered(db, {
        type: typeFilter === 'all' ? undefined : typeFilter,
        categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        startDate: selectedMonth.startDate,
        endDate: selectedMonth.endDate,
        limit: 200,
      }),
      getSpendingSummary(db, selectedMonth.startDate, selectedMonth.endDate),
    ]);
    setTransactions(txns);
    setSummary(sum);
  }, [db, typeFilter, selectedCategoryIds, selectedMonth]);

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

  const visibleCategories = categories.filter((c: any) => {
    if (typeFilter === 'credit') return c.type === 'income';
    if (typeFilter === 'debit') return c.type === 'expense';
    return true;
  });

  const chipBg = colors.surfaceVariant;
  const hasCategoryFilter = selectedCategoryIds.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Month selector */}
      <ScrollView
        ref={monthScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.monthRow}
      >
        {months.map((m, idx) => {
          const isActive = idx === selectedMonthIdx;
          return (
            <TouchableOpacity
              key={m.key}
              style={[styles.monthChip, {
                backgroundColor: isActive ? colors.accent : 'transparent',
                borderColor: isActive ? colors.accent : colors.surfaceVariant,
              }]}
              onPress={() => setSelectedMonthIdx(idx)}
            >
              <Text style={[styles.monthText, { color: isActive ? '#fff' : colors.text }]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Month summary bar */}
      <View style={[styles.summaryBar, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Income</Text>
          <Text style={[styles.summaryAmount, { color: colors.income }]}>
            +{summary.totalIncome.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Expense</Text>
          <Text style={[styles.summaryAmount, { color: colors.expense }]}>
            -{summary.totalExpense.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Net</Text>
          <Text style={[styles.summaryAmount, {
            color: summary.totalIncome - summary.totalExpense >= 0 ? colors.income : colors.expense,
          }]}>
            {(summary.totalIncome - summary.totalExpense).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      {/* Type + Category filters */}
      <View style={styles.filterRow}>
        {(['all', 'credit', 'debit'] as const).map((f) => {
          const isActive = typeFilter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, { backgroundColor: isActive ? colors.accent : chipBg }]}
              onPress={() => { setTypeFilter(f); setSelectedCategoryIds([]); }}
            >
              <Text style={[styles.filterText, { color: isActive ? '#fff' : colors.text }]}>
                {f === 'all' ? 'All' : f === 'credit' ? 'Income' : 'Expense'}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.filterChip, { backgroundColor: hasCategoryFilter ? colors.accent : chipBg }]}
          onPress={() => setShowCategoryModal(true)}
        >
          <Text style={[styles.filterText, { color: hasCategoryFilter ? '#fff' : colors.text }]}>
            Categories{hasCategoryFilter ? ` (${selectedCategoryIds.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/transaction/${item.id}` as any)}>
            <TransactionCard transaction={item} />
          </TouchableOpacity>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />}
        ListEmptyComponent={
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No transactions for {selectedMonth.label.toLowerCase()}.
            </Text>
          </View>
        }
        contentContainerStyle={transactions.length === 0 ? styles.emptyContainer : { paddingBottom: 80 }}
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent }]}
        activeOpacity={0.8}
        onPress={() => router.push('/transaction/add' as any)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showCategoryModal} transparent animationType="fade" onRequestClose={() => setShowCategoryModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowCategoryModal(false)}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Filter by Category</Text>

            <View style={styles.modalChipRow}>
              {visibleCategories.map((cat: any) => {
                const isSelected = selectedCategoryIds.includes(cat.id);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.modalChip, { backgroundColor: isSelected ? colors.accent : chipBg }]}
                    onPress={() => toggleCategory(cat.id)}
                  >
                    <Text style={[styles.modalChipText, { color: isSelected ? '#fff' : colors.text }]}>
                      {cat.icon} {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              {hasCategoryFilter && (
                <TouchableOpacity onPress={() => setSelectedCategoryIds([])}>
                  <Text style={[styles.clearText, { color: colors.expense }]}>Clear All</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.accent }]} onPress={() => setShowCategoryModal(false)}>
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
  monthRow: {
    paddingHorizontal: 13,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  monthChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  monthText: { fontSize: 14, fontWeight: '600' },
  summaryBar: {
    flexDirection: 'row',
    marginHorizontal: 13,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 11, marginBottom: 2 },
  summaryAmount: { fontSize: 13, fontWeight: '700' },
  summaryDivider: {
    width: 1,
    height: 28,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 13, gap: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  filterText: { fontSize: 13, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', padding: 13 },
  emptyCard: {
    padding: 24,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyText: { fontSize: 14, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
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
    borderRadius: 20,
    padding: 24,
    elevation: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
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
    marginTop: 24,
    gap: 16,
  },
  clearText: { fontSize: 14, fontWeight: '500' },
  doneBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 15,
  },
  doneBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
