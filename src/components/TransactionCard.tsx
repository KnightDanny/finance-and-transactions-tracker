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

  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#1e1e1e' : '#fff' }]}>
      <View style={styles.left}>
        <Image source={config.logo} style={styles.bankLogo} resizeMode="contain" />
        <View style={styles.info}>
          <Text style={[styles.counterparty, { color: colors.text }]} numberOfLines={1}>
            {transaction.counterparty || (isCredit ? 'Received' : 'Sent')}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.date, { color: colors.text }]}>{transaction.date}</Text>
            {accountDisplay ? (
              <Text style={[styles.accountTag, { color: colors.text }]}>{accountDisplay}</Text>
            ) : null}
          </View>
          {categoryLabel && (
            <View style={[styles.categoryBadge, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
              <Text style={[styles.categoryText, { color: isDark ? '#aaa' : '#555' }]}>{categoryLabel}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: isCredit ? '#27ae60' : '#e74c3c' }]}>
          {isCredit ? '+' : '-'} {formatCurrency(transaction.amount)}
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

      {/* Note popup */}
      <Modal visible={showNote} transparent animationType="fade" onRequestClose={() => setShowNote(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowNote(false)}>
          <View style={[styles.popup, { backgroundColor: isDark ? '#2a2a2a' : '#fff' }]}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>Note</Text>
            <Text style={[styles.popupText, { color: colors.text }]}>{transaction.note}</Text>
            <TouchableOpacity style={styles.popupClose} onPress={() => setShowNote(false)}>
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 1,
    borderRadius: 8,
    marginHorizontal: 4,
    marginVertical: 2,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  bankLogo: { width: 32, height: 32, borderRadius: 6, marginRight: 12 },
  info: { flex: 1 },
  counterparty: { fontSize: 15, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 8 },
  date: { fontSize: 12, opacity: 0.5 },
  accountTag: { fontSize: 11, opacity: 0.4 },
  categoryBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryText: { fontSize: 11 },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 15, fontWeight: '600' },
  noteIcon: { fontSize: 14 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  popup: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  popupTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  popupText: { fontSize: 14, lineHeight: 20, opacity: 0.8 },
  popupClose: {
    marginTop: 16,
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2f95dc',
    borderRadius: 8,
  },
  popupCloseText: { color: '#fff', fontSize: 14, fontWeight: '500' },
});
