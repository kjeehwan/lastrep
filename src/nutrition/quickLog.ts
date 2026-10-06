import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import {
  NUTRITION_MEALS_SUBCOLLECTION,
  NUTRITION_SAVED_MEALS_SUBCOLLECTION,
  USERS_COLLECTION,
  type NutritionMeal,
  type NutritionMealWrite,
  type NutritionSavedMeal,
  type NutritionSavedMealItem,
  type NutritionSavedMealWrite,
} from "../contracts";
import { getRecentMeals } from "./meals";
import { findPreviousSectionMeals, mealsToSavedItems } from "./quickLogHelpers";

export { findPreviousSectionMeals, mealsToSavedItems } from "./quickLogHelpers";

function targetTimestamp(date: Date, itemIndex: number): Timestamp {
  const now = new Date();
  return Timestamp.fromDate(
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), now.getHours(), now.getMinutes(), itemIndex)
  );
}

function itemToMealWrite(
  item: NutritionSavedMealItem,
  section: string,
  date: Date,
  itemIndex: number
): NutritionMealWrite {
  const now = Timestamp.now();
  return {
    name: item.name,
    calories: item.calories,
    proteinGrams: item.proteinGrams,
    carbGrams: item.carbGrams,
    fatGrams: item.fatGrams,
    source: item.source,
    mealSection: section,
    loggedAt: targetTimestamp(date, itemIndex),
    updatedAt: now,
  };
}

export async function getSavedMeals(uid: string): Promise<NutritionSavedMeal[]> {
  const snapshot = await getDocs(
    query(
      collection(db, USERS_COLLECTION, uid, NUTRITION_SAVED_MEALS_SUBCOLLECTION),
      orderBy("updatedAt", "desc")
    )
  );
  return snapshot.docs.map((savedDoc: QueryDocumentSnapshot<DocumentData>) => ({
    id: savedDoc.id,
    ...(savedDoc.data() as NutritionSavedMealWrite),
  }));
}

export async function createSavedMeal(
  uid: string,
  name: string,
  meals: NutritionMeal[]
): Promise<void> {
  const now = Timestamp.now();
  await addDoc(collection(db, USERS_COLLECTION, uid, NUTRITION_SAVED_MEALS_SUBCOLLECTION), {
    name: name.trim(),
    items: mealsToSavedItems(meals),
    createdAt: now,
    updatedAt: now,
  } satisfies NutritionSavedMealWrite);
}

export async function deleteSavedMeal(uid: string, savedMealId: string): Promise<void> {
  await deleteDoc(doc(db, USERS_COLLECTION, uid, NUTRITION_SAVED_MEALS_SUBCOLLECTION, savedMealId));
}

export async function addSavedMealToDate(
  uid: string,
  savedMeal: NutritionSavedMeal,
  section: string,
  date: Date
): Promise<void> {
  const batch = writeBatch(db);
  const mealsCollection = collection(db, USERS_COLLECTION, uid, NUTRITION_MEALS_SUBCOLLECTION);
  savedMeal.items.forEach((item, index) => {
    batch.set(doc(mealsCollection), itemToMealWrite(item, section, date, index));
  });
  await batch.commit();
}

export async function copyPreviousMealToDate(
  uid: string,
  section: string,
  targetDate: Date,
  lookbackDays = 90
): Promise<{ copied: number; sourceDate: Date | null }> {
  const meals = await getRecentMeals(uid, lookbackDays, targetDate);
  const previous = findPreviousSectionMeals(meals, section, targetDate);
  if (previous.length === 0) return { copied: 0, sourceDate: null };
  const items = mealsToSavedItems(previous);
  const batch = writeBatch(db);
  const mealsCollection = collection(db, USERS_COLLECTION, uid, NUTRITION_MEALS_SUBCOLLECTION);
  items.forEach((item, index) => {
    batch.set(doc(mealsCollection), itemToMealWrite(item, section, targetDate, index));
  });
  await batch.commit();
  return { copied: items.length, sourceDate: previous[0].loggedAt.toDate() };
}
