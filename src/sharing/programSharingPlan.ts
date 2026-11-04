import { parseSharedPlan, type SharedProgramPlan, type SharedWorkoutPlan } from "./sharingContract";
import { normalizeExerciseTargets } from "../workouts/exerciseTargets";
import type { ProgramRecord } from "../workouts/programFlow";
import type { Routine } from "../workouts/workoutLog/workoutLogModel";

/** Build only prescriptions; exclude source IDs, personal notes and all program progress. */
export function programToSharingPlan(program: ProgramRecord, routines: Routine[], effortScale: "rpe" | "rir"): SharedProgramPlan {
  const ids = [...new Set(program.days.filter(d => d.type === "workout").map(d => d.routineId))];
  const keys = new Map(ids.map((id,index) => [id, `r${index+1}`]));
  const plans = ids.map(id => {
    const routine = routines.find(r => r.id === id);
    if (!routine) throw Error("An assigned routine is unavailable. Edit the program before sharing.");
    const plan: SharedWorkoutPlan = { version: 1, title: routine.name, effortScale,
      exercises: routine.exercises.map(e => {
        const mode = e.mode ?? (e.unit === "km" || e.unit === "mi" || e.sets.some(s => s.defaultDurationSec != null) ? "cardio" : "resistance");
        return { name: e.name, mode, unit: e.unit ?? (mode === "cardio" ? "km" : "kg"),
          restSec: e.restSec ?? 90, tempo: mode === "cardio" ? "" : e.tempo ?? "", instructions: "",
          ...(mode === "resistance" && normalizeExerciseTargets(e.targets) ? {targets: normalizeExerciseTargets(e.targets)} : {}),
          ...(e.cardioSessionType ? {cardioSessionType:e.cardioSessionType} : {}),
          ...(e.cardioEffortLevel ? {cardioEffortLevel:e.cardioEffortLevel} : {}),
          sets: e.sets.map(s => ({weightKg:s.defaultWeightKg ?? null,reps:s.reps,targetRpe:s.targetRpe ?? null,
            setType:s.setType ?? "normal",durationSec:s.defaultDurationSec ?? null,distanceKm:s.defaultDistanceKm ?? null})) };
      }) };
    return { key: keys.get(id)!, plan };
  });
  return parseSharedPlan({ version: 2, kind: "program", title: program.name, effortScale,
    routines: plans, days: program.days.map(d => ({type:d.type,title:d.title,routineKey:d.type === "rest" ? null : keys.get(d.routineId) ?? null})) }) as SharedProgramPlan;
}
