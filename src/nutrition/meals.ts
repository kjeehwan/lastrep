import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  type DocumentData,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import {
  NUTRITION_PROFILE_FIELDS,
  NUTRITION_MEAL_FIELDS,
  NUTRITION_MEALS_SUBCOLLECTION,
  USER_NUTRITION_PROFILE_FIELD,
  USERS_COLLECTION,
} from "../contracts";
import type {
  NutritionCalorieTargetsByDietPhase,
  NutritionMeal,
  NutritionMealWrite,
  NutritionProfile,
} from "../contracts";
import type { DecisionNutritionSummary, DietPhase } from "../types/decision";
import {
  buildDecisionNutritionSummary,
  buildNutritionProfile,
  DEFAULT_CALORIE_TARGETS_BY_DIET_PHASE,
  getCalorieTargetForDietPhase,
  normalizeCalorieTargets,
} from "./mealHelpers";

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

function startOfLocalDayOffset(date = new Date(), offsetDays = 0): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + offsetDays);
  next.setHours(0, 0, 0, 0);
  return next;
}

function buildTodayMealsQuery(uid: string, now = new Date()) {
  const start = Timestamp.fromDate(startOfLocalDay(now));
  const end = Timestamp.fromDate(endOfLocalDay(now));

  return query(
    collection(db, USERS_COLLECTION, uid, NUTRITION_MEALS_SUBCOLLECTION),
    where(NUTRITION_MEAL_FIELDS.loggedAt, ">=", start),
    where(NUTRITION_MEAL_FIELDS.loggedAt, "<=", end),
    orderBy(NUTRITION_MEAL_FIELDS.loggedAt, "desc")
  );
}

function buildMealsRangeQuery(uid: string, startDate: Date, endDate: Date) {
  return query(
    collection(db, USERS_COLLECTION, uid, NUTRITION_MEALS_SUBCOLLECTION),
    where(NUTRITION_MEAL_FIELDS.loggedAt, ">=", Timestamp.fromDate(startDate)),
    where(NUTRITION_MEAL_FIELDS.loggedAt, "<=", Timestamp.fromDate(endDate)),
    orderBy(NUTRITION_MEAL_FIELDS.loggedAt, "desc")
  );
}

function mapMealDoc(mealDoc: QueryDocumentSnapshot<DocumentData>): NutritionMeal {
  const data = mealDoc.data() as NutritionMealWrite;
  return {
    id: mealDoc.id,
    name: data.name,
    calories: data.calories,
    proteinGrams: data.proteinGrams ?? null,
    loggedAt: data.loggedAt,
    updatedAt: data.updatedAt,
  };
}

export function subscribeToTodayMeals(
  uid: string,
  onNext: (meals: NutritionMeal[]) => void,
  onError: (error: unknown) => void,
  now = new Date()
): Unsubscribe {
  return onSnapshot(
    buildTodayMealsQuery(uid, now),
    (snapshot) => {
      const meals = snapshot.docs.map(mapMealDoc);
      onNext(meals);
    },
    onError
  );
}

export async function getTodayDecisionNutritionSummary(
  uid: string,
  dietPhase: DietPhase,
  now = new Date()
): Promise<DecisionNutritionSummary> {
  const todayStart = startOfLocalDay(now);
  const completedStart = startOfLocalDayOffset(now, -7);
  const completedEnd = new Date(todayStart.getTime() - 1);

  const [todaySnapshot, completedSnapshot, profileSnapshot] = await Promise.all([
    getDocs(buildTodayMealsQuery(uid, now)),
    getDocs(buildMealsRangeQuery(uid, completedStart, completedEnd)),
    getDoc(doc(db, USERS_COLLECTION, uid)),
  ]);

  const calorieTargets = normalizeCalorieTargets(
    profileSnapshot.data()?.[USER_NUTRITION_PROFILE_FIELD]?.[NUTRITION_PROFILE_FIELDS.calorieTargetsByDietPhase]
  );

  return buildDecisionNutritionSummary(
    todaySnapshot.docs.map(mapMealDoc),
    completedSnapshot.docs.map(mapMealDoc),
    getCalorieTargetForDietPhase(calorieTargets, dietPhase),
    now
  );
}

export async function getNutritionProfile(uid: string): Promise<NutritionProfile> {
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid));
  const data = snapshot.data()?.[USER_NUTRITION_PROFILE_FIELD] as
    | { calorieTargetsByDietPhase?: unknown; updatedAt?: Timestamp | null }
    | undefined;

  return buildNutritionProfile(
    normalizeCalorieTargets(data?.calorieTargetsByDietPhase),
    data?.updatedAt ?? null
  );
}

export async function saveNutritionProfile(
  uid: string,
  calorieTargetsByDietPhase: NutritionCalorieTargetsByDietPhase
): Promise<void> {
  await setDoc(
    doc(db, USERS_COLLECTION, uid),
    {
      [USER_NUTRITION_PROFILE_FIELD]: buildNutritionProfile(
        calorieTargetsByDietPhase,
        Timestamp.now()
      ),
    },
    { merge: true }
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
