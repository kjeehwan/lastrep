import { normalizeExerciseTargets } from "../workouts/exerciseTargets";
import {
  parseSharedWorkoutPlan,
  type SharedWorkoutPlan,
} from "./sharingContract";
import type {
  Exercise,
  ExerciseMode,
  Unit,
} from "../workouts/workoutLog/workoutLogModel";

/** A deliberate allowlist. Personal notes, logged effort and completion never cross this boundary. */
export function workoutToSharingPlan(
  title: string,
  exercises: Exercise[],
  units: Record<string, Unit>,
  mode: (name: string) => ExerciseMode,
  rest: Record<string, number>,
  effortScale: "rpe" | "rir",
): SharedWorkoutPlan {
  return parseSharedWorkoutPlan({
    version: 1,
    title: title.trim() || "Workout",
    effortScale,
    exercises: exercises.map((e) => ({
      name: e.name,
      ...(mode(e.name) !== "cardio" && normalizeExerciseTargets(e.targets) ? { targets: normalizeExerciseTargets(e.targets) } : {}),
      mode: mode(e.name),
      unit: units[e.id] || (mode(e.name) === "cardio" ? "km" : "kg"),
      ...(mode(e.name) === "cardio" && e.cardioSessionType
        ? { cardioSessionType: e.cardioSessionType }
        : {}),
      ...(mode(e.name) === "cardio" && e.cardioEffortLevel
        ? { cardioEffortLevel: e.cardioEffortLevel }
        : {}),
      restSec: rest[e.id] ?? 90,
      tempo: mode(e.name) === "cardio" ? "" : e.tempo || "",
      instructions: "",
      sets: e.sets.map((s) => ({
        weightKg: s.weightKg,
        reps: s.reps,
        targetRpe: s.targetRpe ?? null,
        setType: s.setType || "normal",
        durationSec: s.durationSec ?? null,
        distanceKm: s.distanceKm ?? null,
      })),
    })),
  });
}
export function omitSharingWeights(plan: SharedWorkoutPlan): SharedWorkoutPlan {
  return {
    ...plan,
    exercises: plan.exercises.map((e) => ({
      ...e,
      sets: e.sets.map((s) => ({ ...s, weightKg: null })),
    })),
  };
}
/** Each import has fresh IDs and unchecked sets. Target effort remains a target, never a recorded RPE. */
export function sharingPlanToExercises(plan: SharedWorkoutPlan, key: string) {
  const units: Record<string, Unit> = {},
    rest: Record<string, number> = {};
  const exercises: Exercise[] = plan.exercises.map((e, i) => {
    const id = `shared-${key}-${i}`;
    units[id] = e.unit;
    rest[id] = e.restSec;
    return {
      id,
      plannedRestSec: e.restSec,
      targets: normalizeExerciseTargets(e.targets),
      mode: e.mode,
      cardioSessionType: e.cardioSessionType,
      cardioEffortLevel: e.cardioEffortLevel,
      name: e.name,
      notes: e.instructions,
      tempo: e.tempo,
      sets: e.sets.map((s) => ({
        weightKg: s.weightKg,
        reps: s.reps,
        targetRpe: s.targetRpe,
        rpe: "",
        done: false,
        setType: s.setType,
        durationSec: s.durationSec,
        distanceKm: s.distanceKm,
      })),
    };
  });
  return { exercises, units, rest };
}
