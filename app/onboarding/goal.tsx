import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { MotiView } from "moti";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OnboardingLayout from "../../components/OnboardingLayout";
import { saveUserData } from "../../src/userData"; // Import Firestore save function

const GoalScreen = () => {
  const [goal, setGoal] = useState("");
  const router = useRouter();

  const handleNext = async () => {
    // Save goal to Firestore
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      console.error("No authenticated user found");
      return;
    }
    const userId = user.uid;
    await saveUserData(userId, { goal }); // Save the goal data to Firestore
    router.push("/onboarding/experience");
  };

  const options = [
    { id: "buildMuscle", label: "Build Muscle 💪" },
    { id: "getStronger", label: "Get Stronger 🏋️" },
    { id: "loseFat", label: "Lose Fat 🔥" },
    { id: "improveFitness", label: "Improve Fitness ⚡" },
  ];

  return (
    <OnboardingLayout
      title="What's your fitness goal?"
      onSkip={() => router.push("/onboarding/experience")}
    >
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        {options.map((item, idx) => (
          <MotiView
            key={item.id}
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: idx * 100, duration: 400 }}
          >
            <TouchableOpacity
              style={[styles.optionCard, goal === item.id && styles.selected]}
              onPress={() => setGoal(item.id)}
            >
              <Text style={[styles.optionText, goal === item.id && styles.optionTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          </MotiView>
        ))}

        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 600, duration: 400 }}
        >
          <TouchableOpacity
            style={[styles.nextButton, !goal && styles.disabled]}
            disabled={!goal}
            onPress={handleNext}
          >
            <Text style={styles.nextText}>Next</Text>
          </TouchableOpacity>
        </MotiView>
      </SafeAreaView>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, justifyContent: "center" },
  optionCard: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    marginBottom: 12,
  },
  selected: { backgroundColor: "white", borderColor: "#7b61ff" },
  optionText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  optionTextActive: { color: "#4a90e2" },
  nextButton: {
    backgroundColor: "#2a67b1",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  disabled: { opacity: 0.5 },
  nextText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});

export default GoalScreen;
