import { describe, expect, it } from "vitest";
import { resolveDecisionSleepInput } from "./resolveDecisionSleepInput";

describe("resolveDecisionSleepInput", () => {
  it("uses fresh health sleep when available", () => {
    const resolved = resolveDecisionSleepInput(6.5, {
      source: "health",
      latestSleepHours: 7.8,
      sampleAgeHours: 2.4,
    });

    expect(resolved).toEqual({
      sleepHours: 7.8,
      sleepSource: "health",
      sleepSampleAgeHours: 2.4,
      shouldPersistManualSample: false,
    });
  });

  it("falls back to manual sleep when health sample is stale", () => {
    const resolved = resolveDecisionSleepInput(6.5, {
      source: "health",
      latestSleepHours: 7.8,
      sampleAgeHours: 40.1,
    });

    expect(resolved).toEqual({
      sleepHours: 6.5,
      sleepSource: "manual",
      sleepSampleAgeHours: 0,
      shouldPersistManualSample: true,
    });
  });

  it("falls back to manual sleep when health sleep is missing", () => {
    const resolved = resolveDecisionSleepInput(6.5, {
      source: "health",
      latestSleepHours: null,
      sampleAgeHours: null,
    });

    expect(resolved).toEqual({
      sleepHours: 6.5,
      sleepSource: "manual",
      sleepSampleAgeHours: 0,
      shouldPersistManualSample: true,
    });
  });
});
