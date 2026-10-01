import { describe, expect, it } from "vitest";
import {
  classifyExerciseGroup,
  getAverageRpe,
  getDominantGroup,
  isPhaseGoalAligned,
  pickTemplate,
  resolveRecommendationTargets,
  goalToLabel,
  DEFAULT_WORKOUT_TEMPLATES,
} from "./recommendationHeuristics";

describe("recommendation heuristics", () => {
  it("classifies common exercise groups", () => {
    expect(classifyExerciseGroup("Bench Press")).toBe("chest");
    expect(classifyExerciseGroup("Barbell Row")).toBe("back");
    expect(classifyExerciseGroup("Squat")).toBe("legs");
  });

  it("computes dominant group from workout", () => {
    const workout = {
      exercises: [
        { name: "Bench Press", sets: [] },
        { name: "Incline Dumbbell Press", sets: [] },
        { name: "Lat Pulldown", sets: [] },
      ],
    };
    expect(getDominantGroup(workout)).toBe("chest");
  });

  it("computes average RPE with valid bounds", () => {
    const workout = {
      exercises: [
        { name: "Bench Press", sets: [{ rpe: "9" }, { rpe: "10" }] },
        { name: "Row", sets: [{ rpe: 8.5 }, { rpe: "invalid" }] },
      ],
    };
    expect(getAverageRpe(workout)).toBeCloseTo(9.1666, 3);
  });

  it("picks template excluding yesterday group when possible", () => {
    const picked = pickTemplate(DEFAULT_WORKOUT_TEMPLATES, "chest", 0);
    expect(picked.primaryGroup).not.toBe("chest");
  });

  it("resolves targets with cut + fatigue adjustments", () => {
    const targets = resolveRecommendationTargets("Strength", "getStronger", "Cut", 10, true);
    expect(targets.targetSets).toBe(3);
    expect(targets.targetReps).toBe("5");
    expect(targets.intensityPct).toBe(0);
  });

  it("maps goal labels and alignment correctly", () => {
    expect(goalToLabel("buildMuscle")).toBe("Build Muscle");
    expect(isPhaseGoalAligned("Hypertrophy", "buildMuscle")).toBe(true);
    expect(isPhaseGoalAligned("Strength", "buildMuscle")).toBe(false);
  });
});
