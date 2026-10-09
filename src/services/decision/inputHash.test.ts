import { describe, expect, it } from "vitest";

import type { DecisionInputs } from "../../types/decision";
import { hashDecisionInputs } from "./inputHash";

const baseInputs: DecisionInputs = {
  sleepHours: 7,
  sleepSource: "health",
  sleepSampleAgeHours: 2,
  soreness: 2,
  fatigue: 3,
  motivation: 8,
  trainingPhase: "Hypertrophy",
  dietPhase: "Maintain",
  plannedWorkout: {
    source: "draft",
    title: "Chest",
    exerciseNames: ["Bench Press"],
  },
  recentTraining: {
    lastWorkoutHoursAgo: 24,
    lastWorkoutTitle: "Back",
    workoutsLast7Days: 3,
    exercisePerformance: [{
      exerciseName: "Bench Press",
      sessions: 2,
      daysSinceLast: 4,
      lastTopWeightKg: 100,
      lastTopReps: 8,
      lastAverageRpe: 8,
      estimated1RmKg: 126.7,
      trend: "stable",
    }],
  },
  dailyContext: null,
};

describe("decision input freshness hash", () => {
  it("ignores elapsed-time drift when the underlying context is unchanged", () => {
    const refreshed: DecisionInputs = {
      ...baseInputs,
      sleepSampleAgeHours: 2.5,
      recentTraining: {
        ...baseInputs.recentTraining!,
        lastWorkoutHoursAgo: 24.5,
        exercisePerformance: baseInputs.recentTraining!.exercisePerformance.map((item) => ({
          ...item,
          daysSinceLast: 5,
        })),
      },
    };

    expect(hashDecisionInputs(refreshed)).toBe(hashDecisionInputs(baseInputs));
  });

  it("changes when a meaningful plan input changes", () => {
    expect(hashDecisionInputs({ ...baseInputs, fatigue: 7 })).not.toBe(hashDecisionInputs(baseInputs));
  });
});
