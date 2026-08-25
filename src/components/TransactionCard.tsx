import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { formatCurrency } from '@/src/utils/currency';
import { getBankConfig } from '@/src/utils/bankConfig';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts } from '@/constants/Type';

interface Props {
  transaction: {
    id: string;
    type: 'credit' | 'debit';
    amount: number;
    counterparty?: string;
    date: string;
    source: string;
    bank?: string;
    accountNumber?: string;
    accountLabel?: string;
    categoryName?: string;
    categoryIcon?: string;
    note?: string;
  };
}

// Ledger row — dense, hairline-separated, bank identity as a color dot,
// amount in mono so columns align down the list.
export function TransactionCard({ transaction }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isCredit = transaction.type === 'credit';
  const [showNote, setShowNote] = useState(false);

  const config = getBankConfig(transaction.bank);
  const accountDisplay = transaction.accountLabel
    ? transaction.accountLabel
    : transaction.accountNumber
      ? `${config.name} ...${transaction.accountNumber.slice(-4)}`
      : '';

  const categoryLabel = transaction.categoryIcon && transaction.categoryName
    ? `${transaction.categoryIcon} ${transaction.categoryName}`
    : transaction.categoryName || null;

  const amountColor = isCredit ? colors.income : colors.expense;
  const meta = [transaction.date, accountDisplay].filter(Boolean).join(' · ');

  return (
    <View style={[styles.row, { borderBottomColor: colors.hairline }]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <View style={styles.info}>
        <Text style={[styles.counterparty, { color: colors.text }]} numberOfLines={1}>
          {transaction.counterparty || (isCredit ? 'Received' : 'Sent')}
        </Text>
        <Text style={[styles.meta, { color: colors.textTertiary }]} numberOfLines={1}>
          {meta}
        </Text>
        {categoryLabel && (
          <View style={[styles.categoryBadge, { backgroundColor: colors.surfaceVariant, borderColor: colors.hairline }]}>
            <Text style={[styles.categoryText, { color: colors.textSecondary }]}>{categoryLabel}</Text>
          </View>
        )}
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {isCredit ? '+' : '−'}{formatCurrency(transaction.amount)}
        </Text>
        {transaction.note ? (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); setShowNote(true); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.noteIcon}>📝</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal visible={showNote} transparent animationType="fade" onRequestClose={() => setShowNote(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowNote(false)}>
          <View style={[styles.popup, { backgroundColor: colors.surface, borderColor: colors.hairlineStrong }]}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>Note</Text>
            <Text style={[styles.popupText, { color: colors.textSecondary }]}>{transaction.note}</Text>
            <TouchableOpacity style={[styles.popupClose, { borderColor: colors.hairlineStrong }]} onPress={() => setShowNote(false)}>
              <Text style={[styles.popupCloseText, { color: colors.gold }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    marginHorizontal: 3,
    borderBottomWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  info: { flex: 1, minWidth: 0 },
  counterparty: { fontFamily: fonts.sansMedium, fontSize: 13.5 },
  meta: { fontFamily: fonts.mono, fontSize: 10.5, marginTop: 2.5 },
  categoryBadge: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 9,
    borderWidth: 1,
  },
  categoryText: { fontFamily: fonts.sans, fontSize: 10.5 },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: { fontFamily: fonts.monoMedium, fontSize: 13.5 },
  noteIcon: { fontSize: 13 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  popup: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  popupTitle: { fontFamily: fonts.sansBold, fontSize: 16, marginBottom: 10 },
  popupText: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21 },
  popupClose: {
    marginTop: 20,
    alignSelf: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  popupCloseText: { fontFamily: fonts.sansBold, fontSize: 13 },
});
