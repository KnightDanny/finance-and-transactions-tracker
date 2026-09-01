import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { formatCurrency, formatMoney } from '@/src/utils/currency';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts, sectionLabel } from '@/constants/Type';
import { useBalancePrivacy, MASKED } from '@/src/state/balancePrivacy';
import type { LoanWithProgress } from '@/src/db/repository/loans';

interface Props {
  loans: LoanWithProgress[];
  /** Outstanding totals converted to ETB (foreign-currency loans via rates). */
  totals: { lentOutstanding: number; borrowedOutstanding: number };
}

/** Dashboard loans card: You get / You owe, top open loans, quick add. */
export function LoansCard({ loans, totals }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const hidden = useBalancePrivacy((s) => s.hidden);

  const open = loans.filter((l) => l.remaining > 0);
  const lent = totals.lentOutstanding;
  const borrowed = totals.borrowedOutstanding;
  const top = open.slice(0, 3);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>Loans</Text>
        <TouchableOpacity
          onPress={() => router.push('/loans?add=1' as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.addLink, { color: colors.gold }]}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {open.length === 0 ? (
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/loans?add=1' as any)}>
          <Text style={[styles.empty, { color: colors.textTertiary }]}>
            Track money you lend or borrow — tap to add your first loan.
          </Text>
        </TouchableOpacity>
      ) : (
        <>
          <View style={styles.totalsRow}>
            <View style={styles.totalCol}>
              <Text style={[styles.totalLabel, { color: colors.textTertiary }]}>You get</Text>
              <Text style={[styles.totalValue, { color: colors.income }]}>
                {hidden ? MASKED : `+${formatCurrency(lent)}`}
              </Text>
            </View>
            <View style={[styles.totalDivider, { backgroundColor: colors.hairline }]} />
            <View style={styles.totalCol}>
              <Text style={[styles.totalLabel, { color: colors.textTertiary }]}>You owe</Text>
              <Text style={[styles.totalValue, { color: colors.expense }]}>
                {hidden ? MASKED : `−${formatCurrency(borrowed)}`}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 4 }}>
            {top.map((loan, i) => (
              <TouchableOpacity
                key={loan.id}
                activeOpacity={0.7}
                style={[styles.loanRow, i < top.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.hairline }]}
                onPress={() => router.push('/loans' as any)}
              >
                <View style={[styles.dot, { backgroundColor: loan.direction === 'lent' ? colors.income : colors.expense }]} />
                <Text style={[styles.person, { color: colors.text }]} numberOfLines={1}>{loan.person}</Text>
                <Text style={[styles.amount, { color: loan.direction === 'lent' ? colors.income : colors.expense }]}>
                  {hidden ? MASKED : formatMoney(loan.remaining, loan.currency)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {open.length > top.length && (
            <TouchableOpacity onPress={() => router.push('/loans' as any)}>
              <Text style={[styles.seeAll, { color: colors.gold }]}>
                See all {open.length} loans →
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 13,
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { ...sectionLabel },
  addLink: { fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  empty: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18, marginTop: 10, marginBottom: 4 },
  totalsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8 },
  totalCol: { flex: 1, alignItems: 'center' },
  totalLabel: { fontFamily: fonts.sansBold, fontSize: 8.5, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 4 },
  totalValue: { fontFamily: fonts.monoMedium, fontSize: 14 },
  totalDivider: { width: 1, height: 26 },
  loanRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  person: { fontFamily: fonts.sansMedium, fontSize: 13, flex: 1 },
  amount: { fontFamily: fonts.mono, fontSize: 12.5 },
  seeAll: { fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 10 },
});
