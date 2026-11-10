import type { ExerciseMode, SetEntry } from "./workoutLogModel";
import { freshSetEffort } from "./freshSetEffort";
/** Copy load/reps or cardio prescription, preserving the current set's own effort. */
export function copySetPrescription(set: SetEntry, previous: Partial<SetEntry>, mode: ExerciseMode): SetEntry {
  return { ...set, weightKg: mode === "cardio" ? null : previous.weightKg ?? null, weightText: undefined,
    reps: mode === "cardio" ? "" : String(previous.reps ?? ""),
    distanceKm: mode === "cardio" ? previous.distanceKm ?? null : null,
    durationSec: mode === "cardio" ? previous.durationSec ?? null : null,
    zone: mode === "cardio" ? String(previous.zone ?? "") : "",
    baselineWeightKg: mode === "cardio" ? null : previous.weightKg ?? null,
    baselineReps: mode === "cardio" ? "" : String(previous.reps ?? "") };
}
export function duplicateSetPrescription(set: SetEntry): SetEntry {
  return { ...set, ...freshSetEffort(), done: false, setType: "normal" };
}
