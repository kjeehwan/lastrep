import { useLocalSearchParams, useRouter } from "expo-router";
import { MotiView } from "moti";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LastRepLogo from "../../components/LastRepLogo";

const PreviewScreen = () => {
  const { goal, experience, availability, nickname } = useLocalSearchParams();
  const router = useRouter();

  const workoutPlan = [
    { day: "Day 1: Push", exercises: ["Barbell Bench Press – 3 x 12", "Squat – 3 x 10"], time: "45–60 min" },
    { day: "Day 2: Rest" },
    { day: "Day 3: Pull", exercises: ["Lat Pulldown – 3 x 12", "Deadlift – 3 x 8"], time: "45–55 min" },
    { day: "Day 4: Rest" },
    { day: "Day 5: Push", exercises: ["Incline Bench Press – 3 x 10"], time: "40–50 min" },
    { day: "Day 6: Active Recovery", exercises: ["Yoga – 30 min"], time: "60 min" },
    { day: "Day 7: Rest" },
  ];

  const [showLogo, setShowLogo] = useState(false);
  const [scrollableHeight, setScrollableHeight] = useState(0);

  const handleConfirm = () => {
    router.push("/onboarding/splash-after-preview");
  };

  // Typing contentWidth and contentHeight as numbers
  const onContentSizeChange = (contentWidth: number, contentHeight: number) => {
    setScrollableHeight(contentHeight);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Header */}
      <Text style={styles.headerText}>Sample Workout Plan</Text>

      {/* KeyboardAvoidingView ensures the layout is smooth even with the keyboard */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* ScrollView */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={scrollableHeight > 500} // Only allow scrolling if content is tall enough
          onContentSizeChange={onContentSizeChange} // Measure the content height dynamically
        >
          {workoutPlan.map((day, index) => (
            <MotiView
              key={index}
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: index * 80, duration: 400 }}
            >
              <View style={styles.dayCard}>
                <Text style={styles.dayTitle}>{day.day}</Text>
                {day.time && (
                  <Text style={styles.timeText}>Estimated Time: {day.time}</Text>
                )}
                {day.exercises ? (
                  day.exercises.map((exercise, i) => (
                    <Text key={i} style={styles.exerciseText}>
                      • {exercise}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.restText}>Rest Day</Text>
                )}
              </View>
            </MotiView>
          ))}

          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmText}>Let’s go!</Text>
          </TouchableOpacity>

          {showLogo && (
            <View style={styles.successOverlay}>
              <LastRepLogo />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0d0d1a",
  },
  headerText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 16,
    fontFamily: "sans-serif", // Ensure consistency with onboarding header font
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  dayCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  timeText: {
    fontSize: 15,
    color: "#7b61ff",
    marginTop: 3,
  },
  exerciseText: {
    fontSize: 15,
    color: "#ddd",
    marginTop: 5,
  },
  restText: {
    fontSize: 15,
    color: "#aaa",
    fontStyle: "italic",
    marginTop: 5,
  },
  confirmButton: {
    backgroundColor: "#2a67b1",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 25,
  },
  confirmText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  successOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 10,
  },
});

export default PreviewScreen;
