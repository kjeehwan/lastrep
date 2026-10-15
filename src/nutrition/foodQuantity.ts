import type { NutritionMeal } from "../contracts";
import type { FoodEntryMode } from "./foodDb";

type Density = { servingGrams?: number | null; caloriesPer100g?: number | null };
const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

export function quantityGrams(value: string, mode: FoodEntryMode, density: Density): number | null {
  const amount = Number(value);
  if (!positive(amount)) return null;
  const grams = mode === "grams" ? amount : mode === "servings" && positive(density.servingGrams)
    ? amount * density.servingGrams : mode === "calories" && positive(density.caloriesPer100g)
      ? amount * 100 / density.caloriesPer100g : null;
  return positive(grams) ? grams : null;
}

export function quantityValue(grams: number | null, mode: FoodEntryMode, density: Density): string {
  if (!positive(grams)) return "";
  const value = mode === "grams" ? grams : mode === "servings" && positive(density.servingGrams)
    ? grams / density.servingGrams : mode === "calories" && positive(density.caloriesPer100g)
      ? grams * density.caloriesPer100g / 100 : null;
  return positive(value) ? String(Number(value.toFixed(6))) : "";
}

export function recordedMealGrams(meal: NutritionMeal): number | null {
  const source = meal.source;
  if (!source) return null;
  const mode = source.mode;
  if (mode === "grams" || mode === "servings" || mode === "calories") {
    const grams = quantityGrams(source.value ?? "", mode, source);
    // Prefer the recorded amount over reversing rounded calories. Ignore stale
    // quantity metadata when it clearly disagrees with the saved food total.
    if (grams != null && typeof source.caloriesPer100g === "number" &&
      Math.abs(grams * source.caloriesPer100g / 100 - meal.calories) <= 1) return grams;
  }
  return quantityGrams(String(meal.calories), "calories", source);
}
