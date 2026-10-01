import type { Timestamp } from "firebase/firestore";
import { USERS_COLLECTION } from "./entitlement";

export const NUTRITION_MEALS_SUBCOLLECTION = "nutritionMeals" as const;
export const USER_NUTRITION_MEALS_PATH =
  `${USERS_COLLECTION}/{uid}/${NUTRITION_MEALS_SUBCOLLECTION}` as const;
export const USER_NUTRITION_PROFILE_FIELD = "nutritionProfile" as const;
export const NUTRITION_TARGET_PHASES = ["Cut", "Maintain", "Bulk"] as const;

export const NUTRITION_MEAL_FIELDS = {
  name: "name",
  calories: "calories",
  proteinGrams: "proteinGrams",
  carbGrams: "carbGrams",
  fatGrams: "fatGrams",
  source: "source",
  mealSection: "mealSection",
  loggedAt: "loggedAt",
  updatedAt: "updatedAt",
} as const;

export const NUTRITION_PROFILE_FIELDS = {
  calorieTargetsByDietPhase: "calorieTargetsByDietPhase",
  proteinTargetGrams: "proteinTargetGrams",
  mealSections: "mealSections",
  updatedAt: "updatedAt",
} as const;

export interface NutritionMealSource {
  foodId?: string | null;
  servingLabel?: string | null;
  servingGrams?: number | null;
  caloriesPer100g?: number | null;
  proteinPer100g?: number | null;
  carbsPer100g?: number | null;
  fatPer100g?: number | null;
  mode?: "grams" | "servings" | "calories" | null;
  value?: string | null;
}

export interface NutritionMeal {
  id: string;
  name: string;
  calories: number;
  proteinGrams: number | null;
  carbGrams?: number | null;
  fatGrams?: number | null;
  source?: NutritionMealSource | null;
  mealSection?: string | null;
  loggedAt: Timestamp;
  updatedAt: Timestamp;
}

export type NutritionMealWrite = Omit<NutritionMeal, "id">;
export type NutritionTargetPhase = (typeof NUTRITION_TARGET_PHASES)[number];
export type NutritionCalorieTargetsByDietPhase = Record<NutritionTargetPhase, number | null>;

export interface NutritionProfile {
  calorieTargetsByDietPhase: NutritionCalorieTargetsByDietPhase;
  proteinTargetGrams?: number | null;
  mealSections?: string[] | null;
  updatedAt?: Timestamp | null;
}
