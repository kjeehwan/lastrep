import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import OnboardingLayout from "../../components/OnboardingLayout"; // Ensure this is imported
import { useTheme } from "../../contexts/ThemeContext";
import { db } from "../../firebaseConfig";

export default function Availability() {
  const router = useRouter();
  const { theme } = useTheme();
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
    if (selected === null) return; // Ensure selection is made

    try {
      const user = getAuth().currentUser;
      if (user) {
        // Save availability to Firestore
        await updateDoc(doc(db, "users", user.uid), {
          trainingDays: selected,
        });
        console.log("Training days saved to Firestore");

        // Navigate to the preview screen
        router.push("/onboarding/preview");
      }
    } catch (err) {
      console.error("Error saving availability to Firestore:", err);
    }
  };

  return (
    <OnboardingLayout
      title="How many days per week can you train?"
      subtitle="Pick the number of days you can realistically commit to."
      onNext={handleNext}
      showNext={!!selected}
      nextLabel="Next"
    >
      <View style={styles.optionContainer}>
        {days.map((day) => (
          <TouchableOpacity
            key={day}
            style={[styles.option, selected === day && styles.optionSelected]}
            onPress={() => setSelected(day)}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.optionText, selected === day && styles.optionTextSelected]}
            >
              {`${day} Days / Week`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </OnboardingLayout>
  );
}
