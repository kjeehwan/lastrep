import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import OnboardingLayout from "../../components/OnboardingLayout";
import { useTheme } from "../../contexts/ThemeContext";

export default function Goal() {
  const router = useRouter();
  const { theme } = useTheme(); // ✅ use dynamic theme
  const [selected, setSelected] = useState<string | null>(null);
  const goals = ["Build Muscle", "Get Stronger", "Lose Fat", "Improve Fitness"];

  // ✅ Styles that update automatically when theme changes
  const styles = useMemo(
    () =>
      StyleSheet.create({
        optionContainer: { width: "100%" },

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
      title="What's your goal?"
      subtitle="Choose one that best matches your focus."
      onNext={() => router.push("/onboarding/experience")}
      nextLabel="Next"
      showNext={!!selected}
    >
      <View style={styles.optionContainer}>
        {goals.map((goal) => (
          <TouchableOpacity
            key={goal}
            style={[
              styles.option,
              selected === goal && styles.optionSelected,
            ]}
            onPress={() => setSelected(goal)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.optionText,
                selected === goal && styles.optionTextSelected,
              ]}
            >
              {goal}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </OnboardingLayout>
  );
}
