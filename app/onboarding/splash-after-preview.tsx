import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import LastRepLogo from "../../components/LastRepLogo";

export default function SplashAfterPreview() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/home");
    }, 1500); // duration of splash display
    return () => clearTimeout(timer);
  }, []);

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
