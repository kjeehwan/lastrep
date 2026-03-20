import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, type Href } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { auth } from "../../src/config/firebaseConfig";
import { getUserData } from "../../src/userData";

const ONBOARDING_COMPLETE_KEY = "onboardingComplete";

const hasCompletedLegacyOnboarding = (userData: any): boolean =>
  typeof userData?.nickname === "string" &&
  userData.nickname.trim().length > 0 &&
  typeof userData?.experience === "string" &&
  userData.experience.trim().length > 0 &&
  typeof userData?.availability === "string" &&
  userData.availability.trim().length > 0;

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) {
          setRedirectTo("/auth/sign-up");
          setLoading(false);
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

      setRedirectTo(onboardingComplete === "true" ? "/(tabs)/home" : "/onboarding/goal");
      setLoading(false);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
});
