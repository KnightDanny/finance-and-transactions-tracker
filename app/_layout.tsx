import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import Colors from '@/constants/Colors';
import { fonts } from '@/constants/Type';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { DatabaseProvider } from '@/src/db/provider';
import { useAuthStore } from '@/src/auth/store';
import { LockScreen } from '@/src/components/LockScreen';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    DMMono_400Regular,
    DMMono_500Medium,
  });
  const initialize = useAuthStore(s => s.initialize);
  const isReady = useAuthStore(s => s.isReady);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (loaded && isReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isReady]);

  if (!loaded || !isReady) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isLocked, isPasscodeSet, lock, lockTimeoutSeconds } = useAuthStore();
  const appState = useRef(AppState.currentState);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current === 'active' && nextState.match(/inactive|background/)) {
        backgroundedAt.current = Date.now();
      }
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if (backgroundedAt.current && isPasscodeSet) {
          const elapsed = (Date.now() - backgroundedAt.current) / 1000;
          if (elapsed >= lockTimeoutSeconds) {
            lock();
          }
        }
        backgroundedAt.current = null;
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [isPasscodeSet, lock, lockTimeoutSeconds]);

  const navTheme = colorScheme === 'dark' ? {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: Colors.dark.accent,
      background: Colors.dark.background,
      card: Colors.dark.surface,
      text: Colors.dark.text,
      border: Colors.dark.divider,
      notification: Colors.dark.accent,
    },
  } : {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: Colors.light.accent,
      background: Colors.light.background,
      card: Colors.light.surface,
      text: Colors.light.text,
      border: Colors.light.divider,
      notification: Colors.light.accent,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <DatabaseProvider>
        <Stack
          screenOptions={{
            headerTitleStyle: { fontFamily: fonts.sansBold, fontSize: 17 },
            headerShadowVisible: false,
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="transaction/add" options={{ presentation: 'modal', title: 'Add Transaction' }} />
          <Stack.Screen name="transaction/[id]" options={{ title: 'Transaction Detail' }} />
          <Stack.Screen name="reconciliation" options={{ title: 'Balance Reconciliation' }} />
          <Stack.Screen name="account/[id]" options={{ title: 'Account Detail' }} />
          <Stack.Screen name="customize-dashboard" options={{ title: 'Customize Dashboard' }} />
          <Stack.Screen name="manage-categories" options={{ title: 'Categories' }} />
          <Stack.Screen name="manage-accounts" options={{ title: 'Accounts & Currencies' }} />
          <Stack.Screen name="exchange-rates" options={{ title: 'Exchange Rates' }} />
          <Stack.Screen name="budget-editor" options={{ title: 'Budget' }} />
          <Stack.Screen name="loans" options={{ title: 'Loans' }} />
        </Stack>
        {isLocked && isPasscodeSet && <LockScreen />}
      </DatabaseProvider>
    </ThemeProvider>
  );
}
