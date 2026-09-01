import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, SectionList, TouchableOpacity, RefreshControl, ScrollView, TextInput, LayoutAnimation, Modal, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import { getTransactionsFiltered, getSpendingSummary, getPairProfits } from '@/src/db/repository/transactions';
import { getAllCategories } from '@/src/db/repository/budgets';
import { getAllAccounts } from '@/src/db/repository/accounts';
import { getBankConfig } from '@/src/utils/bankConfig';
import { TransactionCard } from '@/src/components/TransactionCard';
import { CalendarPicker } from '@/src/components/CalendarPicker';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts } from '@/constants/Type';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const daysAgoIso = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDay(d);
};

const todayIso = () => isoDay(new Date());

const monthStartIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
};

/** "2026-08-01" → "1 Aug" for the date pills. */
const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface DaySection {
  title: string;
  income: number;
  expense: number;
  data: any[];
}

/** Group (already date-desc sorted) transactions into per-day sections with totals. */
function buildDaySections(
  txns: any[],
  pairProfits: Array<{ pairId: string; date: string; profit: number }> = []
): DaySection[] {
  const sections: DaySection[] = [];
  const sectionByPairCredit = new Map<string, DaySection>();
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
    // Own-account transfers and foreign-currency rows stay out of the per-day
    // ETB income/expense figures (same rules as the monthly aggregates — a
    // 500 USDT deposit is not ETB 500 of income). Fees are spending even on
    // transfers: the principal moves between own accounts, the fee leaves.
    const own = t.counterparty?.startsWith('Own account');
    const foreign = (t.currency ?? 'ETB') !== 'ETB';
    const paired = !!t.transferPairId; // marked P2P/transfer pair
    const fees = (t.serviceCharge ?? 0) + (t.vat ?? 0) + (t.disasterFund ?? 0);
    if (t.type === 'credit' && paired) sectionByPairCredit.set(t.transferPairId, current!);
    if (!foreign) {
      if (t.type === 'credit') {
        if (!own && !paired) current!.income += t.amount;
      } else {
        current!.expense += own || paired ? fees : t.amount + fees;
      }
    }
  }
  // A P2P pair whose in-leg beats its out-leg (at saved rates) earned income —
  // credited to the day of the incoming leg
  for (const p of pairProfits) {
    const section = sectionByPairCredit.get(p.pairId);
    if (section) section.income += p.profit;
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
  const [accountList, setAccountList] = useState<any[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'credit' | 'debit' | 'loans'>('all');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  // Date range — defaults to all time; '' = open-ended
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [calTarget, setCalTarget] = useState<'from' | 'to' | null>(null);
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, incomeCount: 0, expenseCount: 0 });
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const isSearching = search.trim().length > 0;

  useEffect(() => {
    getAllCategories(db).then(setCategories);
    getAllAccounts(db).then(setAccountList);
  }, [db]);

  // Arriving from the dashboard pie: show that category's transactions for
  // this month, with the filter panel open so the scope is visible
  const { categoryId: incomingCategoryId } = useLocalSearchParams<{ categoryId?: string }>();
  useEffect(() => {
    if (!incomingCategoryId) return;
    setSelectedCategoryIds([incomingCategoryId]);
    setTypeFilter('all');
    setDateFrom(monthStartIso());
    setDateTo(todayIso());
    setFiltersOpen(true);
    router.setParams({ categoryId: undefined });
  }, [incomingCategoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const searching = search.trim();
  const minAmount = parseFloat(amountMin);
  const maxAmount = parseFloat(amountMax);
  const [pairProfits, setPairProfits] = useState<Array<{ pairId: string; date: string; profit: number }>>([]);
  const loadData = useCallback(async () => {
    const [txns, sum, profits] = await Promise.all([
      getTransactionsFiltered(db, {
        type: typeFilter === 'credit' || typeFilter === 'debit' ? typeFilter : undefined,
        // "Loans" = transactions the user marked as loans
        hasLoan: typeFilter === 'loans' || undefined,
        categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
        // The date range always applies — "All" clears it for all-time search
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
        search: searching || undefined,
        minAmount: isNaN(minAmount) ? undefined : minAmount,
        maxAmount: isNaN(maxAmount) ? undefined : maxAmount,
        limit: 200,
      }),
      getSpendingSummary(db, dateFrom || '0000-01-01', dateTo || '9999-12-31'),
      getPairProfits(db, dateFrom || '0000-01-01', dateTo || '9999-12-31'),
    ]);
    setTransactions(txns);
    setSummary(sum);
    setPairProfits(profits);
  }, [db, typeFilter, selectedCategoryIds, selectedAccountIds, dateFrom, dateTo, searching, minAmount, maxAmount]);

  // Reload on focus too — catches category/note edits made in the detail
  // screen and syncs run from other tabs
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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

  const toggleAccount = (accId: string) => {
    setSelectedAccountIds(prev =>
      prev.includes(accId) ? prev.filter(id => id !== accId) : [...prev, accId]
    );
  };

  const accountName = (a: any) =>
    a.label || `${getBankConfig(a.bank, a.label ?? a.accountNumber).name} ...${a.accountNumber.slice(-4)}`;

  const visibleCategories = categories.filter((c: any) => {
    if (typeFilter === 'credit') return c.type === 'income';
    if (typeFilter === 'debit') return c.type === 'expense';
    return true;
  });

  const chipBg = colors.surfaceVariant;

  // Date presets — "This month" is the default and not counted as a filter
  const datePresets = [
    { key: 'all', label: 'All time', from: '', to: '' },
    { key: 'month', label: 'This month', from: monthStartIso(), to: todayIso() },
    { key: 'today', label: 'Today', from: todayIso(), to: todayIso() },
    { key: '7d', label: '7 days', from: daysAgoIso(7), to: todayIso() },
  ];
  const isDefaultRange = dateFrom === '' && dateTo === '';

  const activeFilterCount =
    (isDefaultRange ? 0 : 1) +
    (typeFilter !== 'all' ? 1 : 0) +
    (selectedCategoryIds.length > 0 ? 1 : 0) +
    (selectedAccountIds.length > 0 ? 1 : 0) +
    (!isNaN(minAmount) || !isNaN(maxAmount) ? 1 : 0);
  const filterActive = filtersOpen || activeFilterCount > 0;

  const pickDate = (iso: string) => {
    if (calTarget === 'from') setDateFrom(dateTo && iso > dateTo ? dateTo : iso);
    else if (calTarget === 'to') setDateTo(dateFrom && iso < dateFrom ? dateFrom : iso);
    setCalTarget(null);
  };

  const toggleFilters = () => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(160, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
    );
    setFiltersOpen((o) => !o);
  };

  const resetFilters = () => {
    setTypeFilter('all');
    setSelectedCategoryIds([]);
    setSelectedAccountIds([]);
    setDateFrom('');
    setDateTo('');
    setAmountMin('');
    setAmountMax('');
  };

  /** Uniform filter pill. Plain render helpers (NOT components) — an inline
   * component type is recreated every render, which remounts the ScrollView
   * and kills its horizontal scrolling. */
  const chip = (key: string, active: boolean, label: string, onPress: () => void) => (
    <TouchableOpacity
      key={key}
      style={[styles.chip, {
        backgroundColor: active ? colors.goldDim : colors.surfaceVariant,
        borderColor: active ? colors.hairlineStrong : 'transparent',
      }]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, { color: active ? colors.gold : colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );

  /** One compact filter group: tiny label, single horizontally scrolling row. */
  const filterRow = (label: string, chips: React.ReactNode) => (
    <View style={styles.filterGroup}>
      <Text style={[styles.panelLabel, { color: colors.textTertiary }]}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        style={styles.hScroll}
        contentContainerStyle={styles.hRow}
      >
        {chips}
      </ScrollView>
    </View>
  );

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
          <Feather name="filter" size={16} color={filterActive ? colors.gold : colors.textSecondary} />
          {activeFilterCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: colors.gold }]}>
              <Text style={[styles.filterBadgeText, { color: colorScheme === 'dark' ? '#0C0B09' : '#FFFDF8' }]}>
                {activeFilterCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Expanding filter panel — one compact scrolling row per group */}
      {filtersOpen && (
        <View style={[styles.filterPanel, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
          <View style={styles.panelHeader}>
            <Text style={[styles.panelTitle, { color: colors.textSecondary }]}>Filters</Text>
            <TouchableOpacity
              onPress={resetFilters}
              disabled={activeFilterCount === 0}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.clearText, { color: activeFilterCount > 0 ? colors.gold : colors.textTertiary }]}>
                Clear all
              </Text>
            </TouchableOpacity>
          </View>

          {filterRow('Date', [
            ...datePresets
              .filter((p) => p.key === 'all')
              .map((p) =>
                chip(p.key, dateFrom === p.from && dateTo === p.to, p.label, () => {
                  setDateFrom(p.from);
                  setDateTo(p.to);
                })
              ),
            chip('from', false, `From: ${dateFrom ? shortDate(dateFrom) : 'Any'}`, () => setCalTarget('from')),
            chip('to', false, `To: ${dateTo ? shortDate(dateTo) : 'Any'}`, () => setCalTarget('to')),
            ...datePresets
              .filter((p) => p.key !== 'all')
              .map((p) =>
                chip(p.key, dateFrom === p.from && dateTo === p.to, p.label, () => {
                  setDateFrom(p.from);
                  setDateTo(p.to);
                })
              ),
          ])}

          {filterRow(
            'Type',
            ([
              { key: 'all', label: 'All' },
              { key: 'credit', label: 'Income' },
              { key: 'debit', label: 'Expense' },
              { key: 'loans', label: 'Loans' },
            ] as const).map((f) =>
              chip(f.key, typeFilter === f.key, f.label, () => {
                setTypeFilter(f.key);
                setSelectedCategoryIds([]);
              })
            )
          )}

          {filterRow(
            'Account',
            accountList.map((a: any) =>
              chip(a.id, selectedAccountIds.includes(a.id), accountName(a), () => toggleAccount(a.id))
            )
          )}

          {filterRow(
            'Category',
            visibleCategories.map((cat: any) =>
              chip(cat.id, selectedCategoryIds.includes(cat.id), `${cat.icon} ${cat.name}`, () =>
                toggleCategory(cat.id)
              )
            )
          )}

          <View style={styles.filterGroup}>
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
          </View>
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
        sections={buildDaySections(transactions, pairProfits)}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/transaction/${item.id}` as any)}>
            <TransactionCard transaction={item} />
          </TouchableOpacity>
        )}
        renderSectionHeader={({ section }) => {
          const day = section as unknown as DaySection;
          const net = day.income - day.expense;
          return (
            <View style={[styles.dayHeader, { backgroundColor: colors.background }]}>
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
                  : 'No transactions in this range.'}
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
        <Feather name="plus" size={26} color={colorScheme === 'dark' ? '#0C0B09' : '#FFFDF8'} />
      </TouchableOpacity>

      {/* From/To calendar */}
      <Modal visible={calTarget !== null} transparent animationType="fade" onRequestClose={() => setCalTarget(null)}>
        <Pressable style={styles.calOverlay} onPress={() => setCalTarget(null)}>
          <View
            style={[styles.calSheet, { backgroundColor: colors.surface, borderColor: colors.hairlineStrong }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.calTitle, { color: colors.textSecondary }]}>
              {calTarget === 'from' ? 'From date' : 'To date'}
            </Text>
            <CalendarPicker
              value={(calTarget === 'from' ? dateFrom : dateTo) || null}
              onChange={pickDate}
            />
          </View>
        </Pressable>
      </Modal>

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
    paddingTop: 12,
    paddingBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  panelTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  clearText: { fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  filterGroup: { marginTop: 11 },
  panelLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 8.5,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  // ScrollView defaults to flexGrow:1 AND flexShrink:1 — both must be pinned
  // or the list below squashes the pills
  hScroll: { flexGrow: 0, flexShrink: 0 },
  hRow: { gap: 7, alignItems: 'center' },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 6.5,
    borderRadius: 99,
    borderWidth: 1,
  },
  chipText: { fontFamily: fonts.sansSemiBold, fontSize: 11.5 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountInput: {
    flex: 1,
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
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
  // Sticky while scrolling through the day — solid background and padding
  // (not margins) so the rows sliding underneath stay hidden
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 18,
    paddingBottom: 6,
    paddingHorizontal: 3,
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
  calOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  calSheet: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  calTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
});
