import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import {
  NUTRITION_MEAL_FIELDS,
  NUTRITION_MEALS_SUBCOLLECTION,
  USERS_COLLECTION,
} from "../contracts";
import type { NutritionMeal, NutritionMealWrite } from "../contracts";

export * from "./mealHelpers";

function startOfLocalDay(date = new Date()): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfLocalDay(date = new Date()): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function subscribeToTodayMeals(
  uid: string,
  onNext: (meals: NutritionMeal[]) => void,
  onError: (error: unknown) => void,
  now = new Date()
): Unsubscribe {
  const start = Timestamp.fromDate(startOfLocalDay(now));
  const end = Timestamp.fromDate(endOfLocalDay(now));
  const mealsQuery = query(
    collection(db, USERS_COLLECTION, uid, NUTRITION_MEALS_SUBCOLLECTION),
    where(NUTRITION_MEAL_FIELDS.loggedAt, ">=", start),
    where(NUTRITION_MEAL_FIELDS.loggedAt, "<=", end),
    orderBy(NUTRITION_MEAL_FIELDS.loggedAt, "desc")
  );

  return onSnapshot(
    mealsQuery,
    (snapshot) => {
      const meals = snapshot.docs.map((mealDoc) => {
        const data = mealDoc.data() as NutritionMealWrite;
        return {
          id: mealDoc.id,
          name: data.name,
          calories: data.calories,
          proteinGrams: data.proteinGrams ?? null,
          loggedAt: data.loggedAt,
          updatedAt: data.updatedAt,
        } as NutritionMeal;
      });
      onNext(meals);
    },
    onError
  );
}

export async function createMeal(uid: string, payload: NutritionMealWrite): Promise<void> {
  await addDoc(collection(db, USERS_COLLECTION, uid, NUTRITION_MEALS_SUBCOLLECTION), payload);
}

export async function updateMeal(
  uid: string,
  mealId: string,
  payload: NutritionMealWrite
): Promise<void> {
  await setDoc(doc(db, USERS_COLLECTION, uid, NUTRITION_MEALS_SUBCOLLECTION, mealId), payload, {
    merge: true,
  });
}

export async function deleteMeal(uid: string, mealId: string): Promise<void> {
  await deleteDoc(doc(db, USERS_COLLECTION, uid, NUTRITION_MEALS_SUBCOLLECTION, mealId));
}
