import type { PlannedWorkoutSummary } from "../../types/decision";
import { weightPreferenceKey, type AvailableWeightsByExercise } from "../../workouts/availableWeights";

export function withAvailableWeights(plan: PlannedWorkoutSummary | null, settings: AvailableWeightsByExercise): PlannedWorkoutSummary | null {
  if (!plan?.exercises) return plan;
  return { ...plan, exercises: plan.exercises.map((exercise) => {
    const availableWeights = settings[weightPreferenceKey(exercise.name)];
    return availableWeights ? { ...exercise, availableWeights } : exercise;
  }) };
}

// Completing sets and changing display units do not change the planned prescription.
export const workoutGuidanceSignature = (plan?: PlannedWorkoutSummary | null) =>
  JSON.stringify(plan?.exercises?.map((exercise) => ({
    name: exercise.name.trim().toLowerCase().replace(/\s+/g, " "),
    availableWeights: exercise.availableWeights ?? null,
    sets: exercise.sets.map((set) => ({
      weightKg: set.weightKg,
      reps: set.reps,
      setType: set.setType,
    })),
  })) ?? plan?.exerciseNames.map((name) => name.trim().toLowerCase().replace(/\s+/g, " ")) ?? []);
