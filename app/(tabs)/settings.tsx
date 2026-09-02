import React, { useState, useEffect } from 'react';
import {
  StyleSheet, ScrollView, View, Text, TouchableOpacity, Alert, ActivityIndicator, Switch,
  Modal, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDatabase } from '@/src/db/provider';
import { syncSms } from '@/src/sms/sync';
import { countTransactionsBefore } from '@/src/db/repository/transactions';
import { connectGmail, disconnectGmail, getConnectedEmail } from '@/src/email/gmail';
import { syncEmails } from '@/src/email/sync';
import { exportTransactionsCsv } from '@/src/utils/exportCsv';
import { useAuthStore } from '@/src/auth/store';
import { isBiometricAvailable } from '@/src/auth/biometric';
import { PasscodeSetup } from '@/src/components/PasscodeSetup';
import { CalendarPicker } from '@/src/components/CalendarPicker';
import Constants from 'expo-constants';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts, sectionLabel } from '@/constants/Type';

const TIMEOUT_OPTIONS = [
  { label: 'Immediately', value: 0 },
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toDateStr(d);
}

/** Empty string = all messages. Chips fill the date input; user can still type any date. */
const SYNC_PRESETS: { label: string; date: () => string }[] = [
  { label: '30 days', date: () => daysAgoStr(30) },
  { label: '3 months', date: () => daysAgoStr(90) },
  { label: 'This year', date: () => `${new Date().getFullYear()}-01-01` },
  { label: 'All time', date: () => '' },
];

