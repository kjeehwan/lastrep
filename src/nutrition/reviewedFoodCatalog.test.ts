import { expect, it } from "vitest";
import review from "./data/reviewedFoodCatalog.json";
import { reviewedFoods, reviewedFoodMetadata } from "./reviewedFoodCatalog";
import { auditFoodCatalog } from "../../scripts/audit-food-catalog.mjs";
import { foodQuery, rankFoodMatches } from "./foodSearchRanking";

it("preserves label-serving nutrition when converting reviewed additions to the per-100g model", () => {
  for (const source of review.additions) {
    const food = reviewedFoods.find(row => row.id === source.id)!;
    expect(food.servingGrams).toBe(source.label.servingGrams);
    const ratio = food.servingGrams / 100;
    expect(food.caloriesPer100g * ratio).toBeCloseTo(source.label.calories, 8);
    expect(food.proteinPer100g * ratio).toBeCloseTo(source.label.proteinGrams, 8);
    expect(food.carbsPer100g! * ratio).toBeCloseTo(source.label.carbsGrams, 8);
    expect(food.fatPer100g! * ratio).toBeCloseTo(source.label.fatGrams, 8);
  }
});
it("has provenance, valid references and required staple coverage without replacing existing IDs", () => {
  const report = auditFoodCatalog();
  expect(report.errors).toEqual([]);
  expect(report.addedRecords).toBe(2);
  expect(report.coverage.find((row: { query: string; status: string }) => row.query === "Cheerios Original")?.status).toBe("present");
});
it("excludes the suspect water record from new search without changing the original object", () => {
  const suspect = { ...reviewedFoods.find(row => row.id === "usda-173647")!, id: "off-0039759076110", name: "Water", caloriesPer100g: 19.7, carbsPer100g: 4.93 };
  const original = structuredClone(suspect);
  expect(reviewedFoodMetadata(suspect.id)?.searchable).toBe(false);
  expect(rankFoodMatches([suspect, ...reviewedFoods], foodQuery("water"), 20).map(row => row.id)).toEqual(["usda-173647"]);
  expect(suspect).toEqual(original);
});
