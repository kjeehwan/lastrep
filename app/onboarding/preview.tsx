import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import OnboardingLayout from "../../components/OnboardingLayout";
import { db } from "../../firebaseConfig"; // adjust path if needed
import { Colors } from "../../styles/colors";

type PlanDay = { day: string; focus: string; exercises: string[] };

export default function Preview() {
  const router = useRouter();
  const [goal, setGoal] = useState<string | null>(null);
  const [experience, setExperience] = useState<string | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [plan, setPlan] = useState<PlanDay[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = getAuth().currentUser;
        if (user) {
          const userRef = doc(db, "users", user.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data();
            const g = data.goal || "Build Muscle";
            const e = data.experience || "Intermediate";
            const d = data.trainingDays || 4;
            setGoal(g);
            setExperience(e);
            setDays(d);
            setPlan(generateSamplePlan(g, e, d));
          }
        }
      } catch (err) {
        console.error("Error loading preview data:", err);
      }
    };
    fetchData();
  }, []);

  const handleFinish = async () => {
    try {
      const user = getAuth().currentUser;
      if (user) {
        await updateDoc(doc(db, "users", user.uid), {
          hasCompletedOnboarding: true,
          samplePlan: plan,
        });
      }
      router.replace("/home/index");
    } catch (err) {
      console.error("Error finishing onboarding:", err);
    }
  };

  return (
    <OnboardingLayout
      title="Your Sample Plan"
      subtitle="Based on your selections, here’s a glimpse of your personalized training."
      onNext={handleFinish}
      nextLabel="Finish"
      showNext
    >
      <View style={styles.cardContainer}>
        {plan.length > 0 ? (
          plan.map((day) => (
            <View key={day.day} style={styles.card}>
              <Text style={styles.cardTitle}>{day.day}</Text>
              <Text style={styles.cardFocus}>{day.focus}</Text>
              {day.exercises.map((ex) => (
                <Text key={ex} style={styles.exercise}>
                  • {ex}
                </Text>
              ))}
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>
            Generating your sample plan...
          </Text>
        )}
      </View>
    </OnboardingLayout>
  );
}

/* ---- PLAN GENERATION LOGIC ---- */
function generateSamplePlan(
  goal: string,
  experience: string,
  days: number
): PlanDay[] {
  const templates: Record<string, string[][]> = {
    "Build Muscle": [
      ["Chest / Triceps", "Back / Biceps", "Legs", "Shoulders", "Rest", "Arms"],
      ["Bench Press", "Incline DB Press", "Cable Fly", "Triceps Pushdown"],
      ["Barbell Row", "Lat Pulldown", "Seated Row", "Biceps Curl"],
      ["Squat", "Leg Press", "Lunges", "Leg Curl"],
      ["OHP", "Lateral Raise", "Face Pull", "Shrugs"],
      ["Close Grip Press", "Preacher Curl", "Hammer Curl"],
    ],
    "Lose Fat": [
      ["Full Body", "Cardio / Core", "Lower Body", "Upper Body", "Cardio", "Rest"],
      ["DB Circuit", "Jump Squats", "Push-Ups", "Plank"],
      ["HIIT", "Mountain Climbers", "Crunches", "Leg Raises"],
      ["Squat", "Lunges", "Deadlift", "Calf Raise"],
      ["Pull-Ups", "Bench Press", "Rows", "Shoulder Press"],
    ],
    "Get Stronger": [
      ["Squat", "Bench", "Deadlift", "Accessory", "Rest", "Conditioning"],
      ["Back Squat", "Front Squat", "Pause Squat"],
      ["Bench Press", "Incline Bench", "Dips"],
      ["Deadlift", "RDL", "Deficit Deadlift"],
      ["Pull-Ups", "Press", "Rows"],
    ],
    "Improve Fitness": [
      ["Full Body", "Cardio", "Core", "Mobility", "Active Rest", "Conditioning"],
      ["Circuit", "Rowing", "Push-Ups", "Squats"],
      ["Running", "Cycling", "Jump Rope"],
      ["Crunches", "Leg Raises", "Plank"],
      ["Yoga", "Stretching", "Foam Rolling"],
    ],
  };

  const planFocus = templates[goal] || templates["Build Muscle"];
  const planDays = Math.min(days, planFocus[0].length);
  const plan: PlanDay[] = [];

  for (let i = 0; i < planDays; i++) {
    plan.push({
      day: `Day ${i + 1}`,
      focus: planFocus[0][i],
      exercises: planFocus[i + 1] || planFocus[1],
    });
  }

  return plan;
}

/* ---- STYLES ---- */
const styles = StyleSheet.create({
  cardContainer: { width: "100%", marginTop: 12 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardFocus: {
    fontSize: 14,
    color: Colors.primary,
    marginBottom: 8,
  },
  exercise: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 6,
    lineHeight: 20,
  },
  emptyText: {
    textAlign: "center",
    color: Colors.textSecondary,
    fontSize: 15,
    marginTop: 20,
  },
});
