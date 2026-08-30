import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts, sectionLabel } from '@/constants/Type';
import { useBalancePrivacy, MASKED } from '@/src/state/balancePrivacy';

interface Props {
  cash: number;
  lent: number;
  borrowed: number;
}

function fmt(n: number): string {
  return n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Net worth = all cash in hand + outstanding lent − outstanding borrowed. */
export function NetWorthCard({ cash, lent, borrowed }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const hidden = useBalancePrivacy((s) => s.hidden);
  const netWorth = cash + lent - borrowed;

  return (
    <View style={[styles.card, { backgroundColor: colors.goldDim, borderColor: colors.hairlineStrong }]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Net Worth</Text>
      <Text style={[styles.value, { color: colors.text }]}>
        <Text style={[styles.currency, { color: colors.textSecondary }]}>ETB </Text>
        {hidden ? MASKED : fmt(netWorth)}
      </Text>
      <View style={[styles.breakdown, { borderTopColor: colors.hairline }]}>
        <View style={styles.part}>
          <Text style={[styles.partLabel, { color: colors.textTertiary }]}>Cash</Text>
          <Text style={[styles.partValue, { color: colors.text }]}>{hidden ? MASKED : fmt(cash)}</Text>
        </View>
        <View style={[styles.partDivider, { backgroundColor: colors.hairline }]} />
        <View style={styles.part}>
          <Text style={[styles.partLabel, { color: colors.textTertiary }]}>Lent</Text>
          <Text style={[styles.partValue, { color: colors.income }]}>{hidden ? MASKED : `+${fmt(lent)}`}</Text>
        </View>
        <View style={[styles.partDivider, { backgroundColor: colors.hairline }]} />
        <View style={styles.part}>
          <Text style={[styles.partLabel, { color: colors.textTertiary }]}>Borrowed</Text>
          <Text style={[styles.partValue, { color: colors.expense }]}>{hidden ? MASKED : `−${fmt(borrowed)}`}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 13,
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 13,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  label: { ...sectionLabel },
  value: { fontFamily: fonts.monoMedium, fontSize: 22, marginTop: 8 },
  currency: { fontFamily: fonts.mono, fontSize: 13 },
  breakdown: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 13,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  part: { flex: 1, alignItems: 'center' },
  partLabel: { fontFamily: fonts.sansBold, fontSize: 8.5, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 4 },
  partValue: { fontFamily: fonts.mono, fontSize: 12 },
  partDivider: { width: 1, height: 26 },
});
