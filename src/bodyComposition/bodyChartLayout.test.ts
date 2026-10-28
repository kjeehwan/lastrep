import { describe, expect, it } from "vitest";
import { bodyChartLayout } from "./bodyChartLayout";

describe("body chart observation layout", () => {
  it.each([280, 310, 350, 700])("right-aligns one or two points within a %s-wide viewport", width => {
    for (const count of [1, 2]) {
      const layout = bodyChartLayout(count, width);
      expect(layout.width).toBe(width);
      expect(layout.positions.at(-1)).toBe(width - layout.padding);
      expect(layout.positions[0]).toBeGreaterThanOrEqual(layout.padding);
    }
  });
  it("keeps complete label and touch-target padding at both ends of long histories", () => {
    const layout = bodyChartLayout(30, 310);
    expect(layout.width).toBeGreaterThan(310);
    expect(layout.positions[0]).toBe(layout.padding);
    expect(layout.width - layout.positions.at(-1)!).toBe(layout.padding);
    expect(layout.positions[1] - layout.positions[0]).toBe(64);
  });
  it("retains edge padding with enlarged text", () => {
    const layout = bodyChartLayout(2, 310, 2);
    expect(layout.positions[0]).toBeGreaterThanOrEqual(88);
    expect(layout.width - layout.positions[1]).toBe(88);
  });
});
