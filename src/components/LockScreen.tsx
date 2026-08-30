import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Vibration } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { useAuthStore } from '@/src/auth/store';
import { authenticateWithBiometric } from '@/src/auth/biometric';

export function LockScreen() {
  // Length of the passcode as it was saved — old installs may still be on 4 digits
  const { verifyPasscode, unlock, isBiometricEnabled, passcodeLength } = useAuthStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
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

  const tryBiometric = useCallback(async () => {
    if (!isBiometricEnabled) return;
    const success = await authenticateWithBiometric();
    if (success) unlock();
  }, [isBiometricEnabled, unlock]);

  useEffect(() => {
    tryBiometric();
  }, [tryBiometric]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleDigit = async (digit: string) => {
    if (cooldown > 0) return;
    const newPin = pin + digit;
    setError('');
    setPin(newPin);

    if (newPin.length === passcodeLength) {
      const valid = await verifyPasscode(newPin);
      if (valid) {
        unlock();
      } else {
        Vibration.vibrate(200);
        triggerShake();
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setPin('');
        if (newAttempts >= 3) {
          setCooldown(30);
          setAttempts(0);
          setError('Too many attempts. Wait 30s.');
        } else {
          setError('Wrong passcode');
        }
      }
    }
  };

  const handleBackspace = () => {
    if (cooldown > 0) return;
    setPin(p => p.slice(0, -1));
    setError('');
  };

  const dots = Array.from({ length: passcodeLength }, (_, i) => i < pin.length);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Budget Tracker</Text>
        <Text style={styles.subtitle}>Enter your passcode</Text>

        <Animated.View style={[styles.dotsRow, shakeStyle]}>
          {dots.map((filled, i) => (
            <View key={i} style={[styles.dot, filled && styles.dotFilled]} />
          ))}
        </Animated.View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {cooldown > 0 ? <Text style={styles.cooldownText}>Try again in {cooldown}s</Text> : null}

        <View style={styles.keypad}>
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'del']].map((row, ri) => (
            <View key={ri} style={styles.keypadRow}>
              {row.map((key, ki) => {
                if (key === '') {
                  if (isBiometricEnabled) {
                    return (
                      <TouchableOpacity key={ki} style={styles.key} onPress={tryBiometric}>
                        <Text style={styles.keyBiometric}>fingerprint</Text>
                      </TouchableOpacity>
                    );
                  }
                  return <View key={ki} style={styles.key} />;
                }
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

        {isBiometricEnabled && (
          <TouchableOpacity onPress={tryBiometric} style={styles.biometricBtn}>
            <Text style={styles.biometricText}>Use Fingerprint</Text>
          </TouchableOpacity>
        )}
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
    zIndex: 999,
  },
  content: { alignItems: 'center', width: '100%', paddingHorizontal: 40 },
  title: { color: '#F1EDE2', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 32 },
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
  cooldownText: { color: '#C99667', fontSize: 13, marginBottom: 8 },
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
  keyBiometric: { color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'center' },
  biometricBtn: { marginTop: 16 },
  biometricText: { color: '#D4B96A', fontSize: 14, fontWeight: '500' },
});
