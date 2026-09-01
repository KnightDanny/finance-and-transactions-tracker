import React, { useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity, Alert } from 'react-native';
import dayjs from 'dayjs';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import {
  getPeriodBudgetsWithSpend, deletePeriodBudget, BudgetWithSpend,
} from '@/src/db/repository/periodBudgets';
import { getExpenseCategories } from '@/src/db/repository/budgets';
import { BudgetProgressBar } from '@/src/components/BudgetProgressBar';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts, sectionLabel } from '@/constants/Type';
import { PieDonut } from '@/src/components/PieDonut';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
};

export default function BudgetsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const [currentMonth, setCurrentMonth] = useState(dayjs().format('YYYY-MM'));
  const [budgets, setBudgets] = useState<BudgetWithSpend[]>([]);
  const [mainCats, setMainCats] = useState<any[]>([]);
  const [allCats, setAllCats] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    const [rows, cats] = await Promise.all([
      getPeriodBudgetsWithSpend(db, currentMonth),
      getExpenseCategories(db),
    ]);
    setBudgets(rows);
    setAllCats(cats);
    setMainCats(cats.filter((c: any) => !c.parentId));
  }, [db, currentMonth]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const totalBudgeted = budgets.reduce((s, b) => s + b.limitAmount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const totalProgress = totalBudgeted > 0 ? Math.min(totalSpent / totalBudgeted, 1) : 0;
  const isOverTotal = totalSpent > totalBudgeted;

  const familyMain = (b: BudgetWithSpend) => {
    if (!b.categoryIds?.length) return null;
    const first = allCats.find((c) => c.id === b.categoryIds![0]);
    const mainId = first?.parentId ?? first?.id;
    return mainCats.find((c) => c.id === mainId) ?? null;
  };
  const budgetLabel = (b: BudgetWithSpend) => {
    const base = b.name
      || (b.familyCount === null
        ? 'All spending'
        : b.familyCount === 1
          ? familyMain(b)?.name ?? '1 category'
          : `${b.familyCount} categories`);
    return b.period === 'custom' ? `${base} · ${shortDate(b.rangeStart)}–${shortDate(b.rangeEnd)}` : base;
  };
  const budgetIcon = (b: BudgetWithSpend) =>
    b.familyCount === 1 ? familyMain(b)?.icon ?? '🎯' : '🎯';

  const handleDelete = (b: BudgetWithSpend) => {
    Alert.alert('Remove Budget', `Remove "${budgetLabel(b)}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await deletePeriodBudget(db, b.id);
          loadData();
        },
      },
    ]);
  };

  const prevMonth = () => setCurrentMonth(dayjs(currentMonth).subtract(1, 'month').format('YYYY-MM'));
  const nextMonth = () => setCurrentMonth(dayjs(currentMonth).add(1, 'month').format('YYYY-MM'));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView>
        {/* Month Selector — drives the recurring monthly budgets */}
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
        {budgets.length > 0 && (
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
        )}

        {/* Spending share across budgets */}
        {budgets.length > 1 && totalSpent > 0 && (
          <View style={[styles.donutCard, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <Text style={[styles.donutTitle, { color: colors.textSecondary }]}>Where it went</Text>
            <View style={{ alignItems: 'center' }}>
              <PieDonut
                slices={budgets
                  .map((b, i) => ({ value: b.spent, color: DONUT_COLORS[i % DONUT_COLORS.length], key: b.id }))
                  .filter((sl) => sl.value > 0)}
                size={168}
                strokeWidth={22}
              >
                <Text style={[styles.donutPct, { color: isOverTotal ? colors.expense : colors.text }]}>
                  {Math.round(totalProgress * 100)}%
                </Text>
                <Text style={[styles.donutPctLabel, { color: colors.textTertiary }]}>of budget</Text>
              </PieDonut>
            </View>
            <View style={styles.legendWrap}>
              {budgets.map((b, i) => {
                if (b.spent <= 0) return null;
                const share = totalSpent > 0 ? Math.round((b.spent / totalSpent) * 100) : 0;
                return (
                  <View key={b.id} style={[styles.legendChip, { backgroundColor: colors.surfaceVariant }]}>
                    <View style={[styles.legendDot, { backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }]} />
                    <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                      {budgetIcon(b)} {budgetLabel(b)} · {share}%
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
              No budgets yet.
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Tap + to set a limit for this month or a custom period.
            </Text>
          </View>
        ) : (
          budgets.map((b) => (
            <TouchableOpacity
              key={b.id}
              activeOpacity={0.7}
              onPress={() => router.push(`/budget-editor?id=${b.id}` as any)}
              onLongPress={() => handleDelete(b)}
            >
              <BudgetProgressBar
                categoryName={budgetLabel(b)}
                categoryIcon={budgetIcon(b)}
                spent={b.spent}
                limit={b.limitAmount}
                subtitle={b.perDayLeft != null
                  ? `ETB ${b.perDayLeft.toLocaleString('en', { maximumFractionDigits: 0 })}/day for ${b.daysLeft} more day${b.daysLeft === 1 ? '' : 's'}`
                  : undefined}
              />
              {/* Per-category caps inside this budget */}
              {b.categoryLimits && Object.keys(b.categoryLimits).length > 0 && (
                <View style={[styles.capsCard, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
                  {Object.entries(b.categoryLimits).map(([catId, cap]) => {
                    const cat = allCats.find((c) => c.id === catId);
                    const catSpent = b.perCategorySpend[catId] ?? 0;
                    const over = catSpent > cap;
                    const pct = Math.min(catSpent / cap, 1);
                    return (
                      <View key={catId} style={styles.capRow}>
                        <Text style={[styles.capName, { color: colors.textSecondary }]} numberOfLines={1}>
                          {cat ? `${cat.icon} ${cat.name}` : 'Category'}
                        </Text>
                        <View style={[styles.capBar, { backgroundColor: colors.surfaceVariant }]}>
                          <View style={[styles.capBarFill, {
                            width: `${pct * 100}%`,
                            backgroundColor: over ? colors.expense : pct > 0.8 ? colors.gold : colors.income,
                          }]} />
                        </View>
                        <Text style={[styles.capAmount, { color: over ? colors.expense : colors.textTertiary }]}>
                          {catSpent.toLocaleString('en', { maximumFractionDigits: 0 })}/{cap.toLocaleString('en', { maximumFractionDigits: 0 })}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.gold }]}
        activeOpacity={0.8}
        onPress={() => router.push('/budget-editor' as any)}
      >
        <Feather name="plus" size={26} color={isDark ? '#0C0B09' : '#FFFDF8'} />
      </TouchableOpacity>
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
  emptySubtext: { fontFamily: fonts.sans, fontSize: 12.5, textAlign: 'center' },
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
  capsCard: {
    marginHorizontal: 13, marginTop: -6, marginBottom: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
  },
  capRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4 },
  capName: { fontFamily: fonts.sans, fontSize: 11.5, width: 110 },
  capBar: { flex: 1, height: 3, borderRadius: 3, overflow: 'hidden' },
  capBarFill: { height: 3, borderRadius: 3 },
  capAmount: { fontFamily: fonts.mono, fontSize: 10.5, minWidth: 70, textAlign: 'right' },
});
