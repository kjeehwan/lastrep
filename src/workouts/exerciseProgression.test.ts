import { describe, expect, it } from "vitest";
import { recommendExerciseProgression } from "./exerciseProgression";

const recommend = (overrides: Partial<Parameters<typeof recommendExerciseProgression>[0]> = {}) =>
  recommendExerciseProgression({
    exerciseName: "Bench Press",
    sessions: [{ sets: [{ weightKg: 105, reps: "4", rpe: "8" }, { weightKg: 105, reps: "4", rpe: "8" }, { weightKg: 105, reps: "4", rpe: "8" }] }],
    phase: "Strength",
    baseSets: 3,
    decisionIntensityPct: 0,
    dietPhase: "Maintain",
    highFatigue: false,
    ...overrides,
  });

describe("exercise progression", () => {
  it("respects the barbell grid when recommending progression", () => {
    const result = recommend({ sessions: [{ sets: [{ weightKg: 100, reps: "4", rpe: "7" }] }],
      availableWeights: { mode: "regular", unit: "kg", minimum: 20, increment: 2 } });
    expect(result.weightKg).toBe(102);
  });

  it("holds the load and increases reps when the next increment is too large", () => {
    const result = recommend({ sessions: [{ sets: [{ weightKg: 100, reps: "4", rpe: "7" }] }],
      availableWeights: { mode: "regular", unit: "kg", minimum: 20, increment: 5 } });
    expect(result.weightKg).toBe(100);
    expect(result.reps).toBe("5");
  });
  it("keeps a demonstrated strength load and reps together", () => {
    const result = recommend();
    expect(result.weightKg).toBe(105);
    expect(result.reps).toBe("4");
    expect(result.sets).toBe(3);
  });

  it("uses the explicit workout volume budget", () => {
    const result = recommend({ baseSets: 4 });
    expect(result.sets).toBe(4);
  });

  it("calculates a lower load when hypertrophy needs more reps", () => {
    const result = recommend({ phase: "Hypertrophy" });
    expect(result.reps).toBe("8");
    expect(result.weightKg).toBeLessThan(105);
  });

  it("progresses cautiously after clearly controlled effort", () => {
    const result = recommend({ sessions: [{ sets: [{ weightKg: 100, reps: "4", rpe: "7" }] }] });
    expect(result.weightKg).toBe(102.5);
  });

  it("reduces load but preserves the selected volume after very high effort", () => {
    const result = recommend({ sessions: [{ sets: [{ weightKg: 105, reps: "4", rpe: "9" }] }] });
    expect(result.weightKg).toBeLessThan(105);
    expect(result.sets).toBe(3);
  });

  it("does not use an older stronger session to overprescribe reps after a recent maximal effort", () => {
    const result = recommend({
      phase: "Hypertrophy",
      sessions: [
        {
          sets: [
            { weightKg: 105, reps: "3", rpe: "" },
            { weightKg: 105, reps: "3", rpe: "" },
            { weightKg: 105, reps: "3", rpe: "10" },
          ],
        },
        { sets: [{ weightKg: 120, reps: "8", rpe: "8" }] },
      ],
    });

    expect(result.reps).toBe("8");
    expect(result.weightKg).toBe(86.5);
    expect(result.reason).toContain("Recent effort was very high");
  });

  it("does not use an older stronger session to create a large rep jump when RPE is missing", () => {
    const result = recommend({
      phase: "Hypertrophy",
      sessions: [
        { sets: [{ weightKg: 105, reps: "3", rpe: "" }] },
        { sets: [{ weightKg: 120, reps: "8", rpe: "8" }] },
      ],
    });

    expect(result.reps).toBe("8");
    expect(result.weightKg).toBe(86.5);
  });

  it("never turns high fatigue plus a positive decision adjustment into a load increase", () => {
    const result = recommend({
      phase: "Hypertrophy",
      decisionIntensityPct: 15,
      highFatigue: true,
      sessions: [
        {
          sets: [
            { weightKg: 105, reps: "3", rpe: "10" },
            { weightKg: 85, reps: "6", rpe: "6" },
            { weightKg: 85, reps: "6", rpe: "8" },
          ],
        },
        { sets: [{ weightKg: 120, reps: "8", rpe: "8" }] },
      ],
    });

    expect(result.reps).toBe("8");
    expect(result.weightKg).toBe(86.5);
    expect(result.reason).toContain("Recent effort was very high");
  });

  it("does not progress when estimated strength has materially declined", () => {
    const result = recommend({
      sessions: [
        { sets: [{ weightKg: 90, reps: "4", rpe: "7" }] },
        { sets: [{ weightKg: 105, reps: "4", rpe: "8" }] },
      ],
    });
    expect(result.weightKg).toBeLessThan(90);
    expect(result.sets).toBe(3);
  });

  it("uses blank weight for an exercise with no history", () => {
    const result = recommend({ sessions: [] });
    expect(result.weightKg).toBeNull();
    expect(result.reps).toBe("4");
  });

  it("preserves selected volume during a cut", () => {
    const result = recommend({ dietPhase: "Cut" });
    expect(result.weightKg).toBe(105);
    expect(result.sets).toBe(3);
  });
});
