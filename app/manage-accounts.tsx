import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet, ScrollView, View, Text, TextInput, TouchableOpacity, Alert, Modal, Pressable,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts, sectionLabel } from '@/constants/Type';
import { useDatabase } from '@/src/db/provider';
import {
  getAllAccounts, createManualAccount, updateManualBalance, deleteManualAccount,
} from '@/src/db/repository/accounts';
import {
  getAllRates, setRate, fetchRatesToEtb, COMMON_CURRENCIES, CurrencyRate,
} from '@/src/db/repository/rates';
import { getBankConfig } from '@/src/utils/bankConfig';
import { formatMoney } from '@/src/utils/currency';
import { useBalancePrivacy, MASKED } from '@/src/state/balancePrivacy';
import { AmountInput } from '@/src/components/AmountInput';

export default function ManageAccountsScreen() {
  const db = useDatabase();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const hidden = useBalancePrivacy((s) => s.hidden);

  const [accounts, setAccounts] = useState<any[]>([]);
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState(false);

  // Add-account modal
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USDT');
  const [customCurrency, setCustomCurrency] = useState('');
  const [balance, setBalance] = useState('');
  const [newRate, setNewRate] = useState('');

  // Update-balance modal
  const [editAccount, setEditAccount] = useState<any>(null);
  const [editBalance, setEditBalance] = useState('');

  const load = useCallback(async () => {
    const [accs, rateRows] = await Promise.all([getAllAccounts(db), getAllRates(db)]);
    setAccounts(accs);
    setRates(rateRows);
    const drafts: Record<string, string> = {};
    for (const r of rateRows) drafts[r.currency] = String(r.rateToEtb);
    setRateDrafts(drafts);
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const chosenCurrency = (currency === 'OTHER' ? customCurrency : currency).trim().toUpperCase();
  const rateFor = (code: string) => rates.find((r) => r.currency === code);
  const needsRateInput = chosenCurrency !== 'ETB' && chosenCurrency !== '' && !rateFor(chosenCurrency);

  /** Non-ETB currencies that matter: in use by an account, or already saved. */
  const trackedCurrencies = Array.from(
    new Set([
      ...accounts.map((a) => a.currency ?? 'ETB'),
      ...rates.map((r) => r.currency),
    ])
  ).filter((c) => c !== 'ETB');

  const missingRates = trackedCurrencies.filter((c) => !rateFor(c));

  const submitAdd = async () => {
    const bal = parseFloat(balance);
    if (!name.trim() || !chosenCurrency || isNaN(bal)) return;
    if (accounts.some((a) => a.isManual && a.accountNumber === name.trim())) {
      Alert.alert('Name taken', 'A manual account with this name already exists.');
      return;
    }
    if (needsRateInput) {
      const r = parseFloat(newRate);
      if (isNaN(r) || r <= 0) {
        Alert.alert('Rate needed', `Enter what 1 ${chosenCurrency} is worth in ETB so it can count toward net worth.`);
        return;
      }
      await setRate(db, chosenCurrency, r, 'manual');
    }
    await createManualAccount(db, { name: name.trim(), currency: chosenCurrency, balance: bal });
    setShowAdd(false);
    setName(''); setBalance(''); setNewRate(''); setCurrency('USDT'); setCustomCurrency('');
    load();
  };

  const submitBalance = async () => {
    const bal = parseFloat(editBalance);
    if (!editAccount || isNaN(bal)) return;
    await updateManualBalance(db, editAccount.id, bal);
    setEditAccount(null);
    load();
  };

  const confirmDelete = (account: any) => {
    Alert.alert('Delete Account', `Remove “${account.label}” and its balance history?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteManualAccount(db, account.id);
          load();
        },
      },
    ]);
  };

  const saveRateDraft = async (code: string) => {
    const r = parseFloat(rateDrafts[code] ?? '');
    const existing = rateFor(code);
    if (isNaN(r) || r <= 0 || r === existing?.rateToEtb) return;
    await setRate(db, code, r, 'manual');
    load();
  };

  const handleFetchRates = async () => {
    if (fetching || trackedCurrencies.length === 0) return;
    setFetching(true);
    try {
      const fetched = await fetchRatesToEtb(trackedCurrencies);
      const codes = Object.keys(fetched);
      if (codes.length === 0) throw new Error('No rates found for your currencies');
      for (const code of codes) await setRate(db, code, fetched[code], 'auto');
      await load();
      const skipped = trackedCurrencies.filter((c) => !codes.includes(c));
      Alert.alert(
        'Rates Updated',
        codes.map((c) => `1 ${c} = ETB ${fetched[c].toFixed(2)}`).join('\n') +
          (skipped.length ? `\n\nNot found: ${skipped.join(', ')}` : '') +
          '\n\nThese are official market rates — edit any rate to use your own.'
      );
    } catch (e: any) {
      Alert.alert('Fetch Failed', `${e.message}. Check your connection, or set rates manually.`);
    } finally {
      setFetching(false);
    }
  };

  const manualAccounts = accounts.filter((a) => a.isManual);
  const bankAccounts = accounts.filter((a) => !a.isManual);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      {/* Manual accounts */}
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Manual Accounts</Text>
      <Text style={[styles.hint, { color: colors.textTertiary }]}>
        USD, USDT, USDC and other holdings you update yourself. They count toward net worth at the saved rate.
      </Text>
      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        {manualAccounts.map((a, i) => (
          <TouchableOpacity
            key={a.id}
            style={[styles.row, i < manualAccounts.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.hairline }]}
            onPress={() => { setEditAccount(a); setEditBalance(String(a.latestBalance ?? 0)); }}
            onLongPress={() => confirmDelete(a)}
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{a.label}</Text>
              <Text style={[styles.rowSub, { color: colors.textTertiary }]}>
                {a.currency}{!rateFor(a.currency) && a.currency !== 'ETB' ? ' · rate not set' : ''} · tap to update
              </Text>
            </View>
            <Text style={[styles.rowAmount, { color: hidden ? colors.textTertiary : colors.text }]}>
              {hidden ? MASKED : formatMoney(a.latestBalance ?? 0, a.currency)}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.row, manualAccounts.length > 0 && { borderTopWidth: 1, borderTopColor: colors.hairline }]}
          onPress={() => setShowAdd(true)}
        >
          <Text style={[styles.addText, { color: colors.gold }]}>+ Add manual account</Text>
        </TouchableOpacity>
      </View>

      {/* Exchange rates */}
      {trackedCurrencies.length > 0 && (
        <>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Exchange Rates</Text>
          {missingRates.length > 0 && (
            <Text style={[styles.hint, { color: colors.expense }]}>
              No rate for {missingRates.join(', ')} — those balances count as 0 in net worth until set.
            </Text>
          )}
          <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            {trackedCurrencies.map((code, i) => {
              const r = rateFor(code);
              return (
                <View
                  key={code}
                  style={[styles.row, i < trackedCurrencies.length && { borderBottomWidth: 1, borderBottomColor: colors.hairline }]}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>1 {code} =</Text>
                    {r && (
                      <Text style={[styles.rowSub, { color: colors.textTertiary }]}>
                        {r.source === 'auto' ? 'fetched' : 'set by you'}
                        {r.updatedAt ? ` · ${r.updatedAt.split('T')[0]}` : ''}
                      </Text>
                    )}
                  </View>
                  <View style={styles.rateInputWrap}>
                    <TextInput
                      style={[styles.rateInput, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.hairline }]}
                      value={rateDrafts[code] ?? ''}
                      onChangeText={(t) => setRateDrafts((d) => ({ ...d, [code]: t }))}
                      onEndEditing={() => saveRateDraft(code)}
                      placeholder="0.00"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                    />
                    <Text style={[styles.rateUnit, { color: colors.textTertiary }]}>ETB</Text>
                  </View>
                </View>
              );
            })}
            <TouchableOpacity style={styles.row} onPress={handleFetchRates} disabled={fetching}>
              <Text style={[styles.addText, { color: colors.gold, opacity: fetching ? 0.5 : 1 }]}>
                {fetching ? 'Fetching…' : '↻ Fetch latest rates'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Bank accounts (read-only here) */}
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Bank Accounts</Text>
      <Text style={[styles.hint, { color: colors.textTertiary }]}>Synced automatically from SMS.</Text>
      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        {bankAccounts.map((a, i) => (
          <View
            key={a.id}
            style={[styles.row, i < bankAccounts.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.hairline }]}
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                {a.label || `${getBankConfig(a.bank).name} ...${a.accountNumber.slice(-4)}`}
              </Text>
              <Text style={[styles.rowSub, { color: colors.textTertiary }]}>{getBankConfig(a.bank).name}</Text>
            </View>
            <Text style={[styles.rowAmount, { color: hidden ? colors.textTertiary : colors.text }]}>
              {hidden ? MASKED : formatMoney(a.latestBalance ?? 0, a.currency ?? 'ETB')}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ height: 32 }} />

      {/* Add manual account */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={styles.overlay} onPress={() => setShowAdd(false)}>
            <View
              style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.hairlineStrong }]}
              onStartShouldSetResponder={() => true}
            >
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New Manual Account</Text>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.hairline }]}
                value={name} onChangeText={setName}
                placeholder="e.g. Binance USDT" placeholderTextColor={colors.textTertiary}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>Currency</Text>
              <View style={styles.chipRow}>
                {[...COMMON_CURRENCIES, 'OTHER'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, {
                      backgroundColor: currency === c ? colors.goldDim : colors.surfaceVariant,
                      borderColor: currency === c ? colors.hairlineStrong : 'transparent',
                    }]}
                    onPress={() => setCurrency(c)}
                  >
                    <Text style={[styles.chipText, { color: currency === c ? colors.gold : colors.textSecondary }]}>
                      {c === 'OTHER' ? 'Other…' : c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {currency === 'OTHER' && (
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.hairline, marginTop: 8 }]}
                  value={customCurrency} onChangeText={setCustomCurrency}
                  placeholder="Currency code, e.g. BTC" placeholderTextColor={colors.textTertiary}
                  autoCapitalize="characters"
                />
              )}

              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                Current balance{chosenCurrency ? ` (${chosenCurrency})` : ''}
              </Text>
              <AmountInput
                style={[styles.input, styles.mono, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.hairline }]}
                value={balance} onChangeText={setBalance}
                placeholder="0.00" placeholderTextColor={colors.textTertiary}
              />

              {needsRateInput && (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                    Rate: 1 {chosenCurrency} = ? ETB
                  </Text>
                  <TextInput
                    style={[styles.input, styles.mono, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.hairline }]}
                    value={newRate} onChangeText={setNewRate}
                    placeholder="0.00" placeholderTextColor={colors.textTertiary} keyboardType="numeric"
                  />
                </>
              )}

              <View style={styles.actions}>
                <TouchableOpacity onPress={() => setShowAdd(false)}>
                  <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.gold, opacity: name.trim() && balance && chosenCurrency ? 1 : 0.5 }]}
                  disabled={!name.trim() || !balance || !chosenCurrency}
                  onPress={submitAdd}
                >
                  <Text style={[styles.saveText, { color: isDark ? '#0C0B09' : '#FFFDF8' }]}>Add Account</Text>
                </TouchableOpacity>
              </View>
              </ScrollView>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Update balance */}
      <Modal visible={!!editAccount} transparent animationType="fade" onRequestClose={() => setEditAccount(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={styles.overlay} onPress={() => setEditAccount(null)}>
            <View
              style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.hairlineStrong }]}
              onStartShouldSetResponder={() => true}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>{editAccount?.label}</Text>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                New balance ({editAccount?.currency})
              </Text>
              <AmountInput
                style={[styles.input, styles.mono, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.hairline }]}
                value={editBalance} onChangeText={setEditBalance}
                placeholder="0.00" placeholderTextColor={colors.textTertiary}
                autoFocus
              />
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => setEditAccount(null)}>
                  <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.gold }]} onPress={submitBalance}>
                  <Text style={[styles.saveText, { color: isDark ? '#0C0B09' : '#FFFDF8' }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectionHeader: { ...sectionLabel, paddingHorizontal: 16, paddingTop: 20 },
  hint: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 16, marginHorizontal: 16, marginTop: 6 },
  group: {
    marginHorizontal: 13,
    marginTop: 10,
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
  rowAmount: { fontFamily: fonts.monoMedium, fontSize: 14 },
  addText: { fontFamily: fonts.sansBold, fontSize: 12.5 },
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { width: '100%', maxHeight: '100%', borderRadius: 20, borderWidth: 1, padding: 22 },
  modalTitle: { fontFamily: fonts.sansBold, fontSize: 17, marginBottom: 14 },
  fieldLabel: { ...sectionLabel, fontSize: 9.5, marginBottom: 7 },
  input: { fontFamily: fonts.sans, fontSize: 14, padding: 12, borderRadius: 12, borderWidth: 1 },
  mono: { fontFamily: fonts.monoMedium },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, borderWidth: 1 },
  chipText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 20, marginTop: 20 },
  cancelText: { fontFamily: fonts.sansMedium, fontSize: 13 },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12 },
  saveText: { fontFamily: fonts.sansBold, fontSize: 13 },
});
