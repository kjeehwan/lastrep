import { describe, expect, it } from "vitest";
import { availableWeightAtOrBelow, convertAvailableWeightsUnit, fitAvailableWeight, normalizeAvailableWeights, parseAvailableWeightsByExercise } from "./availableWeights";

describe("available equipment weights", () => {
  it("reduces a 55 kg machine load to an available 50 kg load", () => {
    expect(fitAvailableWeight(55, 53, { mode: "regular", unit: "kg", minimum: 5, increment: 5 }))
      .toEqual({ weightKg: 50, repFallback: 0 });
  });

  it.each([[2, 102], [2.5, 102.5]])("supports %s kg total barbell increments", (increment, expected) => {
    expect(availableWeightAtOrBelow(102.5, { mode: "regular", unit: "kg", minimum: 20, increment })).toBe(expected);
  });

  it("uses reps instead of jumping to an unsupported dumbbell load", () => {
    expect(fitAvailableWeight(14, 15, { mode: "custom", unit: "kg", values: [10, 12, 14, 17.5, 20] }))
      .toEqual({ weightKg: 14, repFallback: 1 });
  });

  it("does not replace a reduction with a much larger drop or a heavier minimum", () => {
    expect(fitAvailableWeight(20, 19, { mode: "custom", unit: "kg", values: [5, 20] }))
      .toEqual({ weightKg: 20, repFallback: -1 });
    expect(fitAvailableWeight(20, 19, { mode: "regular", unit: "kg", minimum: 20, increment: 5 }))
      .toEqual({ weightKg: 20, repFallback: -1 });
  });

  it("uses physical 5 lb increments rather than rounding in kilograms", () => {
    const setup = { mode: "regular" as const, unit: "lbs" as const, minimum: 0, increment: 5 };
    expect(availableWeightAtOrBelow(118 * 0.45359237, setup)).toBeCloseTo(115 * 0.45359237, 5);
    expect(availableWeightAtOrBelow(115 * 0.45359237, setup)).toBeCloseTo(115 * 0.45359237, 5);
  });

  it("preserves the equipment when switching display units", () => {
    const original = { mode: "regular" as const, unit: "kg" as const, minimum: 20, increment: 2.5 };
    const converted = convertAvailableWeightsUnit(original, "lbs");
    expect(availableWeightAtOrBelow(102.5, converted)).toBeCloseTo(102.5, 4);
  });

  it("normalizes custom lists and ignores invalid saved settings", () => {
    expect(normalizeAvailableWeights({ mode: "custom", unit: "kg", values: [14, 10, 14, 12] }))
      .toEqual({ mode: "custom", unit: "kg", values: [10, 12, 14] });
    expect(parseAvailableWeightsByExercise({ " Bench  Press ": { mode: "regular", unit: "kg", minimum: 20, increment: 2.5 }, bad: { increment: -1 } }))
      .toEqual({ "bench press": { mode: "regular", unit: "kg", minimum: 20, increment: 2.5 } });
  });
});
