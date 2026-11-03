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
  it("considers a relevant second pain report even when the legacy primary report is unrelated",()=>{
    const unrelated={area:"knee" as const,side:"left" as const,severity:"mild" as const,trigger:"squatting" as const,note:null,affectsPlannedWorkout:false};
    const relevant={...unrelated,area:"shoulder" as const,severity:"severe" as const,trigger:"pressing" as const,affectsPlannedWorkout:true};
    expect(applyDecisionGuardrails(output,{...inputs,dailyContext:{dateKey:"2026-11-02",pain:unrelated,pains:[unrelated,relevant],additionalActivity:null,note:null}})).toMatchObject({decision:"PULL_BACK",adjustments:{intensityPct:-20}});
  });
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
