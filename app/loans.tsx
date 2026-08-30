import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, ScrollView, View, Text, TouchableOpacity, Alert, Modal,
  Pressable, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import {
  getLoans, getLoanPayments, createLoan, addLoanPayment,
  setLoanArchived, deleteLoan, LoanWithProgress,
} from '@/src/db/repository/loans';
import { formatCurrency } from '@/src/utils/currency';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts, sectionLabel } from '@/constants/Type';

type Filter = 'all' | 'lent' | 'borrowed';

const today = () => new Date().toISOString().split('T')[0];

export default function LoansScreen() {
  const db = useDatabase();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  const [loans, setLoans] = useState<LoanWithProgress[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [detail, setDetail] = useState<LoanWithProgress | null>(null);
  const [payments, setPayments] = useState<any[]>([]);

  // add form
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'lent' | 'borrowed'>('lent');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');

  // payment form
  const [payAmount, setPayAmount] = useState('');

  const load = useCallback(() => getLoans(db).then(setLoans), [db]);
  useEffect(() => { load(); }, [load]);

  // Dashboard quick-add: /loans?add=1 opens the form immediately
  const { add } = useLocalSearchParams<{ add?: string }>();
  useEffect(() => {
    if (add === '1') setShowAdd(true);
  }, [add]);

  const openDetail = async (loan: LoanWithProgress) => {
    setDetail(loan);
    setPayAmount('');
    setPayments(await getLoanPayments(db, loan.id));
  };

  const submitAdd = async () => {
    const principal = parseFloat(amount.replace(/,/g, ''));
    if (!person.trim() || isNaN(principal) || principal <= 0) return;
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      Alert.alert('Invalid date', 'Due date must be YYYY-MM-DD.');
      return;
    }
    await createLoan(db, {
      person: person.trim(), direction, principal,
      note: note.trim() || undefined, startDate: today(),
      dueDate: dueDate || undefined,
    });
    setShowAdd(false);
    setPerson(''); setAmount(''); setDueDate(''); setNote(''); setDirection('lent');
    load();
  };

  const submitPayment = async () => {
    if (!detail) return;
    const a = parseFloat(payAmount.replace(/,/g, ''));
    if (isNaN(a) || a <= 0) return;
    await addLoanPayment(db, detail.id, a, today());
    const updated = (await getLoans(db)).find((l) => l.id === detail.id);
    setPayments(await getLoanPayments(db, detail.id));
    setPayAmount('');
    if (updated) setDetail(updated);
    load();
  };

  const confirmDelete = (loan: LoanWithProgress) => {
    Alert.alert(`Delete loan with ${loan.person}?`, 'The loan and its payment history are removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteLoan(db, loan.id); setDetail(null); load(); } },
    ]);
  };

  const archive = async (loan: LoanWithProgress) => {
    await setLoanArchived(db, loan.id, true);
    setDetail(null);
    load();
  };

  const lentOut = loans.filter((l) => l.direction === 'lent').reduce((s, l) => s + l.remaining, 0);
  const borrowedOut = loans.filter((l) => l.direction === 'borrowed').reduce((s, l) => s + l.remaining, 0);
  const visible = loans.filter((l) => filter === 'all' || l.direction === filter);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView>
        {/* You get / You owe header */}
        <View style={styles.header}>
          <View style={styles.headCol}>
            <Text style={[styles.headLabel, { color: colors.textSecondary }]}>You get</Text>
            <Text style={[styles.headAmount, { color: colors.income }]}>+{formatCurrency(lentOut)}</Text>
          </View>
          <View style={[styles.headDivider, { backgroundColor: colors.hairline }]} />
          <View style={styles.headCol}>
            <Text style={[styles.headLabel, { color: colors.textSecondary }]}>You owe</Text>
            <Text style={[styles.headAmount, { color: colors.expense }]}>−{formatCurrency(borrowedOut)}</Text>
          </View>
        </View>

        {/* Filter */}
        <View style={styles.filterRow}>
          {(['all', 'lent', 'borrowed'] as Filter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, {
                backgroundColor: filter === f ? colors.goldDim : colors.surfaceVariant,
                borderColor: filter === f ? colors.hairlineStrong : 'transparent',
              }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, { color: filter === f ? colors.gold : colors.textSecondary }]}>
                {f === 'all' ? 'All' : f === 'lent' ? 'Lent' : 'Borrowed'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Loan cards */}
        {visible.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No loans yet. Track money you lend or borrow with the + button.
            </Text>
          </View>
        ) : (
          visible.map((loan) => {
            const progress = loan.principal > 0 ? Math.min(1, loan.paid / loan.principal) : 0;
            const isLent = loan.direction === 'lent';
            const dirColor = isLent ? colors.income : colors.expense;
            const settled = loan.remaining <= 0;
            return (
              <TouchableOpacity
                key={loan.id}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}
                activeOpacity={0.7}
                onPress={() => openDetail(loan)}
                onLongPress={() => confirmDelete(loan)}
              >
                <View style={[styles.spine, { backgroundColor: dirColor }]} />
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.person, { color: colors.text }]} numberOfLines={1}>{loan.person}</Text>
                    <Text style={[styles.meta, { color: colors.textTertiary }]}>
                      {isLent ? 'lent' : 'borrowed'} {formatCurrency(loan.principal)}
                      {loan.dueDate ? ` · due ${loan.dueDate}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.remaining, { color: settled ? colors.textTertiary : dirColor }]}>
                      {settled ? 'settled' : formatCurrency(loan.remaining)}
                    </Text>
                    {!settled && (
                      <Text style={[styles.remainLabel, { color: colors.textTertiary }]}>
                        {isLent ? 'to collect' : 'to pay'}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={[styles.track, { backgroundColor: colors.surfaceVariant }]}>
                  <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: dirColor }]} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 90 }} />
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.gold }]} activeOpacity={0.8} onPress={() => setShowAdd(true)}>
        <Text style={[styles.fabText, { color: isDark ? '#0C0B09' : '#FFFDF8' }]}>+</Text>
      </TouchableOpacity>

      {/* Add loan */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.overlay} onPress={() => setShowAdd(false)}>
          <View style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.hairlineStrong }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Loan</Text>

            <View style={styles.typeRow}>
              {(['lent', 'borrowed'] as const).map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.typeChip, {
                    backgroundColor: direction === d ? colors.goldDim : colors.surfaceVariant,
                    borderColor: direction === d ? colors.hairlineStrong : 'transparent',
                  }]}
                  onPress={() => setDirection(d)}
                >
                  <Text style={[styles.typeText, { color: direction === d ? colors.gold : colors.textSecondary }]}>
                    {d === 'lent' ? 'I lent money' : 'I borrowed'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Person</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.hairline }]}
              value={person} onChangeText={setPerson} placeholder="Who?" placeholderTextColor={colors.textTertiary}
            />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>Amount (ETB)</Text>
            <TextInput
              style={[styles.input, styles.mono, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.hairline }]}
              value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor={colors.textTertiary} keyboardType="numeric"
            />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>Due date (optional, YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.input, styles.mono, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.hairline }]}
              value={dueDate} onChangeText={setDueDate} placeholder="2026-12-31" placeholderTextColor={colors.textTertiary}
            />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>Note (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.hairline }]}
              value={note} onChangeText={setNote} placeholder="What for?" placeholderTextColor={colors.textTertiary}
            />

            <View style={styles.actions}>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.gold, opacity: person.trim() && amount ? 1 : 0.5 }]}
                disabled={!person.trim() || !amount}
                onPress={submitAdd}
              >
                <Text style={[styles.saveText, { color: isDark ? '#0C0B09' : '#FFFDF8' }]}>Add Loan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Loan detail + payments */}
      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.overlay} onPress={() => setDetail(null)}>
          <View style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.hairlineStrong }]} onStartShouldSetResponder={() => true}>
            {detail && (
              <>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{detail.person}</Text>
                <Text style={[styles.detailLine, { color: colors.textSecondary }]}>
                  {detail.direction === 'lent' ? 'You lent' : 'You borrowed'}{' '}
                  <Text style={[styles.mono, { color: colors.text }]}>{formatCurrency(detail.principal)}</Text>
                  {'  ·  paid '}
                  <Text style={[styles.mono, { color: colors.text }]}>{formatCurrency(detail.paid)}</Text>
                </Text>
                <Text style={[styles.detailRemaining, {
                  color: detail.remaining <= 0 ? colors.income
                    : detail.direction === 'lent' ? colors.income : colors.expense,
                }]}>
                  {detail.remaining <= 0
                    ? '✓ Fully settled'
                    : `${formatCurrency(detail.remaining)} ${detail.direction === 'lent' ? 'left to collect' : 'left to pay'}`}
                </Text>

                {detail.remaining > 0 && (
                  <View style={styles.payRow}>
                    <TextInput
                      style={[styles.input, styles.mono, {
                        flex: 1, backgroundColor: colors.surfaceVariant,
                        color: colors.text, borderColor: colors.hairline,
                      }]}
                      value={payAmount} onChangeText={setPayAmount}
                      placeholder={`up to ${formatCurrency(detail.remaining)}`}
                      placeholderTextColor={colors.textTertiary} keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={[styles.saveBtn, { backgroundColor: colors.gold, opacity: payAmount ? 1 : 0.5 }]}
                      disabled={!payAmount}
                      onPress={submitPayment}
                    >
                      <Text style={[styles.saveText, { color: isDark ? '#0C0B09' : '#FFFDF8' }]}>
                        {detail.direction === 'lent' ? 'Collect' : 'Pay'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {payments.length > 0 && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={[styles.payHeader, { color: colors.textSecondary }]}>Payments</Text>
                    {payments.map((p: any, i: number) => (
                      <View key={p.id} style={[styles.payItem, i < payments.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.hairline }]}>
                        <Text style={[styles.payDate, { color: colors.textTertiary }]}>{p.date}</Text>
                        <Text style={[styles.payAmt, { color: colors.text }]}>{formatCurrency(p.amount)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => confirmDelete(detail)}>
                    <Text style={[styles.cancelText, { color: colors.expense }]}>Delete</Text>
                  </TouchableOpacity>
                  {detail.remaining <= 0 && !detail.archived && (
                    <TouchableOpacity onPress={() => archive(detail)}>
                      <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Archive</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setDetail(null)}>
                    <Text style={[styles.cancelText, { color: colors.gold }]}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 13, marginTop: 16, marginBottom: 4,
  },
  headCol: { flex: 1, alignItems: 'center' },
  headLabel: { ...sectionLabel, fontSize: 9.5, marginBottom: 5 },
  headAmount: { fontFamily: fonts.monoMedium, fontSize: 17 },
  headDivider: { width: 1, height: 30 },
  filterRow: { flexDirection: 'row', gap: 8, margin: 13 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1 },
  filterText: { fontFamily: fonts.sansSemiBold, fontSize: 12 },
  emptyCard: { margin: 13, padding: 28, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  card: {
    marginHorizontal: 13, marginBottom: 10, paddingHorizontal: 15,
    paddingTop: 13, paddingBottom: 12, borderRadius: 16, borderWidth: 1, overflow: 'hidden',
  },
  spine: {
    position: 'absolute', left: 0, top: 10, bottom: 10, width: 3,
    borderTopRightRadius: 3, borderBottomRightRadius: 3,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 11 },
  person: { fontFamily: fonts.sansSemiBold, fontSize: 14 },
  meta: { fontFamily: fonts.mono, fontSize: 10.5, marginTop: 3 },
  remaining: { fontFamily: fonts.monoMedium, fontSize: 14.5 },
  remainLabel: { fontFamily: fonts.sans, fontSize: 9.5, marginTop: 2 },
  track: { height: 3, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 3 },
  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 56, height: 56,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 4,
  },
  fabText: { fontFamily: fonts.sans, fontSize: 28, lineHeight: 30 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { width: '100%', borderRadius: 20, borderWidth: 1, padding: 22 },
  modalTitle: { fontFamily: fonts.sansBold, fontSize: 17, marginBottom: 14 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, borderWidth: 1 },
  typeText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5 },
  fieldLabel: { ...sectionLabel, fontSize: 9.5, marginBottom: 7 },
  input: { fontFamily: fonts.sans, fontSize: 14, padding: 12, borderRadius: 12, borderWidth: 1 },
  mono: { fontFamily: fonts.monoMedium },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 20, marginTop: 20 },
  cancelText: { fontFamily: fonts.sansMedium, fontSize: 13 },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12 },
  saveText: { fontFamily: fonts.sansBold, fontSize: 13 },
  detailLine: { fontFamily: fonts.sans, fontSize: 12.5 },
  detailRemaining: { fontFamily: fonts.monoMedium, fontSize: 15, marginTop: 8 },
  payRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 14 },
  payHeader: { ...sectionLabel, fontSize: 9.5, marginBottom: 6 },
  payItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  payDate: { fontFamily: fonts.mono, fontSize: 11 },
  payAmt: { fontFamily: fonts.monoMedium, fontSize: 12.5 },
});
