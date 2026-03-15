import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { formatCurrency } from '@/src/utils/currency';
import { useColorScheme } from '@/components/useColorScheme';

interface Props {
  categoryName: string;
  categoryIcon?: string;
  spent: number;
  limit: number;
}

export function BudgetProgressBar({ categoryName, categoryIcon, spent, limit }: Props) {
  const colorScheme = useColorScheme();
  const progress = Math.min(spent / limit, 1);
  const isOverBudget = spent > limit;
  const barColor = isOverBudget ? '#e74c3c' : progress > 0.8 ? '#f39c12' : '#27ae60';

  return (
    <View style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#1e1e1e' : '#fff' }]}>
      <View style={styles.header}>
        <Text style={[styles.name, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
          {categoryIcon ? `${categoryIcon} ` : ''}{categoryName}
        </Text>
        <Text style={[styles.amounts, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>
          {formatCurrency(spent)} / {formatCurrency(limit)}
        </Text>
      </View>
      <View style={[styles.barBg, { backgroundColor: colorScheme === 'dark' ? '#333' : '#e0e0e0' }]}>
        <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: barColor }]} />
      </View>
      {isOverBudget && (
        <Text style={styles.overBudgetText}>
          Over budget by {formatCurrency(spent - limit)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  name: { fontSize: 14, fontWeight: '500' },
  amounts: { fontSize: 12 },
  barBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  overBudgetText: {
    color: '#e74c3c',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
});
