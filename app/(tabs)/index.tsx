import { type Href, useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { auth } from "../../src/config/firebaseConfig";
import { resolveOnboardingDestination } from "../../src/onboarding/onboardingService";

export default function HomeScreen() {
  const router = useRouter();

  useFocusEffect(useCallback(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) {
          if (cancelled || auth.currentUser) return;
          router.replace("/auth/sign-up");
        }
        return;
      }

      const target: Href = await resolveOnboardingDestination(user.uid);

      if (cancelled) return;

      if (cancelled || auth.currentUser?.uid !== user.uid) return;
      router.replace(target);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router]));

  return (
    <View style={styles.container} />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
});
