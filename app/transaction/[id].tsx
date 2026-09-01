import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, View, Text, TextInput, TouchableOpacity, Alert, Modal, Pressable, FlatList, LayoutAnimation } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import {
  getTransactionById,
  updateTransactionCategory,
  updateTransactionNote,
  updateTransactionCounterparty,
  markTransferPair,
  unmarkTransferPair,
  getPairedTransaction,
  getTransferCandidates,
} from '@/src/db/repository/transactions';
import { getBankConfig } from '@/src/utils/bankConfig';
import { markTransactionAsLoan, unmarkTransactionAsLoan } from '@/src/db/repository/loans';
import { getSplits, addCategorySplit, addLoanSplit, deleteSplit, SplitRow } from '@/src/db/repository/splits';
import { AmountInput } from '@/src/components/AmountInput';
import { getAllCategories } from '@/src/db/repository/budgets';
import { getAccountById } from '@/src/db/repository/accounts';
import { formatMoney } from '@/src/utils/currency';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  const [txn, setTxn] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [counterparty, setCounterparty] = useState('');
  const [note, setNote] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [pairedTxn, setPairedTxn] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[] | null>(null); // non-null = picker open
  // Splits — parts of this transaction assigned to other categories / a loan
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [splitAmount, setSplitAmount] = useState('');
  const [splitCategoryId, setSplitCategoryId] = useState('');
  const [splitAsLoan, setSplitAsLoan] = useState(false);
  const [splitLoanPerson, setSplitLoanPerson] = useState('');
  // Collapsible sections — closed by default so the screen stays short
  const [openSec, setOpenSec] = useState({ category: false, split: false });
  const toggleSection = (k: 'category' | 'split') => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(140, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
    );
    setOpenSec((o) => ({ ...o, [k]: !o[k] }));
  };

  useEffect(() => {
    if (id) {
      Promise.all([getTransactionById(db, id), getAllCategories(db)]).then(async ([t, cats]) => {
        if (t) {
          const account = t.accountId ? await getAccountById(db, t.accountId) : null;
          t = { ...t, currency: account?.currency ?? 'ETB' };
          if (t.transferPairId) {
            setPairedTxn(await getPairedTransaction(db, t.transferPairId, t.id));
          }
          setSplits(await getSplits(db, t.id));
        }
        setTxn(t);
        setCategories(cats);
        if (t) {
          setCounterparty(t.counterparty ?? '');
          setNote(t.note ?? '');
          setSelectedCategoryId(t.categoryId ?? '');
        }
      });
    }
  }, [db, id]);

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(prev => (prev === categoryId ? '' : categoryId));
  };

  const hasChanges =
    counterparty !== (txn?.counterparty ?? '') ||
    note !== (txn?.note ?? '') ||
    selectedCategoryId !== (txn?.categoryId ?? '');

  const handleMarkLoan = async () => {
    if (!txn) return;
    const direction = txn.type === 'credit' ? 'borrowed' : 'lent';
    const who = counterparty.trim() || txn.counterparty || 'Unknown';
    const loanId = await markTransactionAsLoan(db, {
      id: txn.id,
      type: txn.type,
      amount: txn.amount,
      counterparty: who,
      date: txn.date,
      currency: txn.currency,
    });
    setTxn({ ...txn, loanId });
    Alert.alert(
      'Marked as Loan',
      direction === 'borrowed'
        ? `Recorded as borrowed from ${who}. It now counts against your net worth.`
        : `Recorded as lent to ${who}. It now counts toward your net worth.`
    );
  };

  const handleUnmarkLoan = () => {
    if (!txn?.loanId) return;
    Alert.alert(
      'Remove Loan?',
      'The loan record and any payments logged against it will be deleted. The transaction itself stays.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            await unmarkTransactionAsLoan(db, txn.id, txn.loanId);
            setTxn({ ...txn, loanId: null });
          },
        },
      ]
    );
  };

  const accountDisplay = (r: any) =>
    r.accountLabel || `${getBankConfig(r.bank, r.accountLabel ?? r.accountNumber).name} ...${(r.accountNumber ?? '').slice(-4)}`;

  const openPairPicker = async () => {
    if (!txn) return;
    // The other leg is by definition on a different account
    const rows = await getTransferCandidates(db, txn);
    setCandidates(rows.filter((r: any) => r.accountId !== txn.accountId));
  };

  const handlePair = (candidate: any) => {
    Alert.alert(
      'Mark as Transfer Pair?',
      `These two become one transfer — neither counts as income or expense:\n\n` +
        `${txn.type === 'debit' ? 'Out' : 'In'}: ${formatMoney(txn.amount, txn.currency)}\n` +
        `${candidate.type === 'debit' ? 'Out' : 'In'}: ${formatMoney(candidate.amount, candidate.currency ?? 'ETB')} · ${accountDisplay(candidate)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Pair',
          onPress: async () => {
            const pairId = await markTransferPair(db, txn.id, candidate.id);
            setTxn({ ...txn, transferPairId: pairId });
            setPairedTxn(await getPairedTransaction(db, pairId, txn.id));
            setCandidates(null);
          },
        },
      ]
    );
  };

  const handleUnpair = () => {
    Alert.alert('Unmark Transfer?', 'Both transactions go back to counting as income/expense.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unmark', style: 'destructive', onPress: async () => {
          await unmarkTransferPair(db, txn.transferPairId);
          setTxn({ ...txn, transferPairId: null });
          setPairedTxn(null);
        },
      },
    ]);
  };

  const splitTotal = splits.reduce((s, x) => s + x.amount, 0);
  const remainder = (txn?.amount ?? 0) - splitTotal;

  const handleAddSplit = async () => {
    const amt = parseFloat(splitAmount.replace(/,/g, ''));
    if (isNaN(amt) || amt <= 0) return;
    if (amt > remainder + 0.004) {
      Alert.alert('Too large', `Only ${remainder.toFixed(2)} of this transaction is left to split.`);
      return;
    }
    if (splitAsLoan) {
      // The loan's person can differ from whoever the money physically went to
      const loanId = await addLoanSplit(db, {
        id: txn.id,
        type: txn.type,
        counterparty: splitLoanPerson.trim() || counterparty.trim() || txn.counterparty,
        date: txn.date,
        currency: txn.currency,
      }, amt);
      if (!txn.loanId) setTxn({ ...txn, loanId });
    } else {
      if (!splitCategoryId) {
        Alert.alert('Pick a category', 'Choose a category for this part, or mark it as a loan.');
        return;
      }
      await addCategorySplit(db, txn.id, amt, splitCategoryId);
    }
    setSplitAmount('');
    setSplitCategoryId('');
    setSplitAsLoan(false);
    setSplitLoanPerson('');
    setSplits(await getSplits(db, txn.id));
  };

  const handleDeleteSplit = (s: SplitRow) => {
    Alert.alert(
      'Remove this part?',
      s.loanId ? 'Its loan (and any payments) will be deleted too.' : undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            await deleteSplit(db, s);
            setSplits(await getSplits(db, txn.id));
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!txn) return;
    const promises: Promise<void>[] = [];
    if (counterparty !== (txn.counterparty ?? '')) {
      promises.push(updateTransactionCounterparty(db, txn.id, counterparty));
    }
    if (note !== (txn.note ?? '')) {
      promises.push(updateTransactionNote(db, txn.id, note));
    }
    if (selectedCategoryId !== (txn.categoryId ?? '')) {
      promises.push(updateTransactionCategory(db, txn.id, selectedCategoryId));
    }
    await Promise.all(promises);
    setTxn({ ...txn, counterparty, note, categoryId: selectedCategoryId });
  };

  if (!txn) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Loading...</Text>
      </View>
    );
  }

  const isCredit = txn.type === 'credit';
  const chipBg = isDark ? '#333' : '#e0e0e0';
  const chipTextColor = isDark ? '#ddd' : '#333';
  const selectedChipBg = '#2f95dc';
  const inputStyle = [styles.input, { color: colors.text, borderColor: isDark ? '#444' : '#ddd' }];

  const money = (n: number) => formatMoney(n, txn.currency ?? 'ETB');
  const rows = [
    { label: 'Type', value: isCredit ? 'Income (Credit)' : 'Expense (Debit)' },
    { label: 'Amount', value: money(txn.amount) },
    ...(txn.totalAmount ? [{ label: 'Total (with charges)', value: money(txn.totalAmount) }] : []),
    ...(txn.serviceCharge ? [{ label: 'Service Charge', value: money(txn.serviceCharge) }] : []),
    ...(txn.vat ? [{ label: 'VAT', value: money(txn.vat) }] : []),
    ...(txn.disasterFund ? [{ label: 'Disaster Fund', value: money(txn.disasterFund) }] : []),
    { label: 'Balance After', value: txn.balanceAfter != null ? money(txn.balanceAfter) : 'N/A' },
    { label: 'Date', value: txn.date },
    ...(txn.referenceNo ? [{ label: 'Reference', value: txn.referenceNo }] : []),
    { label: 'Source', value: txn.source },
  ];

  const typeCats = categories.filter((c: any) => c.type === (isCredit ? 'income' : 'expense'));
  const filteredCategories = typeCats.filter((c: any) => !c.parentId); // main categories

  const sectionHeader = (k: 'category' | 'split', label: string, summary: string) => (
    <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => toggleSection(k)} activeOpacity={0.6}>
      <Text style={[styles.editLabel, { color: colors.text, marginBottom: 0 }]}>{label}</Text>
      <View style={styles.sectionHeaderRight}>
        {!!summary && (
          <Text style={[styles.sectionSummary, { color: isDark ? '#888' : '#999' }]} numberOfLines={1}>
            {summary}
          </Text>
        )}
        <Feather name={openSec[k] ? 'chevron-up' : 'chevron-down'} size={16} color={isDark ? '#888' : '#999'} />
      </View>
    </TouchableOpacity>
  );
  const byId = (cid: string) => categories.find((c: any) => c.id === cid);

  // Two-tier picker: selecting a main with subcategories reveals them
  const selCat = byId(selectedCategoryId);
  const selMainId = selCat?.parentId ?? selCat?.id ?? '';
  const selSubs = typeCats.filter((c: any) => c.parentId === selMainId);

  const splitSelCat = byId(splitCategoryId);
  const splitMainId = splitSelCat?.parentId ?? splitSelCat?.id ?? '';
  const splitSubs = typeCats.filter((c: any) => c.parentId === splitMainId);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Frozen save bar — appears the moment anything changes */}
      {hasChanges && (
        <View style={[styles.saveBar, { backgroundColor: colors.background, borderBottomColor: isDark ? '#333' : '#eee' }]}>
          <TouchableOpacity style={styles.saveBtnTop} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      )}
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      <View style={[styles.amountCard, { backgroundColor: isCredit ? '#27ae60' : '#e74c3c' }]}>
        <Text style={styles.amountLabel}>{isCredit ? 'Received' : 'Sent'}</Text>
        <Text style={styles.amountValue}>{money(txn.amount)}</Text>
      </View>

      {rows.map((row, i) => (
        <View key={i} style={[styles.row, { borderBottomColor: isDark ? '#333' : '#eee' }]}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{row.label}</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>{row.value}</Text>
        </View>
      ))}

      {/* Editable counterparty */}
      <View style={styles.editSection}>
        <Text style={[styles.editLabel, { color: colors.text }]}>{isCredit ? 'From' : 'To'}</Text>
        <TextInput
          style={inputStyle}
          value={counterparty}
          onChangeText={setCounterparty}
          placeholder="Name (optional)"
          placeholderTextColor={isDark ? '#666' : '#aaa'}
        />
      </View>

      {/* Editable category — main first; a main with subcategories reveals a
          second row to refine (Cashew-style) */}
      <View style={[styles.editSection, styles.sectionCard, {
        borderColor: '#D4B96A',
        backgroundColor: isDark ? 'rgba(212,185,106,0.07)' : 'rgba(212,185,106,0.10)',
      }]}>
        {sectionHeader('category', 'Category', selCat ? `${selCat.icon ?? ''} ${selCat.name}`.trim() : 'None')}
        {openSec.category && (<>
        <View style={[styles.chipRow, { marginTop: 8 }]}>
          {filteredCategories.map((cat: any) => {
            const isSelected = selMainId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, { backgroundColor: isSelected ? selectedChipBg : chipBg }]}
                onPress={() => setSelectedCategoryId(selMainId === cat.id ? '' : cat.id)}
              >
                <Text style={[styles.chipText, { color: isSelected ? '#fff' : chipTextColor }]}>
                  {cat.icon} {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {selSubs.length > 0 && (
          <View style={[styles.chipRow, { marginTop: 10 }]}>
            {[{ id: selMainId, icon: '◦', name: 'General' }, ...selSubs].map((cat: any) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.subChip, { backgroundColor: isSelected ? selectedChipBg : chipBg }]}
                  onPress={() => setSelectedCategoryId(cat.id)}
                >
                  <Text style={[styles.subChipText, { color: isSelected ? '#fff' : chipTextColor }]}>
                    {cat.icon} {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        </>)}
      </View>

      {/* Split — parts of this transaction for different purposes */}
      <View style={[styles.editSection, styles.sectionCard, {
        borderColor: '#5E9BC9',
        backgroundColor: isDark ? 'rgba(94,155,201,0.07)' : 'rgba(94,155,201,0.10)',
      }]}>
        {sectionHeader('split', 'Split', splits.length > 0 ? `${splits.length} part${splits.length > 1 ? 's' : ''}` : 'None')}
        {openSec.split && (<>
        <View style={{ marginTop: 8 }} />
        {splits.map((s) => (
          <View key={s.id} style={[styles.splitRow, { borderColor: isDark ? '#444' : '#ddd' }]}>
            <Text style={[styles.splitText, { color: colors.text }]} numberOfLines={1}>
              {money(s.amount)} → {s.loanId
                ? `${isCredit ? 'Borrowed' : 'Lent'} (loan)`
                : `${s.categoryIcon ?? ''} ${s.categoryName ?? 'Uncategorized'}`.trim()}
            </Text>
            <TouchableOpacity onPress={() => handleDeleteSplit(s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.loanRemove}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
        {splits.length > 0 && (
          <Text style={[styles.splitHint, { color: isDark ? '#888' : '#999' }]}>
            Remainder {money(Math.max(0, remainder))} stays on this transaction's own category.
          </Text>
        )}

        {remainder > 0.004 && (
          <View style={[styles.loanCard, { borderColor: isDark ? '#444' : '#ddd' }]}>
            <AmountInput
              style={inputStyle}
              value={splitAmount}
              onChangeText={setSplitAmount}
              placeholder={`Amount (up to ${remainder.toFixed(2)})`}
              placeholderTextColor={isDark ? '#666' : '#aaa'}
            />
            <View style={[styles.chipRow, { marginTop: 10 }]}>
              <TouchableOpacity
                style={[styles.chip, { backgroundColor: splitAsLoan ? selectedChipBg : chipBg }]}
                onPress={() => { setSplitAsLoan(!splitAsLoan); setSplitCategoryId(''); }}
              >
                <Text style={[styles.chipText, { color: splitAsLoan ? '#fff' : chipTextColor }]}>
                  💸 Loan ({isCredit ? 'borrowed' : 'lent'})
                </Text>
              </TouchableOpacity>
              {!splitAsLoan && filteredCategories.map((cat: any) => {
                const sel = splitMainId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.chip, { backgroundColor: sel ? selectedChipBg : chipBg }]}
                    onPress={() => setSplitCategoryId(sel ? '' : cat.id)}
                  >
                    <Text style={[styles.chipText, { color: sel ? '#fff' : chipTextColor }]}>
                      {cat.icon} {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {splitAsLoan && (
              <TextInput
                style={[...inputStyle, { marginTop: 10 }]}
                value={splitLoanPerson}
                onChangeText={setSplitLoanPerson}
                placeholder={`${isCredit ? 'Borrowed from' : 'Lent to'} (default: ${counterparty.trim() || txn.counterparty || 'Unknown'})`}
                placeholderTextColor={isDark ? '#666' : '#aaa'}
              />
            )}
            {!splitAsLoan && splitSubs.length > 0 && (
              <View style={[styles.chipRow, { marginTop: 8 }]}>
                {[{ id: splitMainId, icon: '◦', name: 'General' }, ...splitSubs].map((cat: any) => {
                  const sel = splitCategoryId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.subChip, { backgroundColor: sel ? selectedChipBg : chipBg }]}
                      onPress={() => setSplitCategoryId(cat.id)}
                    >
                      <Text style={[styles.subChipText, { color: sel ? '#fff' : chipTextColor }]}>
                        {cat.icon} {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <TouchableOpacity
              style={[styles.splitAddBtn, { opacity: splitAmount && (splitAsLoan || splitCategoryId) ? 1 : 0.5 }]}
              disabled={!splitAmount || (!splitAsLoan && !splitCategoryId)}
              onPress={handleAddSplit}
            >
              <Text style={styles.splitAddText}>Add Part</Text>
            </TouchableOpacity>
          </View>
        )}
        </>)}
      </View>

      {/* Loan marking — credit = borrowed, debit = lent */}
      <View style={styles.editSection}>
        <Text style={[styles.editLabel, { color: colors.text }]}>Loan</Text>
        {txn.loanId ? (
          <View style={[styles.loanCard, { borderColor: isDark ? '#444' : '#ddd' }]}>
            <Text style={[styles.loanText, { color: colors.text }]}>
              {isCredit ? 'Borrowed from' : 'Lent to'} {txn.counterparty || 'Unknown'}
            </Text>
            <View style={styles.loanActions}>
              <TouchableOpacity onPress={() => router.push('/loans' as any)}>
                <Text style={styles.loanLink}>View loans</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleUnmarkLoan}>
                <Text style={styles.loanRemove}>Unmark</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.loanCard, { borderColor: isDark ? '#444' : '#ddd' }]}
            onPress={handleMarkLoan}
          >
            <Text style={[styles.loanText, { color: colors.text }]}>Mark as loan</Text>
            <Text style={[styles.loanHint, { color: isDark ? '#888' : '#999' }]}>
              {isCredit
                ? `Money received = borrowed from ${counterparty.trim() || 'this person'}`
                : `Money sent = lent to ${counterparty.trim() || 'this person'}`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Transfer pairing — P2P trades and own-account moves */}
      <View style={styles.editSection}>
        <Text style={[styles.editLabel, { color: colors.text }]}>Transfer / P2P</Text>
        {txn.transferPairId ? (
          <View style={[styles.loanCard, { borderColor: isDark ? '#444' : '#ddd' }]}>
            <Text style={[styles.loanText, { color: colors.text }]}>
              ⇄ Paired transfer — not income/expense
            </Text>
            {pairedTxn && (
              <Text style={[styles.loanHint, { color: isDark ? '#888' : '#999' }]}>
                Other leg: {pairedTxn.type === 'credit' ? '+' : '−'}
                {formatMoney(pairedTxn.amount, pairedTxn.currency ?? 'ETB')} · {accountDisplay(pairedTxn)} · {pairedTxn.date}
              </Text>
            )}
            <View style={styles.loanActions}>
              {pairedTxn && (
                <TouchableOpacity onPress={() => router.push(`/transaction/${pairedTxn.id}` as any)}>
                  <Text style={styles.loanLink}>View other leg</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleUnpair}>
                <Text style={styles.loanRemove}>Unmark</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.loanCard, { borderColor: isDark ? '#444' : '#ddd' }]}
            onPress={openPairPicker}
          >
            <Text style={[styles.loanText, { color: colors.text }]}>Mark as transfer pair</Text>
            <Text style={[styles.loanHint, { color: isDark ? '#888' : '#999' }]}>
              {isCredit
                ? 'Pair with the matching debit — a P2P trade or a move between your accounts, not income'
                : 'Pair with the matching credit — a P2P trade or a move between your accounts, not spending'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Editable note */}
      <View style={styles.editSection}>
        <Text style={[styles.editLabel, { color: colors.text }]}>Note</Text>
        <TextInput
          style={[...inputStyle, { height: 80, textAlignVertical: 'top' }]}
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="Optional note"
          placeholderTextColor={isDark ? '#666' : '#aaa'}
        />
      </View>

      {txn.rawSms && (
        <View style={styles.rawSmsSection}>
          <Text style={[styles.rawSmsLabel, { color: colors.text }]}>Original SMS</Text>
          <Text style={[styles.rawSmsText, { color: colors.text }]}>{txn.rawSms}</Text>
        </View>
      )}

      {/* Pick the other leg of the transfer */}
      <Modal visible={candidates !== null} transparent animationType="fade" onRequestClose={() => setCandidates(null)}>
        <Pressable style={styles.pairOverlay} onPress={() => setCandidates(null)}>
          <View
            style={[styles.pairSheet, { backgroundColor: isDark ? '#1c1b18' : '#fff', borderColor: isDark ? '#444' : '#ddd' }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.pairTitle, { color: colors.text }]}>
              Pick the matching {isCredit ? 'debit' : 'credit'}
            </Text>
            <Text style={[styles.pairSub, { color: isDark ? '#888' : '#999' }]}>
              This {isCredit ? 'credit' : 'debit'} of {money(txn.amount)} pairs with the leg on the other account.
            </Text>
            <FlatList
              data={candidates ?? []}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 380 }}
              ListEmptyComponent={
                <Text style={[styles.pairSub, { color: isDark ? '#888' : '#999', marginTop: 12 }]}>
                  No unpaired {isCredit ? 'debits' : 'credits'} within ±6 days.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pairRow, { borderBottomColor: isDark ? '#333' : '#eee' }]}
                  onPress={() => handlePair(item)}
                >
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.pairRowTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.counterparty || (item.type === 'credit' ? 'Received' : 'Sent')}
                    </Text>
                    <Text style={[styles.pairRowSub, { color: isDark ? '#888' : '#999' }]} numberOfLines={1}>
                      {item.date} · {accountDisplay(item)}
                    </Text>
                  </View>
                  <Text style={[styles.pairRowAmount, { color: item.type === 'credit' ? '#27ae60' : '#e74c3c' }]}>
                    {item.type === 'credit' ? '+' : '−'}{formatMoney(item.amount, item.currency ?? 'ETB')}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  amountCard: {
    margin: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  amountLabel: { color: '#fff', fontSize: 14, opacity: 0.8 },
  amountValue: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowLabel: { fontSize: 14, opacity: 0.7 },
  rowValue: { fontSize: 14, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  editSection: { paddingHorizontal: 16, marginTop: 16 },
  editLabel: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  chipText: { fontSize: 13 },
  saveBtn: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#2f95dc',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loanCard: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  loanText: { fontSize: 14, fontWeight: '500' },
  loanHint: { fontSize: 12, marginTop: 3 },
  loanActions: { flexDirection: 'row', gap: 20, marginTop: 8 },
  loanLink: { color: '#2f95dc', fontSize: 13, fontWeight: '500' },
  loanRemove: { color: '#e74c3c', fontSize: 13, fontWeight: '500' },
  sectionCard: {
    marginHorizontal: 16,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  sectionSummary: { fontSize: 12, maxWidth: 180 },
  saveBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  saveBtnTop: {
    backgroundColor: '#2f95dc',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  subChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 99,
  },
  subChipText: { fontSize: 11.5 },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  splitText: { fontSize: 13.5, fontWeight: '600', flex: 1, marginRight: 10 },
  splitHint: { fontSize: 11.5, marginBottom: 8 },
  splitAddBtn: {
    marginTop: 12,
    alignSelf: 'flex-end',
    backgroundColor: '#2f95dc',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  splitAddText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  pairOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  pairSheet: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  pairTitle: { fontSize: 16, fontWeight: '700' },
  pairSub: { fontSize: 12, marginTop: 4, marginBottom: 8 },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  pairRowTitle: { fontSize: 13.5, fontWeight: '600' },
  pairRowSub: { fontSize: 11, marginTop: 2 },
  pairRowAmount: { fontSize: 13, fontWeight: '600' },
  rawSmsSection: { margin: 16, marginTop: 24 },
  rawSmsLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  rawSmsText: { fontSize: 12, opacity: 0.7, lineHeight: 18 },
});
