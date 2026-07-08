import AsyncStorage from "@react-native-async-storage/async-storage";
import { type Href, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import LastRepLogo from "@/components/LastRepLogo";
import { auth } from "../../src/config/firebaseConfig";
import { getUserData } from "../../src/userData";

const ONBOARDING_COMPLETE_KEY = "onboardingComplete";
const MIN_SPLASH_MS = __DEV__ ? 250 : 900;

const hasCompletedLegacyOnboarding = (userData: any): boolean =>
  typeof userData?.nickname === "string" &&
  userData.nickname.trim().length > 0 &&
  typeof userData?.experience === "string" &&
  userData.experience.trim().length > 0 &&
  typeof userData?.availability === "string" &&
  userData.availability.trim().length > 0;

export default function HomeScreen() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) {
          const elapsed = Date.now() - startedAt;
          if (elapsed < MIN_SPLASH_MS) {
            await new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS - elapsed));
          }
          router.replace("/auth/sign-up");
          setTimeout(() => {
            void SplashScreen.hideAsync().catch(() => {});
          }, 0);
        }
        return;
      }

      let onboardingComplete = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
      if (onboardingComplete !== "true") {
        const userData = await getUserData(user.uid);
        if (hasCompletedLegacyOnboarding(userData)) {
          onboardingComplete = "true";
          await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
        }
      }

      if (cancelled) return;

      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_SPLASH_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS - elapsed));
      }
      const target: Href = onboardingComplete === "true" ? "/(tabs)/home" : "/onboarding/goal";
      router.replace(target);
      setTimeout(() => {
        void SplashScreen.hideAsync().catch(() => {});
      }, 0);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <LastRepLogo />
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
