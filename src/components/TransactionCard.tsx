import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { formatCurrency } from '@/src/utils/currency';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

interface Props {
  transaction: {
    id: string;
    type: 'credit' | 'debit';
    amount: number;
    counterparty?: string;
    date: string;
    source: string;
  };
}

export function TransactionCard({ transaction }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isCredit = transaction.type === 'credit';

  return (
    <View style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#1e1e1e' : '#fff' }]}>
      <View style={styles.left}>
        <View style={[styles.indicator, { backgroundColor: isCredit ? '#27ae60' : '#e74c3c' }]} />
        <View style={styles.info}>
          <Text style={[styles.counterparty, { color: colors.text }]} numberOfLines={1}>
            {transaction.counterparty || (isCredit ? 'Received' : 'Sent')}
          </Text>
          <Text style={[styles.date, { color: colors.text }]}>{transaction.date}</Text>
        </View>
      </View>
      <Text style={[styles.amount, { color: isCredit ? '#27ae60' : '#e74c3c' }]}>
        {isCredit ? '+' : '-'} {formatCurrency(transaction.amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 1,
    borderRadius: 8,
    marginHorizontal: 4,
    marginVertical: 2,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  indicator: { width: 4, height: 32, borderRadius: 2, marginRight: 12 },
  info: { flex: 1 },
  counterparty: { fontSize: 15, fontWeight: '500' },
  date: { fontSize: 12, opacity: 0.5, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '600' },
});
