import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import OnboardingLayout from "../../components/OnboardingLayout";
import { useTheme } from "../../contexts/ThemeContext";

export default function Experience() {
  const router = useRouter();
  const { theme } = useTheme(); // ✅ get current theme
  const [selected, setSelected] = useState<string | null>(null);
  const levels = ["Beginner", "Intermediate", "Advanced"];

  // ✅ Dynamic styles that change when theme changes
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { width: "100%" },

        option: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 14,
          paddingVertical: 16,
          paddingHorizontal: 18,
          marginBottom: 12,
          backgroundColor: theme.surface,
        },

        optionSelected: {
          borderColor: theme.primary,
          backgroundColor: theme.highlight,
        },

        optionText: {
          fontSize: 16,
          fontWeight: "600",
          color: theme.textPrimary,
          textAlign: "center",
        },

        optionTextSelected: {
          color: theme.primary,
        },
      }),
    [theme]
  );

  return (
    <OnboardingLayout
      title="What's your experience level?"
      subtitle="Choose the option that best describes you."
      onNext={() => router.push("/onboarding/availability")}
      nextLabel="Next"
      showNext={!!selected}
    >
      <View style={styles.container}>
        {levels.map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.option,
              selected === level && styles.optionSelected,
            ]}
            onPress={() => setSelected(level)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.optionText,
                selected === level && styles.optionTextSelected,
              ]}
            >
              {level}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </OnboardingLayout>
  );
}
