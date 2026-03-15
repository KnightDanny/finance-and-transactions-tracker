import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import { getUnresolvedGaps, skipGap, skipAllGaps } from '@/src/reconciliation/engine';
import { formatCurrency } from '@/src/utils/currency';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function ReconciliationScreen() {
  const db = useDatabase();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [gaps, setGaps] = useState<any[]>([]);

  const loadGaps = useCallback(async () => {
    const data = await getUnresolvedGaps(db);
    setGaps(data);
  }, [db]);

  useEffect(() => {
    loadGaps();
  }, [loadGaps]);

  const handleSkip = async (gapId: string) => {
    await skipGap(db, gapId);
    setGaps((prev) => prev.filter((g) => g.id !== gapId));
  };

  const handleSkipAll = () => {
    Alert.alert(
      'Skip All Gaps',
      'Mark all balance gaps as unaccounted? You can still add missing transactions later from the transaction history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip All',
          style: 'destructive',
          onPress: async () => {
            await skipAllGaps(db);
            setGaps([]);
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.description, { color: colors.text }]}>
        These are balance discrepancies detected between consecutive transactions.
        This usually means an SMS was not received. Add manual transactions to resolve them, or skip to mark as unaccounted.
      </Text>

      {gaps.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.text }]}>
          No unresolved balance gaps. Everything looks good!
        </Text>
      ) : (
        <>
          {/* Skip All button */}
          <TouchableOpacity
            style={[styles.skipAllBtn, { borderColor: colorScheme === 'dark' ? '#555' : '#ccc' }]}
            onPress={handleSkipAll}
          >
            <Text style={[styles.skipAllText, { color: colors.text }]}>
              Skip All ({gaps.length})
            </Text>
          </TouchableOpacity>

          {gaps.map((gap: any) => (
            <View
              key={gap.id}
              style={[styles.gapCard, { backgroundColor: colorScheme === 'dark' ? '#3a2020' : '#fff3f3' }]}
            >
              <Text style={[styles.gapAccount, { color: colors.tint }]}>
                {gap.bank}{gap.accountNumber ? ` • ${gap.accountNumber}` : ''}
              </Text>
              <Text style={[styles.gapTitle, { color: colors.text }]}>
                Missing {gap.gapAmount > 0 ? 'credit' : 'debit'} of {formatCurrency(Math.abs(gap.gapAmount))}
              </Text>
              <Text style={[styles.gapDetail, { color: colors.text }]}>
                Expected: {formatCurrency(gap.expectedBalance)} | Actual: {formatCurrency(gap.actualBalance)}
              </Text>
              <Text style={[styles.gapDate, { color: colors.text }]}>
                Date: {gap.detectedAt}
              </Text>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.resolveBtn, { backgroundColor: '#2f95dc', flex: 1 }]}
                  onPress={() => router.push('/transaction/add' as any)}
                >
                  <Text style={styles.resolveBtnText}>Add Transaction</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.skipBtn, { borderColor: colorScheme === 'dark' ? '#555' : '#ccc' }]}
                  onPress={() => handleSkip(gap.id)}
                >
                  <Text style={[styles.skipBtnText, { color: colors.text }]}>Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  description: { fontSize: 14, opacity: 0.7, margin: 16, lineHeight: 20 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 40, opacity: 0.6 },
  skipAllBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  skipAllText: { fontWeight: '600', fontSize: 14 },
  gapCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  gapAccount: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  gapTitle: { fontSize: 16, fontWeight: '600' },
  gapDetail: { fontSize: 13, opacity: 0.7, marginTop: 4 },
  gapDate: { fontSize: 12, opacity: 0.5, marginTop: 2 },
  btnRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  resolveBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  resolveBtnText: { color: '#fff', fontWeight: '600' },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: { fontWeight: '600', fontSize: 14 },
});
