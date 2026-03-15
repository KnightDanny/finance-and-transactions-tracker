import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { formatCurrency } from '@/src/utils/currency';
import { getBankConfig } from '@/src/utils/bankConfig';

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
  const config = getBankConfig(account.bank);

  return (
    <View style={[styles.card, { backgroundColor: config.color }]}>
      <View style={styles.left}>
        <Image source={config.logo} style={styles.logo} resizeMode="contain" />
        <View>
          <Text style={[styles.bank, { color: config.textColor, opacity: 0.8 }]}>{config.name}</Text>
          <Text style={[styles.name, { color: config.textColor }]}>
            {account.label || `...${account.accountNumber.slice(-4)}`}
          </Text>
        </View>
      </View>
      <Text style={[styles.balance, { color: config.textColor }]}>
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 32, height: 32, borderRadius: 6 },
  bank: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  name: { fontSize: 15, fontWeight: '500', marginTop: 2 },
  balance: { fontSize: 16, fontWeight: '600' },
});
