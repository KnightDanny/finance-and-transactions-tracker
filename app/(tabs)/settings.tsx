import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity, Alert, ActivityIndicator, Switch } from 'react-native';
import { useDatabase } from '@/src/db/provider';
import { syncSms } from '@/src/sms/sync';
import { useAuthStore } from '@/src/auth/store';
import { isBiometricAvailable } from '@/src/auth/biometric';
import { PasscodeSetup } from '@/src/components/PasscodeSetup';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts, sectionLabel } from '@/constants/Type';

const TIMEOUT_OPTIONS = [
  { label: 'Immediately', value: 0 },
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
];

export default function SettingsScreen() {
  const db = useDatabase();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const [syncStatus, setSyncStatus] = useState<string>('Not synced');
  const [isSyncing, setIsSyncing] = useState(false);

  const {
    isPasscodeSet, isBiometricEnabled, lockTimeoutSeconds,
    setupPasscode, verifyPasscode, removePasscode, toggleBiometric, setLockTimeout,
  } = useAuthStore();

  const [showPasscodeSetup, setShowPasscodeSetup] = useState(false);
  const [showChangePasscode, setShowChangePasscode] = useState(false);
  const [showVerifyForRemove, setShowVerifyForRemove] = useState(false);
  const [hasBiometricHardware, setHasBiometricHardware] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setHasBiometricHardware);
  }, []);

  const handleSyncSms = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('Syncing...');
    try {
      const result = await syncSms(db);
      setSyncStatus(
        `Synced: ${result.newTransactions} new, ${result.skippedDuplicates} skipped` +
        (result.gaps > 0 ? `, ${result.gaps} balance gaps detected` : '') +
        (result.parseErrors > 0 ? `, ${result.parseErrors} parse errors` : '')
      );
      if (result.gaps > 0) {
        Alert.alert('Balance Gaps Detected', `${result.gaps} balance discrepancies found.`);
      }
    } catch (e: any) {
      setSyncStatus(`Sync failed: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSetupPasscode = async (pin: string) => {
    await setupPasscode(pin);
    setShowPasscodeSetup(false);
    Alert.alert('Passcode Set', 'Your app is now protected.');
  };

  const handleChangePasscode = async (pin: string) => {
    // First call is verify, second is the new setup flow
    if (showChangePasscode === true) {
      // This is handled via a two-step state
    }
  };

  const handleRemovePasscode = async (pin: string) => {
    const valid = await verifyPasscode(pin);
    if (valid) {
      setShowVerifyForRemove(false);
      Alert.alert('Remove Passcode', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            await removePasscode();
            Alert.alert('Passcode Removed', 'App lock has been disabled.');
          }
        },
      ]);
    } else {
      Alert.alert('Error', 'Wrong passcode.');
      setShowVerifyForRemove(false);
    }
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    try {
      await toggleBiometric(enabled);
    } catch {
      Alert.alert('Error', 'Biometric authentication is not available on this device.');
    }
  };

  const currentTimeoutLabel = TIMEOUT_OPTIONS.find(o => o.value === lockTimeoutSeconds)?.label ?? 'Immediately';

  const handleTimeoutPress = () => {
    Alert.alert('Auto-Lock', 'Lock app after:', TIMEOUT_OPTIONS.map(opt => ({
      text: opt.label + (opt.value === lockTimeoutSeconds ? ' (current)' : ''),
      onPress: () => setLockTimeout(opt.value),
    })));
  };

  // Passcode setup overlay
  if (showPasscodeSetup) {
    return <PasscodeSetup onComplete={handleSetupPasscode} onCancel={() => setShowPasscodeSetup(false)} />;
  }
  if (showChangePasscode) {
    return (
      <PasscodeSetup
        mode="setup"
        onComplete={async (pin) => {
          await setupPasscode(pin);
          setShowChangePasscode(false);
          Alert.alert('Passcode Changed', 'Your new passcode is set.');
        }}
        onCancel={() => setShowChangePasscode(false)}
      />
    );
  }
  if (showVerifyForRemove) {
    return <PasscodeSetup mode="verify" onComplete={handleRemovePasscode} onCancel={() => setShowVerifyForRemove(false)} />;
  }

  const menuItems = [
    {
      title: 'Sync SMS',
      subtitle: isSyncing ? 'Syncing...' : syncStatus,
      onPress: handleSyncSms,
      showSpinner: isSyncing,
    },
    { title: 'Backup to Google Drive', subtitle: 'Not configured', onPress: () => Alert.alert('Backup', 'Coming soon.') },
    { title: 'Restore from Backup', subtitle: 'Restore data from Google Drive', onPress: () => Alert.alert('Backup', 'Coming soon.') },
    { title: 'Manage Categories', subtitle: 'Edit transaction categories', onPress: () => {} },
    { title: 'Manage Accounts', subtitle: 'Label and organize accounts', onPress: () => {} },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
      {menuItems.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.menuItem, {
            borderBottomColor: colors.hairline,
            borderBottomWidth: index === menuItems.length - 1 ? 0 : 1,
          }]}
          onPress={item.onPress}
        >
          <View style={styles.menuRow}>
            <View style={styles.menuTextGroup}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
            </View>
            {item.showSpinner && <ActivityIndicator size="small" color={colors.tint} />}
          </View>
        </TouchableOpacity>
      ))}
      </View>

      {/* Security Section */}
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Security</Text>

      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
      {!isPasscodeSet ? (
        <TouchableOpacity
          style={[styles.menuItem, { borderBottomWidth: 0 }]}
          onPress={() => setShowPasscodeSetup(true)}
        >
          <View style={styles.menuTextGroup}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>Set Up Passcode</Text>
            <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Protect your app with a 4-digit PIN</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.hairline }]}
            onPress={() => setShowChangePasscode(true)}
          >
            <View style={styles.menuTextGroup}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Change Passcode</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Set a new 4-digit PIN</Text>
            </View>
          </TouchableOpacity>

          {hasBiometricHardware && (
            <View style={[styles.menuItem, { borderBottomColor: colors.hairline }]}>
              <View style={styles.menuRow}>
                <View style={styles.menuTextGroup}>
                  <Text style={[styles.menuTitle, { color: colors.text }]}>Fingerprint Unlock</Text>
                  <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Use fingerprint to unlock app</Text>
                </View>
                <Switch
                  value={isBiometricEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: colors.surfaceVariant, true: colors.gold }}
                  thumbColor={'#FFFDF8'}
                />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.hairline }]}
            onPress={handleTimeoutPress}
          >
            <View style={styles.menuTextGroup}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Auto-Lock</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>{currentTimeoutLabel}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={() => setShowVerifyForRemove(true)}
          >
            <View style={styles.menuTextGroup}>
              <Text style={[styles.menuTitle, { color: colors.expense }]}>Remove Passcode</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Disable app lock</Text>
            </View>
          </TouchableOpacity>
        </>
      )}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textTertiary }]}>Budget Tracker v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  group: {
    marginHorizontal: 13,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    ...sectionLabel,
    paddingHorizontal: 16,
    paddingTop: 22,
  },
  menuItem: {
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuTextGroup: { flex: 1 },
  menuTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13.5 },
  menuSubtitle: { fontFamily: fonts.sans, fontSize: 11, marginTop: 2.5 },
  footer: { padding: 28, alignItems: 'center' },
  footerText: { fontFamily: fonts.mono, fontSize: 10.5 },
});
