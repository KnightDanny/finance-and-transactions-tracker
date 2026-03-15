import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import { getTransactionById } from '@/src/db/repository/transactions';
import { formatCurrency } from '@/src/utils/currency';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [txn, setTxn] = useState<any>(null);

  useEffect(() => {
    if (id) {
      getTransactionById(db, id).then(setTxn);
    }
  }, [db, id]);

  if (!txn) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Loading...</Text>
      </View>
    );
  }

  const isCredit = txn.type === 'credit';
  const rows = [
    { label: 'Type', value: isCredit ? 'Income (Credit)' : 'Expense (Debit)' },
    { label: 'Amount', value: formatCurrency(txn.amount) },
    ...(txn.totalAmount ? [{ label: 'Total (with charges)', value: formatCurrency(txn.totalAmount) }] : []),
    ...(txn.serviceCharge ? [{ label: 'Service Charge', value: formatCurrency(txn.serviceCharge) }] : []),
    ...(txn.vat ? [{ label: 'VAT', value: formatCurrency(txn.vat) }] : []),
    ...(txn.disasterFund ? [{ label: 'Disaster Fund', value: formatCurrency(txn.disasterFund) }] : []),
    { label: 'Balance After', value: txn.balanceAfter != null ? formatCurrency(txn.balanceAfter) : 'N/A' },
    ...(txn.counterparty ? [{ label: isCredit ? 'From' : 'To', value: txn.counterparty }] : []),
    { label: 'Date', value: txn.date },
    ...(txn.referenceNo ? [{ label: 'Reference', value: txn.referenceNo }] : []),
    { label: 'Source', value: txn.source },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.amountCard, { backgroundColor: isCredit ? '#27ae60' : '#e74c3c' }]}>
        <Text style={styles.amountLabel}>{isCredit ? 'Received' : 'Sent'}</Text>
        <Text style={styles.amountValue}>{formatCurrency(txn.amount)}</Text>
      </View>

      {rows.map((row, i) => (
        <View key={i} style={[styles.row, { borderBottomColor: colorScheme === 'dark' ? '#333' : '#eee' }]}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{row.label}</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>{row.value}</Text>
        </View>
      ))}

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
  rawSmsSection: { margin: 16 },
  rawSmsLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  rawSmsText: { fontSize: 12, opacity: 0.7, lineHeight: 18 },
});
