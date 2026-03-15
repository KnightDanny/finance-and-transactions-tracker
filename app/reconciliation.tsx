import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import { getUnresolvedGaps } from '@/src/reconciliation/engine';
import { formatCurrency } from '@/src/utils/currency';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function ReconciliationScreen() {
  const db = useDatabase();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [gaps, setGaps] = useState<any[]>([]);

  useEffect(() => {
    getUnresolvedGaps(db).then(setGaps);
  }, [db]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.description, { color: colors.text }]}>
        These are balance discrepancies detected between consecutive transactions.
        This usually means an SMS was not received. Add manual transactions to resolve them.
      </Text>

      {gaps.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.text }]}>
          No unresolved balance gaps. Everything looks good!
        </Text>
      ) : (
        gaps.map((gap: any) => (
          <View
            key={gap.id}
            style={[styles.gapCard, { backgroundColor: colorScheme === 'dark' ? '#3a2020' : '#fff3f3' }]}
          >
            <Text style={[styles.gapTitle, { color: colors.text }]}>
              Missing {gap.gapAmount > 0 ? 'credit' : 'debit'} of {formatCurrency(Math.abs(gap.gapAmount))}
            </Text>
            <Text style={[styles.gapDetail, { color: colors.text }]}>
              Expected: {formatCurrency(gap.expectedBalance)} | Actual: {formatCurrency(gap.actualBalance)}
            </Text>
            <Text style={[styles.gapDate, { color: colors.text }]}>Detected: {gap.detectedAt}</Text>

            <TouchableOpacity
              style={[styles.resolveBtn, { backgroundColor: colors.tint }]}
              onPress={() => router.push('/transaction/add' as any)}
            >
              <Text style={styles.resolveBtnText}>Add Missing Transaction</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  description: { fontSize: 14, opacity: 0.7, margin: 16, lineHeight: 20 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 40, opacity: 0.6 },
  gapCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  gapTitle: { fontSize: 16, fontWeight: '600' },
  gapDetail: { fontSize: 13, opacity: 0.7, marginTop: 4 },
  gapDate: { fontSize: 12, opacity: 0.5, marginTop: 2 },
  resolveBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  resolveBtnText: { color: '#fff', fontWeight: '600' },
});
