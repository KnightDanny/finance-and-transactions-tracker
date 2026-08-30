import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, SectionList, TouchableOpacity, RefreshControl, ScrollView, TextInput, LayoutAnimation } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import { getTransactionsFiltered, getSpendingSummary } from '@/src/db/repository/transactions';
import { getAllCategories } from '@/src/db/repository/budgets';
import { TransactionCard } from '@/src/components/TransactionCard';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts } from '@/constants/Type';

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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface DaySection {
  title: string;
  income: number;
  expense: number;
  data: any[];
}

/** Group (already date-desc sorted) transactions into per-day sections with totals. */
function buildDaySections(txns: any[]): DaySection[] {
  const sections: DaySection[] = [];
  let current: DaySection | null = null;
  let currentDate = '';
  for (const t of txns) {
    if (t.date !== currentDate) {
      currentDate = t.date;
      const d = new Date(`${t.date}T00:00:00`);
      const title = isNaN(d.getTime())
        ? t.date
        : `${DAY_NAMES[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
      current = { title, income: 0, expense: 0, data: [] };
      sections.push(current);
    }
    current!.data.push(t);
    // Own-account transfers move money between the user's own accounts —
    // keep them out of the per-day income/expense figures (same rule as the
    // monthly aggregates)
    const own = t.counterparty?.startsWith('Own account');
    if (!own) {
      if (t.type === 'credit') current!.income += t.amount;
      else current!.expense += t.amount;
    }
  }
  return sections;
}

function fmtDay(n: number): string {
  return n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TransactionsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'credit' | 'debit' | 'loans'>('all');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, incomeCount: 0, expenseCount: 0 });
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const isSearching = search.trim().length > 0;

  const months = generateMonths(12);
  const selectedMonth = months[selectedMonthIdx];
  const monthScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    getAllCategories(db).then(setCategories);
  }, [db]);

  const searching = search.trim();
  const minAmount = parseFloat(amountMin);
  const maxAmount = parseFloat(amountMax);
  const loadData = useCallback(async () => {
    const [txns, sum] = await Promise.all([
      getTransactionsFiltered(db, {
        type: typeFilter === 'credit' || typeFilter === 'debit' ? typeFilter : undefined,
        // "Loans" = transactions the user marked as loans
        hasLoan: typeFilter === 'loans' || undefined,
        categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        // A search spans ALL months — the month picker only scopes browsing
        startDate: searching ? undefined : selectedMonth.startDate,
        endDate: searching ? undefined : selectedMonth.endDate,
        search: searching || undefined,
        minAmount: isNaN(minAmount) ? undefined : minAmount,
        maxAmount: isNaN(maxAmount) ? undefined : maxAmount,
        limit: 200,
      }),
      getSpendingSummary(db, selectedMonth.startDate, selectedMonth.endDate),
    ]);
    setTransactions(txns);
    setSummary(sum);
  }, [db, typeFilter, selectedCategoryIds, selectedMonth, searching, minAmount, maxAmount]);

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

  const activeFilterCount =
    (selectedMonthIdx !== 0 ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0) +
    (selectedCategoryIds.length > 0 ? 1 : 0) +
    (!isNaN(minAmount) || !isNaN(maxAmount) ? 1 : 0);
  const filterActive = filtersOpen || activeFilterCount > 0;

  const toggleFilters = () => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(160, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
    );
    setFiltersOpen((o) => !o);
  };

  const resetFilters = () => {
    setTypeFilter('all');
    setSelectedCategoryIds([]);
    setSelectedMonthIdx(0);
    setAmountMin('');
    setAmountMax('');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search + combined filter toggle */}
      <View style={styles.topRow}>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceVariant, borderColor: colors.hairline }]}>
          <Feather name="search" size={15} color={isSearching ? colors.gold : colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, amount, ref, note…"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {isSearching && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={15} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, {
            backgroundColor: filterActive ? colors.goldDim : colors.surfaceVariant,
            borderColor: filterActive ? colors.hairlineStrong : colors.hairline,
          }]}
          onPress={toggleFilters}
        >
          <Feather name="sliders" size={16} color={filterActive ? colors.gold : colors.textSecondary} />
          {activeFilterCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: colors.gold }]}>
              <Text style={[styles.filterBadgeText, { color: colorScheme === 'dark' ? '#0C0B09' : '#FFFDF8' }]}>
                {activeFilterCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Expanding filter panel */}
      {filtersOpen && (
        <View style={[styles.filterPanel, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
          {!isSearching && (
            <>
              <Text style={[styles.panelLabel, { color: colors.textTertiary }]}>Month</Text>
              <ScrollView
                ref={monthScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.monthScroll}
                contentContainerStyle={styles.monthRow}
              >
                {months.map((m, idx) => {
                  const isActive = idx === selectedMonthIdx;
                  return (
                    <TouchableOpacity
                      key={m.key}
                      style={[styles.monthChip, {
                        backgroundColor: isActive ? colors.goldDim : chipBg,
                        borderColor: isActive ? colors.hairlineStrong : 'transparent',
                      }]}
                      onPress={() => setSelectedMonthIdx(idx)}
                    >
                      <Text style={[styles.monthText, { color: isActive ? colors.gold : colors.textTertiary }]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          <Text style={[styles.panelLabel, { color: colors.textTertiary }]}>Type</Text>
          <View style={styles.chipWrap}>
            {([
              { key: 'all', label: 'All' },
              { key: 'credit', label: 'Income' },
              { key: 'debit', label: 'Expense' },
              { key: 'loans', label: 'Loans' },
            ] as const).map((f) => {
              const isActive = typeFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, {
                    backgroundColor: isActive ? colors.goldDim : chipBg,
                    borderColor: isActive ? colors.hairlineStrong : 'transparent',
                  }]}
                  onPress={() => { setTypeFilter(f.key); setSelectedCategoryIds([]); }}
                >
                  <Text style={[styles.filterText, { color: isActive ? colors.gold : colors.textSecondary }]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.panelLabel, { color: colors.textTertiary }]}>Categories</Text>
          <View style={styles.chipWrap}>
            {visibleCategories.map((cat: any) => {
              const isSelected = selectedCategoryIds.includes(cat.id);
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.filterChip, {
                    backgroundColor: isSelected ? colors.goldDim : chipBg,
                    borderColor: isSelected ? colors.hairlineStrong : 'transparent',
                  }]}
                  onPress={() => toggleCategory(cat.id)}
                >
                  <Text style={[styles.filterText, { color: isSelected ? colors.gold : colors.textSecondary }]}>
                    {cat.icon} {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.panelLabel, { color: colors.textTertiary }]}>Amount (ETB)</Text>
          <View style={styles.amountRow}>
            <TextInput
              style={[styles.amountInput, { backgroundColor: chipBg, color: colors.text, borderColor: colors.hairline }]}
              value={amountMin}
              onChangeText={setAmountMin}
              placeholder="Min"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
            <Text style={{ color: colors.textTertiary }}>–</Text>
            <TextInput
              style={[styles.amountInput, { backgroundColor: chipBg, color: colors.text, borderColor: colors.hairline }]}
              value={amountMax}
              onChangeText={setAmountMax}
              placeholder="Max"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
          </View>

          {activeFilterCount > 0 && (
            <TouchableOpacity onPress={resetFilters} style={styles.resetBtn}>
              <Text style={[styles.resetText, { color: colors.expense }]}>Reset filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Month summary bar */}
      {!isSearching && (
      <View style={[styles.summaryBar, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
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
      )}

      <SectionList
        sections={buildDaySections(transactions)}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/transaction/${item.id}` as any)}>
            <TransactionCard transaction={item} />
          </TouchableOpacity>
        )}
        renderSectionHeader={({ section }) => {
          const day = section as unknown as DaySection;
          const net = day.income - day.expense;
          return (
            <View style={styles.dayHeader}>
              <Text style={[styles.dayTitle, { color: colors.textSecondary }]}>{day.title}</Text>
              <View style={[styles.dayRule, { backgroundColor: colors.hairline }]} />
              <View style={styles.dayTotals}>
                <View style={styles.dayFlowRow}>
                  {day.income > 0 && (
                    <Text style={[styles.dayFlow, { color: colors.income }]}>+{fmtDay(day.income)}</Text>
                  )}
                  {day.expense > 0 && (
                    <Text style={[styles.dayFlow, { color: colors.expense }]}>−{fmtDay(day.expense)}</Text>
                  )}
                </View>
                <Text style={[styles.dayNet, { color: net >= 0 ? colors.income : colors.expense }]}>
                  {net >= 0 ? '+' : '−'}{fmtDay(Math.abs(net))}
                </Text>
              </View>
            </View>
          );
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />}
        ListEmptyComponent={
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {isSearching
                ? `No matches for “${search.trim()}”.`
                : activeFilterCount > 0
                  ? 'No transactions match your filters.'
                  : `No transactions for ${selectedMonth.label.toLowerCase()}.`}
            </Text>
          </View>
        }
        contentContainerStyle={transactions.length === 0 ? styles.emptyContainer : { paddingHorizontal: 13, paddingBottom: 80 }}
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.gold }]}
        activeOpacity={0.8}
        onPress={() => router.push('/transaction/add' as any)}
      >
        <Text style={[styles.fabText, { color: colorScheme === 'dark' ? '#0C0B09' : '#FFFDF8' }]}>+</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 13,
    marginTop: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 13.5, paddingVertical: 0 },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { fontFamily: fonts.sansBold, fontSize: 9.5 },
  filterPanel: {
    marginHorizontal: 13,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  panelLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 8.5,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 8,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountInput: {
    flex: 1,
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  resetBtn: { alignSelf: 'flex-end', marginTop: 14 },
  resetText: { fontFamily: fonts.sansMedium, fontSize: 12 },
  // ScrollView defaults to flexGrow:1 AND flexShrink:1 — both must be pinned
  // or the list below squashes the pills
  monthScroll: { flexGrow: 0, flexShrink: 0 },
  monthRow: {
    gap: 8,
    alignItems: 'center',
  },
  monthChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1,
  },
  monthText: { fontFamily: fonts.mono, fontSize: 12 },
  summaryBar: {
    flexDirection: 'row',
    marginHorizontal: 13,
    marginTop: 8,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: { fontFamily: fonts.sansBold, fontSize: 9, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 4 },
  summaryAmount: { fontFamily: fonts.monoMedium, fontSize: 12.5 },
  summaryDivider: {
    width: 1,
    height: 28,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1,
  },
  filterText: { fontFamily: fonts.sansSemiBold, fontSize: 12 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    marginBottom: 4,
    marginHorizontal: 3,
  },
  dayTitle: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  dayRule: { flex: 1, height: 1 },
  dayTotals: { alignItems: 'flex-end' },
  dayFlowRow: { flexDirection: 'row', gap: 8 },
  dayFlow: { fontFamily: fonts.mono, fontSize: 9.5 },
  dayNet: { fontFamily: fonts.monoMedium, fontSize: 11.5, marginTop: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', padding: 13 },
  emptyCard: {
    padding: 24,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, textAlign: 'center' },
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
});
