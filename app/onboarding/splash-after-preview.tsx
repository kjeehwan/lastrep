import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import LastRepLogo from "../../components/LastRepLogo";

const ONBOARDING_COMPLETE_KEY = "onboardingComplete";

export default function SplashAfterPreview() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      (async () => {
        await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
        if (!cancelled) {
          router.replace("/home");
        }
      })().catch((error) => {
        console.log("Failed to persist onboarding completion", error);
        if (!cancelled) {
          router.replace("/home");
        }
      });
    }, 1500); // duration of splash display

    return () => {
      cancelled = true;
      clearTimeout(timer);
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
    backgroundColor: "#0d0d1a", // same as onboarding background
    alignItems: "center",
    justifyContent: "center",
  },
});
