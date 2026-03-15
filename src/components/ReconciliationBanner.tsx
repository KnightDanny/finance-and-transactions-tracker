import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

interface Props {
  gapCount: number;
  onPress: () => void;
}

export function ReconciliationBanner({ gapCount, onPress }: Props) {
  if (gapCount === 0) return null;

  return (
    <TouchableOpacity style={styles.banner} onPress={onPress}>
      <Text style={styles.icon}>!</Text>
      <View style={styles.textGroup}>
        <Text style={styles.title}>
          {gapCount} balance {gapCount === 1 ? 'gap' : 'gaps'} detected
        </Text>
        <Text style={styles.subtitle}>
          Some SMS messages may have been missed. Tap to review.
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  icon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f39c12',
    marginRight: 12,
    width: 28,
    height: 28,
    textAlign: 'center',
    lineHeight: 28,
    borderRadius: 14,
    backgroundColor: '#ffeaa7',
  },
  textGroup: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: '#856404' },
  subtitle: { fontSize: 12, color: '#856404', opacity: 0.8, marginTop: 2 },
});
