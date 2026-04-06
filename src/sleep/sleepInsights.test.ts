import { describe, expect, it } from "vitest";
import { classifySleepVsTarget, getSleepDeltaText, getSleepRecoveryHint } from "./sleepInsights";

describe("sleepInsights", () => {
  it("classifies below/on/above target with tolerance", () => {
    expect(classifySleepVsTarget(6.0, 7.0)).toBe("below_target");
    expect(classifySleepVsTarget(7.2, 7.0)).toBe("on_target");
    expect(classifySleepVsTarget(7.7, 7.0)).toBe("above_target");
  });

  it("returns delta text", () => {
    expect(getSleepDeltaText(6.4, 7.0)).toBe("-0.6h vs target");
    expect(getSleepDeltaText(7.6, 7.0)).toBe("+0.6h vs target");
  });

  it("returns practical hint copy", () => {
    expect(getSleepRecoveryHint("below_target", 40)).toContain("below target");
    expect(getSleepRecoveryHint("above_target", 80)).toContain("exceeded target");
    expect(getSleepRecoveryHint(null, 80)).toContain("consistency");
  });
});
