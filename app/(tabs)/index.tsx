import { type Href, useFocusEffect, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { onAuthStateChanged } from "firebase/auth";
import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import LastrepLogo from "@/components/LastrepLogo";
import { auth } from "../../src/config/firebaseConfig";
import { resolveOnboardingDestination } from "../../src/onboarding/onboardingService";

const MIN_SPLASH_MS = __DEV__ ? 250 : 900;

export default function HomeScreen() {
  const router = useRouter();

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    const startedAt = Date.now();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) {
          const elapsed = Date.now() - startedAt;
          if (elapsed < MIN_SPLASH_MS) {
            await new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS - elapsed));
          }
          if (cancelled || auth.currentUser) return;
          router.replace("/auth/sign-up");
          setTimeout(() => {
            void SplashScreen.hideAsync().catch(() => {});
          }, 0);
        }
        return;
      }

      const target: Href = await resolveOnboardingDestination(user.uid);

      if (cancelled) return;

      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_SPLASH_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS - elapsed));
      }
      if (cancelled || auth.currentUser?.uid !== user.uid) return;
      router.replace(target);
      setTimeout(() => {
        void SplashScreen.hideAsync().catch(() => {});
      }, 0);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router]));

  return (
    <View style={styles.container}>
      <LastrepLogo />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0d0d1a",
  },
});
