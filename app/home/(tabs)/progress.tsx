import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../../src/contexts/ThemeContext";

export default function ProgressScreen() {
  const { theme } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.background,
          paddingHorizontal: 20,
        },
        text: {
          fontSize: 18,
          color: theme.textPrimary,
          textAlign: "center",
        },
        subtitle: {
          fontSize: 15,
          color: theme.textSecondary,
          marginTop: 6,
          textAlign: "center",
        },
      }),
    [theme]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Progress tracking coming soon 📈</Text>
      <Text style={styles.subtitle}>Stay tuned for analytics and trends!</Text>
    </View>
  );
}
