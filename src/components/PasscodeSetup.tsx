import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Vibration } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { useAuthStore } from '@/src/auth/store';
import { NEW_PASSCODE_LENGTH } from '@/src/auth/storage';

interface Props {
  onComplete: (pin: string) => void;
  onCancel: () => void;
  mode?: 'setup' | 'change' | 'verify';
}

export function PasscodeSetup({ onComplete, onCancel, mode = 'setup' }: Props) {
  const [step, setStep] = useState<'enter' | 'confirm' | 'verify'>(mode === 'verify' ? 'verify' : 'enter');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const currentLength = useAuthStore((s) => s.passcodeLength);
  // Verifying matches the passcode as saved (may be 4 digits on old installs);
  // new passcodes are always NEW_PASSCODE_LENGTH
  const pinLength = step === 'verify' ? currentLength : NEW_PASSCODE_LENGTH;
  const shakeX = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-12, { duration: 50 }),
      withTiming(12, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  };

  const title =
    step === 'verify' ? 'Enter current passcode' :
    step === 'enter' ? 'Enter new passcode' :
    'Confirm passcode';

  const handleDigit = (digit: string) => {
    const newPin = pin + digit;
    setError('');
    setPin(newPin);

    if (newPin.length === pinLength) {
      if (step === 'verify') {
        onComplete(newPin);
        setPin('');
      } else if (step === 'enter') {
        setFirstPin(newPin);
        setPin('');
        setStep('confirm');
      } else {
        if (newPin === firstPin) {
          onComplete(newPin);
        } else {
          Vibration.vibrate(200);
          triggerShake();
          setError('Passcodes don\'t match. Try again.');
          setPin('');
          setFirstPin('');
          setStep('enter');
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin(p => p.slice(0, -1));
    setError('');
  };

  const dots = Array.from({ length: pinLength }, (_, i) => i < pin.length);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>

        <Animated.View style={[styles.dotsRow, shakeStyle]}>
          {dots.map((filled, i) => (
            <View key={i} style={[styles.dot, filled && styles.dotFilled]} />
          ))}
        </Animated.View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.keypad}>
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'del']].map((row, ri) => (
            <View key={ri} style={styles.keypadRow}>
              {row.map((key, ki) => {
                if (key === '') return <View key={ki} style={styles.key} />;
                if (key === 'del') {
                  return (
                    <TouchableOpacity key={ki} style={styles.key} onPress={handleBackspace}>
                      <Text style={styles.keyTextSmall}>Delete</Text>
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity key={ki} style={styles.key} onPress={() => handleDigit(key)}>
                    <Text style={styles.keyText}>{key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0C0B09',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 998,
  },
  content: { alignItems: 'center', width: '100%', paddingHorizontal: 40 },
  title: { color: '#F1EDE2', fontSize: 18, fontWeight: '600', marginBottom: 32 },
  dotsRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  dotFilled: { backgroundColor: '#D4B96A', borderColor: '#D4B96A' },
  error: { color: '#C97B67', fontSize: 13, marginBottom: 8 },
  keypad: { marginTop: 24, width: '100%' },
  keypadRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12 },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  keyText: { color: '#F1EDE2', fontSize: 28, fontWeight: '500' },
  keyTextSmall: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  cancelBtn: { marginTop: 24 },
  cancelText: { color: '#C97B67', fontSize: 15 },
});
