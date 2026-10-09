import { describe, expect, it } from "vitest";
import { safeParseDecisionOutput } from "./decisionValidation";

describe("decision output validation", () => {
  it("accepts complete explanation sentences", () => {
    const parsed = safeParseDecisionOutput({
      decision: "MAINTAIN",
      explanation: ["Sleep is adequate.", "Fatigue is manageable."],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects an explanation that ends mid-sentence", () => {
    const parsed = safeParseDecisionOutput({
      decision: "MAINTAIN",
      explanation: ["Sleep is adequate.", "Nutrition is supportive, but this factor is only a"],
    });

    expect(parsed.success).toBe(false);
  });

  it("normalizes nullable callable response fields", () => {
    const parsed = safeParseDecisionOutput({
      decision: "MAINTAIN",
      headline: "Choose today's session.",
      todayAction: "Select a workout before requesting specific guidance.",
      explanation: ["Sleep is adequate.", "Fatigue is manageable."],
      caution: null,
      adjustments: null,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.caution).toBeUndefined();
      expect(parsed.data.adjustments).toBeUndefined();
    }
  });

  it("keeps deterministic exercise adjustments when reloading a saved plan", () => {
    const parsed = safeParseDecisionOutput({
      decision: "PULL_BACK",
      explanation: ["Recovery is limited.", "Lower-back discomfort affects hip hinges."],
      exerciseAdjustments: [{
        exerciseName: "Romanian Deadlift",
        action: "reduce",
        loadPct: -20,
        setDelta: -1,
        repsDelta: 0,
        targetRpe: 6,
        reason: "This movement overlaps with the reported lower-back discomfort.",
      }],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.exerciseAdjustments?.[0].loadPct).toBe(-20);
  });
});
