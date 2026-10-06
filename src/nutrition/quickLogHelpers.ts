import type {
  NutritionMeal,
  NutritionSavedMealItem,
} from "../contracts";

function cleanSource(meal: NutritionMeal): NutritionSavedMealItem["source"] {
  if (!meal.source) return null;
  return {
    foodId: meal.source.foodId ?? null,
    barcode: meal.source.barcode ?? null,
    servingLabel: meal.source.servingLabel ?? null,
    servingGrams: meal.source.servingGrams ?? null,
    caloriesPer100g: meal.source.caloriesPer100g ?? null,
    proteinPer100g: meal.source.proteinPer100g ?? null,
    carbsPer100g: meal.source.carbsPer100g ?? null,
    fatPer100g: meal.source.fatPer100g ?? null,
    mode: meal.source.mode ?? null,
    value: meal.source.value ?? null,
  };
}

export function mealsToSavedItems(meals: NutritionMeal[]): NutritionSavedMealItem[] {
  return meals.map((meal) => ({
    name: meal.name,
    calories: meal.calories,
    proteinGrams: meal.proteinGrams ?? null,
    carbGrams: meal.carbGrams ?? null,
    fatGrams: meal.fatGrams ?? null,
    source: cleanSource(meal),
  }));
}

export function findPreviousSectionMeals(
  meals: NutritionMeal[],
  section: string,
  targetDate: Date
): NutritionMeal[] {
  const targetStart = new Date(targetDate);
  targetStart.setHours(0, 0, 0, 0);
  const matching = meals.filter((meal) => {
    const mealSection = meal.mealSection?.trim() || "Breakfast";
    return mealSection === section && meal.loggedAt.toMillis() < targetStart.getTime();
  });
  if (matching.length === 0) return [];
  const newestDay = new Date(Math.max(...matching.map((meal) => meal.loggedAt.toMillis())));
  newestDay.setHours(0, 0, 0, 0);
  const dayEnd = new Date(newestDay);
  dayEnd.setHours(23, 59, 59, 999);
  return matching.filter((meal) => {
    const time = meal.loggedAt.toMillis();
    return time >= newestDay.getTime() && time <= dayEnd.getTime();
  });
}
