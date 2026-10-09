import { describe, expect, it } from "vitest";
import type { DecisionInputs } from "../../types/decision";
import type { ExerciseCatalogItem } from "../../workouts/exerciseCatalog";
import type { WorkoutSummary } from "../../workouts/homeInsights";
import { buildDeterministicTodayPlan } from "./todayPlanEngine";
import { applyTodayPlanToWorkoutDraft } from "./todayPlanDraft";

const catalog: ExerciseCatalogItem[] = [
  { id: "rdl", name: "Romanian Deadlift", aliases: [], primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: ["lower back"], equipment: ["barbell"], movementPattern: "hinge", difficulty: "intermediate", group: "legs", cues: [] },
  { id: "leg-curl", name: "Leg Curl", aliases: [], primaryMuscles: ["hamstrings"], secondaryMuscles: [], equipment: ["machine"], movementPattern: "knee flexion", difficulty: "beginner", group: "legs", cues: [] },
  { id: "hip-thrust", name: "Hip Thrust", aliases: [], primaryMuscles: ["glutes"], secondaryMuscles: ["hamstrings"], equipment: ["barbell"], movementPattern: "hip extension", difficulty: "intermediate", group: "legs", cues: [] },
  { id: "bench", name: "Bench Press", aliases: [], primaryMuscles: ["chest"], secondaryMuscles: ["triceps"], equipment: ["barbell"], movementPattern: "horizontal push", difficulty: "intermediate", group: "chest", cues: [] },
];

const inputs = (overrides: Partial<DecisionInputs> = {}): DecisionInputs => ({
  sleepHours: 7.5,
  sleepSource: "manual",
  sleepSampleAgeHours: null,
  soreness: 1,
  fatigue: 1,
  motivation: 9,
  trainingPhase: "Hypertrophy",
  dietPhase: "Maintain",
  plannedWorkout: {
    source: "draft",
    title: "Posterior Legs",
    exerciseNames: ["Romanian Deadlift", "Leg Curl", "Hip Thrust"],
  },
  recentTraining: {
    lastWorkoutHoursAgo: 96,
    lastWorkoutTitle: "Chest",
    workoutsLast7Days: 3,
    exercisePerformance: [],
  },
  dailyContext: null,
  ...overrides,
});

const bodyweightCatalog: ExerciseCatalogItem[] = [...catalog, {
  id: "hanging-leg-raise", name: "Hanging Leg Raise", aliases: [], primaryMuscles: ["abs"], secondaryMuscles: ["hip flexors"],
  equipment: ["bar"], movementPattern: "hip flexion", difficulty: "intermediate", group: "core", cues: [],
}];

