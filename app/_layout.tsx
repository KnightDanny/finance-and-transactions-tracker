import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
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

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <DatabaseProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="transaction/add" options={{ presentation: 'modal', title: 'Add Transaction' }} />
          <Stack.Screen name="transaction/[id]" options={{ title: 'Transaction Detail' }} />
          <Stack.Screen name="reconciliation" options={{ title: 'Balance Reconciliation' }} />
          <Stack.Screen name="account/[id]" options={{ title: 'Account Detail' }} />
        </Stack>
        {isLocked && isPasscodeSet && <LockScreen />}
      </DatabaseProvider>
    </ThemeProvider>
  );
}
