import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';
import 'react-native-reanimated';

import OfflineBanner from '@/components/OfflineBanner';
import { auth } from '@/src/config/firebaseConfig';
import { initializeRevenueCat, syncRevenueCatIdentity } from '@/src/billing/revenuecat';
import { logAnalyticsRuntimeDiagnostics } from '@/src/analytics/analytics';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const stackScreens = [
    <Stack.Screen key="tabs" name="(tabs)" options={{ headerShown: false }} />,
    <Stack.Screen key="paywall" name="paywall" options={{ title: "Paywall" }} />,
    <Stack.Screen key="modal" name="modal" options={{ presentation: "modal", title: "Modal" }} />,
  ];

  if (__DEV__) {
    stackScreens.push(
      <Stack.Screen
        key="revenuecat-dev"
        name="settings/revenuecat-dev"
        options={{ title: "RevenueCat Debug" }}
      />
    );
  }

  useEffect(() => {
    if (__DEV__) {
      void logAnalyticsRuntimeDiagnostics();
    }

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
      <Stack>{stackScreens}</Stack>
      <OfflineBanner />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
