import { describe, expect, it } from "vitest";
import { effortInputValue } from "../effortScale";
import { freshSetEffort } from "./freshSetEffort";

describe("fresh set effort", () => {
  it("clears historical RPE and cached RIR without altering load or reps", () => {
    const history = { weightKg: 105, reps: "3", rpe: "10", effortInput: { scale: "rir" as const, value: "0", canonicalRpe: "10" } };
    const fresh = { ...history, ...freshSetEffort() };
    expect(fresh.weightKg).toBe(105);
    expect(fresh.reps).toBe("3");
    expect(effortInputValue(fresh, "rpe")).toBe("");
    expect(effortInputValue(fresh, "rir")).toBe("");
    expect(history.rpe).toBe("10");
  });
});
