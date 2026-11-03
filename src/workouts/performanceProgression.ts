import type { PlannedExerciseSummary } from "../types/decision";
import type { WorkoutSummary } from "./homeInsights";
import { availableWeightAtOrBelow } from "./availableWeights";

export type ProgressionPreferences = { repSteps: number[]; preferredIncreaseKg: number; maxIncreaseKg: number };
export const defaultProgressionPreferences: ProgressionPreferences = { repSteps: [6,8,10,12,15,18], preferredIncreaseKg: 2.5, maxIncreaseKg: 2.5 };
export function normalizeProgressionPreferences(raw: unknown): ProgressionPreferences {
  const value = raw as Partial<ProgressionPreferences> | null;
  const steps = value?.repSteps;
  return { repSteps: Array.isArray(steps) && steps.length > 0 && steps.length <= 100 && steps.every(n => Number.isInteger(n) && n >= 1 && n <= 100)
    ? [...new Set(steps)].sort((a,b) => a-b) : defaultProgressionPreferences.repSteps,
    preferredIncreaseKg: typeof value?.preferredIncreaseKg === "number" && Number.isFinite(value.preferredIncreaseKg) && value.preferredIncreaseKg > 0 && value.preferredIncreaseKg <= 100 ? value.preferredIncreaseKg : 2.5,
    maxIncreaseKg: typeof value?.maxIncreaseKg === "number" && Number.isFinite(value.maxIncreaseKg) && value.maxIncreaseKg > 0 && value.maxIncreaseKg <= 100 ? value.maxIncreaseKg : 2.5 };
}
type Candidate = { weightKg: number; reps: number; reason: string };
const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g," ");
const normal = (set: { setType?: string | null }) => !set.setType || set.setType === "normal";
/** Performance proposes an increase; today's context can veto it, never create one. */
export function performanceProgression(exercise: PlannedExerciseSummary, workouts: WorkoutSummary[], now = new Date()): { candidate: Candidate | null; reason: string } {
  const repeat = (reason: string) => ({ candidate: null, reason });
  if (exercise.mode !== "resistance") return repeat("Keep the planned pace and duration.");
  const sets = exercise.sets.filter(set => set.setType !== "warmup");
  if (!sets.length || sets.some(set => !normal(set) || set.done || set.rpe != null)) return repeat("Mixed prescriptions or recorded sets need individual review; keep the planned sets.");
  const first = sets[0];
  if (!(first.weightKg != null && first.weightKg > 0 && first.reps != null && first.reps > 0) || sets.some(set => set.weightKg !== first.weightKg || set.reps !== first.reps)) return repeat("The currently planned working sets are mixed. No uniform progression is suggested.");
  const targets = exercise.targets;
  if (targets?.minReps == null || targets.maxReps == null || targets.targetRpe == null) return repeat("Set target reps and effort to receive a progression suggestion.");
  const targetEffort = targets.targetRpe;
  const recent = [...workouts].filter(workout => workout.date <= now && now.getTime() - workout.date.getTime() <= 42 * 86400000)
    .sort((a,b) => b.date.getTime() - a.date.getTime()).flatMap(workout => {
      const matching = workout.exercises.filter(item => key(item.name) === key(exercise.name));
      // Duplicate exercise blocks have ambiguous set counts.
      return matching.length === 1 ? [matching[0].sets.filter(set => set.setType !== "warmup")] : [];
    }).slice(0,3);
  const uniform = (rows: typeof recent[number]) => rows.length === sets.length && rows.every(set => normal(set) && set.weightKg === rows[0].weightKg && Number(set.reps) === Number(rows[0].reps));
  const latest = recent[0];
  if (!latest || !uniform(latest)) return repeat("The latest completed sets are missing or mixed. Repeat the planned prescription.");
  if (latest[0].weightKg !== first.weightKg || Number(latest[0].reps) !== first.reps) return repeat("The current plan differs from the latest comparable session. Keep your chosen prescription.");
  const effortPassed = (rows: typeof recent[number]) => rows.every(set => set.rpe != null && Number(set.rpe) >= 6 && Number(set.rpe) <= targetEffort);
  if (!effortPassed(latest)) return repeat("The latest completed sets exceeded the effort target or have missing effort. Repeat before increasing.");
  if (first.reps < targets.minReps || first.reps > targets.maxReps) return repeat("The planned reps fall outside your targets. Review the prescription first.");
  const preferences = normalizeProgressionPreferences(exercise.progression);
  if (first.reps < targets.maxReps) {
    const reps = [...new Set([...preferences.repSteps, targets.minReps, targets.maxReps])].sort((a,b) => a-b).find(value => value > first.reps! && value <= targets.maxReps!);
    return reps ? { candidate: { weightKg: first.weightKg, reps, reason: "All sets in the latest comparable session met the effort target. Try the next rep step at the same load." }, reason: "" } : repeat("Repeat within your target reps.");
  }
  const maximum = first.weightKg + preferences.maxIncreaseKg;
  const available = exercise.availableWeights;
  let smallest: number | null;
  if (!available) smallest = first.weightKg + Math.min(2.5, preferences.preferredIncreaseKg, preferences.maxIncreaseKg);
  else if (available.mode === "custom") smallest = available.values.map(value => value * (available.unit === "lbs" ? 0.45359237 : 1)).find(value => value > first.weightKg! + 1e-5) ?? null;
  else {
    const factor = available.unit === "lbs" ? 0.45359237 : 1;
    const increment = available.increment * factor, minimum = available.minimum * factor;
    smallest = minimum + Math.max(0, Math.floor((first.weightKg - minimum + 1e-5) / increment) + 1) * increment;
  }
  if (smallest == null || smallest > maximum + 1e-5) return repeat("No available increase fits your limit. Repeat the current load and reps.");
  let weightKg = smallest;
  // Stop looking back at a recent load reduction; old heavier lifts cannot leapfrog a rebuild.
  const supported = [] as number[];
  for (let index = 1; index < recent.length; index++) {
    if (!uniform(recent[index])) break;
    const newer = recent[index-1][0].weightKg ?? 0, older = recent[index][0].weightKg ?? 0;
    if (newer < older - 1e-5 && Number(recent[index-1][0].reps) <= Number(recent[index][0].reps)) break;
    if (Number(recent[index][0].reps) === targets.minReps && effortPassed(recent[index])) supported.push(older);
  }
  const preferredCeiling = first.weightKg + Math.min(preferences.preferredIncreaseKg, preferences.maxIncreaseKg);
  const proven = supported.filter(value => value > first.weightKg! && value <= preferredCeiling + 1e-5).sort((a,b) => b-a)
    .find(value => !available || Math.abs((availableWeightAtOrBelow(value, available) ?? -1) - value) < 1e-5);
  if (proven != null) weightKg = proven;
  return { candidate: { weightKg, reps: targets.minReps, reason: proven != null ? "Recent comparable sets support this load at your lower rep target and effort target." : "The latest sets reached the top of your rep range within target effort. Try the smallest available increase and return to the lower rep target." }, reason: "" };
}
