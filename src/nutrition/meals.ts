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
  NutritionMealSource,
  NutritionMealWrite,
  NutritionProfile,
} from "../contracts";
import type { DecisionNutritionSummary, DietPhase } from "../types/decision";
import {
  buildDecisionNutritionSummary,
  buildTrendReport,
  buildNutritionProfile,
  getCalorieTargetForDietPhase,
  normalizeCalorieTargets,
} from "./mealHelpers";
import type { NutritionTrendReport } from "./mealHelpers";

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

export function formatDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function parseDateKey(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
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
  const rawSource = (data as { source?: NutritionMealSource | null }).source;
  return {
    id: mealDoc.id,
    name: data.name,
    calories: data.calories,
    proteinGrams: data.proteinGrams ?? null,
    carbGrams: data.carbGrams ?? null,
    fatGrams: data.fatGrams ?? null,
    source: rawSource ?? null,
    mealSection: data.mealSection ?? null,
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

export function subscribeToMealsForDate(
  uid: string,
  date: Date,
  onNext: (meals: NutritionMeal[]) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    buildTodayMealsQuery(uid, date),
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

export async function getNutritionTrendReport(
  uid: string,
  calorieTarget: number | null,
  days = 7,
  now = new Date()
): Promise<NutritionTrendReport> {
  const todayStart = startOfLocalDay(now);
  const startDate = startOfLocalDayOffset(now, -days);
  const endDate = new Date(todayStart.getTime() - 1);

  const snapshot = await getDocs(buildMealsRangeQuery(uid, startDate, endDate));
  const meals = snapshot.docs.map(mapMealDoc);

  return buildTrendReport(meals, calorieTarget);
}

export async function getRecentMeals(
  uid: string,
  days = 7,
  now = new Date()
): Promise<NutritionMeal[]> {
  const startDate = startOfLocalDayOffset(now, -days);
  const endDate = endOfLocalDay(now);

  const snapshot = await getDocs(buildMealsRangeQuery(uid, startDate, endDate));
  return snapshot.docs.map(mapMealDoc);
}

export async function getMealsForDate(uid: string, date = new Date()): Promise<NutritionMeal[]> {
  const snapshot = await getDocs(buildTodayMealsQuery(uid, date));
  return snapshot.docs.map(mapMealDoc);
}

export async function getNutritionProfile(uid: string): Promise<NutritionProfile> {
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid));
  const data = snapshot.data()?.[USER_NUTRITION_PROFILE_FIELD] as
    | {
        calorieTargetsByDietPhase?: unknown;
        proteinTargetGrams?: unknown;
        mealSections?: unknown;
        updatedAt?: Timestamp | null;
      }
    | undefined;
  const proteinTargetGrams =
    typeof data?.proteinTargetGrams === "number" &&
    Number.isFinite(data.proteinTargetGrams) &&
    data.proteinTargetGrams > 0
      ? Math.round(data.proteinTargetGrams)
      : null;

  const mealSections = Array.isArray(data?.mealSections)
    ? data!.mealSections.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : null;

  return buildNutritionProfile(
    normalizeCalorieTargets(data?.calorieTargetsByDietPhase),
    proteinTargetGrams,
    mealSections,
    data?.updatedAt ?? null
  );
}

export async function saveNutritionProfile(
  uid: string,
  calorieTargetsByDietPhase: NutritionCalorieTargetsByDietPhase,
  proteinTargetGrams: number | null = null,
  mealSections: string[] | null = null
): Promise<void> {
  await setDoc(
    doc(db, USERS_COLLECTION, uid),
    {
      [USER_NUTRITION_PROFILE_FIELD]: buildNutritionProfile(
        calorieTargetsByDietPhase,
        proteinTargetGrams,
        mealSections,
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
