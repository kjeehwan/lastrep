import { expect, it } from "vitest";
import { parseManualMeasurement } from "./manualMeasurement";
it("keeps sparse measurements separate and converts pounds", () => {
  expect(parseManualMeasurement({ weightKg: "220.46226218", bodyFatPercent: "", leanBodyMassKg: "", skeletalMuscleMassKg: "" }, "lbs").weightKg).toBeCloseTo(100);
  expect(parseManualMeasurement({ leanBodyMassKg: "60", skeletalMuscleMassKg: "30" }, "kg")).toEqual({ leanBodyMassKg: 60, skeletalMuscleMassKg: 30 });
});
it("rejects empty, malformed and out-of-range entries", () => {
  for (const value of ["", "bad", "-1", "101"]) expect(() => parseManualMeasurement({ bodyFatPercent: value }, "kg")).toThrow();
});
it("converts all mass fields from pounds, leaving percentages unchanged", () => {
  const result = parseManualMeasurement({ weightKg: "220.46226218", leanBodyMassKg: "176.369809744", skeletalMuscleMassKg: "88.184904872", bodyFatPercent: "20" }, "lbs");
  expect(result.weightKg).toBeCloseTo(100);
  expect(result.leanBodyMassKg).toBeCloseTo(80);
  expect(result.skeletalMuscleMassKg).toBeCloseTo(40);
  expect(result.bodyFatPercent).toBe(20);
  expect(parseManualMeasurement({ weightKg: "80.15" }, "kg").weightKg).toBe(80.15);
});
