import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, LayoutAnimation, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Storage } from 'expo-sqlite/kv-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts, sectionLabel } from '@/constants/Type';
import { PieDonut } from './PieDonut';
import { CalendarPicker } from './CalendarPicker';
import { useDatabase } from '@/src/db/provider';
import { getSpendingByCategory } from '@/src/db/repository/transactions';
import { getAllCategories } from '@/src/db/repository/budgets';
import { FEES_CATEGORY_NAME } from '@/src/db/seed';

const PERIOD_KEY = 'pie_chart_period_v2';
const GROUPING_KEY = 'pie_chart_ungrouped';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PERIODS = [
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
] as const;
type PeriodKey = (typeof PERIODS)[number]['key'];

interface PeriodChoice {
  key: PeriodKey;
  from?: string; // custom range bounds (YYYY-MM-DD, '' = open)
  to?: string;
}

function loadPeriod(): PeriodChoice {
  try {
    const saved = JSON.parse(Storage.getItemSync(PERIOD_KEY) ?? '');
    if (saved && PERIODS.some((p) => p.key === saved.key)) return saved;
  } catch {}
  return { key: 'month' };
}

function rangeFor(p: PeriodChoice): { start: string; end: string } {
  const now = new Date();
  switch (p.key) {
    case 'month': {
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return { start: `${ym}-01`, end: `${ym}-31` };
    }
    case 'all':
      return { start: '0000-01-01', end: '9999-12-31' };
    case 'custom':
      return { start: p.from || '0000-01-01', end: p.to || '9999-12-31' };
  }
}

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
};

/** Scale a #RRGGBB color's brightness — subcategories wear shades of their
 * parent's color, Cashew-style. */
