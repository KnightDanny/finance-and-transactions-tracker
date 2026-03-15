import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import {
  getTransactionById,
  updateTransactionCategory,
  updateTransactionNote,
  updateTransactionCounterparty,
} from '@/src/db/repository/transactions';
import { getAllCategories } from '@/src/db/repository/budgets';
import { formatCurrency } from '@/src/utils/currency';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  const [txn, setTxn] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [counterparty, setCounterparty] = useState('');
  const [note, setNote] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  useEffect(() => {
    if (id) {
      Promise.all([getTransactionById(db, id), getAllCategories(db)]).then(([t, cats]) => {
        setTxn(t);
        setCategories(cats);
        if (t) {
          setCounterparty(t.counterparty ?? '');
          setNote(t.note ?? '');
          setSelectedCategoryId(t.categoryId ?? '');
        }
      });
    }
  }, [db, id]);

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(prev => (prev === categoryId ? '' : categoryId));
  };

  const hasChanges =
    counterparty !== (txn?.counterparty ?? '') ||
    note !== (txn?.note ?? '') ||
    selectedCategoryId !== (txn?.categoryId ?? '');

  const handleSave = async () => {
    if (!txn) return;
    const promises: Promise<void>[] = [];
    if (counterparty !== (txn.counterparty ?? '')) {
      promises.push(updateTransactionCounterparty(db, txn.id, counterparty));
    }
    if (note !== (txn.note ?? '')) {
      promises.push(updateTransactionNote(db, txn.id, note));
    }
    if (selectedCategoryId !== (txn.categoryId ?? '')) {
      promises.push(updateTransactionCategory(db, txn.id, selectedCategoryId));
    }
    await Promise.all(promises);
    setTxn({ ...txn, counterparty, note, categoryId: selectedCategoryId });
  };

  if (!txn) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Loading...</Text>
      </View>
    );
  }

  const isCredit = txn.type === 'credit';
  const chipBg = isDark ? '#333' : '#e0e0e0';
  const chipTextColor = isDark ? '#ddd' : '#333';
  const selectedChipBg = '#2f95dc';
  const inputStyle = [styles.input, { color: colors.text, borderColor: isDark ? '#444' : '#ddd' }];

  const rows = [
    { label: 'Type', value: isCredit ? 'Income (Credit)' : 'Expense (Debit)' },
    { label: 'Amount', value: formatCurrency(txn.amount) },
    ...(txn.totalAmount ? [{ label: 'Total (with charges)', value: formatCurrency(txn.totalAmount) }] : []),
    ...(txn.serviceCharge ? [{ label: 'Service Charge', value: formatCurrency(txn.serviceCharge) }] : []),
    ...(txn.vat ? [{ label: 'VAT', value: formatCurrency(txn.vat) }] : []),
    ...(txn.disasterFund ? [{ label: 'Disaster Fund', value: formatCurrency(txn.disasterFund) }] : []),
    { label: 'Balance After', value: txn.balanceAfter != null ? formatCurrency(txn.balanceAfter) : 'N/A' },
    { label: 'Date', value: txn.date },
    ...(txn.referenceNo ? [{ label: 'Reference', value: txn.referenceNo }] : []),
    { label: 'Source', value: txn.source },
  ];

  const filteredCategories = categories.filter(
    (c: any) => c.type === (isCredit ? 'income' : 'expense')
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.amountCard, { backgroundColor: isCredit ? '#27ae60' : '#e74c3c' }]}>
        <Text style={styles.amountLabel}>{isCredit ? 'Received' : 'Sent'}</Text>
        <Text style={styles.amountValue}>{formatCurrency(txn.amount)}</Text>
      </View>

      {rows.map((row, i) => (
        <View key={i} style={[styles.row, { borderBottomColor: isDark ? '#333' : '#eee' }]}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{row.label}</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>{row.value}</Text>
        </View>
      ))}

      {/* Editable counterparty */}
      <View style={styles.editSection}>
        <Text style={[styles.editLabel, { color: colors.text }]}>{isCredit ? 'From' : 'To'}</Text>
        <TextInput
          style={inputStyle}
          value={counterparty}
          onChangeText={setCounterparty}
          placeholder="Name (optional)"
          placeholderTextColor={isDark ? '#666' : '#aaa'}
        />
      </View>

      {/* Editable category */}
      <View style={styles.editSection}>
        <Text style={[styles.editLabel, { color: colors.text }]}>Category</Text>
        <View style={styles.chipRow}>
          {filteredCategories.map((cat: any) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, { backgroundColor: isSelected ? selectedChipBg : chipBg }]}
                onPress={() => handleCategorySelect(cat.id)}
              >
                <Text style={[styles.chipText, { color: isSelected ? '#fff' : chipTextColor }]}>
                  {cat.icon} {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Editable note */}
      <View style={styles.editSection}>
        <Text style={[styles.editLabel, { color: colors.text }]}>Note</Text>
        <TextInput
          style={[...inputStyle, { height: 80, textAlignVertical: 'top' }]}
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="Optional note"
          placeholderTextColor={isDark ? '#666' : '#aaa'}
        />
      </View>

      {hasChanges && (
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>
      )}

      {txn.rawSms && (
        <View style={styles.rawSmsSection}>
          <Text style={[styles.rawSmsLabel, { color: colors.text }]}>Original SMS</Text>
          <Text style={[styles.rawSmsText, { color: colors.text }]}>{txn.rawSms}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  amountCard: {
    margin: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  amountLabel: { color: '#fff', fontSize: 14, opacity: 0.8 },
  amountValue: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowLabel: { fontSize: 14, opacity: 0.7 },
  rowValue: { fontSize: 14, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  editSection: { paddingHorizontal: 16, marginTop: 16 },
  editLabel: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
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
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#2f95dc',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  rawSmsSection: { margin: 16, marginTop: 24 },
  rawSmsLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  rawSmsText: { fontSize: 12, opacity: 0.7, lineHeight: 18 },
});
