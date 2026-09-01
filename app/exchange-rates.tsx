import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, ScrollView, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts, sectionLabel } from '@/constants/Type';
import { useDatabase } from '@/src/db/provider';
import {
  getAllRates, setRate, fetchRatesToEtb, CurrencyRate,
} from '@/src/db/repository/rates';

/** The only rates the user actually manages. USDT/USDC are pegged 1:1 to USD,
 * so saving USD silently writes all three. */
const CURRENCIES = ['USD', 'EUR'];
const USD_PEGGED = ['USD', 'USDT', 'USDC'];

/**
 * Standalone exchange-rates editor (More → Exchange Rates). Rates convert
 * foreign balances and loans into the ETB totals everywhere; editing a rate
 * here saves it as manual so the auto-fetch never overrides it.
 */
export default function ExchangeRatesScreen() {
  const db = useDatabase();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState(false);

  const load = useCallback(async () => {
    const rateRows = await getAllRates(db);
    setRates(rateRows);
    const draft: Record<string, string> = {};
    for (const r of rateRows) draft[r.currency] = String(r.rateToEtb);
    setDrafts(draft);
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const rateFor = (code: string) => rates.find((r) => r.currency === code);
  const missing = CURRENCIES.filter((c) => !rateFor(c));

  const saveRate = async (code: string, value: number, source: 'manual' | 'auto') => {
    // 1 USD = 1 USDT = 1 USDC — the dollar rate drives all three
    for (const c of code === 'USD' ? USD_PEGGED : [code]) {
      await setRate(db, c, value, source);
    }
  };

  const saveDraft = async (code: string) => {
    const r = parseFloat((drafts[code] ?? '').replace(/,/g, ''));
    const existing = rateFor(code);
    if (isNaN(r) || r <= 0 || r === existing?.rateToEtb) return;
    await saveRate(code, r, 'manual');
    load();
  };

  const handleFetch = async () => {
    if (fetching) return;
    setFetching(true);
    try {
      const fetched = await fetchRatesToEtb(CURRENCIES);
      const codes = Object.keys(fetched);
      if (codes.length === 0) throw new Error('No rates found');
      for (const code of codes) await saveRate(code, fetched[code], 'auto');
      await load();
      Alert.alert(
        'Rates Updated',
        codes.map((c) => `1 ${c} = ETB ${fetched[c].toFixed(2)}`).join('\n') +
          '\n\nThese are official market rates — edit any rate to use your own.'
      );
    } catch (e: any) {
      Alert.alert('Fetch Failed', `${e.message}. Check your connection, or set rates manually.`);
    } finally {
      setFetching(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      <Text style={[styles.hint, { color: colors.textTertiary }]}>
        Used to convert balances and loans into the ETB totals — net worth, account ordering, and
        loan summaries. The USD rate also covers USDT and USDC (1:1). Edited rates are yours until
        you fetch again.
      </Text>
      {missing.length > 0 && (
        <Text style={[styles.hint, { color: colors.expense }]}>
          No rate for {missing.join(', ')} — those balances count as 0 until set.
        </Text>
      )}

      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        {CURRENCIES.map((code, i) => {
          const r = rateFor(code);
          return (
            <View
              key={code}
              style={[styles.row, i < CURRENCIES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.hairline }]}
            >
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>1 {code} =</Text>
                <Text style={[styles.rowSub, { color: colors.textTertiary }]}>
                  {code === 'USD' ? 'also USDT & USDC · ' : ''}
                  {r
                    ? `${r.source === 'auto' ? 'fetched' : 'set by you'}${r.updatedAt ? ` · ${r.updatedAt.split('T')[0]}` : ''}`
                    : 'not set'}
                </Text>
              </View>
              <View style={styles.rateInputWrap}>
                <TextInput
                  style={[styles.rateInput, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.hairline }]}
                  value={drafts[code] ?? ''}
                  onChangeText={(t) => setDrafts((d) => ({ ...d, [code]: t }))}
                  onEndEditing={() => saveDraft(code)}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                />
                <Text style={[styles.rateUnit, { color: colors.textTertiary }]}>ETB</Text>
              </View>
            </View>
          );
        })}
        <TouchableOpacity
          style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.hairline }]}
          onPress={handleFetch}
          disabled={fetching}
        >
          <Text style={[styles.fetchText, { color: colors.gold, opacity: fetching ? 0.5 : 1 }]}>
            {fetching ? 'Fetching…' : '↻ Fetch latest rates'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hint: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 16, marginHorizontal: 16, marginTop: 14 },
  group: {
    marginHorizontal: 13,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  rowText: { flex: 1, marginRight: 10 },
  rowTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13.5 },
  rowSub: { fontFamily: fonts.sans, fontSize: 11, marginTop: 2.5 },
  rateInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rateInput: {
    fontFamily: fonts.monoMedium,
    fontSize: 13.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 96,
    textAlign: 'right',
  },
  rateUnit: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1 },
  fetchText: { fontFamily: fonts.sansBold, fontSize: 12.5 },
});
