import React, { useState } from 'react';
import { StyleSheet, Modal, Pressable, View, Text, TouchableOpacity } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts } from '@/constants/Type';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called with the evaluated result when the user hits Enter. */
  onEnter: (value: number) => void;
}

/** Left-to-right with × ÷ precedence; no eval(). Returns null when the
 * expression is empty/incomplete. */
function evaluate(expr: string): number | null {
  const tokens = expr.match(/(\d+(?:\.\d+)?|[+\-×÷])/g);
  if (!tokens) return null;
  while (tokens.length && /^[+\-×÷]$/.test(tokens[tokens.length - 1])) tokens.pop();
  if (!tokens.length || /^[+\-×÷]$/.test(tokens[0])) return null;

  // First pass: × ÷
  const vals: number[] = [parseFloat(tokens[0])];
  const ops: string[] = [];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const n = parseFloat(tokens[i + 1]);
    if (isNaN(n)) return null;
    if (op === '×' || op === '÷') {
      const prev = vals.pop()!;
      vals.push(op === '×' ? prev * n : prev / n);
    } else {
      ops.push(op);
      vals.push(n);
    }
  }
  // Second pass: + −
  let result = vals[0];
  for (let i = 0; i < ops.length; i++) result = ops[i] === '+' ? result + vals[i + 1] : result - vals[i + 1];
  return isFinite(result) ? result : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const KEYS: string[][] = [
  ['C', '⌫', '÷', '×'],
  ['7', '8', '9', '−'],
  ['4', '5', '6', '+'],
  ['1', '2', '3', '='],
  ['0', '.', 'ENTER'],
];

/** Quick in-app calculator; Enter hands the result to the calling form. */
export function CalculatorModal({ visible, onClose, onEnter }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const [expr, setExpr] = useState('');

  const result = evaluate(expr);
  const showLive = /[+\-×÷]/.test(expr.slice(1));

  const press = (key: string) => {
    if (key === 'C') return setExpr('');
    if (key === '⌫') return setExpr((e) => e.slice(0, -1));
    if (key === '=') {
      if (result != null) setExpr(String(round2(result)));
      return;
    }
    if (key === 'ENTER') {
      if (result != null && result > 0) {
        onEnter(round2(result));
        setExpr('');
        onClose();
      }
      return;
    }
    if (/[+\-×÷]/.test(key)) {
      return setExpr((e) => {
        if (!e) return e;
        return /[+\-×÷]$/.test(e) ? e.slice(0, -1) + key : e + key;
      });
    }
    if (key === '.') {
      return setExpr((e) => {
        const seg = e.split(/[+\-×÷]/).pop() ?? '';
        if (seg.includes('.')) return e;
        return e + (seg === '' ? '0.' : '.');
      });
    }
    setExpr((e) => e + key);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.hairlineStrong }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[styles.expr, { color: colors.text }]} numberOfLines={1}>
            {expr || '0'}
          </Text>
          <Text style={[styles.live, { color: colors.textTertiary }]} numberOfLines={1}>
            {showLive && result != null ? `= ${round2(result)}` : ' '}
          </Text>

          {KEYS.map((row, i) => (
            <View key={i} style={styles.keyRow}>
              {row.map((key) => {
                const isEnter = key === 'ENTER';
                const isOp = /^[+\-×÷=C⌫]$/.test(key);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.key,
                      isEnter && styles.enterKey,
                      {
                        backgroundColor: isEnter
                          ? colors.gold
                          : isOp
                            ? colors.goldDim
                            : colors.surfaceVariant,
                        borderColor: colors.hairline,
                      },
                    ]}
                    onPress={() => press(key)}
                  >
                    <Text
                      style={[
                        styles.keyText,
                        {
                          color: isEnter
                            ? (isDark ? '#0C0B09' : '#FFFDF8')
                            : isOp
                              ? colors.gold
                              : colors.text,
                        },
                        isEnter && styles.enterText,
                      ]}
                    >
                      {isEnter ? 'Enter' : key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  sheet: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  expr: { fontFamily: fonts.monoMedium, fontSize: 26, textAlign: 'right' },
  live: { fontFamily: fonts.mono, fontSize: 13, textAlign: 'right', marginTop: 3, marginBottom: 10 },
  keyRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  key: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enterKey: { flex: 2.08 },
  keyText: { fontFamily: fonts.sansSemiBold, fontSize: 18 },
  enterText: { fontFamily: fonts.sansBold, fontSize: 15, letterSpacing: 1 },
});
