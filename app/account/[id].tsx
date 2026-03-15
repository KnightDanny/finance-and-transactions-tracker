import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import { getAccountById } from '@/src/db/repository/accounts';
import { getTransactionsByAccount } from '@/src/db/repository/transactions';
import { TransactionCard } from '@/src/components/TransactionCard';
import { formatCurrency } from '@/src/utils/currency';
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

  useEffect(() => {
    if (id) {
      Promise.all([
        getAccountById(db, id),
        getTransactionsByAccount(db, id, 100),
      ]).then(([acc, txns]) => {
        setAccount(acc);
        setTransactions(txns);
      });
    }
  }, [db, id]);

  if (!account) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colorScheme === 'dark' ? '#1a3a5c' : '#1B4965' }]}>
        <Text style={styles.bankName}>{account.bank}</Text>
        <Text style={styles.accountNumber}>{account.label || account.accountNumber}</Text>
        <Text style={styles.balance}>{formatCurrency(account.latestBalance ?? 0)}</Text>
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
  bankName: { color: '#BEE9E8', fontSize: 14 },
  accountNumber: { color: '#fff', fontSize: 16, marginTop: 4 },
  balance: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 8 },
  emptyText: { fontSize: 14, opacity: 0.6, textAlign: 'center', paddingVertical: 40 },
});
