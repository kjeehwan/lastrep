import { describe, expect, it } from "vitest";
import { adjacentDiaryDate, foodNamesBySection, macroLabelCenters, macroPercentages } from "./notebookPresentation";

describe("nutrition notebook presentation", () => {
  it("keeps macro percentages at 100 without inventing intake", () => {
    expect(macroPercentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(macroPercentages([0, 0, 0])).toEqual([0, 0, 0]);
    expect(macroPercentages([NaN, -1, 9])).toEqual([0, 0, 100]);
    for (let p = 1; p < 100; p++) expect(macroPercentages([p, 41, 39]).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("moves between calendar days across months and years", () => {
    expect(adjacentDiaryDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(adjacentDiaryDate("2028-03-01", -1)).toBe("2028-02-29");
  });
  it("keeps narrow macro labels inside the bar without collisions", () => {
    const centers = macroLabelCenters([0.01, 0.98, 0.01], 300, 72);
    expect(centers[0]).toBeGreaterThanOrEqual(36);
    expect(centers[2]).toBeLessThanOrEqual(264);
    expect(centers[1] - centers[0]).toBeGreaterThanOrEqual(72);
    expect(centers[2] - centers[1]).toBeGreaterThanOrEqual(72);
  });
});


it("lists actual foods by persistent meal ID without changing order or collapsing duplicates", () => {
  const meals = [{ name: "Oats", mealSection: "Breakfast" }, { name: "Milk", mealSection: "Breakfast" }, { name: "Rice", mealSection: "Lunch" }, { name: "Oats", mealSection: null }];
  const names = foodNamesBySection(meals);
  expect(names.get("Breakfast")).toEqual(["Oats", "Milk", "Oats"]);
  expect(names.get("Lunch")).toEqual(["Rice"]);
  expect(names.has("Dinner")).toBe(false);
  expect(meals[0].name).toBe("Oats");
});
