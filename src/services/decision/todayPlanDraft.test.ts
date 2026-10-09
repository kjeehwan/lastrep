import { describe, expect, it } from "vitest";
import { applyTodayPlanToWorkoutDraft } from "./todayPlanDraft";

describe("apply today's plan to workout draft", () => {
  it("updates only unfinished working sets and removes at most the requested sets", () => {
    const result = applyTodayPlanToWorkoutDraft(JSON.stringify({
      exercises: [{
        name: "Romanian Deadlift",
        sets: [
          { weightKg: 40, weightText: "40", reps: "8", setType: "warmup", done: false },
          { weightKg: 100, weightText: "100", reps: "8", setType: "normal", done: true },
          { weightKg: 100, weightText: "100", reps: "8", setType: "normal", done: false },
          { weightKg: 100, weightText: "100", reps: "8", setType: "normal", done: false },
        ],
      }],
    }), [{
      exerciseName: "Romanian Deadlift",
      action: "reduce",
      loadPct: -20,
      setDelta: -1,
      repsDelta: 0,
      targetRpe: 6,
      reason: "Lower-back demand.",
    }], 1000);
    const parsed = JSON.parse(result.raw);

    expect(parsed.exercises[0].sets).toHaveLength(3);
    expect(parsed.exercises[0].sets[1].weightKg).toBe(100);
    expect(parsed.exercises[0].sets[2].weightKg).toBe(80);
    expect(result.changedExercises).toBe(1);
  });

  it("leaves avoid recommendations for manual review", () => {
    const raw = JSON.stringify({ exercises: [{ name: "Deadlift", sets: [{ weightKg: 100, reps: "5" }] }] });
    const result = applyTodayPlanToWorkoutDraft(raw, [{
      exerciseName: "Deadlift",
      action: "avoid",
      loadPct: 0,
      setDelta: 0,
      repsDelta: 0,
      targetRpe: null,
      reason: "Pain overlap.",
    }]);

    expect(result.manualReviewExercises).toEqual(["Deadlift"]);
    expect(JSON.parse(result.raw).exercises[0].sets[0].weightKg).toBe(100);
  });
});
