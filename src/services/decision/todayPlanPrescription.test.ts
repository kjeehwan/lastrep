import { describe, expect, it } from "vitest";
import type { ExercisePlanAdjustment, PlannedExerciseSummary } from "../../types/decision";
import { exerciseAdjustmentText } from "./todayPlanPrescription";

const exercise: PlannedExerciseSummary = {
  name: "Leg Extension", mode: "resistance",
  sets: [60, 50, 50].map((weightKg) => ({ weightKg, reps: 18, done: false, setType: "normal" })),
};
const adjustment: ExercisePlanAdjustment = {
  exerciseName: exercise.name, action: "reduce", loadPct: -10, repsDelta: 0, setDelta: 0, targetRpe: 8,
  reason: "Recovery", plannedPrescription: { weightKg: 60, reps: 18, sets: 3 },
  recommendedPrescription: { weightKg: 54, reps: 18, sets: 3 },
};

describe("per-set plan preview", () => {
  it("shows a top set and back-off sets separately instead of repeating the first load", () => {
    expect(exerciseAdjustmentText(adjustment, "kg", exercise)).toBe(
      "Current: 60 kg x 18 reps x 1 set + 50 kg x 18 reps x 2 sets\nSuggested: 54 kg x 18 reps x 1 set + 45 kg x 18 reps x 2 sets"
    );
  });

  it("previews equipment rounding and set removal using the Apply transformation", () => {
    const result = exerciseAdjustmentText({ ...adjustment, setDelta: -1,
      availableWeights: { mode: "regular", unit: "kg", minimum: 0, increment: 5 } }, "kg", exercise);
    expect(result).toContain("Suggested: 50 kg x 18 reps x 1 set + 45 kg x 18 reps x 1 set");
  });

  it("excludes completed and warm-up sets from the adjustable prescription", () => {
    const result = exerciseAdjustmentText(adjustment, "kg", { ...exercise,
      sets: [{ ...exercise.sets[0], done: true }, { ...exercise.sets[0], setType: "warmup" }, ...exercise.sets.slice(1)] });
    expect(result).toBe("Current: 50 kg x 18 reps x 2 sets\nSuggested: 45 kg x 18 reps x 2 sets");
  });

  it("keeps skip recommendations and bodyweight prescriptions readable", () => {
    expect(exerciseAdjustmentText({ ...adjustment, action: "avoid" }, "kg", exercise)).toBe("Skip or replace");
    expect(exerciseAdjustmentText({ ...adjustment, loadPct: 0, repsDelta: -2 }, "kg", {
      ...exercise, sets: [{ weightKg: null, reps: 18, done: false, setType: "normal" }],
    })).toBe("Current: 18 reps x 1 set\nSuggested: 16 reps x 1 set");
  });
});
