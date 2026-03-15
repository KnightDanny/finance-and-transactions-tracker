import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity, Modal, Pressable, TextInput, Alert } from 'react-native';
import dayjs from 'dayjs';
import { useDatabase } from '@/src/db/provider';
import { getBudgetsForMonth, upsertBudget, deleteBudget, getExpenseCategories } from '@/src/db/repository/budgets';
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
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);

  // Add/Edit budget modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [limitInput, setLimitInput] = useState('');

  const loadData = useCallback(async () => {
    const [budgetData, spendingData, cats] = await Promise.all([
      getBudgetsForMonth(db, currentMonth),
      getMonthlySpendingByCategory(db, currentMonth),
      getExpenseCategories(db),
    ]);
    setBudgets(budgetData);
    setExpenseCategories(cats);
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
  const totalProgress = totalBudgeted > 0 ? Math.min(totalSpent / totalBudgeted, 1) : 0;
  const isOverTotal = totalSpent > totalBudgeted;

  // Categories not yet budgeted
  const budgetedCategoryIds = new Set(budgets.map((b: any) => b.categoryId));
  const unbudgetedCategories = expenseCategories.filter((c: any) => !budgetedCategoryIds.has(c.id));

  const handleSaveBudget = async () => {
    if (!selectedCategoryId || !limitInput) return;
    const amount = parseFloat(limitInput.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid budget amount.');
      return;
    }
    await upsertBudget(db, {
      categoryId: selectedCategoryId,
      month: currentMonth,
      limitAmount: amount,
    });
    setShowAddModal(false);
    setSelectedCategoryId(null);
    setLimitInput('');
    loadData();
  };

  const handleDeleteBudget = (budget: any) => {
    Alert.alert('Remove Budget', `Remove ${budget.categoryName} budget?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await deleteBudget(db, budget.id);
          loadData();
        }
      },
    ]);
  };

  const handleEditBudget = (budget: any) => {
    setSelectedCategoryId(budget.categoryId);
    setLimitInput(budget.limitAmount.toString());
    setShowAddModal(true);
  };

  const openAddModal = () => {
    setSelectedCategoryId(unbudgetedCategories[0]?.id ?? null);
    setLimitInput('');
    setShowAddModal(true);
  };

  const prevMonth = () => setCurrentMonth(dayjs(currentMonth).subtract(1, 'month').format('YYYY-MM'));
  const nextMonth = () => setCurrentMonth(dayjs(currentMonth).add(1, 'month').format('YYYY-MM'));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView>
        {/* Month Selector */}
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={prevMonth} style={styles.arrowBtn}>
            <Text style={[styles.monthArrow, { color: colors.accent }]}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: colors.text }]}>
            {dayjs(currentMonth).format('MMMM YYYY')}
          </Text>
          <TouchableOpacity onPress={nextMonth} style={styles.arrowBtn}>
            <Text style={[styles.monthArrow, { color: colors.accent }]}>{'›'}</Text>
          </TouchableOpacity>
        </View>

        {/* Total Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Spent</Text>
              <Text style={[styles.summaryAmount, { color: isOverTotal ? colors.expense : colors.text }]}>
                ETB {totalSpent.toLocaleString('en', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Budgeted</Text>
              <Text style={[styles.summaryBudgeted, { color: colors.text }]}>
                ETB {totalBudgeted.toLocaleString('en', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
          <View style={[styles.totalBar, { backgroundColor: colors.surfaceVariant }]}>
            <View style={[styles.totalBarFill, {
              width: `${totalProgress * 100}%`,
              backgroundColor: isOverTotal ? colors.expense : totalProgress > 0.8 ? '#E6A23C' : colors.income,
            }]} />
          </View>
          <Text style={[styles.summaryRemaining, { color: colors.textSecondary }]}>
            {isOverTotal
              ? `Over budget by ETB ${(totalSpent - totalBudgeted).toLocaleString('en', { minimumFractionDigits: 2 })}`
              : `ETB ${(totalBudgeted - totalSpent).toLocaleString('en', { minimumFractionDigits: 2 })} remaining`
            }
          </Text>
        </View>

        {/* Budget Items */}
        {budgets.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No budgets set for this month.
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Tap the + button to create one.
            </Text>
          </View>
        ) : (
          budgets.map((budget: any) => (
            <TouchableOpacity
              key={budget.id}
              activeOpacity={0.7}
              onPress={() => handleEditBudget(budget)}
              onLongPress={() => handleDeleteBudget(budget)}
            >
              <BudgetProgressBar
                categoryName={budget.categoryName}
                categoryIcon={budget.categoryIcon}
                spent={spending[budget.categoryId] ?? 0}
                limit={budget.limitAmount}
              />
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent }]}
        activeOpacity={0.8}
        onPress={openAddModal}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add/Edit Budget Modal */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowAddModal(false)}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {budgetedCategoryIds.has(selectedCategoryId ?? '') ? 'Edit Budget' : 'Set Budget'}
            </Text>

            {/* Category selector */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              <View style={styles.catRow}>
                {/* Show all expense categories for editing, unbudgeted for adding */}
                {expenseCategories.map((cat: any) => {
                  const isSelected = selectedCategoryId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catChip, { backgroundColor: isSelected ? colors.accent : colors.surfaceVariant }]}
                      onPress={() => setSelectedCategoryId(cat.id)}
                    >
                      <Text style={[styles.catChipText, { color: isSelected ? '#fff' : colors.text }]}>
                        {cat.icon} {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Amount input */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>Monthly Limit (ETB)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.divider }]}
              value={limitInput}
              onChangeText={setLimitInput}
              placeholder="e.g. 5000"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: selectedCategoryId && limitInput ? 1 : 0.5 }]}
                onPress={handleSaveBudget}
                disabled={!selectedCategoryId || !limitInput}
              >
                <Text style={styles.saveBtnText}>Save</Text>
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
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  arrowBtn: { padding: 8 },
  monthArrow: { fontSize: 28, fontWeight: '300' },
  monthLabel: { fontSize: 18, fontWeight: '700', minWidth: 160, textAlign: 'center' },
  summaryCard: {
    marginHorizontal: 13,
    padding: 16,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  summaryRight: { alignItems: 'flex-end' },
  summaryLabel: { fontSize: 12, marginBottom: 2 },
  summaryAmount: { fontSize: 22, fontWeight: '700' },
  summaryBudgeted: { fontSize: 16, fontWeight: '600' },
  totalBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  totalBarFill: { height: 8, borderRadius: 4 },
  summaryRemaining: { fontSize: 12, marginTop: 8 },
  emptyCard: {
    margin: 13,
    padding: 32,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyText: { fontSize: 15, fontWeight: '500', marginBottom: 4 },
  emptySubtext: { fontSize: 13 },
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
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  catScroll: { maxHeight: 50 },
  catRow: { flexDirection: 'row', gap: 8 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  catChipText: { fontSize: 13, fontWeight: '500' },
  input: {
    fontSize: 18,
    fontWeight: '600',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 20,
    gap: 16,
  },
  cancelText: { fontSize: 14, fontWeight: '500' },
  saveBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 15,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
