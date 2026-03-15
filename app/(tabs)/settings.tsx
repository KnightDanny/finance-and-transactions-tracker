import React, { useState } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useDatabase } from '@/src/db/provider';
import { syncSms } from '@/src/sms/sync';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function SettingsScreen() {
  const db = useDatabase();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [syncStatus, setSyncStatus] = useState<string>('Not synced');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncSms = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('Syncing...');

    try {
      // Use mock data for development; set to false when native module is ready
      const result = await syncSms(db, true);
      setSyncStatus(
        `Synced: ${result.newTransactions} new, ${result.skippedDuplicates} skipped` +
        (result.gaps > 0 ? `, ${result.gaps} balance gaps detected` : '') +
        (result.parseErrors > 0 ? `, ${result.parseErrors} parse errors` : '')
      );

      if (result.gaps > 0) {
        Alert.alert(
          'Balance Gaps Detected',
          `${result.gaps} balance discrepancies found. Some SMS messages may have been missed. Go to Dashboard to review.`
        );
      }
    } catch (e: any) {
      setSyncStatus(`Sync failed: ${e.message}`);
      console.error('SMS sync error:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncReal = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('Syncing real SMS...');

    try {
      const result = await syncSms(db, false);
      setSyncStatus(
        `Synced: ${result.newTransactions} new, ${result.skippedDuplicates} skipped` +
        (result.gaps > 0 ? `, ${result.gaps} balance gaps` : '')
      );
    } catch (e: any) {
      setSyncStatus(`Sync failed: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBackup = () => {
    Alert.alert('Backup', 'Google Drive backup coming soon.');
  };

  const menuItems = [
    {
      title: 'Sync SMS (Mock Data)',
      subtitle: isSyncing ? 'Syncing...' : syncStatus,
      onPress: handleSyncSms,
      showSpinner: isSyncing,
    },
    {
      title: 'Sync SMS (Real)',
      subtitle: 'Requires custom dev build with SMS permission',
      onPress: handleSyncReal,
    },
    { title: 'Backup to Google Drive', subtitle: 'Not configured', onPress: handleBackup },
    { title: 'Restore from Backup', subtitle: 'Restore data from Google Drive', onPress: handleBackup },
    { title: 'Manage Categories', subtitle: 'Edit transaction categories', onPress: () => {} },
    { title: 'Manage Accounts', subtitle: 'Label and organize accounts', onPress: () => {} },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {menuItems.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.menuItem, { borderBottomColor: colorScheme === 'dark' ? '#333' : '#e0e0e0' }]}
          onPress={item.onPress}
        >
          <View style={styles.menuRow}>
            <View style={styles.menuTextGroup}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.menuSubtitle, { color: colors.text }]}>{item.subtitle}</Text>
            </View>
            {item.showSpinner && <ActivityIndicator size="small" color={colors.tint} />}
          </View>
        </TouchableOpacity>
      ))}

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.text }]}>Budget Tracker v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuTextGroup: { flex: 1 },
  menuTitle: { fontSize: 16, fontWeight: '500' },
  menuSubtitle: { fontSize: 13, opacity: 0.6, marginTop: 2 },
  footer: { padding: 24, alignItems: 'center' },
  footerText: { fontSize: 12, opacity: 0.4 },
});
