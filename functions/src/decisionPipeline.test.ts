import { describe, expect, it } from "vitest";
import { heuristicDecision } from "./decisionHeuristic";
import { parseAndSanitizeDecisionOutputText, sanitizeDecisionOutput } from "./decisionPipeline";
import type { DecisionInputs } from "./decisionTypes";

const baseInputs: DecisionInputs = {
  sleepHours: 7,
  sleepSource: "manual",
  sleepSampleAgeHours: null,
  soreness: 4,
  fatigue: 4,
  motivation: 7,
  trainingPhase: "Hypertrophy",
  dietPhase: "Maintain",
};

const toJson = (value: unknown) => JSON.stringify(value);

describe("decisionPipeline golden cases", () => {
  it("heuristic PUSH (+20) stays valid", () => {
    const output = heuristicDecision({ ...baseInputs, sleepHours: 8, fatigue: 2, motivation: 9 });
    const parsed = sanitizeDecisionOutput(output);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.decision).toBe("PUSH");
    expect(parsed.data.adjustments?.intensityPct).toBe(20);
  });

  it("heuristic MAINTAIN has no adjustments", () => {
    const output = heuristicDecision({ ...baseInputs, sleepHours: 7, fatigue: 5, motivation: 5 });
    const parsed = sanitizeDecisionOutput(output);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.decision).toBe("MAINTAIN");
    expect(parsed.data.adjustments).toBeUndefined();
  });

  it("heuristic PULL_BACK (-20) stays valid", () => {
    const output = heuristicDecision({ ...baseInputs, sleepHours: 4, fatigue: 8, soreness: 7 });
    const parsed = sanitizeDecisionOutput(output);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.decision).toBe("PULL_BACK");
    expect(parsed.data.adjustments?.intensityPct).toBe(-20);
  });

  it("downgrades a strong-recovery day to MAINTAIN when recent intake trails target", () => {
    const output = heuristicDecision({
      ...baseInputs,
      sleepHours: 8,
      fatigue: 2,
      motivation: 9,
      nutrition: {
        caloriesConsumedToday: 0,
        proteinGramsToday: null,
        calorieTarget: 2200,
        yesterdayCalories: 1700,
        yesterdayAdherence: "below_target",
        recentAdherence: "below_target",
        recentCompletedDaysTracked: 4,
      },
    });
    const parsed = sanitizeDecisionOutput(output);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.decision).toBe("MAINTAIN");
    expect(parsed.data.adjustments).toBeUndefined();
  });

  it("does not penalize zero same-day calories when completed days are on target", () => {
    const output = heuristicDecision({
      ...baseInputs,
      sleepHours: 8,
      fatigue: 2,
      soreness: 2,
      motivation: 9,
      nutrition: {
        caloriesConsumedToday: 0,
        proteinGramsToday: null,
        calorieTarget: 2200,
        yesterdayCalories: 2200,
        yesterdayAdherence: "on_target",
        recentAdherence: "on_target",
        recentCompletedDaysTracked: 5,
      },
    });
    const parsed = sanitizeDecisionOutput(output);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.decision).toBe("PUSH");
  });

  it("keeps PUSH conservative in a cut when recovery is strong and nutrition is on target", () => {
    const output = heuristicDecision({
      ...baseInputs,
      dietPhase: "Cut",
      sleepHours: 8,
      fatigue: 2,
      soreness: 2,
      motivation: 9,
      nutrition: {
        caloriesConsumedToday: 0,
        proteinGramsToday: null,
        calorieTarget: 2200,
        yesterdayCalories: 2200,
        yesterdayAdherence: "on_target",
        recentAdherence: "on_target",
        recentCompletedDaysTracked: 5,
      },
    });
    const parsed = sanitizeDecisionOutput(output);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.decision).toBe("PUSH");
    expect(parsed.data.adjustments?.intensityPct).toBe(10);
  });

  it("mocked OPENAI PUSH (+10) stays valid", () => {
    const parsed = parseAndSanitizeDecisionOutputText(
      toJson({
        decision: "PUSH",
        explanation: ["Bullet 1", "Bullet 2"],
        adjustments: { intensityPct: 10 },
      })
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.adjustments?.intensityPct).toBe(10);
  });

  it("mocked OPENAI PULL_BACK (-10) stays valid", () => {
    const parsed = parseAndSanitizeDecisionOutputText(
      toJson({
        decision: "PULL_BACK",
        explanation: ["Bullet 1", "Bullet 2"],
        adjustments: { intensityPct: -10 },
      })
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.adjustments?.intensityPct).toBe(-10);
  });

  it("MAINTAIN strips adjustments and forbidden volumePct", () => {
    const parsed = sanitizeDecisionOutput({
      decision: "MAINTAIN",
      explanation: ["Bullet 1", "Bullet 2"],
      adjustments: { intensityPct: 20, volumePct: 20 },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.decision).toBe("MAINTAIN");
    expect(parsed.data.adjustments).toBeUndefined();
  });

  it("caps explanation bullets at 4", () => {
    const parsed = sanitizeDecisionOutput({
      decision: "PUSH",
      explanation: ["One", "Two", "Three", "Four", "Five"],
      adjustments: { intensityPct: 20 },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.explanation.length).toBe(4);
  });

  it("caps each bullet to 140 chars", () => {
    const long = "x".repeat(200);
    const parsed = sanitizeDecisionOutput({
      decision: "PUSH",
      explanation: [long, "Two"],
      adjustments: { intensityPct: 20 },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.explanation[0].length).toBeLessThanOrEqual(140);
  });

  it("truncates long bullets without trailing ellipsis", () => {
    const long =
      "Recovery is solid overall, and motivation is high, but this sentence is intentionally too long to fit the bullet limit cleanly.";
    const parsed = sanitizeDecisionOutput({
      decision: "PUSH",
      explanation: [long, "Nutrition remains supportive."],
      adjustments: { intensityPct: 10 },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.explanation[0].endsWith("...")).toBe(false);
  });

  it("caps total explanation chars to 600", () => {
    const long = "x".repeat(200);
    const parsed = sanitizeDecisionOutput({
      decision: "PULL_BACK",
      explanation: [long, long, long, long],
      adjustments: { intensityPct: -20 },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const total = parsed.data.explanation.reduce((sum, item) => sum + item.length, 0);
    expect(total).toBeLessThanOrEqual(600);
  });

  it("rejects malformed output", () => {
    const parsed = sanitizeDecisionOutput({
      decision: "PUSH",
      explanation: ["Only one bullet"],
      adjustments: { intensityPct: 999 },
    });
    expect(parsed.ok).toBe(false);
  });

  it("humanizes nutrition adherence enums in explanations", () => {
    const parsed = sanitizeDecisionOutput({
      decision: "MAINTAIN",
      explanation: [
        "Completed-day nutrition adherence is on_target.",
        "Recovery is otherwise steady.",
      ],
      adjustments: null,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.explanation[0]).toContain("on target");
    expect(parsed.data.explanation[0]).not.toContain("on_target");
  });

  it("collapses duplicate nutrition bullets when other context exists", () => {
    const parsed = sanitizeDecisionOutput({
      decision: "MAINTAIN",
      explanation: [
        "Completed-day nutrition adherence is on_target.",
        "Recent calorie intake has stayed close to target.",
        "Motivation is high.",
      ],
      adjustments: null,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.explanation).toEqual([
      "Completed-day nutrition adherence is on target.",
      "Motivation is high.",
    ]);
  });

  it("humanizes sleep sample age phrasing in explanations", () => {
    const parsed = sanitizeDecisionOutput({
      decision: "MAINTAIN",
      explanation: ["Sleep sample age ~3.5h is recent.", "Recovery is otherwise steady."],
      adjustments: null,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.explanation[0]).toContain("recorded about 3.5h ago");
    expect(parsed.data.explanation[0]).not.toContain("age ~3.5h");
  });
});
