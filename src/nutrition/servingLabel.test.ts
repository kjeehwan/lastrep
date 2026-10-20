import { expect, it } from "vitest";
import { formatServingLabel, normalizeServingInfo } from "./servingLabel";

it.each([
  ["1 1/2 cups (39 g)", "1.5 cups (39 g)"], ["1/2 cup", "0.5 cup"],
  ["2 3/4 scoops", "2.75 scoops"], ["1/8 tsp", "0.125 tsp"],
  ["1/10000 tsp", "0.0001 tsp"],
  ["½ cup", "0.5 cup"], ["1½ cups", "1.5 cups"], ["1 ½ cups", "1.5 cups"],
  ["1\u00a0½ cups", "1.5 cups"], ["1\u202f1/2 cups", "1.5 cups"],
  ["⅔ cup", "0.667 cup"], ["1⁄4 cup", "0.25 cup"], ["1/2cup", "0.5cup"],
  ["1.5 cups", "1.5 cups"], ["100 g", "100 g"], ["1 serving", "1 serving"],
  ["1/0 cup", "1/0 cup"], ["10/20/2026", "10/20/2026"], ["B12/6", "B12/6"],
])("formats serving quantities without changing unrelated label text: %s", (source, expected) => {
  expect(formatServingLabel(source)).toBe(expected);
});
it.each([
  ["1 1/2 cups (39 g)", 39, "1.5 cups"], ["39 g (1 1/2 cups)", 39, "1.5 cups"],
  ["30 g (½ cup)", 30, "0.5 cup"], ["1/3 cup (28 g)", 28, "0.333 cup"],
  ["100 g", 100, "1 serving"], ["", 39, "1 serving"], [null, 39, "1 serving"],
] as const)("normalizes both label layouts for display: %s", (source, grams, expected) => {
  expect(normalizeServingInfo(source, grams)).toBe(expected);
});
