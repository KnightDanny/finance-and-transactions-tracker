import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { formatCurrency } from '@/src/utils/currency';
import { useColorScheme } from '@/components/useColorScheme';

interface Props {
  account: {
    id: string;
    bank: string;
    accountNumber: string;
    label?: string;
    latestBalance?: number;
  };
}

export function BalanceCard({ account }: Props) {
  const colorScheme = useColorScheme();

  return (
    <View style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#1e1e1e' : '#fff' }]}>
      <View>
        <Text style={[styles.bank, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>{account.bank}</Text>
        <Text style={[styles.name, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
          {account.label || `...${account.accountNumber.slice(-4)}`}
        </Text>
      </View>
      <Text style={[styles.balance, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
        {formatCurrency(account.latestBalance ?? 0)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  bank: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  name: { fontSize: 15, fontWeight: '500', marginTop: 2 },
  balance: { fontSize: 16, fontWeight: '600' },
});
