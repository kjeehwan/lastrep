import type { ExerciseMode, Unit } from "./workoutLogModel";
export type DistanceUnit = "km" | "mi";
export const resolveDistanceUnit = (value: unknown): DistanceUnit => value === "mi" ? "mi" : "km";
/** Known cardio entries repair legacy routine defaults; custom cardio keeps its mode. */
export function resolveExerciseMode(mode: unknown, catalogGroup?: string): ExerciseMode {
  return mode === "cardio" || catalogGroup === "cardio" ? "cardio" : "resistance";
}
export function exerciseDisplayUnit(mode: ExerciseMode, stored: Unit | undefined, distance: DistanceUnit = "km"): Unit {
  return mode === "cardio" ? stored === "km" || stored === "mi" ? stored : distance : stored === "lbs" ? "lbs" : "kg";
}
