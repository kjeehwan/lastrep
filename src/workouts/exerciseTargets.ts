import { parseExerciseTargets, type ExerciseTargets } from "../sharing/sharingContract";
import { effortToRpe, rpeToEffort, type EffortScale } from "./effortScale";
export type { ExerciseTargets } from "../sharing/sharingContract";

/** Read old/malformed account data without inventing a training target. */
export function normalizeExerciseTargets(input: unknown): ExerciseTargets | null {
  try { return parseExerciseTargets(input); } catch { return null; }
}
export function exerciseTargetsText(input: unknown, scale: EffortScale): string {
  const targets = normalizeExerciseTargets(input);
  if (!targets) return "";
  return [targets.minReps == null ? "" : `${targets.minReps}\u2013${targets.maxReps} reps`, targets.targetRpe == null ? "" : `${scale.toUpperCase()} ${rpeToEffort(targets.targetRpe, scale)}`].filter(Boolean).join(" \u00b7 ");
}
export type TargetsDraft = { min: string; max: string; effort: string };
export function exerciseTargetsDraft(input: unknown, scale: EffortScale): TargetsDraft {
  const targets = normalizeExerciseTargets(input);
  return { min: targets?.minReps?.toString() ?? "", max: targets?.maxReps?.toString() ?? "", effort: rpeToEffort(targets?.targetRpe, scale) };
}
export function readExerciseTargetsDraft(draft: TargetsDraft, scale: EffortScale): ExerciseTargets | null {
  const min = draft.min.trim(), max = draft.max.trim(), effort = draft.effort.trim().replace(",", ".");
  if (Boolean(min) !== Boolean(max)) throw Error("Enter both ends of the rep range, or leave both blank.");
  if (min && (!/^\d+$/.test(min) || !/^\d+$/.test(max) || +min < 1 || +max > 100 || +min > +max)) throw Error("Enter a whole rep range from 1 to 100, with minimum no greater than maximum.");
  if (effort && (!/^\d+(?:\.\d+)?$/.test(effort) || +effort < (scale === "rpe" ? 6 : 0) || +effort > (scale === "rpe" ? 10 : 4))) throw Error(scale === "rpe" ? "Enter RPE from 6 to 10, or leave it blank." : "Enter RIR from 0 to 4, or leave it blank.");
  return parseExerciseTargets({ minReps: min ? +min : null, maxReps: max ? +max : null, targetRpe: effort ? +effortToRpe(effort, scale) : null });
}
export function exerciseTargetsChanged(input: unknown, draft: TargetsDraft, scale: EffortScale): boolean {
  try { return JSON.stringify(normalizeExerciseTargets(input)) !== JSON.stringify(readExerciseTargetsDraft(draft, scale)); } catch { return true; }
}
/** Individual prescriptions survive sharing; exercise defaults apply to normal working sets only. */
export function effectiveTargetRpe(exercise: { targets?: ExerciseTargets | null }, set: { targetRpe?: number | null; setType?: string }): number | null {
  if (typeof set.targetRpe === "number" && set.targetRpe >= 6 && set.targetRpe <= 10) return set.targetRpe;
  return !set.setType || set.setType === "normal" ? normalizeExerciseTargets(exercise.targets)?.targetRpe ?? null : null;
}
/** Keep routine prescriptions even when loads/reps are filled from recent performance. */
export function routineSetTargets<T extends { setType?: string }>(history: T[], planned: { setType?: string; targetRpe?: number | null }[]): (T & { targetRpe: number | null })[] {
  const ordinal = new Map<string, number>();
  return history.map(set => {
    const type = set.setType || "normal", at = ordinal.get(type) ?? 0;
    ordinal.set(type, at + 1);
    return { ...set, targetRpe: planned.filter(row => (row.setType || "normal") === type)[at]?.targetRpe ?? null };
  });
}
