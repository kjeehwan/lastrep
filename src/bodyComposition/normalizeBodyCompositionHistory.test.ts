import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import { normalizeBodyCompositionHistory } from "./normalizeBodyCompositionHistory";

const date = Timestamp.fromMillis(1000);

describe("shared body history normalization", () => {
  it("handles empty or malformed account history", () => {
    expect(normalizeBodyCompositionHistory(undefined)).toEqual([]);
    expect(normalizeBodyCompositionHistory([null, 42, {}, { source: "health", recordedAt: "yesterday" }])).toEqual([]);
  });
  it("preserves lean mass and manual skeletal muscle without relabeling legacy health records", () => {
    const history = normalizeBodyCompositionHistory([
      { source: "health", recordedAt: date, leanBodyMassKg: 65, muscleMassKg: 38 },
      { source: "manual", recordedAt: date, muscleMassKg: 37 },
    ]);
    expect(history[0]).toMatchObject({ source: "manual", skeletalMuscleMassKg: 37, legacyMuscleMassKg: null });
    expect(history[1]).toMatchObject({ leanBodyMassKg: 65, skeletalMuscleMassKg: null, legacyMuscleMassKg: 38 });
  });
  it("sorts newest first, validates values and caps history at 400", () => {
    const history = normalizeBodyCompositionHistory(Array.from({ length: 405 }, (_, index) => ({
      source: "health", recordedAt: Timestamp.fromMillis(index), weightKg: 80.26,
      bodyFatPercent: 101, leanBodyMassKg: -1, skeletalMuscleMassKg: NaN,
    })));
    expect(history).toHaveLength(400);
    expect(history[0].recordedAt?.toMillis()).toBe(404);
    expect(history[0]).toMatchObject({ weightKg: 80.26, bodyFatPercent: null, leanBodyMassKg: null, skeletalMuscleMassKg: null });
  });
});
