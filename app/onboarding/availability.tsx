import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { MotiView } from "moti";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OnboardingLayout from "../../components/OnboardingLayout";
import { saveUserData } from "../../src/userData";

const AvailabilityScreen = () => {
  const [availabilityDays, setAvailabilityDays] = useState(4);
  const router = useRouter();

  const handleNext = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      console.error("No authenticated user found");
      return;
    }

    const userId = user.uid;
    await saveUserData(userId, {
      availability: `${availabilityDays}`,
      availabilityDays,
    });
    router.push("/onboarding/nickname");
  };

  return (
    <OnboardingLayout
      title="How many days per week can you train?"
      onSkip={() => router.push("/onboarding/nickname")}
      onBack={() => router.push("/onboarding/experience")}
    >
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ duration: 400 }}
          style={styles.sliderCard}
        >
          <Text style={styles.valueText}>{availabilityDays} Days</Text>
          <Slider
            value={availabilityDays}
            minimumValue={1}
            maximumValue={7}
            step={1}
            minimumTrackTintColor="#7b61ff"
            maximumTrackTintColor="rgba(255,255,255,0.35)"
            thumbTintColor="#fff"
            onValueChange={(value: number) => setAvailabilityDays(Math.round(value))}
          />
          <View style={styles.tickMarksRow}>
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <View key={`tick-${day}`} style={styles.tickColumn}>
                <View
                  style={[
                    styles.tickMark,
                    day === availabilityDays && styles.tickMarkActive,
                  ]}
                />
                <Text
                  style={[
                    styles.tickLabel,
                    day === availabilityDays && styles.tickLabelActive,
                  ]}
                >
                  {day}
                </Text>
              </View>
            ))}
          </View>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 300, duration: 400 }}
        >
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextText}>Next</Text>
          </TouchableOpacity>
        </MotiView>
      </SafeAreaView>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    justifyContent: "center",
    gap: 20,
  },
  sliderCard: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  valueText: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  tickMarksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 4,
  },
  tickColumn: {
    width: 18,
    alignItems: "center",
    gap: 4,
  },
  tickMark: {
    width: 2,
    height: 8,
    borderRadius: 1,
    backgroundColor: "rgba(216,218,236,0.55)",
  },
  tickMarkActive: {
    backgroundColor: "#ffffff",
    height: 10,
  },
  tickLabel: {
    color: "#d8daec",
    fontSize: 11,
    fontWeight: "700",
  },
  tickLabelActive: {
    color: "#ffffff",
  },
  nextButton: {
    backgroundColor: "#2a67b1",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  nextText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});

export default AvailabilityScreen;
