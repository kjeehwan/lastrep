import type { DecisionInputs, ExercisePlanAdjustment, PlannedExerciseSummary, SetGroupAdjustment, SetGroupRole } from "../../types/decision";
import type { WorkoutSummary } from "../../workouts/homeInsights";
import { effectiveGroupTargets } from "../../workouts/exerciseTargets";
import { buildRecentTrainingSummary } from "./todayPlanContext";

export const groupRoleLabel = (role: SetGroupRole) => role === "top" ? "Top" : "Back-off";
export const adjustmentSelectionKey = (item: ExercisePlanAdjustment & { role?: SetGroupRole }) => item.role ? `${item.exerciseName}\u001f${item.role}` : item.exerciseName;
export const hasAdjustmentChanges = (item: ExercisePlanAdjustment): boolean => Boolean(item.groupAdjustments?.some(hasAdjustmentChanges) || item.action === "avoid" || item.loadPct || item.setDelta || item.repsDelta);

/** Explicit roles only: no load-based inference and no mutation of historical records. */
export function buildSetGroupReview(exercise: PlannedExerciseSummary, inputs: DecisionInputs, workouts: WorkoutSummary[], now: Date,
  evaluate: (inputs: DecisionInputs, workouts: WorkoutSummary[], role: SetGroupRole) => ExercisePlanAdjustment): ExercisePlanAdjustment {
  const working = exercise.sets.filter(set => set.setType !== "warmup");
  const arrangement = working.length >= 2 && working[0].setType === "top" && working.slice(1).every(set => set.setType === "backoff") &&
    working.slice(1).every(set => set.weightKg === working[1].weightKg && set.reps === working[1].reps);
  const recording = working.some(set => set.done || set.rpe != null);
  const duplicatePlan = inputs.plannedWorkout?.exercises?.filter(item => item.name.trim().toLowerCase() === exercise.name.trim().toLowerCase()).length !== 1;
  const roles = (["top","backoff"] as const).filter(role => working.some(set => set.setType === role));
  const groupAdjustments: SetGroupAdjustment[] = roles.map(role => {
    const rows = working.filter(set => set.setType === role);
    let targets = effectiveGroupTargets(exercise, role);
    const efforts = [...new Set(rows.map(set => set.targetRpe ?? targets?.targetRpe ?? null))];
    if (targets && efforts.length === 1) targets = {...targets,targetRpe:efforts[0]};
    const scoped: PlannedExerciseSummary = {...exercise,targets,groupTargets:null,deloadAppliedId:exercise.deloadAppliedGroups?.[role] ?? exercise.deloadAppliedId,sets:rows.map(set => ({...set,setType:"normal"}))};
    const plannedWorkout = {...inputs.plannedWorkout!,exercises:inputs.plannedWorkout!.exercises!.map(item => item === exercise ? scoped : item)};
    // Keep missing/changed roles in the latest session as an empty group: never skip
    // it to reach an older, heavier record during a rebuild.
    const scopedHistory = workouts.map(workout => ({...workout,exercises:workout.exercises.map(item => item.name.trim().toLowerCase() === exercise.name.trim().toLowerCase()
      ? {...item,sets:item.sets.filter(set => set.setType === role).map(set => ({...set,setType:"normal" as const}))} : item)}));
    const adjusted = evaluate({...inputs,plannedWorkout,recentTraining:buildRecentTrainingSummary(scopedHistory,plannedWorkout,now)},scopedHistory,role);
    const reason = duplicatePlan ? "This exercise appears more than once in your plan. Review each entry before increasing."
      : !arrangement ? "Suggestions support one Top set followed by Back-off sets with the same weight and reps. Keep your chosen sets today."
      : recording ? "You have started recording this exercise. Keep your planned sets."
        : efforts.length > 1 ? "These sets have different effort targets. Review each target before increasing." : null;
    // Context is evaluated first. Unsupported/recorded groups are held for manual
    // review; avoidance advice still surfaces without editing recorded values.
    const hold = reason && adjusted.action !== "avoid";
    return {...adjusted,role,...(hold ? {action:"as_planned" as const,loadPct:0,setDelta:0,repsDelta:0,targetRpe:null,reason,
      recommendedPrescription:adjusted.plannedPrescription} : {})};
  });
  const action = groupAdjustments.some(g => g.action === "avoid") ? "avoid" : groupAdjustments.some(g => g.action === "reduce" || g.setDelta < 0) ? "reduce" : groupAdjustments.some(g => g.action === "progress") ? "progress" : "as_planned";
  return {exerciseName:exercise.name,action,loadPct:0,setDelta:0,repsDelta:0,targetRpe:null,reason:"Review the suggested Top and Back-off sets below.",groupAdjustments};
}
