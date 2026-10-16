import { rpeToEffort, type EffortScale } from "../effortScale";
export function lastResistanceSet(set: { weightKg: number | null; reps: string; rpe?: string }, unit: string, scale: EffortScale) {
  const load = set.weightKg == null || !Number.isFinite(set.weightKg) || set.weightKg <= 0 ? "" : String(Math.round(set.weightKg * (unit === "lbs" ? 2.2046226218 : 1) * 100) / 100);
  const effort = rpeToEffort(set.rpe, scale);
  return `${load ? load + " x " : ""}${set.reps || "-"}${effort ? " @ " + effort : ""}`;
}
