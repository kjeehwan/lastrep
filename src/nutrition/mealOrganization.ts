import type { NutritionMeal } from "../contracts";

// These are persistent identifiers, not editable display names.
export const DEFAULT_MEAL_IDS = ["Breakfast", "Snack 1", "Lunch", "Snack 2", "Dinner", "Snack 3"];
export type MealLabelMode = "named" | "numbered";
export type MealLabels = { mode: MealLabelMode; names: Record<string, string> };

export function normalizeMealLabels(raw: unknown): MealLabels {
  const value = raw as Partial<MealLabels> | null;
  const names: Record<string, string> = {};
  if (value?.names && typeof value.names === "object") {
    for (const [id, name] of Object.entries(value.names).sort(([a], [b]) => a.localeCompare(b))) {
      if (typeof name === "string" && name.trim()) names[id] = name.trim().slice(0, 24);
    }
  }
  return { mode: value?.mode === "numbered" ? "numbered" : "named", names };
}

export function reconcileMealLabelDraft(baseline: MealLabels, draft: MealLabels, remote: MealLabels) {
  if (JSON.stringify(normalizeMealLabels(baseline)) === JSON.stringify(normalizeMealLabels(draft))) {
    return { baseline: remote, draft: remote };
  }
  return { baseline, draft };
}

export function mealLabel(id: string, labels: MealLabels): string {
  if (Object.hasOwn(labels.names, id)) return labels.names[id];
  const index = DEFAULT_MEAL_IDS.indexOf(id);
  return labels.mode === "numbered" && index >= 0 ? `Meal ${index + 1}` : id;
}

export function mealSectionId(meal: Pick<NutritionMeal, "mealSection">): string {
  return meal.mealSection?.trim() || DEFAULT_MEAL_IDS[0];
}

export function validMealMinutes(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 1440;
}

export function sectionMealTime(meals: NutritionMeal[]): number | null {
  const first = [...meals].sort((a, b) => a.loggedAt.toMillis() - b.loggedAt.toMillis())[0];
  return first && validMealMinutes(first.mealTimeMinutes) ? first.mealTimeMinutes : null;
}

export function initialMealTime(meals: NutritionMeal[], now = new Date()): number | null {
  return meals.length ? sectionMealTime(meals) : now.getHours() * 60 + now.getMinutes();
}

export function formatMealTime(minutes: number | null): string {
  if (!validMealMinutes(minutes)) return "Set time";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function parseMealTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