export default function SettingsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const [syncStatus, setSyncStatus] = useState<string>('Not synced');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncFromDate, setSyncFromDate] = useState('');
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);

  useEffect(() => {
    getConnectedEmail().then(setGmailEmail);
  }, []);

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

  const handleSyncSms = async (fromTimestamp?: number) => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('Syncing...');
    try {
      const result = await syncSms(db, false, fromTimestamp);
      setSyncStatus(
        `Synced: ${result.newTransactions} new, ${result.skippedDuplicates} skipped` +
        (result.removedOld > 0 ? `, ${result.removedOld} old removed` : '') +
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

  const startSyncFromDate = async () => {
    const date = syncFromDate.trim();
    if (!date) {
      // Empty = full sync, nothing removed — confirm so it's never a surprise
      Alert.alert(
        'Sync all messages',
        'No start date set. Your full SMS history will be imported and nothing will be removed.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sync All', onPress: () => {
              setShowSyncModal(false);
              handleSyncSms(0);
            },
          },
        ]
      );
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Invalid date', 'Start date must be YYYY-MM-DD.');
      return;
    }
    const [y, m, d] = date.split('-').map(Number);
    const parsed = new Date(y, m - 1, d);
    // Reject rollovers like 2026-02-31 → Mar 3
    if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) {
      Alert.alert('Invalid date', `${date} is not a real date.`);
      return;
    }
    const fromTimestamp = parsed.getTime();
    // Dated sync re-baselines the app — say exactly how much is going away
    const removeCount = await countTransactionsBefore(db, date);
    Alert.alert(
      `Sync from ${date}`,
      (removeCount > 0
        ? `${removeCount} transaction${removeCount === 1 ? '' : 's'} before ${date} will be REMOVED from the app. `
        : 'No existing transactions predate this. ') +
        `SMS from ${date} onward will then be imported. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: removeCount > 0 ? 'Remove & Sync' : 'Sync', style: 'destructive', onPress: () => {
            setShowSyncModal(false);
            handleSyncSms(fromTimestamp);
          },
        },
      ]
    );
  };

  const handleEmailSync = async () => {
    try {
      const r = await syncEmails(db);
      Alert.alert(
        'Email Sync',
        `${r.newTransactions} new, ${r.skippedDuplicates} skipped` +
          (r.parseErrors > 0 ? `, ${r.parseErrors} unparsed` : '')
      );
    } catch (e: any) {
      Alert.alert('Email Sync Failed', e.message);
    }
  };

  const handleGmailPress = async () => {
    if (gmailEmail) {
      Alert.alert('Gmail', `Signed in to ${gmailEmail}`, [
        { text: 'Close', style: 'cancel' },
        { text: 'Sync Emails', onPress: handleEmailSync },
        {
          text: 'Disconnect', style: 'destructive', onPress: async () => {
            await disconnectGmail();
            setGmailEmail(null);
          },
        },
      ]);
      return;
    }
    try {
      const email = await connectGmail();
      setGmailEmail(email);
      Alert.alert('Gmail Connected', `Signed in to ${email}`);
    } catch (e: any) {
      Alert.alert('Sign-in Failed', e.message ?? 'Could not sign in');
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
      title: 'Sync from Date',
      subtitle: isSyncing ? 'Syncing...' : syncStatus,
      onPress: () => {
        if (isSyncing) return;
        // Open unselected — the calendar shows the current month and the user
        // picks a day or a preset chip
        setSyncFromDate('');
        setShowSyncModal(true);
      },
      showSpinner: isSyncing,
    },
    {
      title: 'Export Transactions (CSV)',
      subtitle: 'All transactions, sorted by date',
      onPress: async () => {
        try {
          const count = await exportTransactionsCsv(db);
          if (count !== null) Alert.alert('Exported', `${count} transactions written to CSV.`);
        } catch (e: any) {
          Alert.alert('Export Failed', e.message);
        }
      },
    },
    {
      title: 'Gmail (USD & Crypto)',
      subtitle: gmailEmail ? `✓ Signed in to ${gmailEmail}` : 'Connect to import provider emails',
      onPress: handleGmailPress,
    },
    { title: 'Backup to Google Drive', subtitle: 'Not configured', onPress: () => Alert.alert('Backup', 'Coming soon.') },
    { title: 'Restore from Backup', subtitle: 'Restore data from Google Drive', onPress: () => Alert.alert('Backup', 'Coming soon.') },
    { title: 'Customize Dashboard', subtitle: 'Choose which sections show on Home', onPress: () => router.push('/customize-dashboard' as any) },
    { title: 'Loans', subtitle: 'Money lent and borrowed', onPress: () => router.push('/loans' as any) },
    { title: 'Manage Categories', subtitle: 'Add, edit, and delete categories', onPress: () => router.push('/manage-categories' as any) },
    { title: 'Accounts & Currencies', subtitle: 'Manual USD/USDT/USDC accounts and exchange rates', onPress: () => router.push('/manage-accounts' as any) },
    { title: 'Exchange Rates', subtitle: 'What 1 USD/USDT/EUR is worth in ETB', onPress: () => router.push('/exchange-rates' as any) },
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
            <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Protect your app with a 6-digit PIN</Text>
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
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Set a new 6-digit PIN</Text>
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
        <Text style={[styles.footerText, { color: colors.textTertiary }]}>Budget Tracker v{Constants.expoConfig?.version ?? '1.0.1'}</Text>
      </View>

      {/* Sync-from-date modal */}
      <Modal visible={showSyncModal} transparent animationType="fade" onRequestClose={() => setShowSyncModal(false)}>
          <Pressable style={styles.overlay} onPress={() => setShowSyncModal(false)}>
            <View
              style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.hairlineStrong }]}
              onStartShouldSetResponder={() => true}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>Sync from Date</Text>
              <Text style={[styles.modalHint, { color: colors.textTertiary }]}>
                Imports bank SMS from the picked date onward — and removes anything older from the app. All time syncs everything and removes nothing.
              </Text>

              <View style={styles.chipRow}>
                {SYNC_PRESETS.map((preset) => {
                  const value = preset.date();
                  const active = syncFromDate === value;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      style={[styles.chip, {
                        backgroundColor: active ? colors.goldDim : colors.surfaceVariant,
                        borderColor: active ? colors.hairlineStrong : 'transparent',
                      }]}
                      onPress={() => setSyncFromDate(value)}
                    >
                      <Text style={[styles.chipText, { color: active ? colors.gold : colors.textSecondary }]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <CalendarPicker value={syncFromDate || null} onChange={setSyncFromDate} />
              <Text style={[styles.selectedLine, { color: colors.textSecondary }]}>
                {syncFromDate ? (
                  <>Start: <Text style={[styles.mono, { color: colors.gold }]}>{syncFromDate}</Text></>
                ) : (
                  'No start date — all messages, nothing removed'
                )}
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity onPress={() => setShowSyncModal(false)}>
                  <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.gold }]}
                  onPress={startSyncFromDate}
                >
                  <Text style={[styles.saveText, { color: isDark ? '#0C0B09' : '#FFFDF8' }]}>Sync</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
      </Modal>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { width: '100%', borderRadius: 20, borderWidth: 1, padding: 22 },
  modalTitle: { fontFamily: fonts.sansBold, fontSize: 17, marginBottom: 6 },
  modalHint: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 16, marginBottom: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, borderWidth: 1 },
  chipText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5 },
  selectedLine: { fontFamily: fonts.sans, fontSize: 11.5, marginTop: 10 },
  mono: { fontFamily: fonts.monoMedium },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 20, marginTop: 20 },
  cancelText: { fontFamily: fonts.sansMedium, fontSize: 13 },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12 },
  saveText: { fontFamily: fonts.sansBold, fontSize: 13 },
});
