import type { NutritionMeal } from "../contracts";
import type { FoodEntryMode } from "./foodDb";

type Density = { servingGrams?: number | null; caloriesPer100g?: number | null };
type NutritionDensity = Density & { proteinPer100g?: number | null; carbsPer100g?: number | null; fatPer100g?: number | null };
const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

/** Quantity edits must not wait for the search database or remove the facts card. */
export function quantityNutrition(value: string, mode: FoodEntryMode, source: NutritionDensity) {
  const grams = quantityGrams(value, mode, source);
  const calories = source.caloriesPer100g;
  const protein = source.proteinPer100g;
  if (grams == null || !positive(source.servingGrams) || typeof calories !== "number" || !Number.isFinite(calories) || calories < 0 || typeof protein !== "number" || !Number.isFinite(protein) || protein < 0) return null;
  const factor = grams / 100;
  return {
    grams, servings: grams / source.servingGrams, calories: calories * factor,
    proteinGrams: protein * factor,
    carbGrams: typeof source.carbsPer100g === "number" && Number.isFinite(source.carbsPer100g) ? source.carbsPer100g * factor : null,
    fatGrams: typeof source.fatPer100g === "number" && Number.isFinite(source.fatPer100g) ? source.fatPer100g * factor : null,
  };
}

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

export function selectedFoodSummary(draft: { mode: FoodEntryMode; value: string; food: Density }): string | null {
  const grams = quantityGrams(draft.value, draft.mode, draft.food);
  const calories = draft.food.caloriesPer100g;
  const servingGrams = draft.food.servingGrams;
  if (grams == null || typeof calories !== "number" || !Number.isFinite(calories) || calories < 0 || !positive(servingGrams)) return null;
  const servings = Number((grams / servingGrams).toFixed(2));
  return `${Number(grams.toFixed(2))}g / ${Math.round(grams * calories / 100)} kcal / ${servings} ${servings === 1 ? "serving" : "servings"}`;
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
