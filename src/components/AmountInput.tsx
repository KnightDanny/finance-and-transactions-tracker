import React, { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, StyleProp, TextStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CalculatorModal } from './CalculatorModal';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  /** Style for the text input itself — pass the screen's own input style. */
  style?: StyleProp<TextStyle>;
  autoFocus?: boolean;
}

/**
 * Numeric amount field with a built-in quick calculator: the icon opens
 * CalculatorModal and its Enter key writes the result into the field.
 */
export function AmountInput({ value, onChangeText, placeholder, placeholderTextColor, style, autoFocus }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [showCalc, setShowCalc] = useState(false);

  return (
    <View style={styles.row}>
      <TextInput
        style={[style, styles.input]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        keyboardType="numeric"
        autoFocus={autoFocus}
      />
      <TouchableOpacity
        style={[styles.calcBtn, { borderColor: colors.hairlineStrong, backgroundColor: colors.surfaceVariant }]}
        onPress={() => setShowCalc(true)}
      >
        <MaterialCommunityIcons name="calculator-variant-outline" size={20} color={colors.text} />
      </TouchableOpacity>
      <CalculatorModal
        visible={showCalc}
        onClose={() => setShowCalc(false)}
        onEnter={(v) => onChangeText(String(v))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1 },
  calcBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
