import { describe, expect, it } from "vitest";
import { applyDecisionGuardrails } from "./decisionGuardrails";
import type { DecisionInputs, DecisionOutput } from "./decisionTypes";

const output: DecisionOutput = {
  decision: "PUSH",
  headline: "You are ready to progress.",
  todayAction: "Add load conservatively.",
  explanation: ["Recovery is strong.", "Motivation is high."],
  adjustments: { intensityPct: 10 },
};

const inputs: DecisionInputs = {
  sleepHours: 8,
  sleepSource: "manual",
  sleepSampleAgeHours: null,
  soreness: 2,
  fatigue: 2,
  motivation: 9,
  trainingPhase: "Hypertrophy",
  dietPhase: "Maintain",
  plannedWorkout: { source: "draft", title: "Chest", exerciseNames: ["Bench Press"] },
};

describe("decision guardrails", () => {
  it("prevents PUSH when reported pain overlaps the workout", () => {
    const guarded = applyDecisionGuardrails(output, {
      ...inputs,
      dailyContext: {
        dateKey: "2026-10-07",
        pain: {
          area: "shoulder",
          side: "left",
          severity: "moderate",
          trigger: "pressing",
          note: null,
          affectsPlannedWorkout: true,
        },
        additionalActivity: null,
        note: null,
      },
    });
    expect(guarded.decision).toBe("PULL_BACK");
    expect(guarded.adjustments?.intensityPct).toBe(-10);
    expect(guarded.caution).toMatch(/sharp/i);
  });

  it("prevents PUSH after hard overlapping activity", () => {
    const guarded = applyDecisionGuardrails(output, {
      ...inputs,
      dailyContext: {
        dateKey: "2026-10-07",
        pain: null,
        additionalActivity: {
          type: "physical_work",
          timing: "yesterday",
          effort: "hard",
          duration: "over_2h",
          overlapsPlannedWorkout: true,
        },
        note: null,
      },
    });
    expect(guarded.decision).toBe("MAINTAIN");
    expect(guarded.adjustments).toBeUndefined();
  });

  it("turns a scheduled rest day into recovery guidance", () => {
    const guarded = applyDecisionGuardrails(output, {
      ...inputs,
      plannedWorkout: { source: "rest_day", title: "Rest", exerciseNames: [] },
    });
    expect(guarded.decision).toBe("MAINTAIN");
    expect(guarded.todayAction).toMatch(/rest day/i);
  });
});
