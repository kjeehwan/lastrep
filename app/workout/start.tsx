import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { arrayUnion, doc, increment, serverTimestamp, updateDoc } from "firebase/firestore";
import React, { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ExerciseCard from "../../components/workout/ExerciseCard";
import ExercisePickerModal from "../../components/workout/ExercisePickerModal";
import { useTheme } from "../../contexts/ThemeContext";
import { db } from "../../firebaseConfig";
import { cacheGet, cacheSet } from "../../lib/cache";

type ExerciseSet = { weight: string; reps: string; rpe: string; done: boolean };
type Exercise = { name: string; sets: ExerciseSet[] };

export default function WorkoutStart() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;
  const { theme } = useTheme();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null); // Track which exercise to replace

  // ✅ Add or replace exercise
  const handleAddExercise = (name: string) => {
    if (replaceIndex !== null) {
      // Replace an existing exercise
      const updated = [...exercises];
      updated[replaceIndex] = { name, sets: [{ weight: "", reps: "", rpe: "", done: false }] };
      setExercises(updated);
      setReplaceIndex(null);
    } else {
      // Add new exercise (avoid duplicates)
      if (exercises.some((ex) => ex.name === name)) return;
      setExercises((prev) => [
        ...prev,
        { name, sets: [{ weight: "", reps: "", rpe: "", done: false }] },
      ]);
    }
    setPickerVisible(false);
  };

  // ✅ Update set fields
  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: keyof ExerciseSet,
    value: string
  ) => {
    const updated = [...exercises];
    updated[exerciseIndex].sets[setIndex] = {
      ...updated[exerciseIndex].sets[setIndex],
      [field]: value,
    };
    setExercises(updated);
  };

  // ✅ Toggle set done
  const toggleSetDone = (exerciseIndex: number, setIndex: number) => {
    const updated = [...exercises];
    updated[exerciseIndex].sets[setIndex].done =
      !updated[exerciseIndex].sets[setIndex].done;
    setExercises(updated);
  };

  // ✅ Add new set
  const addSet = (exerciseIndex: number) => {
    const updated = [...exercises];
    updated[exerciseIndex].sets.push({ weight: "", reps: "", rpe: "", done: false });
    setExercises(updated);
  };

  // ✅ Remove a specific set
  const removeSet = (exerciseIndex: number, setIndex: number) => {
    const updated = [...exercises];
    updated[exerciseIndex].sets.splice(setIndex, 1);
    setExercises(updated);
  };

  // ✅ Remove entire exercise
  const removeExercise = (exerciseIndex: number) => {
    const updated = [...exercises];
    updated.splice(exerciseIndex, 1);
    setExercises(updated);
  };

  // ✅ Replace exercise (open modal)
  const replaceExercise = (exerciseIndex: number) => {
    setReplaceIndex(exerciseIndex);
    setPickerVisible(true);
  };

  // ✅ Save workout
  const finishWorkout = async () => {
    if (!user) return;
    try {
      const summary = {
        date: new Date().toISOString(),
        exercises,
        createdAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "users", user.uid), {
        workoutHistory: arrayUnion(summary),
        "stats.totalWorkouts": increment(1),
        "stats.lastWorkout": serverTimestamp(),
      });

      const cached = (await cacheGet("workout_history", [])) || [];
      const updatedHistory = [summary, ...cached];
      await cacheSet("workout_history", updatedHistory);

      Alert.alert("Workout saved!", "Your session has been logged.");
      router.replace("/home");
    } catch (err) {
      console.error("Error saving workout:", err);
      Alert.alert("Error", "Could not save your workout.");
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background, padding: 20 },
        title: {
          fontSize: 22,
          fontWeight: "700",
          color: theme.textPrimary,
          marginBottom: 16,
        },
        addExerciseButton: {
          borderWidth: 1,
          borderColor: theme.primary,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
          marginBottom: 20,
        },
        addExerciseText: { color: theme.primary, fontWeight: "700" },
        finishButton: {
          backgroundColor: theme.primary,
          borderRadius: 14,
          paddingVertical: 16,
          alignItems: "center",
          marginTop: 20,
          marginBottom: 40,
        },
        finishButtonText: {
          color: theme.buttonText,
          fontSize: 18,
          fontWeight: "700",
        },
      }),
    [theme]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's Workout</Text>

      {/* Add exercise button */}
      <TouchableOpacity
        onPress={() => setPickerVisible(true)}
        style={styles.addExerciseButton}
        activeOpacity={0.85}
      >
        <Text style={styles.addExerciseText}>+ Add Exercise</Text>
      </TouchableOpacity>

      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => {
          setPickerVisible(false);
          setReplaceIndex(null);
        }}
        onSelect={handleAddExercise}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {exercises.map((exercise, i) => (
          <ExerciseCard
            key={i}
            exercise={exercise}
            onUpdateSet={(setIndex, field, value) => updateSet(i, setIndex, field, value)}
            onToggleSetDone={(setIndex) => toggleSetDone(i, setIndex)}
            onAddSet={() => addSet(i)}
            onRemove={() => removeExercise(i)}
            onRemoveSet={(setIndex) => removeSet(i, setIndex)}
            onReplaceExercise={() => replaceExercise(i)}
          />
        ))}

        {exercises.length > 0 && (
          <TouchableOpacity
            style={styles.finishButton}
            onPress={finishWorkout}
            activeOpacity={0.85}
          >
            <Text style={styles.finishButtonText}>Finish Workout</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
