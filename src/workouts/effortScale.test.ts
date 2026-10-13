import { describe, expect, it } from "vitest";
import { effortInputValue, effortToRpe, formatEffort, isValidWorkoutEffort, resolveEffortScale, rpeToEffort } from "./effortScale";

describe("global effort scale", () => {
  it("accepts optional RPE 6-10 and equivalent RIR 0-4, including decimals", () => {
    for (const value of ["", "6", "8.5", "10"]) expect(isValidWorkoutEffort(value)).toBe(true);
    for (const value of ["5.5", "10.5", "abc", "."]) expect(isValidWorkoutEffort(value)).toBe(false);
    for (const value of ["0", "2.5", "4"]) expect(isValidWorkoutEffort(effortToRpe(value, "rir"))).toBe(true);
    for (const value of ["-1", "4.5", "5"]) expect(isValidWorkoutEffort(effortToRpe(value, "rir"))).toBe(false);
    expect(formatEffort(5, "rpe")).toBe(" @ RPE 5");
    expect(formatEffort(5, "rir")).toBe(" @ RIR 5");
  });
  it("defaults old profiles to RPE", () => {
    expect(resolveEffortScale(undefined)).toBe("rpe");
    expect(resolveEffortScale("unknown")).toBe("rpe");
    expect(resolveEffortScale("rir")).toBe("rir");
  });
  it("converts RIR at the boundary while keeping canonical history in RPE", () => {
    expect(effortToRpe("2", "rir")).toBe("8");
    expect(rpeToEffort("8", "rir")).toBe("2");
    expect(effortToRpe("0", "rir")).toBe("10");
    expect(rpeToEffort("10", "rir")).toBe("0");
    expect(effortToRpe("9", "rir")).toBe("1");
    expect(effortToRpe("1.5", "rir")).toBe("8.5");
    expect(formatEffort(10, "rir")).toBe(" @ RIR 0");
    expect(formatEffort(8, "rpe")).toBe(" @ RPE 8");
  });
  it("preserves partial decimal input without confusing a preference change or copied Last set", () => {
    const set = { rpe: "8", effortInput: { scale: "rir" as const, value: "2.", canonicalRpe: "8" } };
    expect(effortInputValue(set, "rir")).toBe("2.");
    expect(effortInputValue(set, "rpe")).toBe("8");
    expect(effortInputValue({ ...set, rpe: "9" }, "rir")).toBe("1");
  });
  it("keeps blank ratings blank and invalid input invalid for save validation", () => {
    expect(effortToRpe("", "rir")).toBe("");
    expect(rpeToEffort(null, "rir")).toBe("");
    expect(rpeToEffort("", "rir")).toBe("");
    expect(effortToRpe("11", "rir")).toBe("-1");
    expect(effortToRpe("abc", "rir")).toBe("abc");
    expect(effortToRpe("1,5", "rir")).toBe("8.5");
  });
});
