import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import OnboardingLayout from "../../components/OnboardingLayout";
import { Colors } from "../../styles/colors";

export default function Goal() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const goals = ["Build Muscle", "Get Stronger", "Lose Fat", "Improve Fitness"];

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

const styles = StyleSheet.create({
  optionContainer: {
    width: "100%",
  },
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
