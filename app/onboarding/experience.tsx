import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import OnboardingLayout from "../../components/OnboardingLayout";
import { Colors } from "../../styles/colors";

export default function Experience() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const levels = ["Beginner", "Intermediate", "Advanced"];

  return (
    <OnboardingLayout
      title="What's your experience level?"
      subtitle="Choose the option that best describes you."
      onNext={() => router.push("/onboarding/availability")}
      nextLabel="Next"
      showNext={!!selected}
    >
      <View style={{ width: "100%" }}>
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

const styles = StyleSheet.create({
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
  optionTextSelected: {
    color: Colors.primary,
  },
});
