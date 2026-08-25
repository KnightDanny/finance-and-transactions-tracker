import React, { useState } from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { formatCurrency } from '@/src/utils/currency';
import { getBankConfig } from '@/src/utils/bankConfig';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts } from '@/constants/Type';
import { useBalancePrivacy, MASKED } from '@/src/state/balancePrivacy';

interface Account {
  id: string;
  bank: string;
  accountNumber: string;
  label?: string;
  latestBalance?: number;
}

interface Props {
  bank: string;
  accounts: Account[];
}

/**
 * Collapsible group for a bank with multiple accounts: header shows the bank
 * identity + summed balance; expanding reveals the individual accounts.
 */
export function BankGroupCard({ bank, accounts }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const config = getBankConfig(bank);
  const hidden = useBalancePrivacy((s) => s.hidden);
  const [open, setOpen] = useState(false);

  const total = accounts.reduce((sum, a) => sum + (a.latestBalance ?? 0), 0);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
      <View style={[styles.spine, { backgroundColor: config.color }]} />

      <TouchableOpacity style={styles.header} activeOpacity={0.7} onPress={() => setOpen(!open)}>
        <View style={[styles.logoChip, { backgroundColor: colors.surfaceVariant, borderColor: colors.hairline }]}>
          <Image source={config.logo} style={styles.logo} resizeMode="contain" />
        </View>
        <View>
          <Text style={[styles.bank, { color: colors.textTertiary }]}>{config.name}</Text>
          <Text style={[styles.count, { color: colors.text }]}>
            {accounts.length} accounts
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={[styles.total, { color: hidden ? colors.textTertiary : colors.text }]}>
            {hidden ? MASKED : formatCurrency(total)}
          </Text>
          <Feather name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>

      {open && (
        <View style={[styles.body, { borderTopColor: colors.hairline }]}>
          {accounts.map((account, i) => (
            <TouchableOpacity
              key={account.id}
              activeOpacity={0.7}
              style={[
                styles.accountRow,
                i < accounts.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.hairline },
              ]}
              onPress={() => router.push(`/account/${account.id}` as any)}
            >
              <Text style={[styles.accountName, { color: colors.text }]}>
                {account.label || `...${account.accountNumber.slice(-4)}`}
              </Text>
              <Text style={[styles.accountBalance, { color: hidden ? colors.textTertiary : colors.textSecondary }]}>
                {hidden ? MASKED : formatCurrency(account.latestBalance ?? 0)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
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
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingLeft: 16,
    paddingRight: 14,
  },
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
  count: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, marginTop: 2 },
  right: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 },
  total: { fontFamily: fonts.monoMedium, fontSize: 15 },
  body: {
    borderTopWidth: 1,
    marginLeft: 16,
    marginRight: 14,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    paddingLeft: 48,
  },
  accountName: { fontFamily: fonts.sansMedium, fontSize: 13 },
  accountBalance: { fontFamily: fonts.mono, fontSize: 13.5 },
});
