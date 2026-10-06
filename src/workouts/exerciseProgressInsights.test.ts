import { describe, expect, it } from "vitest";
import { buildExerciseProgressInsights, estimateOneRepMaxKg } from "./exerciseProgressInsights";

describe("exercise progress insights", () => {
  it("compares different rep ranges using estimated one-rep max", () => {
    expect(estimateOneRepMaxKg(100, 3)).toBeCloseTo(110);
    expect(estimateOneRepMaxKg(90, 8)).toBeCloseTo(114);
  });

  it("excludes warmups and marks chronological strength PRs", () => {
    const result = buildExerciseProgressInsights([
      {
        date: new Date("2026-01-01"),
        sets: [
          { weightKg: 60, reps: "10", setType: "warmup" },
          { weightKg: 100, reps: "3", rpe: "9" },
        ],
      },
      {
        date: new Date("2026-02-01"),
        sets: [{ weightKg: 90, reps: "8", rpe: "8" }],
      },
      {
        date: new Date("2026-03-01"),
        sets: [{ weightKg: 90, reps: "7" }],
      },
    ]);

    expect(result.sessions.map((session) => session.isStrengthPr)).toEqual([true, true, false]);
    expect(result.best?.bestWeightKg).toBe(90);
    expect(result.latest?.volumeKg).toBe(630);
    expect(result.changeFromPreviousPct).toBeLessThan(0);
  });

  it("returns an empty result when no valid weighted sets exist", () => {
    const result = buildExerciseProgressInsights([
      { date: new Date("2026-01-01"), sets: [{ weightKg: null, reps: "10" }] },
    ]);

    expect(result.sessions).toEqual([]);
    expect(result.latest).toBeNull();
    expect(result.best).toBeNull();
  });
});
