import { describe, expect, it } from "vitest";
import type { PlannedWorkoutSummary } from "../../types/decision";
import type { WorkoutSummary } from "../../workouts/homeInsights";
import {
  activityOverlapsWorkout,
  buildRecentTrainingSummary,
  normalizeDailyDecisionContext,
  painAffectsWorkout,
  parseWorkoutDraftPlan,
} from "./todayPlanContext";

const chestPlan: PlannedWorkoutSummary = {
  source: "draft",
  title: "Chest",
  exerciseNames: ["Bench Press", "Cable Fly"],
};

describe("today plan context", () => {
  it("reads a current workout draft", () => {
    const now = new Date(2026, 9, 7, 12);
    const result = parseWorkoutDraftPlan(
      JSON.stringify({
        sessionDateText: "2026-10-07",
        draftSavedAt: now.getTime(),
        sessionTitle: "Chest + Triceps",
        exercises: [{ name: "Bench Press" }],
      }),
      now
    );
    expect(result).toEqual({
      source: "draft",
      title: "Chest + Triceps",
      exerciseNames: ["Bench Press"],
      exercises: [{ name: "Bench Press", mode: "resistance", sets: [] }],
    });
  });

  it("matches movement-specific discomfort to the planned workout", () => {
    expect(painAffectsWorkout({ area: "shoulder", severity: "moderate", trigger: "pressing" }, chestPlan)).toBe(true);
    expect(painAffectsWorkout({ area: "knee", severity: "mild", trigger: "squatting" }, chestPlan)).toBe(false);
  });

  it("does not apply a pain record from a prior date", () => {
    const result = normalizeDailyDecisionContext(
      {
        dateKey: "2026-10-06",
        pain: {
          area: "lower_back",
          side: "not_applicable",
          severity: "moderate",
          trigger: "hinging",
          note: null,
        },
      },
      chestPlan,
      new Date(2026, 9, 7, 12)
    );

    expect(result).toBeNull();
  });

  it("matches lower-body activity to a leg workout", () => {
    const legPlan: PlannedWorkoutSummary = {
      source: "program",
      title: "Legs",
      exerciseNames: ["Back Squat", "Leg Press"],
    };
    expect(activityOverlapsWorkout({ type: "long_walk_hike", effort: "hard" }, legPlan)).toBe(true);
    expect(activityOverlapsWorkout({ type: "long_walk_hike", effort: "hard" }, chestPlan)).toBe(false);
  });

  it("summarizes comparable exercise performance without inventing a trend", () => {
    const workouts: WorkoutSummary[] = [
      {
        id: "new",
        title: "Chest",
        date: new Date(2026, 9, 5, 12),
        trainingPhase: "Hypertrophy",
        exercises: [{ name: "Bench Press", sets: [{ weightKg: 105, reps: "3", rpe: 10 }] }],
      },
      {
        id: "old",
        title: "Chest",
        date: new Date(2026, 8, 28, 12),
        trainingPhase: "Hypertrophy",
        exercises: [{ name: "Bench Press", sets: [{ weightKg: 102.5, reps: "3", rpe: 9 }] }],
      },
    ];
    const result = buildRecentTrainingSummary(workouts, chestPlan, new Date(2026, 9, 7, 12));
    expect(result.exercisePerformance[0]).toMatchObject({
      exerciseName: "Bench Press",
      sessions: 2,
      daysSinceLast: 2,
      lastTopWeightKg: 105,
      lastTopReps: 3,
      lastAverageRpe: 10,
    });
  });
});
