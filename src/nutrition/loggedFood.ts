import type { NutritionMeal } from "../contracts";
import type { FoodItem } from "./foodDb";

/** Reuse the saved product reference; never manufacture missing nutrition facts. */
export function loggedFoodReference(meal: NutritionMeal): FoodItem | null {
  const source = meal.source;
  if (!source?.foodId || !source.servingGrams || source.servingGrams <= 0 ||
    typeof source.caloriesPer100g !== "number" || !Number.isFinite(source.caloriesPer100g) || source.caloriesPer100g < 0 ||
    typeof source.proteinPer100g !== "number" || !Number.isFinite(source.proteinPer100g) || source.proteinPer100g < 0) return null;
  return {
    id: source.foodId, name: meal.name, aliases: [], servingGrams: source.servingGrams,
    servingLabel: source.servingLabel || "1 serving", caloriesPer100g: source.caloriesPer100g,
    proteinPer100g: source.proteinPer100g,
    ...(source.barcode ? { barcode: source.barcode } : {}),
    ...(typeof source.carbsPer100g === "number" ? { carbsPer100g: source.carbsPer100g } : {}),
    ...(typeof source.fatPer100g === "number" ? { fatPer100g: source.fatPer100g } : {}),
  };
}
