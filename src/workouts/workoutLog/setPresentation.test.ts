import { describe, expect, it } from "vitest";
import { lastResistanceSet, setRowPresentation } from "./setPresentation";
import { notebookRowHeight, notebookDark, notebookPaper } from "../../ui/notebook/tokens";
describe("Notebook set presentation", () => {
  it("keeps Last in working-set order when today's roles differ",()=>{
    const previous=[{setType:"top",weightKg:130},{setType:"backoff",weightKg:110},{setType:"backoff",weightKg:105}];
    expect(setRowPresentation([{setType:"backoff"},{setType:"normal"},{setType:"top"}],previous)).toEqual([
      {marker:"B",previous:previous[0]},{marker:"2",previous:previous[1]},{marker:"T",previous:previous[2]}
    ]);
  });
  it("preserves previous load, reps and RPE through partial relabelling and reversion",()=>{
    const previous = Object.freeze([
      Object.freeze({setType:"warmup",weightKg:60,reps:"5",rpe:""}),
      Object.freeze({setType:"normal",weightKg:170,reps:"5",rpe:"8"}),
      Object.freeze({setType:"normal",weightKg:145,reps:"6",rpe:"9"}),
      Object.freeze({setType:"normal",weightKg:145,reps:"6",rpe:"10"}),
    ]);
    for (const roles of [["normal","normal","normal"],["top","normal","normal"],["top","backoff","backoff"],["normal","normal","normal"]]) {
      const rows = setRowPresentation([{setType:"warmup"},...roles.map(setType=>({setType}))],[...previous]);
      expect(rows[0].previous).toBeUndefined();
      expect(rows.slice(1).map(row=>row.previous)).toEqual(previous.slice(1));
      expect(rows.slice(1).map(row=>lastResistanceSet(row.previous!,"kg","rpe"))).toEqual(["170 x 5 @ 8","145 x 6 @ 9","145 x 6 @ 10"]);
    }
  });
  it("leaves extra sets blank and does not fabricate missing historical effort",()=>{
    const rows = setRowPresentation([{setType:"top"},{setType:"backoff"}],[{setType:"normal",weightKg:170,reps:"5"}]);
    expect(lastResistanceSet(rows[0].previous!,"kg","rpe")).toBe("170 x 5");
    expect(rows[1].previous).toBeUndefined();
  });
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
    expect(notebookRowHeight(1)).toBeGreaterThanOrEqual(48 + 4 + 4); // input, row padding, row margin
    expect(notebookRowHeight(2)).toBeGreaterThanOrEqual(180);
    expect(notebookRowHeight(3)).toBeGreaterThan(notebookRowHeight(2));
  });
  it("keeps default and dark primary text distinct from their backgrounds", () => {
    for (const colors of [notebookPaper, notebookDark]) expect(colors.primary).not.toBe(colors.onPrimary);
  });
});
