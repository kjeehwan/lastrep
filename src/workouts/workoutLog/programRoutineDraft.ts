import type { ProgramLink } from "../programFlow";
import { normalizeExerciseTargets } from "../exerciseTargets";
import type { Exercise, Routine } from "./workoutLogModel";
import { toLocalDateKey, toSetType } from "./workoutLogModel";

/** Routine prescriptions are plans; actual effort and completion never carry forward. */
export function programRoutineDraft(routine: Routine, link: ProgramLink, id: () => string) {
  const exercises: Exercise[] = routine.exercises.map(exercise => ({
    id: id(), name: exercise.name, mode: exercise.mode, targets: normalizeExerciseTargets(exercise.targets),
    plannedRestSec: exercise.restSec, notes: exercise.notes ?? "", tempo: exercise.tempo ?? "",
    cardioSessionType: exercise.cardioSessionType, cardioEffortLevel: exercise.cardioEffortLevel,
    sets: exercise.sets.map(set => ({ weightKg: set.defaultWeightKg ?? null, reps: String(set.reps ?? ""),
      targetRpe: set.targetRpe ?? null, rpe: "", done: false, setType: toSetType(set.setType),
      distanceKm: set.defaultDistanceKm ?? null, durationSec: set.defaultDurationSec ?? null, zone: set.defaultZone ?? "",
      baselineWeightKg: set.defaultWeightKg ?? null, baselineReps: String(set.reps ?? "") })),
  }));
  return { exercises, exerciseUnits: Object.fromEntries(exercises.map((exercise,index) => [exercise.id,routine.exercises[index].unit ?? "kg"])),
    programLink: link, sessionTitle: routine.name, sessionDateText: toLocalDateKey(new Date()),
    lastAppliedRoutineId: routine.id, lastAppliedRoutineName: routine.name, elapsedSeconds: 0,
    workoutTimerRunning: false, workoutTimerHasStarted: false, workoutTimerStartedAtMs: null };
}
