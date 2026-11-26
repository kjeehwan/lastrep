import type { SharedWorkoutExercise, SharedWorkoutPlan } from "./sharingContract";
import { effectiveGroupTargets } from "../workouts/exerciseTargets";
import { rpeToEffort, type EffortScale } from "../workouts/effortScale";

export type SharingPreviewUnits = { weightUnit: "kg" | "lbs"; distanceUnit: "km" | "mi" };
const number = (value: number) => String(Math.round(value * 100) / 100);

/** Presentation only: canonical loads, distances and targets remain untouched. */
export function sharingSetTable(exercise: SharedWorkoutExercise, scale: EffortScale, units?: SharingPreviewUnits) {
  const cardio = exercise.mode === "cardio";
  const unit = cardio ? units?.distanceUnit ?? exercise.unit : units?.weightUnit ?? exercise.unit;
  const showEffort = exercise.sets.some(set => set.targetRpe != null &&
    set.targetRpe !== (["normal", "top", "backoff"].includes(set.setType) ? effectiveGroupTargets(exercise, set.setType)?.targetRpe ?? null : null));
  let working = 0;
  const names = { warmup: "Warm-up", top: "Top", backoff: "Back-off", drop: "Drop", failure: "Failure", normal: "Set" };
  const markers = { warmup: "W", top: "T", backoff: "B", drop: "D", failure: "F" };
  return {
    unit, showEffort,
    rows: exercise.sets.map(set => {
      if (set.setType !== "warmup") working++;
      return {
        marker: set.setType === "normal" ? String(working) : markers[set.setType],
        label: set.setType === "normal" ? `Set ${working}` : names[set.setType],
        load: set.weightKg == null ? "\u2014" : number(set.weightKg * (unit === "lbs" ? 2.2046226218 : 1)),
        reps: set.reps || "\u2014",
        duration: set.durationSec == null ? "\u2014" : `${Math.floor(set.durationSec / 60)}:${String(set.durationSec % 60).padStart(2, "0")}`,
        distance: set.distanceKm == null ? "\u2014" : number(set.distanceKm / (unit === "mi" ? 1.60934 : 1)),
        effort: rpeToEffort(set.targetRpe, scale) || "\u2014",
      };
    }),
  };
}

/** Excludes warm-ups and cardio; missing loads never become a zero-volume claim. */
export function sharingWorkoutTotals(plan: SharedWorkoutPlan, units?: SharingPreviewUnits) {
  const resistance = plan.exercises.filter(exercise => exercise.mode === "resistance");
  const working = resistance.flatMap(exercise => exercise.sets.filter(set => set.setType !== "warmup"));
  const weightUnit = units?.weightUnit ?? (resistance[0]?.unit === "lbs" ? "lbs" : "kg");
  const missingWeights = working.some(set => set.weightKg == null);
  const volumeKg = working.reduce((total, set) => total + (set.weightKg ?? 0) * Number(set.reps), 0);
  return {
    workingSets: working.length, weightUnit, missingWeights,
    volume: working.length && !missingWeights ? volumeKg * (weightUnit === "lbs" ? 2.2046226218 : 1) : null,
  };
}
