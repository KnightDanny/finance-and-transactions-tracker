import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import { getAllAccounts } from '@/src/db/repository/accounts';
import { insertTransaction } from '@/src/db/repository/transactions';
import { getAllCategories } from '@/src/db/repository/budgets';
import dayjs from 'dayjs';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function AddTransactionScreen() {
  const db = useDatabase();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

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
      if (accs.length > 0) setSelectedAccountId(accs[0].id);
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

    await insertTransaction(db, {
      accountId: selectedAccountId,
      type,
      amount: parsedAmount,
      totalAmount: parsedAmount,
      counterparty: counterparty || undefined,
      categoryId: selectedCategoryId || undefined,
      date,
      source: 'manual',
      note: note || undefined,
    });

    router.back();
  };

  const inputStyle = [styles.input, { color: colors.text, borderColor: colorScheme === 'dark' ? '#444' : '#ddd' }];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Type Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, type === 'debit' && { backgroundColor: '#e74c3c' }]}
          onPress={() => setType('debit')}
        >
          <Text style={[styles.toggleText, type === 'debit' && { color: '#fff' }]}>Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, type === 'credit' && { backgroundColor: '#27ae60' }]}
          onPress={() => setType('credit')}
        >
          <Text style={[styles.toggleText, type === 'credit' && { color: '#fff' }]}>Income</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Amount (ETB)</Text>
      <TextInput
        style={inputStyle}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={colorScheme === 'dark' ? '#666' : '#aaa'}
      />

      <Text style={[styles.label, { color: colors.text }]}>Account</Text>
      <View style={styles.chipRow}>
        {accounts.map((acc: any) => (
          <TouchableOpacity
            key={acc.id}
            style={[styles.chip, selectedAccountId === acc.id && { backgroundColor: colors.tint }]}
            onPress={() => setSelectedAccountId(acc.id)}
          >
            <Text style={[styles.chipText, selectedAccountId === acc.id && { color: '#fff' }]}>
              {acc.label || `${acc.bank} ...${acc.accountNumber.slice(-4)}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>{type === 'credit' ? 'From' : 'To'}</Text>
      <TextInput
        style={inputStyle}
        value={counterparty}
        onChangeText={setCounterparty}
        placeholder="Name (optional)"
        placeholderTextColor={colorScheme === 'dark' ? '#666' : '#aaa'}
      />

      <Text style={[styles.label, { color: colors.text }]}>Category</Text>
      <View style={styles.chipRow}>
        {categories
          .filter((c: any) => c.type === (type === 'credit' ? 'income' : 'expense'))
          .map((cat: any) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, selectedCategoryId === cat.id && { backgroundColor: colors.tint }]}
              onPress={() => setSelectedCategoryId(cat.id)}
            >
              <Text style={[styles.chipText, selectedCategoryId === cat.id && { color: '#fff' }]}>
                {cat.icon} {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Date</Text>
      <TextInput
        style={inputStyle}
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colorScheme === 'dark' ? '#666' : '#aaa'}
      />

      <Text style={[styles.label, { color: colors.text }]}>Note</Text>
      <TextInput
        style={[...inputStyle, { height: 80, textAlignVertical: 'top' }]}
        value={note}
        onChangeText={setNote}
        multiline
        placeholder="Optional note"
        placeholderTextColor={colorScheme === 'dark' ? '#666' : '#aaa'}
      />

      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.tint }]} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Save Transaction</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
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
    backgroundColor: '#e0e0e0',
  },
  chipText: { fontSize: 13 },
  saveBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 40,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
