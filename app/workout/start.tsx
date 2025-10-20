import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import {
  arrayUnion,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../firebaseConfig";
import { Colors } from "../../styles/colors";

type ExerciseSet = { weight: string; reps: string };
type Exercise = { name: string; sets: ExerciseSet[] };

export default function WorkoutStart() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;

  const [workout, setWorkout] = useState<Exercise[]>([
    { name: "Bench Press", sets: [{ weight: "", reps: "" }] },
    { name: "Barbell Row", sets: [{ weight: "", reps: "" }] },
    { name: "Squat", sets: [{ weight: "", reps: "" }] },
  ]);

  const handleSetChange = (
    exerciseIndex: number,
    setIndex: number,
    field: "weight" | "reps",
    value: string
  ) => {
    const updated = [...workout];
    updated[exerciseIndex].sets[setIndex][field] = value;
    setWorkout(updated);
  };

  const addSet = (exerciseIndex: number) => {
    const updated = [...workout];
    updated[exerciseIndex].sets.push({ weight: "", reps: "" });
    setWorkout(updated);
  };

  const finishWorkout = async () => {
    if (!user) return;
    try {
      const summary = {
        date: new Date().toISOString(),
        exercises: workout,
        createdAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "users", user.uid), {
        workoutHistory: arrayUnion(summary),
        "stats.totalWorkouts": increment(1),
        "stats.lastWorkout": serverTimestamp(),
      });

      Alert.alert("Workout logged", "Your session has been saved!");
      router.replace("/home");
    } catch (err) {
      console.error("Error saving workout:", err);
      Alert.alert("Error", "Could not save your workout.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's Workout</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {workout.map((exercise, i) => (
          <View key={i} style={styles.exerciseCard}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>

            {exercise.sets.map((set, j) => (
              <View key={j} style={styles.setRow}>
                <TextInput
                  placeholder="Weight"
                  value={set.weight}
                  onChangeText={(t) => handleSetChange(i, j, "weight", t)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <Text style={styles.x}>x</Text>
                <TextInput
                  placeholder="Reps"
                  value={set.reps}
                  onChangeText={(t) => handleSetChange(i, j, "reps", t)}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            ))}

            <TouchableOpacity
              style={styles.addSetButton}
              onPress={() => addSet(i)}
            >
              <Text style={styles.addSetText}>+ Add Set</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.finishButton} onPress={finishWorkout}>
          <Text style={styles.finishButtonText}>Finish Workout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  exerciseCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary,
    marginBottom: 10,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: 80,
    fontSize: 16,
    textAlign: "center",
  },
  x: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginHorizontal: 8,
  },
  addSetButton: {
    marginTop: 6,
    alignItems: "center",
  },
  addSetText: {
    color: Colors.primary,
    fontWeight: "600",
  },
  finishButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  finishButtonText: {
    color: Colors.surface,
    fontSize: 18,
    fontWeight: "700",
  },
});
