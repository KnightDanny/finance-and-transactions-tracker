import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts } from '@/constants/Type';

interface Props {
  gapCount: number;
  onPress: () => void;
}

export function ReconciliationBanner({ gapCount, onPress }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  if (gapCount === 0) return null;

  return (
    <TouchableOpacity
      style={[styles.banner, {
        backgroundColor: colorScheme === 'dark' ? 'rgba(201,150,103,0.06)' : 'rgba(168,118,59,0.07)',
        borderColor: colorScheme === 'dark' ? 'rgba(201,150,103,0.35)' : 'rgba(168,118,59,0.35)',
      }]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Text style={[styles.count, { color: colors.warning }]}>{gapCount}</Text>
      <Text style={[styles.title, { color: colors.warning }]}>
        balance {gapCount === 1 ? 'gap' : 'gaps'} to review
      </Text>
      <Text style={[styles.arrow, { color: colors.warning }]}>→</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: 13,
    marginBottom: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  count: { fontFamily: fonts.monoMedium, fontSize: 13 },
  title: { fontFamily: fonts.sansMedium, fontSize: 12.5, flex: 1 },
  arrow: { fontSize: 14, opacity: 0.7 },
});
