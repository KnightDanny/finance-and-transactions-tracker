import React, { useState } from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, Modal, Pressable } from 'react-native';
import { formatCurrency } from '@/src/utils/currency';
import { getBankConfig } from '@/src/utils/bankConfig';
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
    bank?: string;
    accountNumber?: string;
    accountLabel?: string;
    categoryName?: string;
    categoryIcon?: string;
    note?: string;
  };
}

export function TransactionCard({ transaction }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
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

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <View style={styles.left}>
        <Image source={config.logo} style={styles.bankLogo} resizeMode="contain" />
        <View style={styles.info}>
          <Text style={[styles.counterparty, { color: colors.text }]} numberOfLines={1}>
            {transaction.counterparty || (isCredit ? 'Received' : 'Sent')}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.date, { color: colors.textSecondary }]}>{transaction.date}</Text>
            {accountDisplay ? (
              <Text style={[styles.accountTag, { color: colors.textSecondary }]}>{accountDisplay}</Text>
            ) : null}
          </View>
          {categoryLabel && (
            <View style={[styles.categoryBadge, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.categoryText, { color: colors.textSecondary }]}>{categoryLabel}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {isCredit ? '+' : '-'}{formatCurrency(transaction.amount)}
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
          <View style={[styles.popup, { backgroundColor: colors.surface }]}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>Note</Text>
            <Text style={[styles.popupText, { color: colors.text }]}>{transaction.note}</Text>
            <TouchableOpacity style={[styles.popupClose, { backgroundColor: colors.accent }]} onPress={() => setShowNote(false)}>
              <Text style={styles.popupCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 15,
    marginHorizontal: 6,
    marginVertical: 3,
    borderWidth: 1,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  bankLogo: { width: 32, height: 32, borderRadius: 8, marginRight: 12 },
  info: { flex: 1 },
  counterparty: { fontSize: 15, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 8 },
  date: { fontSize: 12 },
  accountTag: { fontSize: 11 },
  categoryBadge: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  categoryText: { fontSize: 11 },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 16, fontWeight: '700' },
  noteIcon: { fontSize: 14 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  popup: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    elevation: 8,
  },
  popupTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  popupText: { fontSize: 15, lineHeight: 22, opacity: 0.8 },
  popupClose: {
    marginTop: 20,
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 15,
  },
  popupCloseText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
