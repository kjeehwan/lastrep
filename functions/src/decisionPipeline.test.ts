import { describe, expect, it } from "vitest";
import { heuristicDecision } from "./decisionHeuristic";
import { parseAndSanitizeDecisionOutputText, sanitizeDecisionOutput } from "./decisionPipeline";
import type { DecisionInputs } from "./decisionTypes";

const baseInputs: DecisionInputs = {
  sleepHours: 7,
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
});
