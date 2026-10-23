import { describe, expect, it } from "vitest";
import { defaultWarmupPattern, insertWarmupSets, orderedWarmupRows, readWarmupPattern, suggestWarmupRows, unmatchedWarmups, warmupKg, warmupKey, warmupPatternFromRows, warmupValidation, type WarmupRow } from "./warmupSets";
import { setRowPresentation } from "./setPresentation";

describe("warm-up helper", () => {
  const example = () => suggestWarmupRows(100, "kg", defaultWarmupPattern(true, "kg"));
  it("uses the approved editable example and adapts the actual last-used setup", () => {
    expect(example().map(row => [row.weight, row.reps])).toEqual([["20", "4"], ["60", "4"], ["80", "2"]]);
    const pattern = warmupPatternFromRows(example(), 100, "kg");
    expect(suggestWarmupRows(120, "kg", pattern).map(row => row.weight)).toEqual(["20", "70", "95"]);
    expect(suggestWarmupRows(120, "kg", warmupPatternFromRows(example().slice(0, 2), 100, "kg"))).toHaveLength(2);
  });
  it("rounds proportional rows to the exercise's available weights", () => {
    expect(suggestWarmupRows(100, "kg", defaultWarmupPattern(true, "kg"), { mode: "custom", unit: "kg", values: [20, 50, 75, 100] }).map(row => row.weight)).toEqual(["20", "50", "75"]);
    expect(suggestWarmupRows(10, "kg", defaultWarmupPattern(true, "kg")).every(row => Number(row.weight) <= 10)).toBe(true);
  });
  it("keeps fixed weights in canonical kg across unit changes", () => {
    const pattern = warmupPatternFromRows(example(), 100, "kg");
    const pounds = suggestWarmupRows(100, "lbs", pattern);
    expect(warmupKg(Number(pounds[0].weight), "lbs")).toBeCloseTo(20, 2);
    expect(suggestWarmupRows(warmupKg(225, "lbs"), "lbs", defaultWarmupPattern(true, "lbs")).map(row => row.weight)).toEqual(["45", "135", "180"]);
  });
  it("inserts only new rows and preserves every existing value and completion flag", () => {
    const existing = [{ weightKg: 20, reps: "4", setType: "warmup", done: true, note: "retained" }, { weightKg: 100, reps: "8", setType: "normal", done: false, rpe: "8", baselineWeightKg: 95 }];
    const snapshot = structuredClone(existing);
    const { kept, additions } = unmatchedWarmups(example(), existing, "kg");
    expect(kept).toHaveLength(1); expect(additions).toHaveLength(2);
    const next = insertWarmupSets(existing, additions, "kg");
    expect(existing).toEqual(snapshot); expect(next[0]).toBe(existing[0]); expect(next[3]).toBe(existing[1]);
    expect(next.slice(1, 3).map(set => [set.weightKg, set.done, set.setType])).toEqual([[60, false, "warmup"], [80, false, "warmup"]]);
    expect(unmatchedWarmups(example(), next, "kg").additions).toHaveLength(0);
  });
  it("matches repeated warm-up rows by occurrence", () => {
    const row = example()[0];
    expect(unmatchedWarmups([row, row], [{ weightKg: 20, reps: "4", setType: "warmup", done: false }], "kg").additions).toHaveLength(1);
  });
  it("allows intentionally added rows to repeat an existing warm-up", () => {
    const existing = [{ weightKg: 20, reps: "4", setType: "warmup", done: false }];
    const manual = { ...example()[0], id: "manual-repeat" };
    const { additions } = unmatchedWarmups([example()[0], manual], existing, "kg");
    expect(additions).toEqual([manual]);
    expect(insertWarmupSets(existing, additions, "kg")).toHaveLength(2);
  });
  it("retains the ramp order when only a middle suggestion already exists", () => {
    const { kept, additions } = unmatchedWarmups(example(), [{ weightKg: 60, reps: "4", setType: "warmup", done: false }], "kg");
    expect(orderedWarmupRows(kept, additions).map(row => row.weight)).toEqual(["20", "60", "80"]);
  });
  it("numbers working sets independently and never attaches Last to warm-ups", () => {
    const sets = [{ setType: "warmup" }, { setType: "warmup" }, { setType: "normal" }, { setType: "failure" }, { setType: "normal" }];
    const previous = [{ setType: "warmup", weightKg: 20 }, { setType: "normal", weightKg: 90 }, { setType: "normal", weightKg: 85 }, { setType: "normal", weightKg: 80 }];
    const rows = setRowPresentation(sets, previous);
    expect(rows.map(row => row.marker)).toEqual(["W", "W", "1", "F", "3"]);
    expect(rows.map(row => row.previous?.weightKg)).toEqual([undefined, undefined, 90, 85, 80]);
  });
  it("rejects missing, nonfinite, incomplete, negative and excessive inputs", () => {
    expect(suggestWarmupRows(0, "kg", defaultWarmupPattern(true, "kg"))).toEqual([]);
    expect(warmupValidation(example(), 100, "kg")).toBeNull();
    const bad: Partial<WarmupRow>[] = [{ weight: "" }, { weight: "-2" }, { weight: "Infinity" }, { weight: "101" }, { weight: "2e1" }, { reps: "1.5" }, { reps: "0" }];
    for (const patch of bad) expect(warmupValidation([{ ...example()[0], ...patch }], 100, "kg")).toBeTruthy();
    expect(warmupValidation([], 100, "kg")).toBeTruthy();
    for (const raw of [null, "invalid", "[null]", '[{"mode":"ratio","ratio":2,"reps":4}]']) expect(readWarmupPattern(raw)).toBeNull();
    expect(readWarmupPattern(JSON.stringify(warmupPatternFromRows(example(), 100, "kg")))).toHaveLength(3);
  });
  it("isolates remembered choices by account and normalized exercise, not display unit", () => {
    expect(warmupKey("a", " Bench  Press ")).toBe(warmupKey("a", "bench press"));
    expect(warmupKey("a", "bench press")).not.toBe(warmupKey("b", "bench press"));
    expect(warmupKey("a", "bench press")).not.toBe(warmupKey("a", "squat"));
  });
});
