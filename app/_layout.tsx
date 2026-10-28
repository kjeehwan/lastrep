import { SharingProvider } from "../src/sharing/SharingProvider";
import * as SplashScreen from 'expo-splash-screen';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { setRestAlertOwner } from '../src/workouts/workoutLog/restAlertsNative';
import { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import OfflineBanner from '@/components/OfflineBanner';
import AppDialogHost from '@/components/AppDialogHost';
import { auth } from '@/src/config/firebaseConfig';
import { initializeRevenueCat, isDevBillingBuild, syncRevenueCatIdentity } from '@/src/billing/revenuecat';
import { logAnalyticsRuntimeDiagnostics } from '@/src/analytics/analytics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppThemeProvider } from '@/src/theme/AppThemeProvider';
import { usesNotebookDesign } from '@/src/ui/notebook/navigationGeometry';

export const unstable_settings = {
  anchor: '(tabs)',
};

if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-reanimated');
}

void SplashScreen.preventAutoHideAsync().catch(() => {
  // already prevented or unavailable
});
// Home is prepared behind the native splash. Avoid blending the black launch
// surface through the light notebook canvas during Expo's default 400ms fade.
SplashScreen.setOptions({ duration: 0, fade: false });

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
  return <AppThemeProvider><RootContent /></AppThemeProvider>;
}
function RootContent() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();

  useEffect(() => {
    if (!__DEV__) return;
    LogBox.ignoreLogs([
      "SafeAreaView has been deprecated and will be removed in a future release. Please use 'react-native-safe-area-context' instead.",
    ]);
  }, []);


  const stackScreens = [
    <Stack.Screen key="tabs" name="(tabs)" options={{ headerShown: false }} />,
    <Stack.Screen key="auth-sign-in" name="auth/sign-in" options={{ headerShown: false }} />,
    <Stack.Screen key="auth-sign-up" name="auth/sign-up" options={{ headerShown: false }} />,
    <Stack.Screen key="shared-workout" name="shared-workout" options={{ headerShown: false }} />,
    <Stack.Screen key="short-shared-workout" name="w/[token]" options={{ headerShown: false }} />,
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
    if (__DEV__ || isDevBillingBuild()) {
      if (__DEV__) void logAnalyticsRuntimeDiagnostics();
      // Standalone dev releases also lack the production Play products.
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
        void setRestAlertOwner(user?.uid ?? null).catch(() => undefined);
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
        <SharingProvider><Stack>{stackScreens}</Stack></SharingProvider>
        <OfflineBanner />
        <AppDialogHost />
        <StatusBar style={usesNotebookDesign(pathname) && colorScheme === 'light' ? 'dark' : 'light'} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
