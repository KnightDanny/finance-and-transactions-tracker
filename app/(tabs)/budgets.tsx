import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity, Modal, Pressable, TextInput, Alert } from 'react-native';
import dayjs from 'dayjs';
import { useDatabase } from '@/src/db/provider';
import { getBudgetsForMonth, upsertBudget, deleteBudget, getExpenseCategories } from '@/src/db/repository/budgets';
import { getMonthlySpendingByCategory } from '@/src/db/repository/transactions';
import { BudgetProgressBar } from '@/src/components/BudgetProgressBar';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts, sectionLabel } from '@/constants/Type';
import { PieDonut } from '@/src/components/PieDonut';

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
        <View style={[styles.summaryCard, { backgroundColor: colors.goldDim, borderColor: colors.hairlineStrong }]}>
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
              backgroundColor: isOverTotal ? colors.expense : totalProgress > 0.8 ? colors.gold : colors.income,
            }]} />
          </View>
          <Text style={[styles.summaryRemaining, { color: colors.textSecondary }]}>
            {isOverTotal
              ? `Over budget by ETB ${(totalSpent - totalBudgeted).toLocaleString('en', { minimumFractionDigits: 2 })}`
              : `ETB ${(totalBudgeted - totalSpent).toLocaleString('en', { minimumFractionDigits: 2 })} remaining`
            }
          </Text>
        </View>

        {/* Spending distribution donut across budgeted categories */}
        {budgets.length > 0 && totalSpent > 0 && (
          <View style={[styles.donutCard, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <Text style={[styles.donutTitle, { color: colors.textSecondary }]}>Where it went</Text>
            <View style={{ alignItems: 'center' }}>
              <PieDonut
                slices={budgets
                  .map((b: any, i: number) => ({
                    value: spending[b.categoryId] ?? 0,
                    color: b.categoryColor || DONUT_COLORS[i % DONUT_COLORS.length],
                    key: b.id,
                  }))
                  .filter((sl: any) => sl.value > 0)}
                size={168}
                strokeWidth={20}
              >
                <Text style={[styles.donutPct, { color: isOverTotal ? colors.expense : colors.text }]}>
                  {Math.round(totalProgress * 100)}%
                </Text>
                <Text style={[styles.donutPctLabel, { color: colors.textTertiary }]}>of budget</Text>
              </PieDonut>
            </View>
            <View style={styles.legendWrap}>
              {budgets.map((b: any, i: number) => {
                const spent = spending[b.categoryId] ?? 0;
                if (spent <= 0) return null;
                const share = totalSpent > 0 ? Math.round((spent / totalSpent) * 100) : 0;
                return (
                  <View key={b.id} style={[styles.legendChip, { backgroundColor: colors.surfaceVariant }]}>
                    <View style={[styles.legendDot, { backgroundColor: b.categoryColor || DONUT_COLORS[i % DONUT_COLORS.length] }]} />
                    <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                      {b.categoryIcon ? `${b.categoryIcon} ` : ''}{b.categoryName} · {share}%
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Budget Items */}
        {budgets.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
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
        style={[styles.fab, { backgroundColor: colors.gold }]}
        activeOpacity={0.8}
        onPress={openAddModal}
      >
        <Text style={[styles.fabText, { color: colorScheme === 'dark' ? '#0C0B09' : '#FFFDF8' }]}>+</Text>
      </TouchableOpacity>

      {/* Add/Edit Budget Modal */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowAddModal(false)}>
          <View style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.hairlineStrong, borderWidth: 1 }]} onStartShouldSetResponder={() => true}>
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
                      style={[styles.catChip, {
                        backgroundColor: isSelected ? colors.goldDim : colors.surfaceVariant,
                        borderColor: isSelected ? colors.hairlineStrong : 'transparent',
                      }]}
                      onPress={() => setSelectedCategoryId(cat.id)}
                    >
                      <Text style={[styles.catChipText, { color: isSelected ? colors.gold : colors.text }]}>
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
              style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.hairline }]}
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
                style={[styles.saveBtn, { backgroundColor: colors.gold, opacity: selectedCategoryId && limitInput ? 1 : 0.5 }]}
                onPress={handleSaveBudget}
                disabled={!selectedCategoryId || !limitInput}
              >
                <Text style={[styles.saveBtnText, { color: colorScheme === 'dark' ? '#0C0B09' : '#FFFDF8' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const DONUT_COLORS = [
  '#D4B96A', '#8FB573', '#C97B67', '#5E9BC9', '#8D6CAB',
  '#C99667', '#7FAEA3', '#B08EA2', '#6577A0', '#98917F',
];

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
  monthArrow: { fontSize: 26, fontWeight: '300' },
  monthLabel: { fontFamily: fonts.sansBold, fontSize: 15, minWidth: 160, textAlign: 'center' },
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
  summaryLabel: { ...sectionLabel, fontSize: 9.5, marginBottom: 5 },
  summaryAmount: { fontFamily: fonts.monoMedium, fontSize: 20 },
  summaryBudgeted: { fontFamily: fonts.mono, fontSize: 14 },
  totalBar: { height: 3, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  totalBarFill: { height: 3, borderRadius: 3 },
  summaryRemaining: { fontFamily: fonts.sans, fontSize: 11, marginTop: 9 },
  donutCard: {
    marginHorizontal: 13, marginBottom: 16, paddingHorizontal: 16,
    paddingTop: 15, paddingBottom: 14, borderRadius: 16, borderWidth: 1,
  },
  donutTitle: { ...sectionLabel, marginBottom: 14 },
  donutPct: { fontFamily: fonts.monoMedium, fontSize: 21 },
  donutPctLabel: { fontFamily: fonts.sansBold, fontSize: 8.5, letterSpacing: 1.3, textTransform: 'uppercase', marginTop: 3 },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 15, justifyContent: 'center' },
  legendChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99,
  },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontFamily: fonts.sans, fontSize: 10.5 },
  emptyCard: {
    margin: 13,
    padding: 32,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyText: { fontFamily: fonts.sansMedium, fontSize: 14, marginBottom: 4 },
  emptySubtext: { fontFamily: fonts.sans, fontSize: 12.5 },
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
  fabText: { fontFamily: fonts.sans, fontSize: 28, lineHeight: 30 },
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
  modalTitle: { fontFamily: fonts.sansBold, fontSize: 17, marginBottom: 16 },
  fieldLabel: { ...sectionLabel, fontSize: 9.5, marginBottom: 8 },
  catScroll: { maxHeight: 50 },
  catRow: { flexDirection: 'row', gap: 8 },
  catChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1,
  },
  catChipText: { fontFamily: fonts.sans, fontSize: 12.5 },
  input: {
    fontFamily: fonts.monoMedium,
    fontSize: 16,
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
  cancelText: { fontFamily: fonts.sansMedium, fontSize: 13 },
  saveBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 15,
  },
  saveBtnText: { fontFamily: fonts.sansBold, fontSize: 13 },
});
