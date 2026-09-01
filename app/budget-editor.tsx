import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity, TextInput, Alert, Modal, Pressable, LayoutAnimation } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useDatabase } from '@/src/db/provider';
import { getExpenseCategories } from '@/src/db/repository/budgets';
import { getPeriodBudgets, savePeriodBudget, deletePeriodBudget } from '@/src/db/repository/periodBudgets';
import { AmountInput } from '@/src/components/AmountInput';
import { CalendarPicker } from '@/src/components/CalendarPicker';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts, sectionLabel } from '@/constants/Type';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
};

/** Full-page budget editor — one scroll surface, no nested-scroll jank. */
export default function BudgetEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useDatabase();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  const [allCats, setAllCats] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [limitInput, setLimitInput] = useState('');
  const [period, setPeriod] = useState<'month' | 'custom'>('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [calTarget, setCalTarget] = useState<'from' | 'to' | null>(null);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [catLimits, setCatLimits] = useState<Record<string, string>>({});
  const [editingCapId, setEditingCapId] = useState<string | null>(null);
  const [showOnHome, setShowOnHome] = useState(true);
  const [catsOpen, setCatsOpen] = useState(false);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const toggleOpen = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(140, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
    );
    setter((o) => !o);
  };

  const mainCats = allCats.filter((c) => !c.parentId);
  const subsOf = (mainId: string) => allCats.filter((c) => c.parentId === mainId);

  useEffect(() => {
    (async () => {
      const cats = (await getExpenseCategories(db)) as any[];
      setAllCats(cats);
      if (id) {
        const budget = (await getPeriodBudgets(db)).find((b) => b.id === id);
        if (budget) {
          setName(budget.name ?? '');
          setLimitInput(String(budget.limitAmount));
          setPeriod(budget.period);
          setFromDate(budget.startDate ?? '');
          setToDate(budget.endDate ?? '');
          if (budget.categoryIds === null) {
            setSelectedCats(new Set(cats.map((c: any) => c.id)));
          } else {
            // Legacy sets held only main ids meaning "whole family" — expand
            const set = new Set(budget.categoryIds);
            const hasSubs = budget.categoryIds.some((cid) => cats.find((c: any) => c.id === cid)?.parentId);
            if (!hasSubs) {
              for (const cid of budget.categoryIds) {
                for (const s of cats.filter((c: any) => c.parentId === cid)) set.add(s.id);
              }
            }
            setSelectedCats(set);
          }
          setCatLimits(Object.fromEntries(Object.entries(budget.categoryLimits ?? {}).map(([k, v]) => [k, String(v)])));
          setShowOnHome(budget.showOnHome);
        }
      } else {
        setSelectedCats(new Set(cats.map((c: any) => c.id))); // all ON by default
      }
      setLoaded(true);
    })();
  }, [db, id]);

  const toggleCat = (catId: string) => {
    const isMain = allCats.some((c) => c.id === catId && !c.parentId);
    setSelectedCats((prev) => {
      const next = new Set(prev);
      const turningOn = !next.has(catId);
      turningOn ? next.add(catId) : next.delete(catId);
      if (isMain) {
        for (const s of subsOf(catId)) turningOn ? next.add(s.id) : next.delete(s.id);
      }
      return next;
    });
  };
  const allOn = allCats.length > 0 && selectedCats.size === allCats.length;
  const toggleAll = () => setSelectedCats(allOn ? new Set() : new Set(allCats.map((c) => c.id)));

  const handleSave = async () => {
    const amount = parseFloat(limitInput.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid budget amount.');
      return;
    }
    if (selectedCats.size === 0) {
      Alert.alert('No categories', 'Turn on at least one category for this budget.');
      return;
    }
    const limits: Record<string, number> = {};
    for (const [catId, raw] of Object.entries(catLimits)) {
      if (!selectedCats.has(catId) && !subsOf(catId).some((s: any) => selectedCats.has(s.id))) continue;
      const v = parseFloat(raw.replace(/,/g, ''));
      if (!isNaN(v) && v > 0) limits[catId] = v;
    }
    await savePeriodBudget(db, {
      id: id || undefined,
      name: name || undefined,
      limitAmount: amount,
      period,
      startDate: fromDate || undefined,
      endDate: toDate || undefined,
      categoryIds: allOn ? null : [...selectedCats],
      categoryLimits: limits,
      showOnHome,
    });
    router.back();
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Remove Budget', 'Remove this budget?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await deletePeriodBudget(db, id);
          router.back();
        },
      },
    ]);
  };

  const pickDate = (iso: string) => {
    if (calTarget === 'from') setFromDate(toDate && iso > toDate ? toDate : iso);
    else if (calTarget === 'to') setToDate(fromDate && iso < fromDate ? fromDate : iso);
    setCalTarget(null);
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
      <Text style={[styles.chipText, { color: active ? colors.gold : colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );

  if (!loaded) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name (optional)</Text>
        <TextInput
          style={[styles.nameInput, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.hairline }]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Everyday spending"
          placeholderTextColor={colors.textTertiary}
          maxLength={40}
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>Limit (ETB)</Text>
        <AmountInput
          style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.hairline }]}
          value={limitInput}
          onChangeText={setLimitInput}
          placeholder="e.g. 5000"
          placeholderTextColor={colors.textTertiary}
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>Period</Text>
        <View style={styles.chipRow}>
          {chip('month', period === 'month', 'Every month', () => setPeriod('month'))}
          {chip('custom', period === 'custom', 'Custom period', () => setPeriod('custom'))}
        </View>
        {period === 'custom' && (
          <View style={[styles.chipRow, { marginTop: 8 }]}>
            {chip('from', false, `From: ${fromDate ? shortDate(fromDate) : 'Any'}`, () => setCalTarget('from'))}
            {chip('to', false, `To: ${toDate ? shortDate(toDate) : 'Any'}`, () => setCalTarget('to'))}
          </View>
        )}

        {/* Categories — collapsible, fixed-height box with its own scroll bar */}
        <TouchableOpacity style={[styles.catsHeader, { marginTop: 18 }]} onPress={() => toggleOpen(setCatsOpen)} activeOpacity={0.6}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>Categories</Text>
          <View style={styles.headerRight}>
            <Text style={[styles.headerSummary, { color: colors.textTertiary }]}>
              {allOn ? 'All' : `${selectedCats.size} of ${allCats.length}`}
            </Text>
            <Feather name={catsOpen ? 'chevron-up' : 'chevron-down'} size={15} color={colors.textTertiary} />
          </View>
        </TouchableOpacity>
        {catsOpen && (
        <>
        <View style={[styles.catsHeader, { marginTop: 8 }]}>
          <Text style={[styles.catsHint, { color: colors.textTertiary, flex: 1, marginTop: 0, marginBottom: 0 }]}>
            {allOn
              ? 'All spending counts — including new categories and fees.'
              : 'Only the selected categories count.'}
          </Text>
          <TouchableOpacity onPress={toggleAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.allToggle, { color: colors.gold }]}>{allOn ? 'All off' : 'All on'}</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.catBox, { borderColor: colors.hairline, backgroundColor: colors.surfaceVariant, marginTop: 10 }]}>
          <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled persistentScrollbar keyboardShouldPersistTaps="handled">
          {mainCats.map((cat: any, i: number) => {
            const on = selectedCats.has(cat.id);
            return (
              <View key={cat.id} style={i > 0 && { borderTopWidth: 1, borderTopColor: colors.hairline }}>
                <TouchableOpacity style={styles.catRow} onPress={() => toggleCat(cat.id)} activeOpacity={0.6}>
                  <Feather name={on ? 'check-circle' : 'circle'} size={15} color={on ? colors.gold : colors.textTertiary} />
                  <Text style={[styles.catRowText, { color: on ? colors.text : colors.textTertiary }]} numberOfLines={1}>
                    {cat.icon} {cat.name}
                  </Text>
                </TouchableOpacity>
                {subsOf(cat.id).map((sub: any) => {
                  const subOn = selectedCats.has(sub.id);
                  return (
                    <TouchableOpacity key={sub.id} style={styles.catSubRow} onPress={() => toggleCat(sub.id)} activeOpacity={0.6}>
                      <Feather name={subOn ? 'check-circle' : 'circle'} size={12} color={subOn ? colors.gold : colors.textTertiary} />
                      <Text style={[styles.catSubRowText, { color: subOn ? colors.textSecondary : colors.textTertiary }]} numberOfLines={1}>
                        {sub.icon} {sub.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
          </ScrollView>
        </View>
        </>
        )}

        {/* Per-category limits — collapsible, tap a value to edit */}
        {selectedCats.size > 0 && (
          <>
            <TouchableOpacity style={[styles.catsHeader, { marginTop: 16 }]} onPress={() => toggleOpen(setLimitsOpen)} activeOpacity={0.6}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>
                Per-category limits
              </Text>
              <View style={styles.headerRight}>
                <Text style={[styles.headerSummary, { color: colors.textTertiary }]}>
                  {(() => {
                    const n = Object.entries(catLimits).filter(([cid, v]) => selectedCats.has(cid) && parseFloat(v) > 0).length;
                    return n > 0 ? `${n} set` : 'None';
                  })()}
                </Text>
                <Feather name={limitsOpen ? 'chevron-up' : 'chevron-down'} size={15} color={colors.textTertiary} />
              </View>
            </TouchableOpacity>
            {limitsOpen && (
            <View style={[styles.catBox, { borderColor: colors.hairline, backgroundColor: colors.surfaceVariant, marginTop: 8 }]}>
              <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled persistentScrollbar keyboardShouldPersistTaps="handled">
              {mainCats.filter((c) => selectedCats.has(c.id) || subsOf(c.id).some((s: any) => selectedCats.has(s.id)))
                .flatMap((cat: any) => [
                  { ...cat, indent: false },
                  ...subsOf(cat.id).filter((s: any) => selectedCats.has(s.id)).map((s: any) => ({ ...s, indent: true })),
                ])
                .map((cat: any, i: number) => (
                  <View
                    key={cat.id}
                    style={[styles.limitRow, i > 0 && !cat.indent && { borderTopWidth: 1, borderTopColor: colors.hairline }]}
                  >
                    <Text
                      style={[
                        cat.indent ? styles.catSubRowText : styles.catRowText,
                        { color: cat.indent ? colors.textSecondary : colors.text, paddingLeft: cat.indent ? 22 : 0 },
                      ]}
                      numberOfLines={1}
                    >
                      {cat.indent ? '└ ' : ''}{cat.icon} {cat.name}
                    </Text>
                    {editingCapId === cat.id ? (
                      <TextInput
                        style={[styles.limitInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.hairlineStrong }]}
                        value={catLimits[cat.id] ?? ''}
                        onChangeText={(t) => setCatLimits((prev) => ({ ...prev, [cat.id]: t }))}
                        placeholder="—"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="numeric"
                        autoFocus
                        onBlur={() => setEditingCapId(null)}
                        onSubmitEditing={() => setEditingCapId(null)}
                      />
                    ) : (
                      <TouchableOpacity
                        style={[styles.limitInput, { backgroundColor: colors.surface, borderColor: colors.hairline, justifyContent: 'center' }]}
                        onPress={() => setEditingCapId(cat.id)}
                      >
                        <Text style={[styles.limitValue, { color: parseFloat(catLimits[cat.id]) > 0 ? colors.text : colors.textTertiary }]}>
                          {parseFloat(catLimits[cat.id]) > 0 ? catLimits[cat.id] : '—'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
            )}
          </>
        )}

        {/* Home visibility */}
        <View style={[styles.catsHeader, { marginTop: 18 }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>Show on Home</Text>
          {chip('home', showOnHome, showOnHome ? 'Shown' : 'Hidden', () => setShowOnHome((s) => !s))}
        </View>

        {id && (
          <TouchableOpacity onPress={handleDelete} style={{ marginTop: 26, alignSelf: 'center' }}>
            <Text style={[styles.deleteText, { color: colors.expense }]}>Remove this budget</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Frozen save bar */}
      <View style={[styles.saveBar, { backgroundColor: colors.background, borderTopColor: colors.hairline }]}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.gold, opacity: limitInput ? 1 : 0.5 }]}
          onPress={handleSave}
          disabled={!limitInput}
        >
          <Text style={[styles.saveBtnText, { color: isDark ? '#0C0B09' : '#FFFDF8' }]}>
            {id ? 'Save Changes' : 'Create Budget'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Custom period calendar */}
      <Modal visible={calTarget !== null} transparent animationType="fade" onRequestClose={() => setCalTarget(null)}>
        <Pressable style={styles.overlay} onPress={() => setCalTarget(null)}>
          <View
            style={[styles.calSheet, { backgroundColor: colors.surface, borderColor: colors.hairlineStrong }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 10 }]}>
              {calTarget === 'from' ? 'From date' : 'To date'}
            </Text>
            <CalendarPicker value={(calTarget === 'from' ? fromDate : toDate) || null} onChange={pickDate} allowFuture />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fieldLabel: { ...sectionLabel, fontSize: 9.5, marginBottom: 8 },
  nameInput: { fontFamily: fonts.sans, fontSize: 14, padding: 12, borderRadius: 12, borderWidth: 1 },
  input: { fontFamily: fonts.monoMedium, fontSize: 16, padding: 14, borderRadius: 12, borderWidth: 1 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99, borderWidth: 1 },
  chipText: { fontFamily: fonts.sansSemiBold, fontSize: 12 },
  catsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerSummary: { fontFamily: fonts.sans, fontSize: 11.5 },
  allToggle: { fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase' },
  catsHint: { fontFamily: fonts.sans, fontSize: 10.5, marginTop: 5, marginBottom: 10 },
  catBox: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 9 },
  catRowText: { fontFamily: fonts.sansMedium, fontSize: 12.5, flex: 1 },
  catSubRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 34, paddingRight: 12, paddingVertical: 6 },
  catSubRowText: { fontFamily: fonts.sans, fontSize: 11.5, flex: 1 },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 6 },
  limitInput: {
    width: 96, height: 36, textAlign: 'right', fontFamily: fonts.monoMedium, fontSize: 13,
    paddingHorizontal: 10, paddingVertical: 0, borderRadius: 10, borderWidth: 1,
  },
  limitValue: { fontFamily: fonts.monoMedium, fontSize: 13, textAlign: 'right' },
  deleteText: { fontFamily: fonts.sansBold, fontSize: 12.5 },
  saveBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 14, borderTopWidth: 1,
  },
  saveBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveBtnText: { fontFamily: fonts.sansBold, fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  calSheet: { borderRadius: 20, borderWidth: 1, padding: 18 },
});
