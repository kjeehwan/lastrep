import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

export default function Welcome() {
  const router = useRouter();
  const { theme } = useTheme(); // ✅ dynamic theme colors

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.background,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
        },
        textContainer: {
          alignItems: "center",
          marginBottom: 40,
        },
        title: {
          fontSize: 26,
          fontWeight: "800",
          color: theme.textPrimary,
          marginBottom: 8,
          textAlign: "center",
        },
        subtitle: {
          fontSize: 16,
          color: theme.textSecondary,
          textAlign: "center",
          lineHeight: 22,
        },
        button: {
          backgroundColor: theme.primary,
          borderRadius: 14,
          paddingVertical: 16,
          paddingHorizontal: 50,
        },
        buttonText: {
          color: theme.onPrimary,
          fontWeight: "700",
          fontSize: 18,
        },
      }),
    [theme]
  );

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{"Welcome to LastRep"}</Text>
        <Text style={styles.subtitle}>
          {"Your coach, partner, and guide for training, recovery, and growth."}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/onboarding/goal")}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>Let's Go</Text>
      </TouchableOpacity>
    </View>
  );
}
