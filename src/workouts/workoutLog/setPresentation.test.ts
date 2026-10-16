import { describe, expect, it } from "vitest";
import { lastResistanceSet } from "./setPresentation";
import { notebookRowHeight, notebookDark, notebookPaper } from "../../ui/notebook/tokens";
describe("Notebook set presentation", () => {
  it("shows the corresponding load, reps and effort without changing stored values", () => {
    const set = { weightKg: 105, reps: "3", rpe: "10" };
    expect(lastResistanceSet(set, "kg", "rpe")).toBe("105 x 3 @ 10");
    expect(lastResistanceSet(set, "kg", "rir")).toBe("105 x 3 @ 0");
    expect(set.rpe).toBe("10");
  });
  it("converts Last into the displayed unit and preserves missing effort", () => {
    expect(lastResistanceSet({ weightKg: 10, reps: "5" }, "lbs", "rpe")).toBe("22.05 x 5");
    expect(lastResistanceSet({ weightKg: null, reps: "12" }, "kg", "rpe")).toBe("12");
    expect(lastResistanceSet({ weightKg: 0, reps: "12" }, "kg", "rpe")).toBe("12");
  });
  it("reserves a larger native row for enlarged text", () => {
    expect(notebookRowHeight(1)).toBe(52);
    expect(notebookRowHeight(2)).toBeGreaterThanOrEqual(180);
    expect(notebookRowHeight(3)).toBeGreaterThan(notebookRowHeight(2));
  });
  it("keeps default and dark primary text distinct from their backgrounds", () => {
    for (const colors of [notebookPaper, notebookDark]) expect(colors.primary).not.toBe(colors.onPrimary);
  });
});
