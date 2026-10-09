import type { ExercisePlanAdjustment } from "../../types/decision";
import { fitAvailableWeight } from "../../workouts/availableWeights";

type DraftSet = {
  weightKg?: number | null;
  weightText?: string;
  reps?: string;
  rpe?: string;
  setType?: string;
  done?: boolean;
  [key: string]: unknown;
};

type DraftExercise = {
  name?: string;
  sets?: DraftSet[];
  [key: string]: unknown;
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const roundLoad = (value: number) => Math.max(0, Math.round(value * 2) / 2);

export type ApplyTodayPlanResult = {
  raw: string;
  changedExercises: number;
  manualReviewExercises: string[];
};

export const applyTodayPlanToWorkoutDraft = (
  raw: string,
  adjustments: ExercisePlanAdjustment[],
  appliedAt = Date.now()
): ApplyTodayPlanResult => {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const exercises = Array.isArray(parsed.exercises) ? parsed.exercises as DraftExercise[] : [];
  const byName = new Map(adjustments.map((item) => [normalize(item.exerciseName), item]));
  const manualReviewExercises: string[] = [];
  let changedExercises = 0;

  const nextExercises = exercises.map((exercise) => {
    const name = typeof exercise.name === "string" ? exercise.name : "";
    const adjustment = byName.get(normalize(name));
    if (!adjustment) return exercise;
    if (adjustment.action === "avoid") {
      manualReviewExercises.push(name || adjustment.exerciseName);
      return exercise;
    }
    const originalSets = Array.isArray(exercise.sets) ? exercise.sets : [];
    let sets = originalSets.map((set) => {
      if (set.done || set.setType === "warmup") return set;
      let changed = false;
      let next = { ...set };
      if (adjustment.loadPct !== 0 && typeof set.weightKg === "number" && Number.isFinite(set.weightKg)) {
        const targetKg = set.weightKg * (1 + adjustment.loadPct / 100);
        const weightKg = adjustment.availableWeights
          ? fitAvailableWeight(set.weightKg, targetKg, adjustment.availableWeights).weightKg
          : roundLoad(targetKg);
        next = { ...next, weightKg, weightText: String(weightKg) };
        changed = true;
      }
      if (adjustment.repsDelta !== 0) {
        const reps = Number(set.reps);
        if (Number.isFinite(reps) && reps > 0) {
          next = { ...next, reps: String(Math.max(1, Math.round(reps + adjustment.repsDelta))) };
          changed = true;
        }
      }
      return changed ? next : set;
    });

    if (adjustment.setDelta < 0) {
      let remaining = Math.abs(adjustment.setDelta);
      for (let index = sets.length - 1; index >= 0 && remaining > 0; index -= 1) {
        const set = sets[index];
        const workingSetCount = sets.filter((candidate) => candidate.setType !== "warmup").length;
        if (!set.done && set.setType !== "warmup" && workingSetCount > 1) {
          sets = sets.filter((_, candidateIndex) => candidateIndex !== index);
          remaining -= 1;
        }
      }
    } else if (adjustment.setDelta > 0) {
      const template = [...sets].reverse().find((set) => !set.done && set.setType !== "warmup");
      if (template) {
        for (let count = 0; count < adjustment.setDelta; count += 1) {
          sets.push({ ...template, done: false });
        }
      }
    }

    if (JSON.stringify(sets) !== JSON.stringify(originalSets)) changedExercises += 1;
    return { ...exercise, sets };
  });

  return {
    raw: JSON.stringify({
      ...parsed,
      exercises: nextExercises,
      draftSavedAt: appliedAt,
      todayPlanAppliedAt: appliedAt,
    }),
    changedExercises,
    manualReviewExercises,
  };
};
