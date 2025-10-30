import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import OnboardingLayout from "../../src/components/OnboardingLayout"; // Ensure this is imported
import { db } from "../../src/config/firebaseConfig";
import { useTheme } from "../../src/contexts/ThemeContext";

export default function Experience() {
  const router = useRouter();
  const { theme } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const levels = ["Beginner", "Intermediate", "Advanced"];

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

  const handleNext = async () => {
    if (!selected) return; // Ensure selection is made

    try {
      const user = getAuth().currentUser;
      if (user) {
        // Save selected experience to Firestore
        await updateDoc(doc(db, "users", user.uid), {
          experience: selected,
        });
        console.log("Experience saved to Firestore");

        // Navigate to the next screen
        router.push("/onboarding/availability");
      }
    } catch (err) {
      console.error("Error saving experience to Firestore:", err);
    }
  };

  return (
    <OnboardingLayout
      title="What's your experience level?"
      subtitle="Choose the option that best describes you."
      onNext={handleNext}
      nextLabel="Next"
      showNext={!!selected}
    >
      <View style={styles.container}>
        {levels.map((level) => (
          <TouchableOpacity
            key={level}
            style={[styles.option, selected === level && styles.optionSelected]}
            onPress={() => setSelected(level)}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.optionText, selected === level && styles.optionTextSelected]}
            >
              {level || "Default Experience Level"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </OnboardingLayout>
  );
}
