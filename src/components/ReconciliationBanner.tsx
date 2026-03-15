import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { theme } from '@/constants/Colors';

interface Props {
  gapCount: number;
  onPress: () => void;
}

export function ReconciliationBanner({ gapCount, onPress }: Props) {
  if (gapCount === 0) return null;

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TouchableOpacity
      style={[styles.banner, {
        backgroundColor: isDark ? 'rgba(202, 153, 90, 0.15)' : 'rgba(202, 153, 90, 0.12)',
        borderColor: theme.warning,
      }]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={[styles.iconCircle, { backgroundColor: theme.warning }]}>
        <Text style={styles.icon}>!</Text>
      </View>
      <View style={styles.textGroup}>
        <Text style={[styles.title, { color: isDark ? '#DA9C72' : '#856404' }]}>
          {gapCount} balance {gapCount === 1 ? 'gap' : 'gaps'} detected
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? 'rgba(218,156,114,0.7)' : 'rgba(133,100,4,0.7)' }]}>
          Tap to review and resolve.
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 13,
    marginBottom: 13,
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: { fontSize: 16, fontWeight: '800', color: '#fff' },
  textGroup: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600' },
  subtitle: { fontSize: 12, marginTop: 2 },
});
