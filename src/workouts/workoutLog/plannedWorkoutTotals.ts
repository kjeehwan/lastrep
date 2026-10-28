import type { Exercise, ExerciseMode } from "./workoutLogModel";

/** Plan totals include warm-ups; completion state does not change a prescription. */
export function plannedWorkoutTotals(exercises: Exercise[], modeFor: (name: string) => ExerciseMode) {
  let sets = 0, volumeKg = 0, cardioExercises = 0;
  for (const exercise of exercises) {
    if (modeFor(exercise.name) === "cardio") { cardioExercises++; continue; }
    sets += exercise.sets.length;
    for (const set of exercise.sets) {
      const reps = Number(set.reps), weight = set.weightKg;
      if (typeof weight === "number" && Number.isFinite(weight) && weight > 0 && Number.isFinite(reps) && reps > 0) volumeKg += weight * reps;
    }
  }
  return { sets, volumeKg, cardioExercises };
}
