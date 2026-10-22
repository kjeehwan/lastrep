import { describe, expect, it } from "vitest";
import { centeredTimeIndex, wrapTimePart } from "./timeWheel";

describe("cyclic meal time selection", () => {
  it.each([24, 60])("wraps both boundaries and preserves values when recentering (%i)", count => {
    expect(wrapTimePart(count, count)).toBe(0);
    expect(wrapTimePart(-1, count)).toBe(count - 1);
    for (let index = -count; index < count * 6; index++) {
      const centered = centeredTimeIndex(index, count);
      expect(centered).toBeGreaterThanOrEqual(count * 2);
      expect(centered).toBeLessThan(count * 3);
      expect(wrapTimePart(centered, count)).toBe(wrapTimePart(index, count));
    }
  });
});
