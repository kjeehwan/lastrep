import { Timestamp } from "firebase/firestore";
import type { NutritionMeal, NutritionMealWrite } from "../contracts";

export type NutritionTotals = {
  calories: number;
  proteinGrams: number;
};

export type MealFormValues = {
  name: string;
  calories: string;
  proteinGrams: string;
  time: string;
};

export type ParsedMealFormResult =
  | { ok: true; payload: NutritionMealWrite }
  | { ok: false; message: string };

export const DEFAULT_MEAL_FORM_VALUES: MealFormValues = {
  name: "",
  calories: "",
  proteinGrams: "",
  time: "",
};

export function computeNutritionTotals(meals: NutritionMeal[]): NutritionTotals {
  return meals.reduce(
    (totals, meal) => ({
      calories: totals.calories + meal.calories,
      proteinGrams: totals.proteinGrams + (meal.proteinGrams ?? 0),
    }),
    { calories: 0, proteinGrams: 0 }
  );
}

export function formatMealTime(timestamp: Timestamp): string {
  return timestamp.toDate().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toEditableTime(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function getDefaultMealTime(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function parseMealForm(
  values: MealFormValues,
  now = new Date()
): ParsedMealFormResult {
  const name = values.name.trim();
  if (!name) {
    return { ok: false, message: "Enter a meal name." };
  }

  const calories = Number(values.calories);
  if (!Number.isFinite(calories) || calories <= 0) {
    return { ok: false, message: "Enter calories as a positive number." };
  }

  let proteinGrams: number | null = null;
  if (values.proteinGrams.trim()) {
    const parsedProtein = Number(values.proteinGrams);
    if (!Number.isFinite(parsedProtein) || parsedProtein < 0) {
      return { ok: false, message: "Protein must be 0 or a positive number." };
    }
    proteinGrams = parsedProtein;
  }

  const time = values.time.trim() || getDefaultMealTime(now);
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) {
    return { ok: false, message: "Use a meal time like 08:30." };
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return { ok: false, message: "Meal time must be a valid 24-hour time." };
  }

  const loggedAtDate = new Date(now);
  loggedAtDate.setHours(hours, minutes, 0, 0);
  const loggedAt = Timestamp.fromDate(loggedAtDate);
  const updatedAt = Timestamp.now();

  return {
    ok: true,
    payload: {
      name,
      calories: Math.round(calories),
      proteinGrams: proteinGrams == null ? null : Math.round(proteinGrams),
      loggedAt,
      updatedAt,
    },
  };
}