function shade(hex: string, f: number): string {
  const m = hex?.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${(((ch((n >> 16) & 255)) << 16) | ((ch((n >> 8) & 255)) << 8) | ch(n & 255)).toString(16).padStart(6, '0')}`;
}
const SUB_SHADES = [1.35, 0.7, 1.6, 0.55, 1.12, 0.85];

// 20 distinct muted tones on the ink-and-gold palette
const CHART_COLORS = [
  '#D4B96A', '#8FB573', '#C97B67', '#5E9BC9', '#8D6CAB',
  '#C99667', '#7FAEA3', '#B08EA2', '#6577A0', '#A6803A',
  '#5C8A72', '#C25B72', '#4E8FB0', '#9A7BC9', '#D08A3E',
  '#4F9B8F', '#8A9B4F', '#B76E4A', '#7B87C9', '#98917F',
];

interface Segment {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  color: string;
  total: number;
  percentage: number;
  isSub?: boolean;
  children: Segment[]; // grouped view: subcategory breakdown
}

interface Props {
  /** Bump to make the chart refetch (dashboard reloads, syncs). */
  refreshKey?: number;
}

export function SpendingPieChart({ refreshKey = 0 }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const db = useDatabase();

  const [period, setPeriod] = useState<PeriodChoice>(loadPeriod);
  const [data, setData] = useState<any[]>([]);
  const [catMeta, setCatMeta] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [calTarget, setCalTarget] = useState<'from' | 'to' | null>(null);
  // Cashew's double-arrow: grouped (subs rolled into parents) vs ungrouped
  const [ungrouped, setUngrouped] = useState(() => Storage.getItemSync(GROUPING_KEY) === '1');
  const [openMains, setOpenMains] = useState<Set<string>>(new Set());

  useEffect(() => {
    const { start, end } = rangeFor(period);
    Promise.all([getSpendingByCategory(db, start, end), getAllCategories(db)]).then(([rows, cats]) => {
      setData(rows);
      setCatMeta(cats);
      setSelected(null);
    });
  }, [db, period.key, period.from, period.to, refreshKey]);

  const savePeriod = (p: PeriodChoice) => {
    setPeriod(p);
    Storage.setItemSync(PERIOD_KEY, JSON.stringify(p));
  };
  const pickPeriod = (key: PeriodKey) => {
    if (key === 'custom') savePeriod({ key, from: period.from, to: period.to });
    else savePeriod({ key });
  };
  const pickDate = (iso: string) => {
    const p = { ...period };
    if (calTarget === 'from') p.from = p.to && iso > p.to ? p.to : iso;
    else if (calTarget === 'to') p.to = p.from && iso < p.from ? p.from : iso;
    setCalTarget(null);
    savePeriod(p);
  };

  const toggleGrouping = () => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(150, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
    );
    setUngrouped((u) => {
      Storage.setItemSync(GROUPING_KEY, u ? '0' : '1');
      return !u;
    });
    setSelected(null);
  };

  const totalExpense = data.reduce((s, c) => s + c.total, 0);
  const metaById = new Map(catMeta.map((c: any) => [c.id, c]));

  // ── Build the family tree of spending ───────────────────
  // Group spending rows under their MAIN category; a row on a subcategory
  // contributes to its parent's total and appears as a child.
  interface Group { main: any; ownTotal: number; total: number; subs: Array<{ row: any; total: number }> }
  const groups = new Map<string, Group>();
  for (const r of data) {
    const meta = r.categoryId ? metaById.get(r.categoryId) : null;
    const mainId = meta?.parentId ?? r.categoryId ?? '__none__';
    if (!groups.has(mainId)) {
      const mainMeta = meta?.parentId ? metaById.get(meta.parentId) : null;
      groups.set(mainId, {
        main: mainMeta ?? (meta?.parentId ? null : r),
        ownTotal: 0,
        total: 0,
        subs: [],
      });
    }
    const g = groups.get(mainId)!;
    g.total += r.total;
    if (meta?.parentId) g.subs.push({ row: r, total: r.total });
    else {
      g.ownTotal += r.total;
      if (!g.main) g.main = r;
    }
  }

  // Unique color per MAIN family: explicit color wins once, palette fills in
  const usedColors = new Set<string>();
  let paletteIdx = 0;
  const nextPaletteColor = () => {
    while (usedColors.has(CHART_COLORS[paletteIdx % CHART_COLORS.length].toLowerCase())) paletteIdx++;
    return CHART_COLORS[paletteIdx % CHART_COLORS.length];
  };
  const orderedGroups = [...groups.values()].sort((a, b) => b.total - a.total);

  const segments: Segment[] = [];
  for (const g of orderedGroups) {
    const mainMeta = g.main?.categoryId ? metaById.get(g.main.categoryId) ?? g.main : g.main;
    const own = (mainMeta?.categoryColor ?? mainMeta?.color)?.toLowerCase?.();
    const color = own && !usedColors.has(own) ? (mainMeta.categoryColor ?? mainMeta.color) : nextPaletteColor();
    usedColors.add(color.toLowerCase());
    const name = g.main?.categoryName ?? mainMeta?.name ?? 'Uncategorized';
    const icon = g.main?.categoryIcon ?? mainMeta?.icon ?? null;
    const children: Segment[] = g.subs
      .sort((a, b) => b.total - a.total)
      .map((s, i) => ({
        categoryId: s.row.categoryId,
        categoryName: s.row.categoryName,
        categoryIcon: s.row.categoryIcon,
        color: shade(color, SUB_SHADES[i % SUB_SHADES.length]),
        total: s.total,
        percentage: totalExpense > 0 ? (s.total / totalExpense) * 100 : 0,
        isSub: true,
        children: [],
      }));
    segments.push({
      // g.main is a spending row (categoryId) or bare category meta (id)
      categoryId: g.main?.categoryId ?? g.main?.id ?? null,
      categoryName: name,
      categoryIcon: icon,
      color,
      total: g.total,
      percentage: totalExpense > 0 ? (g.total / totalExpense) * 100 : 0,
      children,
    });
    // In the UNGROUPED view the parent slice is only its direct spend
    if (ungrouped && children.length > 0) {
      segments[segments.length - 1] = {
        ...segments[segments.length - 1],
        total: g.ownTotal,
        percentage: totalExpense > 0 ? (g.ownTotal / totalExpense) * 100 : 0,
      };
    }
  }

  // Flat list for the ungrouped view: each family adjacent — parent's direct
  // spend, then its subcategories
  const flat: Segment[] = ungrouped
    ? segments.flatMap((s) => (s.total > 0.004 ? [s, ...s.children] : [...s.children]))
    : segments;

  // Collapsed = just the (larger) donut; expanded = full category list
  const visible = showAll ? flat : [];
  const selSeg = selected != null ? flat[selected] : null;

  const toggleShowAll = () => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(150, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
    );
    setShowAll((s) => !s);
  };

  const toggleMainOpen = (id: string) => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(130, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
    );
    setOpenMains((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const chip = (key: string, active: boolean, label: string, onPress: () => void) => (
    <TouchableOpacity
      key={key}
      style={[styles.chip, {
        backgroundColor: active ? colors.goldDim : colors.surfaceVariant,
        borderColor: active ? colors.hairlineStrong : 'transparent',
      }]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, { color: active ? colors.gold : colors.textTertiary }]}>{label}</Text>
    </TouchableOpacity>
  );

  const legendRow = (seg: Segment, key: string, indent = false) => (
    <TouchableOpacity
      key={key}
      style={[styles.row, indent && styles.rowIndent]}
      activeOpacity={0.6}
      disabled={!seg.categoryId || seg.categoryName === FEES_CATEGORY_NAME}
      onPress={() => router.push(`/(tabs)/transactions?categoryId=${seg.categoryId}` as any)}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.dot, { backgroundColor: seg.color }]} />
        <Text
          style={[indent ? styles.subLabel : styles.catLabel, { color: indent ? colors.textSecondary : colors.text }]}
          numberOfLines={1}
        >
          {seg.categoryIcon ? `${seg.categoryIcon} ` : ''}{seg.categoryName}
        </Text>
        {!indent && !ungrouped && seg.children.length > 0 && (
          <TouchableOpacity
            onPress={(e: any) => { e.stopPropagation?.(); toggleMainOpen(seg.categoryId!); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name={openMains.has(seg.categoryId!) ? 'chevron-up' : 'chevron-down'}
              size={17}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.rowRight}>
        <Text style={[indent ? styles.subAmount : styles.catAmount, { color: indent ? colors.textSecondary : colors.text }]}>
          {seg.total.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text style={[styles.catPercent, { color: colors.textTertiary }]}>
          {seg.percentage.toFixed(1)}%
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>Spending by Category</Text>
        {/* Cashew's double arrow: split families into subcategories / regroup */}
        <TouchableOpacity onPress={toggleGrouping} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons
            name="unfold-more-horizontal"
            size={19}
            color={ungrouped ? colors.gold : colors.textTertiary}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.chipRow}>
        {PERIODS.map((p) => chip(p.key, p.key === period.key, p.label, () => pickPeriod(p.key)))}
      </View>
      {period.key === 'custom' && (
        <View style={styles.chipRow}>
          {chip('from', false, `From: ${period.from ? shortDate(period.from) : 'Any'}`, () => setCalTarget('from'))}
          {chip('to', false, `To: ${period.to ? shortDate(period.to) : 'Any'}`, () => setCalTarget('to'))}
        </View>
      )}

      {flat.length === 0 || totalExpense === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No spending in this period
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.donutWrap}>
            <PieDonut
              slices={flat.map((seg) => ({ value: seg.total, color: seg.color, key: seg.categoryName }))}
              size={222}
              strokeWidth={38}
              selected={selected}
              onPressSlice={setSelected}
            >
              {selSeg ? (
                <>
                  <Text style={[styles.donutCenterLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                    {selSeg.categoryIcon ? `${selSeg.categoryIcon} ` : ''}{selSeg.categoryName}
                  </Text>
                  <Text style={[styles.donutCenterValue, { color: selSeg.color, marginTop: 3 }]}>
                    {selSeg.total.toLocaleString('en', { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={[styles.donutCenterLabel, { color: colors.textTertiary, marginTop: 2 }]}>
                    {selSeg.percentage.toFixed(1)}%
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.donutCenterValue, { color: colors.text }]}>
                    {totalExpense.toLocaleString('en', { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={[styles.donutCenterLabel, { color: colors.textTertiary }]}>ETB spent</Text>
                </>
              )}
            </PieDonut>
          </View>

          {showAll && (
            <View style={styles.list}>
              {visible.map((seg, i) => (
                <View key={seg.categoryId ?? `c${i}`}>
                  {legendRow(seg, `r${i}`, !!seg.isSub)}
                  {!ungrouped && seg.categoryId && openMains.has(seg.categoryId) &&
                    seg.children.map((child, j) => legendRow(child, `r${i}s${j}`, true))}
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity onPress={toggleShowAll} style={styles.expandBtn}>
            <Text style={[styles.expandText, { color: colors.gold }]}>
              {showAll ? 'Hide categories ▴' : `All ${flat.length} categories ▾`}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* Custom range calendar */}
      <Modal visible={calTarget !== null} transparent animationType="fade" onRequestClose={() => setCalTarget(null)}>
        <Pressable style={styles.calOverlay} onPress={() => setCalTarget(null)}>
          <View
            style={[styles.calSheet, { backgroundColor: colors.surface, borderColor: colors.hairlineStrong }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.title, { color: colors.textSecondary, marginBottom: 10 }]}>
              {calTarget === 'from' ? 'From date' : 'To date'}
            </Text>
            <CalendarPicker
              value={(calTarget === 'from' ? period.from : period.to) || null}
              onChange={pickDate}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 13,
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  title: { ...sectionLabel },
  chipRow: { flexDirection: 'row', gap: 7, alignItems: 'center', marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1 },
  chipText: { fontFamily: fonts.sansSemiBold, fontSize: 11 },
  donutWrap: { alignItems: 'center', marginBottom: 16, marginTop: 4 },
  donutCenterValue: { fontFamily: fonts.monoMedium, fontSize: 19 },
  donutCenterLabel: { fontFamily: fonts.sansBold, fontSize: 8.5, letterSpacing: 1.3, textTransform: 'uppercase', marginTop: 3 },
  list: { gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowIndent: { paddingLeft: 17, marginTop: 8 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12, gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  catLabel: { fontFamily: fonts.sansMedium, fontSize: 12.5, flexShrink: 1 },
  subLabel: { fontFamily: fonts.sans, fontSize: 11.5, flexShrink: 1 },
  rowRight: { alignItems: 'flex-end' },
  catAmount: { fontFamily: fonts.monoMedium, fontSize: 12.5 },
  subAmount: { fontFamily: fonts.mono, fontSize: 11.5 },
  catPercent: { fontFamily: fonts.mono, fontSize: 10, marginTop: 1 },
  expandBtn: { alignSelf: 'center', marginTop: 12 },
  expandText: { fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  emptyState: { padding: 24, alignItems: 'center' },
  emptyText: { fontFamily: fonts.sans, fontSize: 13 },
  calOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  calSheet: { borderRadius: 20, borderWidth: 1, padding: 18 },
});
