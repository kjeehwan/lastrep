import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore"; // Added setDoc
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import OnboardingLayout from "../../src/components/OnboardingLayout";
import { db } from "../../src/config/firebaseConfig";
import { useTheme } from "../../src/contexts/ThemeContext";

export default function Goal() {
  const router = useRouter();
  const { theme } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const goals = ["Build Muscle", "Get Stronger", "Lose Fat", "Improve Fitness"];

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
    if (!selected) return; // Ensure selection is made

    try {
      const user = getAuth().currentUser;
      if (user) {
        const userRef = doc(db, "users", user.uid);
        
        // Check if the user document exists
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          // If no document exists, create the user document using setDoc
          await setDoc(userRef, {
            email: user.email,
            displayName: null,
            createdAt: new Date(),
            hasCompletedOnboarding: false,
            goal: selected,
            experience: null,
            trainingDays: null,
            samplePlan: null,
            profile: {
              gender: null,
              age: null,
              height: null,
              weight: null,
              units: "metric",
            },
            stats: {
              totalWorkouts: 0,
              lastWorkout: null,
            },
          });
          console.log("User document created in Firestore.");
        } else {
          // If document exists, update the goal
          await updateDoc(userRef, {
            goal: selected,
          });
          console.log("Goal updated in Firestore");
        }

        // Navigate to the next screen
        router.push("/onboarding/experience");
      }
    } catch (err) {
      console.error("Error saving goal to Firestore:", err);
    }
  };

  return (
    <OnboardingLayout
      title="What's your goal?"
      subtitle="Choose one that best matches your focus."
      onNext={handleNext}
      nextLabel="Next"
      showNext={!!selected}
    >
      <View style={styles.optionContainer}>
        {goals.map((goal) => (
          <TouchableOpacity
            key={goal}
            style={[styles.option, selected === goal && styles.optionSelected]}
            onPress={() => setSelected(goal)}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.optionText, selected === goal && styles.optionTextSelected]}
            >
              {goal || "Default Goal"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </OnboardingLayout>
  );
}