describe("deterministic today's plan", () => {
  it("shows and applies the same available machine weight", () => {
    const result = buildDeterministicTodayPlan(inputs({ soreness: 9, fatigue: 9,
      plannedWorkout: { source: "draft", title: "Legs", exerciseNames: ["Leg Curl"],
        exercises: [{ name: "Leg Curl", mode: "resistance",
          availableWeights: { mode: "regular", unit: "kg", minimum: 5, increment: 5 },
          sets: [{ weightKg: 55, reps: 8, setType: "normal", done: false }] }] },
    }), [], new Date("2026-10-07T12:00:00Z"), catalog);
    const adjustment = result.exerciseAdjustments![0];
    expect(adjustment.recommendedPrescription?.weightKg).toBe(45);
    const applied = applyTodayPlanToWorkoutDraft(JSON.stringify({ exercises: [{ name: "Leg Curl",
      sets: [{ weightKg: 55, reps: "8", done: false }, { weightKg: 55, reps: "8", done: true }] }] }), [adjustment]);
    expect(JSON.parse(applied.raw).exercises[0].sets[0].weightKg).toBe(adjustment.recommendedPrescription?.weightKg);
    expect(JSON.parse(applied.raw).exercises[0].sets[1].weightKg).toBe(55);
  });
  it("reduces bodyweight reps after a maximal-effort leg raise without inventing a weight reduction", () => {
    const planned = {
      source: "draft" as const, title: "Core", exerciseNames: ["Hanging Leg Raise"],
      exercises: [{ name: "Hanging Leg Raise", mode: "resistance" as const,
        sets: [{ weightKg: null, reps: 12, setType: "normal" as const, done: false }] }],
    };
    const result = buildDeterministicTodayPlan(inputs({ plannedWorkout: planned,
      recentTraining: { lastWorkoutHoursAgo: 96, lastWorkoutTitle: "Core", workoutsLast7Days: 2,
        exercisePerformance: [{ exerciseName: "Hanging Leg Raise", sessions: 2, daysSinceLast: 4,
          lastTopWeightKg: null, lastTopReps: 12, lastAverageRpe: 10, estimated1RmKg: null, trend: "stable" }] },
    }), [], new Date("2026-10-07T12:00:00Z"), bodyweightCatalog);
    const adjustment = result.exerciseAdjustments![0];
    expect(adjustment).toMatchObject({ loadPct: 0, repsDelta: -2, targetRpe: 8,
      recommendedPrescription: { weightKg: null, reps: 10, sets: 1 } });
    const applied = applyTodayPlanToWorkoutDraft(JSON.stringify({ exercises: [{ name: "Hanging Leg Raise",
      sets: [{ weightKg: null, reps: "12", done: false }] }] }), [adjustment]);
    expect(JSON.parse(applied.raw).exercises[0].sets[0]).toMatchObject({ weightKg: null, reps: "10" });
  });

  it("adjusts added weight normally when a bodyweight exercise is recorded with external load", () => {
    const result = buildDeterministicTodayPlan(inputs({ soreness: 9, fatigue: 9,
      plannedWorkout: { source: "draft", title: "Core", exerciseNames: ["Hanging Leg Raise"],
        exercises: [{ name: "Hanging Leg Raise", mode: "resistance",
          sets: [{ weightKg: 10, reps: 12, setType: "normal", done: false }] }] },
    }), [], new Date("2026-10-07T12:00:00Z"), bodyweightCatalog);
    expect(result.exerciseAdjustments![0]).toMatchObject({ loadPct: -10, repsDelta: 0,
      recommendedPrescription: { weightKg: 9, reps: 12, sets: 1 } });
  });

  it("withholds exercise prescriptions until a workout is selected", () => {
    const result = buildDeterministicTodayPlan(inputs({
      plannedWorkout: { source: "none", title: null, exerciseNames: [] },
    }), [], new Date("2026-10-07T12:00:00Z"), [...catalog]);

    expect(result.headline).toMatch(/ready to train/i);
    expect(result.exerciseAdjustments).toBeUndefined();
    expect(result.todayAction).toMatch(/choose today's workout/i);
  });

  it("reduces lower-back-demanding movements without reducing leg curls", () => {
    const result = buildDeterministicTodayPlan(inputs({
      dailyContext: {
        dateKey: "2026-10-07",
        pain: {
          area: "lower_back",
          side: "not_applicable",
          severity: "moderate",
          trigger: "hinging",
          note: null,
          affectsPlannedWorkout: true,
        },
        additionalActivity: null,
        note: null,
      },
    }), [], new Date("2026-10-07T12:00:00Z"), [...catalog]);

    expect(result.decision).toBe("PULL_BACK");
    expect(result.exerciseAdjustments?.find((item) => item.exerciseName === "Romanian Deadlift")?.loadPct).toBe(-20);
    expect(result.exerciseAdjustments?.find((item) => item.exerciseName === "Leg Curl")?.loadPct).toBe(0);
  });

  it("does not progress an exercise after a maximal recent effort", () => {
    const result = buildDeterministicTodayPlan(inputs({
      plannedWorkout: { source: "draft", title: "Chest", exerciseNames: ["Bench Press"] },
      recentTraining: {
        lastWorkoutHoursAgo: 96,
        lastWorkoutTitle: "Chest",
        workoutsLast7Days: 2,
        exercisePerformance: [{
          exerciseName: "Bench Press",
          sessions: 2,
          daysSinceLast: 4,
          lastTopWeightKg: 105,
          lastTopReps: 3,
          lastAverageRpe: 10,
          estimated1RmKg: 115.5,
          trend: "stable",
        }],
      },
    }), [], new Date("2026-10-07T12:00:00Z"), [...catalog]);

    expect(result.exerciseAdjustments?.[0].action).toBe("reduce");
    expect(result.exerciseAdjustments?.[0].loadPct).toBe(-5);
  });

  it("turns an unrealistic planned load into an exact supported prescription", () => {
    const result = buildDeterministicTodayPlan(inputs({
      plannedWorkout: {
        source: "draft",
        title: "Chest",
        exerciseNames: ["Bench Press"],
        exercises: [{
          name: "Bench Press",
          mode: "resistance",
          sets: Array.from({ length: 3 }, () => ({
            weightKg: 105,
            reps: 8,
            setType: "normal" as const,
            done: false,
          })),
        }],
      },
      recentTraining: {
        lastWorkoutHoursAgo: 96,
        lastWorkoutTitle: "Chest",
        workoutsLast7Days: 2,
        exercisePerformance: [{
          exerciseName: "Bench Press",
          sessions: 2,
          daysSinceLast: 4,
          lastTopWeightKg: 105,
          lastTopReps: 3,
          lastAverageRpe: 10,
          estimated1RmKg: 115.5,
          trend: "stable",
        }],
      },
    }), [], new Date("2026-10-07T12:00:00Z"), [...catalog]);

    expect(result.exerciseAdjustments?.[0]).toMatchObject({
      action: "reduce",
      plannedPrescription: { weightKg: 105, reps: 8, sets: 3 },
      recommendedPrescription: { weightKg: 86.5, reps: 8, sets: 3 },
    });
  });

  it("uses recent nutrition as a progression tie-breaker", () => {
    const result = buildDeterministicTodayPlan(inputs({
      plannedWorkout: { source: "draft", title: "Chest", exerciseNames: ["Bench Press"] },
      nutrition: {
        caloriesConsumedToday: 0,
        proteinGramsToday: null,
        calorieTarget: 3000,
        yesterdayCalories: 2200,
        yesterdayAdherence: "below_target",
        recentAdherence: "below_target",
        recentCompletedDaysTracked: 5,
      },
      recentTraining: {
        lastWorkoutHoursAgo: 96,
        lastWorkoutTitle: "Chest",
        workoutsLast7Days: 2,
        exercisePerformance: [{
          exerciseName: "Bench Press",
          sessions: 2,
          daysSinceLast: 4,
          lastTopWeightKg: 100,
          lastTopReps: 8,
          lastAverageRpe: 7,
          estimated1RmKg: 126.7,
          trend: "stable",
        }],
      },
    }), [], new Date("2026-10-07T12:00:00Z"), [...catalog]);

    expect(result.exerciseAdjustments?.[0]?.action).toBe("as_planned");
    expect(result.exerciseAdjustments?.[0]?.reason).toMatch(/calorie intake is below target/i);
  });

  it("does not trim cardio or core work solely because it was performed recently", () => {
    const cardioAndCoreCatalog: ExerciseCatalogItem[] = [
      ...catalog,
      { id: "treadmill", name: "Treadmill", aliases: [], primaryMuscles: ["cardio"], secondaryMuscles: ["legs"], equipment: ["machine"], movementPattern: "cardio", difficulty: "beginner", group: "cardio", cues: [] },
      { id: "hanging-leg-raise", name: "Hanging Leg Raise", aliases: [], primaryMuscles: ["abs"], secondaryMuscles: ["hip flexors"], equipment: ["bar"], movementPattern: "hip flexion", difficulty: "intermediate", group: "core", cues: [] },
    ];
    const recentWorkouts: WorkoutSummary[] = [{
      id: "recent",
      title: "Mixed",
      date: new Date("2026-10-06T12:00:00Z"),
      trainingPhase: "Hypertrophy",
      exercises: [
        { name: "Treadmill", sets: [{ weightKg: null, reps: "", rpe: 6 }] },
        { name: "Hanging Leg Raise", sets: [{ weightKg: null, reps: "12", rpe: 7 }] },
      ],
    }];
    const result = buildDeterministicTodayPlan(inputs({
      plannedWorkout: {
        source: "draft",
        title: "Mixed",
        exerciseNames: ["Treadmill", "Hanging Leg Raise"],
      },
    }), recentWorkouts, new Date("2026-10-07T12:00:00Z"), cardioAndCoreCatalog);

    expect(result.decision).toBe("MAINTAIN");
    expect(result.exerciseAdjustments).toEqual(expect.arrayContaining([
      expect.objectContaining({ exerciseName: "Treadmill", setDelta: 0, loadPct: 0 }),
      expect.objectContaining({ exerciseName: "Hanging Leg Raise", setDelta: 0, loadPct: 0 }),
    ]));
  });
});
