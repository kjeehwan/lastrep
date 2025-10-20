import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import OnboardingLayout from "../../components/OnboardingLayout";
import { Colors } from "../../styles/colors";

export default function Availability() {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const days = [2, 3, 4, 5, 6];

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

const styles = StyleSheet.create({
  optionContainer: { width: "100%" },
  option: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 12,
    backgroundColor: Colors.surface,
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#E8F9FD",
  },
  optionText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  optionTextSelected: { color: Colors.primary },
});
