import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { formatCurrency } from '@/src/utils/currency';
import { getBankConfig } from '@/src/utils/bankConfig';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts } from '@/constants/Type';
import { useBalancePrivacy, MASKED } from '@/src/state/balancePrivacy';

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
  const colors = Colors[colorScheme];
  const config = getBankConfig(account.bank);
  const hidden = useBalancePrivacy((s) => s.hidden);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
      <View style={[styles.spine, { backgroundColor: config.color }]} />
      <View style={styles.left}>
        <View style={[styles.logoChip, { backgroundColor: colors.surfaceVariant, borderColor: colors.hairline }]}>
          <Image source={config.logo} style={styles.logo} resizeMode="contain" />
        </View>
        <View>
          <Text style={[styles.bank, { color: colors.textTertiary }]}>{config.name}</Text>
          <Text style={[styles.name, { color: colors.text }]}>
            {account.label || `...${account.accountNumber.slice(-4)}`}
          </Text>
        </View>
      </View>
      <Text style={[styles.balance, { color: hidden ? colors.textTertiary : colors.text }]}>
        {hidden ? MASKED : formatCurrency(account.latestBalance ?? 0)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingLeft: 16,
    paddingRight: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 9,
    overflow: 'hidden',
  },
  spine: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoChip: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 24, height: 24, borderRadius: 6 },
  bank: { fontFamily: fonts.sansBold, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 1.6 },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, marginTop: 2 },
  balance: { fontFamily: fonts.monoMedium, fontSize: 15 },
});
