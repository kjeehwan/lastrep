import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { auth } from '@/src/config/firebaseConfig';
import { initializeRevenueCat, syncRevenueCatIdentity } from '@/src/billing/revenuecat';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    let canceled = false;
    let unsubscribeAuth: (() => void) | null = null;

    (async () => {
      try {
        await initializeRevenueCat();
      } catch {
        // Initialization failures are already logged in billing wrapper.
      }

      if (canceled) return;

      unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        syncRevenueCatIdentity(user?.uid ?? null).catch(() => {
          // Auth sync failures are already logged in billing wrapper.
        });
      });
    })();

    return () => {
      canceled = true;
      unsubscribeAuth?.();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        {__DEV__ && (
          <Stack.Screen name="settings/revenuecat-dev" options={{ title: 'RevenueCat Debug' }} />
        )}
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
