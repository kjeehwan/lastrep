import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import type { NutritionMeal } from "../contracts";
import { quantityGrams, quantityValue, recordedMealGrams, selectedFoodSummary } from "./foodQuantity";

const density = { servingGrams: 164, caloriesPer100g: 116 };
function oatmeal(source: Partial<NonNullable<NutritionMeal["source"]>> = {}, calories = 190): NutritionMeal {
  return { id: "meal", name: "Oatmeal", calories, proteinGrams: 5, loggedAt: Timestamp.now(), updatedAt: Timestamp.now(),
    source: { ...density, mode: "servings", value: "1", ...source } };
}
describe("food editor quantities", () => {
  it("summarizes the confirmed selection rather than the reference serving", () => {
    const food = { servingGrams: 100, caloriesPer100g: 130 };
    expect(selectedFoodSummary({ food, mode: "grams", value: "200" })).toBe("200g / 260 kcal / 2 servings");
    expect(selectedFoodSummary({ food, mode: "calories", value: "260" })).toBe("200g / 260 kcal / 2 servings");
    expect(selectedFoodSummary({ food, mode: "servings", value: "2" })).toBe("200g / 260 kcal / 2 servings");
    expect(selectedFoodSummary({ food, mode: "servings", value: "1" })).toBe("100g / 130 kcal / 1 serving");
    expect(selectedFoodSummary({ food, mode: "grams", value: "200.25" })).toBe("200.25g / 260 kcal / 2 servings");
    expect(selectedFoodSummary({ food, mode: "grams", value: "" })).toBeNull();
  });
  it("opens one recorded serving in grams, not 1 gram", () => {
    const grams = recordedMealGrams(oatmeal());
    expect(grams).toBe(164);
    expect(quantityValue(grams, "grams", density)).toBe("164");
    expect(quantityValue(grams, "servings", density)).toBe("1");
    expect(quantityValue(grams, "calories", density)).toBe("190.24");
  });
  it("preserves recorded gram amounts despite rounded saved calories", () => {
    expect(recordedMealGrams(oatmeal({ mode: "grams", value: "164.25" }, 191))).toBe(164.25);
  });
  it("converts a calorie-based entry to its equivalent grams", () => {
    const grams = recordedMealGrams(oatmeal({ mode: "calories", value: "190" }));
    expect(grams).toBeCloseTo(163.793103, 6);
    expect(quantityValue(grams, "calories", density)).toBe("190");
  });
  it("falls back to saved calories for missing or stale source quantities", () => {
    expect(recordedMealGrams(oatmeal({ mode: null, value: null }))).toBeCloseTo(190 / 116 * 100);
    expect(recordedMealGrams(oatmeal({ value: "1" }, 380))).toBeCloseTo(380 / 116 * 100);
  });
  it("displays edited draft amounts in all units, not the original recorded amount", () => {
    const grams = quantityGrams("200", "grams", density);
    expect(quantityValue(grams, "calories", density)).toBe("232");
    expect(quantityValue(grams, "servings", density)).toBe("1.219512");
    expect(quantityValue(grams, "grams", density)).toBe("200");
  });
  it("keeps a canonical gram quantity across repeated display-unit switches", () => {
    const grams = quantityGrams("1.25", "servings", density);
    for (let cycle = 0; cycle < 20; cycle++) {
      expect(quantityValue(grams, "grams", density)).toBe("205");
      expect(quantityValue(grams, "calories", density)).toBe("237.8");
      expect(quantityValue(grams, "servings", density)).toBe("1.25");
    }
  });
  it("does not substitute one serving for an empty or invalid draft", () => {
    for (const raw of ["", "abc", "0", "-1", "Infinity"]) {
      expect(quantityGrams(raw, "grams", density)).toBeNull();
      expect(quantityValue(quantityGrams(raw, "grams", density), "servings", density)).toBe("");
    }
  });
  it("supports recorded zero-calorie amounts but cannot infer grams from calories alone", () => {
    const zero = oatmeal({ caloriesPer100g: 0, mode: "grams", value: "330" }, 0);
    expect(recordedMealGrams(zero)).toBe(330);
    expect(quantityGrams("100", "calories", zero.source!)).toBeNull();
    expect(recordedMealGrams(oatmeal({ caloriesPer100g: 0, mode: null, value: null }, 0))).toBeNull();
  });
});
