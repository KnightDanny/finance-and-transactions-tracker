import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import { getAllAccounts } from '@/src/db/repository/accounts';
import { insertTransaction } from '@/src/db/repository/transactions';
import { getAllCategories } from '@/src/db/repository/budgets';
import { resolveGap } from '@/src/reconciliation/engine';
import dayjs from 'dayjs';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function AddTransactionScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{
    gapId?: string;
    amount?: string;
    type?: string;
    accountId?: string;
    date?: string;
    bank?: string;
    accountNumber?: string;
  }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  // Whether this form was opened from reconciliation with pre-filled data
  const isFromGap = !!params.gapId;

  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [type, setType] = useState<'credit' | 'debit'>('debit');
  const [amount, setAmount] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));

  useEffect(() => {
    Promise.all([getAllAccounts(db), getAllCategories(db)]).then(([accs, cats]) => {
      setAccounts(accs);
      setCategories(cats);

      // Pre-fill from reconciliation gap params
      if (params.accountId) {
        setSelectedAccountId(params.accountId);
      } else if (accs.length > 0) {
        setSelectedAccountId(accs[0].id);
      }
      if (params.type === 'credit' || params.type === 'debit') {
        setType(params.type);
      }
      if (params.amount) {
        setAmount(params.amount);
      }
      if (params.date) {
        setDate(params.date);
      }
    });
  }, [db]);

  const handleSave = async () => {
    if (!selectedAccountId) {
      Alert.alert('Error', 'Please select an account.');
      return;
    }
    const parsedAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    const txnId = await insertTransaction(db, {
      accountId: selectedAccountId,
      type,
      amount: parsedAmount,
      totalAmount: parsedAmount,
      counterparty: counterparty || undefined,
      categoryId: selectedCategoryId || undefined,
      date,
      source: isFromGap ? 'reconciliation' : 'manual',
      note: note || undefined,
    });

    // If from reconciliation, mark the gap as resolved
    if (isFromGap && params.gapId && txnId) {
      await resolveGap(db, params.gapId, txnId);
    }

    router.back();
  };

  const chipBg = isDark ? '#333' : '#e0e0e0';
  const chipTextColor = isDark ? '#ddd' : '#333';
  const selectedChipBg = '#2f95dc';
  const inputStyle = [styles.input, { color: colors.text, borderColor: isDark ? '#444' : '#ddd' }];

  // Account display name for gap pre-fill
  const gapAccountLabel = params.bank
    ? `${params.bank}${params.accountNumber ? ` ...${params.accountNumber.slice(-4)}` : ''}`
    : '';

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {isFromGap ? (
        /* Pre-filled summary from reconciliation gap */
        <View style={[styles.prefilledCard, { backgroundColor: isDark ? '#1a2a3a' : '#e3f2fd' }]}>
          <Text style={[styles.prefilledTitle, { color: isDark ? '#8cf' : '#1565c0' }]}>
            Resolving Balance Gap
          </Text>
          <View style={styles.prefilledRow}>
            <Text style={[styles.prefilledLabel, { color: colors.text }]}>Type</Text>
            <Text style={[styles.prefilledValue, { color: type === 'credit' ? '#27ae60' : '#e74c3c' }]}>
              {type === 'credit' ? 'Income' : 'Expense'}
            </Text>
          </View>
          <View style={styles.prefilledRow}>
            <Text style={[styles.prefilledLabel, { color: colors.text }]}>Amount</Text>
            <Text style={[styles.prefilledValue, { color: colors.text }]}>ETB {amount}</Text>
          </View>
          <View style={styles.prefilledRow}>
            <Text style={[styles.prefilledLabel, { color: colors.text }]}>Account</Text>
            <Text style={[styles.prefilledValue, { color: colors.text }]}>{gapAccountLabel}</Text>
          </View>
          <View style={styles.prefilledRow}>
            <Text style={[styles.prefilledLabel, { color: colors.text }]}>Date</Text>
            <Text style={[styles.prefilledValue, { color: colors.text }]}>{date}</Text>
          </View>
        </View>
      ) : (
        <>
          {/* Type Toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, { backgroundColor: isDark ? '#333' : '#e0e0e0' }, type === 'debit' && { backgroundColor: '#e74c3c' }]}
              onPress={() => setType('debit')}
            >
              <Text style={[styles.toggleText, { color: isDark ? '#ddd' : '#333' }, type === 'debit' && { color: '#fff' }]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, { backgroundColor: isDark ? '#333' : '#e0e0e0' }, type === 'credit' && { backgroundColor: '#27ae60' }]}
              onPress={() => setType('credit')}
            >
              <Text style={[styles.toggleText, { color: isDark ? '#ddd' : '#333' }, type === 'credit' && { color: '#fff' }]}>Income</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Amount (ETB)</Text>
          <TextInput
            style={inputStyle}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={isDark ? '#666' : '#aaa'}
          />

          <Text style={[styles.label, { color: colors.text }]}>Account</Text>
          <View style={styles.chipRow}>
            {accounts.map((acc: any) => {
              const isSelected = selectedAccountId === acc.id;
              return (
                <TouchableOpacity
                  key={acc.id}
                  style={[styles.chip, { backgroundColor: isSelected ? selectedChipBg : chipBg }]}
                  onPress={() => setSelectedAccountId(acc.id)}
                >
                  <Text style={[styles.chipText, { color: isSelected ? '#fff' : chipTextColor }]}>
                    {acc.label || `${acc.bank} ...${acc.accountNumber.slice(-4)}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Date</Text>
          <TextInput
            style={inputStyle}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={isDark ? '#666' : '#aaa'}
          />
        </>
      )}

      <Text style={[styles.label, { color: colors.text }]}>{type === 'credit' ? 'From' : 'To'}</Text>
      <TextInput
        style={inputStyle}
        value={counterparty}
        onChangeText={setCounterparty}
        placeholder="Name (optional)"
        placeholderTextColor={isDark ? '#666' : '#aaa'}
      />

      <Text style={[styles.label, { color: colors.text }]}>Category</Text>
      <View style={styles.chipRow}>
        {categories
          .filter((c: any) => c.type === (type === 'credit' ? 'income' : 'expense'))
          .map((cat: any) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, { backgroundColor: isSelected ? selectedChipBg : chipBg }]}
                onPress={() => setSelectedCategoryId(selectedCategoryId === cat.id ? '' : cat.id)}
              >
                <Text style={[styles.chipText, { color: isSelected ? '#fff' : chipTextColor }]}>
                  {cat.icon} {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Note</Text>
      <TextInput
        style={[...inputStyle, { height: 80, textAlignVertical: 'top' }]}
        value={note}
        onChangeText={setNote}
        multiline
        placeholder="Optional note"
        placeholderTextColor={isDark ? '#666' : '#aaa'}
      />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Save Transaction</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  prefilledCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  prefilledTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  prefilledRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  prefilledLabel: { fontSize: 14, opacity: 0.7 },
  prefilledValue: { fontSize: 14, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  chipText: { fontSize: 13 },
  saveBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 40,
    backgroundColor: '#2f95dc',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
