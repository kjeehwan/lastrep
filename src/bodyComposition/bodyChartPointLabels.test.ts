import { expect, it } from "vitest";
import { bodyChartPointLabels } from "./bodyChartPointLabels";

it("keeps well-spaced values directly above their observations", () => {
  const result = bodyChartPointLabels([{ key: "a", x: 32, y: 80, label: "87.6" }, { key: "b", x: 96, y: 100, label: "88.1" }]);
  expect(result.map(label => label.y)).toEqual([68, 88]);
});
it("separates dense neighboring values, including pounds and enlarged text", () => {
  for (const scale of [1, 2]) {
    const points = Array.from({ length: 20 }, (_, i) => ({ key: String(i), x: (32 + i * 24) * scale, y: (80 + i % 4) * scale, label: "193.4" }));
    const labels = bodyChartPointLabels(points, scale);
    for (let i = 0; i < labels.length; i++) {
      expect(labels[i].y).toBeLessThan(points[i].y);
      for (let j = 0; j < i; j++) {
        const a = labels[i], b = labels[j];
        const separated = Math.abs(a.x - b.x) >= (a.width + b.width) / 2 + 4 * scale || Math.abs(a.y - b.y) >= 18 * scale;
        expect(separated).toBe(true);
      }
    }
  }
});
