import { Timestamp } from "firebase/firestore";
import type {
  NutritionCalorieTargetsByDietPhase,
  NutritionMeal,
  NutritionMealWrite,
  NutritionProfile,
} from "../contracts";
import { NUTRITION_TARGET_PHASES } from "../contracts";
import type {
  CalorieTargetAdherence,
  DecisionNutritionSummary,
  DietPhase,
} from "../types/decision";

export type NutritionTotals = {
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
};

export type DailyCalorieProgress = {
  remainingCalories: number | null;
  overTargetCalories: number | null;
};

export type NutritionDayAggregate = {
  dateKey: string;
  calories: number;
  proteinGrams: number;
  mealCount: number;
  adherence: CalorieTargetAdherence | null;
};

export type NutritionTrendReport = {
  dailyHistory: NutritionDayAggregate[];
  averageCalories: number | null;
  consistencyScore: number | null; // percentage of on_target days
  daysTracked: number;
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

export const DEFAULT_CALORIE_TARGETS_BY_DIET_PHASE: NutritionCalorieTargetsByDietPhase = {
  Cut: null,
  Maintain: null,
  Bulk: null,
};

const MIN_RECENT_COMPLETED_DAYS = 3;

export function computeNutritionTotals(meals: NutritionMeal[]): NutritionTotals {
  return meals.reduce(
    (totals, meal) => ({
      calories: totals.calories + meal.calories,
      proteinGrams: totals.proteinGrams + (meal.proteinGrams ?? 0),
      carbGrams: totals.carbGrams + (meal.carbGrams ?? 0),
      fatGrams: totals.fatGrams + (meal.fatGrams ?? 0),
    }),
    { calories: 0, proteinGrams: 0, carbGrams: 0, fatGrams: 0 }
  );
}

export function buildTrendReport(
  meals: NutritionMeal[],
  calorieTarget: number | null
): NutritionTrendReport {
  const dailyHistory = groupMealsByLocalDay(meals, calorieTarget);
  const daysTracked = dailyHistory.length;

  const totalCalories = dailyHistory.reduce((sum, day) => sum + day.calories, 0);
  const averageCalories = daysTracked > 0 ? Math.round(totalCalories / daysTracked) : null;

  const onTargetDays = dailyHistory.filter((day) => day.adherence === "on_target").length;
  const consistencyScore = daysTracked > 0 ? Math.round((onTargetDays / daysTracked) * 100) : null;

  return {
    dailyHistory,
    averageCalories,
    consistencyScore,
    daysTracked,
  };
}

export function buildDecisionNutritionSummary(
  todayMeals: NutritionMeal[],
  completedDayMeals: NutritionMeal[],
  calorieTarget: number | null,
  now = new Date()
): DecisionNutritionSummary {
  const totals = computeNutritionTotals(todayMeals);
  const hasProteinEntries = todayMeals.some((meal) => meal.proteinGrams != null);
  const groupedCompletedDays = groupMealsByLocalDay(completedDayMeals);
  const yesterdayKey = getLocalDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const yesterday = groupedCompletedDays.find((day) => day.dateKey === yesterdayKey) ?? null;
  const recentCompletedDaysTracked = groupedCompletedDays.length;
  const recentAverageCalories =
    recentCompletedDaysTracked >= MIN_RECENT_COMPLETED_DAYS
      ? Math.round(
          groupedCompletedDays.reduce((sum, day) => sum + day.calories, 0) / recentCompletedDaysTracked
        )
      : null;

  return {
    caloriesConsumedToday: totals.calories,
    proteinGramsToday: hasProteinEntries ? totals.proteinGrams : null,
    calorieTarget,
    yesterdayCalories: yesterday?.calories ?? null,
    yesterdayAdherence: classifyCalorieTargetAdherence(yesterday?.calories ?? null, calorieTarget),
    recentAdherence: classifyCalorieTargetAdherence(recentAverageCalories, calorieTarget),
    recentCompletedDaysTracked,
  };
}

export function normalizeCalorieTargets(
  value: unknown
): NutritionCalorieTargetsByDietPhase {
  const normalized = { ...DEFAULT_CALORIE_TARGETS_BY_DIET_PHASE };

  if (!value || typeof value !== "object") {
    return normalized;
  }

  for (const phase of NUTRITION_TARGET_PHASES) {
    const raw = (value as Record<string, unknown>)[phase];
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      normalized[phase] = Math.round(raw);
    }
  }

  return normalized;
}

export function buildNutritionProfile(
  calorieTargetsByDietPhase: NutritionCalorieTargetsByDietPhase,
  proteinTargetGrams: number | null = null,
  mealSections: string[] | null = null,
  updatedAt: Timestamp | null = Timestamp.now()
): NutritionProfile {
  return {
    calorieTargetsByDietPhase,
    proteinTargetGrams,
    mealSections,
    updatedAt,
  };
}

export function getCalorieTargetForDietPhase(
  calorieTargetsByDietPhase: NutritionCalorieTargetsByDietPhase,
  dietPhase: DietPhase
): number | null {
  return calorieTargetsByDietPhase[dietPhase] ?? null;
}

export function classifyCalorieTargetAdherence(
  calories: number | null,
  calorieTarget: number | null
): CalorieTargetAdherence | null {
  if (calories == null || calorieTarget == null || calorieTarget <= 0) {
    return null;
  }

  const ratio = calories / calorieTarget;
  if (ratio < 0.9) return "below_target";
  if (ratio <= 1.1) return "on_target";
  return "above_target";
}

export function computeDailyCalorieProgress(
  caloriesConsumedToday: number,
  calorieTarget: number | null
): DailyCalorieProgress {
  if (calorieTarget == null) {
    return {
      remainingCalories: null,
      overTargetCalories: null,
    };
  }

  if (caloriesConsumedToday <= calorieTarget) {
    return {
      remainingCalories: calorieTarget - caloriesConsumedToday,
      overTargetCalories: 0,
    };
  }

  return {
    remainingCalories: 0,
    overTargetCalories: caloriesConsumedToday - calorieTarget,
  };
}

export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function groupMealsByLocalDay(
  meals: NutritionMeal[],
  calorieTarget: number | null = null
): NutritionDayAggregate[] {
  const grouped = new Map<string, NutritionDayAggregate>();

  for (const meal of meals) {
    const dateKey = getLocalDateKey(meal.loggedAt.toDate());
    const current =
      grouped.get(dateKey) ?? {
        dateKey,
        calories: 0,
        proteinGrams: 0,
        mealCount: 0,
        adherence: null,
      };

    current.calories += meal.calories;
    current.proteinGrams += meal.proteinGrams ?? 0;
    current.mealCount += 1;
    grouped.set(dateKey, current);
  }

  // Final pass to calculate adherence per day
  for (const day of grouped.values()) {
    day.adherence = classifyCalorieTargetAdherence(day.calories, calorieTarget);
  }

  return Array.from(grouped.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
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
