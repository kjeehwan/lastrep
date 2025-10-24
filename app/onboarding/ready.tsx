import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import OnboardingLayout from "../../components/OnboardingLayout";
import { useTheme } from "../../contexts/ThemeContext";

export default function Ready() {
  const router = useRouter();
  const { theme } = useTheme(); // ✅ dynamic theme

  // ✅ dynamic styles update when theme changes
  const styles = useMemo(
    () =>
      StyleSheet.create({
        centerContent: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 20,
        },
        logoContainer: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.surface,
          borderRadius: 16,
          paddingVertical: 20,
          paddingHorizontal: 28,
          shadowColor: theme.border,
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
        },
        logo: {
          width: 40,
          height: 40,
          marginRight: 10,
        },
        logoText: {
          fontSize: 26,
          fontWeight: "700",
          color: theme.primary,
        },
      }),
    [theme]
  );

  return (
    <OnboardingLayout
      title="Ready for the"
      subtitle=""
      onNext={() => router.push("/onboarding/welcome")}
      nextLabel="Let's go"
    >
      <View style={styles.centerContent}>
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/images/lastrep-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>LastRep</Text>
        </View>
      </View>
    </OnboardingLayout>
  );
}
