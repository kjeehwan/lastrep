import { expect, it } from "vitest";
import type { NutritionMeal } from "../contracts";
import { loggedFoodReference } from "./loggedFood";

it("uses a logged product's per-100g reference, not its edited portion, for favorites", () => {
  const meal = { name: "Milk", calories: 100, source: { foodId: "milk", servingGrams: 250, caloriesPer100g: 50, proteinPer100g: 3.4, value: "200", mode: "grams" } } as NutritionMeal;
  expect(loggedFoodReference(meal)).toMatchObject({ id: "milk", caloriesPer100g: 50, servingGrams: 250 });
  expect(loggedFoodReference({ ...meal, source: null })).toBeNull();
  expect(loggedFoodReference({ ...meal, source: { ...meal.source, caloriesPer100g: 0 } })).not.toBeNull();
  expect(loggedFoodReference({ ...meal, source: { ...meal.source, proteinPer100g: NaN } })).toBeNull();
});
