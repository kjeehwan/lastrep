import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';
import { InteractionManager, LogBox } from 'react-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import OfflineBanner from '@/components/OfflineBanner';
import AppDialogHost from '@/components/AppDialogHost';
import { auth } from '@/src/config/firebaseConfig';
import { initializeRevenueCat, syncRevenueCatIdentity } from '@/src/billing/revenuecat';
import { logAnalyticsRuntimeDiagnostics } from '@/src/analytics/analytics';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

void SplashScreen.preventAutoHideAsync().catch(() => {
  // already prevented or unavailable
});

if (__DEV__) {
  const warnGuard = globalThis as unknown as { __lastrepWarnFilterInstalled?: boolean };
  if (!warnGuard.__lastrepWarnFilterInstalled) {
    const originalWarn = console.warn.bind(console);
    console.warn = (...args: unknown[]) => {
      const first = args[0];
      if (
        typeof first === 'string' &&
        first.includes('SafeAreaView has been deprecated and will be removed in a future release')
      ) {
        return;
      }
      originalWarn(...args);
    };
    warnGuard.__lastrepWarnFilterInstalled = true;
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (!__DEV__) return;
    LogBox.ignoreLogs([
      "SafeAreaView has been deprecated and will be removed in a future release. Please use 'react-native-safe-area-context' instead.",
    ]);
  }, []);

  useEffect(() => {
    if (__DEV__) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      const warmNutritionSearch = async () => {
        try {
          const foodDb = await import('@/src/nutrition/foodDb');
          if (cancelled) return;
          await foodDb.prewarmFoodSearch();
        } catch {
          // Best-effort warmup only.
        }
      };
      void warmNutritionSearch();
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, []);

  const stackScreens = [
    <Stack.Screen key="tabs" name="(tabs)" options={{ headerShown: false }} />,
    <Stack.Screen key="auth-sign-in" name="auth/sign-in" options={{ headerShown: false }} />,
    <Stack.Screen key="auth-sign-up" name="auth/sign-up" options={{ headerShown: false }} />,
    <Stack.Screen key="onboarding" name="onboarding" options={{ headerShown: false }} />,
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
      // Dev client builds are not used for real Play billing validation.
      // Skip RevenueCat bootstrap to avoid noisy configuration errors.
      return;
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>{stackScreens}</Stack>
        <OfflineBanner />
        <AppDialogHost />
        <StatusBar style="light" backgroundColor="#0d0d1a" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
