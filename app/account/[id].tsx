import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Image, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import { getAccountById, updateAccountLabel } from '@/src/db/repository/accounts';
import { getTransactionsByAccount } from '@/src/db/repository/transactions';
import { TransactionCard } from '@/src/components/TransactionCard';
import { formatCurrency } from '@/src/utils/currency';
import { getBankConfig } from '@/src/utils/bankConfig';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [account, setAccount] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');

  useEffect(() => {
    if (id) {
      Promise.all([
        getAccountById(db, id),
        getTransactionsByAccount(db, id, 100),
      ]).then(([acc, txns]) => {
        setAccount(acc);
        setTransactions(txns);
        setLabelDraft(acc?.label ?? '');
      });
    }
  }, [db, id]);

  const handleSaveLabel = async () => {
    if (!account) return;
    const trimmed = labelDraft.trim();
    await updateAccountLabel(db, account.id, trimmed);
    setAccount({ ...account, label: trimmed });
    setEditingLabel(false);
  };

  if (!account) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Loading...</Text>
      </View>
    );
  }

  const config = getBankConfig(account.bank);
  const displayName = account.label || `...${account.accountNumber.slice(-4)}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: config.color }]}>
        <Image source={config.logo} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.bankName, { color: config.textColor, opacity: 0.8 }]}>{config.name}</Text>

        {editingLabel ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.labelInput}
              value={labelDraft}
              onChangeText={setLabelDraft}
              placeholder={`...${account.accountNumber.slice(-4)}`}
              placeholderTextColor="rgba(255,255,255,0.5)"
              autoFocus
              onSubmitEditing={handleSaveLabel}
            />
            <TouchableOpacity style={styles.saveChip} onPress={handleSaveLabel}>
              <Text style={styles.saveChipText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setEditingLabel(false); setLabelDraft(account.label ?? ''); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditingLabel(true)}>
            <Text style={[styles.accountLabel, { color: config.textColor }]}>
              {displayName} ✏️
            </Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.accountNumber, { color: config.textColor, opacity: 0.7 }]}>
          {account.accountNumber}
        </Text>
        <Text style={[styles.balance, { color: config.textColor }]}>
          {formatCurrency(account.latestBalance ?? 0)}
        </Text>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/transaction/${item.id}` as any)}>
            <TransactionCard transaction={item} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.text }]}>No transactions for this account.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, alignItems: 'center' },
  logo: { width: 48, height: 48, borderRadius: 10, marginBottom: 8 },
  bankName: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  accountLabel: { fontSize: 18, fontWeight: '600', marginTop: 4 },
  accountNumber: { fontSize: 12, marginTop: 2 },
  balance: { fontSize: 28, fontWeight: '700', marginTop: 8 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  labelInput: {
    borderBottomWidth: 2,
    borderBottomColor: '#fff',
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 120,
    textAlign: 'center',
  },
  saveChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
  },
  saveChipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  cancelText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  emptyText: { fontSize: 14, opacity: 0.6, textAlign: 'center', paddingVertical: 40 },
});
