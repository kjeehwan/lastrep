import type { Timestamp } from "firebase/firestore";
import { USERS_COLLECTION } from "./entitlement";

export const NUTRITION_MEALS_SUBCOLLECTION = "nutritionMeals" as const;
export const USER_NUTRITION_MEALS_PATH =
  `${USERS_COLLECTION}/{uid}/${NUTRITION_MEALS_SUBCOLLECTION}` as const;

export const NUTRITION_MEAL_FIELDS = {
  name: "name",
  calories: "calories",
  proteinGrams: "proteinGrams",
  loggedAt: "loggedAt",
  updatedAt: "updatedAt",
} as const;

export interface NutritionMeal {
  id: string;
  name: string;
  calories: number;
  proteinGrams: number | null;
  loggedAt: Timestamp;
  updatedAt: Timestamp;
}

export type NutritionMealWrite = Omit<NutritionMeal, "id">;
