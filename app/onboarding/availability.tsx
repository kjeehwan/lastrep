import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import OnboardingLayout from "../../components/OnboardingLayout";
import { useTheme } from "../../contexts/ThemeContext";

export default function Availability() {
  const router = useRouter();
  const { theme } = useTheme(); // ✅ theme from context
  const [selected, setSelected] = useState<number | null>(null);
  const days = [2, 3, 4, 5, 6];

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
          backgroundColor: theme.highlight, // ✅ subtle highlight for selected state
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
      title="How many days per week can you train?"
      subtitle="Pick the number of days you can realistically commit to."
      onNext={() => router.push("/onboarding/preview")}
      showNext={!!selected}
      nextLabel="Next"
    >
      <View style={styles.optionContainer}>
        {days.map((day) => (
          <TouchableOpacity
            key={day}
            style={[
              styles.option,
              selected === day && styles.optionSelected,
            ]}
            onPress={() => setSelected(day)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.optionText,
                selected === day && styles.optionTextSelected,
              ]}
            >
              {day} Days / Week
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </OnboardingLayout>
  );
}
