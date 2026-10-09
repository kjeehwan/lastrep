import type { ExercisePlanAdjustment, ExercisePrescription, PlannedExerciseSummary } from "../../types/decision";
import { applyTodayPlanToWorkoutDraft } from "./todayPlanDraft";

type PreviewSet = { weightKg: number | null; reps: number | string | null; done: boolean; setType: string };

const prescriptionText = (value: ExercisePrescription, unit: "kg" | "lbs") => {
  const parts: string[] = [];
  if (value.weightKg != null && value.weightKg > 0) parts.push(`${Number((value.weightKg * (unit === "lbs" ? 2.2046226218 : 1)).toFixed(1))} ${unit}`);
  if (value.reps != null) parts.push(`${value.reps} reps`);
  parts.push(`${value.sets} set${value.sets === 1 ? "" : "s"}`);
  return parts.join(" x ");
};

const groupedSetsText = (sets: PreviewSet[], unit: "kg" | "lbs") => {
  const groups: ExercisePrescription[] = [];
  for (const set of sets.filter((item) => !item.done && item.setType !== "warmup")) {
    const reps = set.reps == null ? null : Number(set.reps);
    const last = groups[groups.length - 1];
    if (last && last.weightKg === set.weightKg && last.reps === reps) last.sets += 1;
    else groups.push({ weightKg: set.weightKg, reps, sets: 1 });
  }
  return groups.map((group) => prescriptionText(group, unit)).join(" + ");
};

export function exerciseAdjustmentText(item: ExercisePlanAdjustment, unit: "kg" | "lbs", exercise?: PlannedExerciseSummary) {
  if (item.action === "avoid") return "Skip or replace";
  if (exercise?.mode === "resistance" && exercise.sets.some((set) => !set.done && set.setType !== "warmup")) {
    // Preview the exact Apply transformation, including varied loads and removed sets.
    const applied = applyTodayPlanToWorkoutDraft(JSON.stringify({ exercises: [exercise] }), [item], 0);
    const afterSets = (JSON.parse(applied.raw) as { exercises: { sets: PreviewSet[] }[] }).exercises[0].sets;
    const before = groupedSetsText(exercise.sets, unit);
    const after = groupedSetsText(afterSets, unit);
    if (before !== after) return `Current: ${before}\nSuggested: ${after}`;
  } else if (item.plannedPrescription && item.recommendedPrescription) {
    const before = prescriptionText(item.plannedPrescription, unit);
    const after = prescriptionText(item.recommendedPrescription, unit);
    if (before !== after) return `${before} → ${after}`;
  }
  const parts: string[] = [];
  if (item.loadPct) parts.push(`Load ${item.loadPct > 0 ? "+" : ""}${Number(item.loadPct.toFixed(1))}%`);
  if (item.setDelta) parts.push(`${Math.abs(item.setDelta)} ${item.setDelta < 0 ? "fewer" : "more"} sets`);
  if (item.repsDelta) parts.push(`${item.repsDelta > 0 ? "+" : ""}${item.repsDelta} reps`);
  if (item.targetRpe) parts.push(`Cap at RPE ${item.targetRpe}`);
  return parts.join(" · ") || "As planned";
}
