import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Pressable, LayoutAnimation } from 'react-native';
import { formatMoney } from '@/src/utils/currency';
import { getBankConfig } from '@/src/utils/bankConfig';
import { useDatabase } from '@/src/db/provider';
import { getSplits, SplitRow } from '@/src/db/repository/splits';
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
    /** ms epoch of the source SMS/email — supplies the HH:MM in the meta line. */
    smsTimestamp?: number | null;
    source: string;
    bank?: string;
    accountNumber?: string;
    accountLabel?: string;
    categoryName?: string;
    categoryIcon?: string;
    note?: string;
    /** Account currency — email/manual accounts hold USD/USDT/…, not ETB. */
    currency?: string | null;
    /** Set when this row is one leg of a marked P2P/transfer pair. */
    transferPairId?: string | null;
    /** Truthy when the transaction has splits (parts on other categories). */
    hasSplits?: number | boolean;
  };
}

// Ledger row — dense, hairline-separated, bank identity as a color dot,
// amount in mono so columns align down the list.
export function TransactionCard({ transaction }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const db = useDatabase();
  const isCredit = transaction.type === 'credit';
  const [showNote, setShowNote] = useState(false);
  const [splitsOpen, setSplitsOpen] = useState(false);
  const [parts, setParts] = useState<SplitRow[] | null>(null);

  const toggleSplits = async (e: any) => {
    e.stopPropagation?.();
    // Always refetch on open — cached parts go stale when splits are edited
    // in the detail screen while this row stays mounted
    if (!splitsOpen) setParts(await getSplits(db, transaction.id));
    LayoutAnimation.configureNext(
      LayoutAnimation.create(140, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
    );
    setSplitsOpen((o) => !o);
  };

  const config = getBankConfig(transaction.bank, transaction.accountLabel ?? transaction.accountNumber);
  const accountDisplay = transaction.accountLabel
    ? transaction.accountLabel
    : transaction.accountNumber
      ? `${config.name} ...${transaction.accountNumber.slice(-4)}`
      : '';

  const baseCategory = transaction.categoryIcon && transaction.categoryName
    ? `${transaction.categoryIcon} ${transaction.categoryName}`
    : transaction.categoryName || null;
  const isSplit = !!transaction.hasSplits && !transaction.transferPairId;
  const categoryLabel = transaction.transferPairId
    ? '⇄ Transfer'
    : isSplit
      ? `✂ Split ${splitsOpen ? '▴' : '▾'}`
      : baseCategory;

  const money = (n: number) => formatMoney(n, transaction.currency ?? 'ETB');
  const sign = isCredit ? '+' : '−';
  const partsTotal = (parts ?? []).reduce((s, p) => s + p.amount, 0);
  const remainder = transaction.amount - partsTotal;

  const amountColor = isCredit ? colors.income : colors.expense;
  const ts = transaction.smsTimestamp ? new Date(transaction.smsTimestamp) : null;
  const time =
    ts && !isNaN(ts.getTime())
      ? `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`
      : null;

  return (
    <View style={[styles.container, { borderBottomColor: colors.hairline }]}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: config.color }]} />
        <View style={styles.info}>
          <Text style={[styles.counterparty, { color: colors.text }]} numberOfLines={1}>
            {transaction.counterparty || (isCredit ? 'Received' : 'Sent')}
          </Text>
          {!!accountDisplay && (
            <Text style={[styles.meta, { color: colors.textTertiary }]} numberOfLines={1}>
              {accountDisplay}
            </Text>
          )}
          {categoryLabel && (
            <TouchableOpacity
              disabled={!isSplit}
              onPress={toggleSplits}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={[styles.categoryBadge, { backgroundColor: colors.surfaceVariant, borderColor: colors.hairline }]}
            >
              <Text style={[styles.categoryText, { color: colors.textSecondary }]}>{categoryLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.right}>
          <Text style={[styles.amount, { color: amountColor }]}>
            {sign}{money(transaction.amount)}
          </Text>
          {transaction.note ? (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation?.(); setShowNote(true); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.noteIcon}>📝</Text>
            </TouchableOpacity>
          ) : null}
          {time && <Text style={[styles.dateTime, { color: colors.textTertiary }]}>{time}</Text>}
        </View>
      </View>

      {/* Split breakdown — each part as its own mini transaction. Gated on
          isSplit so a row whose splits were deleted can't show a stale list */}
      {isSplit && splitsOpen && parts && (
        <View style={[styles.splitList, { borderTopColor: colors.hairline }]}>
          {parts.map((p) => (
            <View key={p.id} style={styles.splitItem}>
              <Text style={[styles.splitLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {p.loanId
                  ? `💸 ${isCredit ? 'Borrowed' : 'Lent'} (loan)`
                  : `${p.categoryIcon ?? ''} ${p.categoryName ?? 'Uncategorized'}`.trim()}
              </Text>
              <Text style={[styles.splitAmount, { color: amountColor }]}>{sign}{money(p.amount)}</Text>
            </View>
          ))}
          {remainder > 0.004 && (
            <View style={styles.splitItem}>
              <Text style={[styles.splitLabel, { color: colors.textTertiary }]} numberOfLines={1}>
                {baseCategory ?? 'Uncategorized'} (remainder)
              </Text>
              <Text style={[styles.splitAmount, { color: amountColor }]}>{sign}{money(remainder)}</Text>
            </View>
          )}
        </View>
      )}

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
  container: {
    marginHorizontal: 3,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
  },
  splitList: {
    borderTopWidth: 1,
    marginLeft: 19,
    paddingVertical: 4,
    marginBottom: 8,
  },
  splitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  splitLabel: { fontFamily: fonts.sans, fontSize: 12, flex: 1, marginRight: 12 },
  splitAmount: { fontFamily: fonts.mono, fontSize: 12 },
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
  right: { alignItems: 'flex-end', gap: 4, alignSelf: 'stretch', justifyContent: 'space-between' },
  amount: { fontFamily: fonts.monoMedium, fontSize: 13.5 },
  dateTime: { fontFamily: fonts.mono, fontSize: 9.5 },
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
