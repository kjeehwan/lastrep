import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../../config/firebaseConfig";
import { classifyCalorieTargetAdherence, getCalorieTargetForDietPhase, getMealsForDate, getNutritionProfile, getNutritionTrendReport } from "../../nutrition/meals";
import { getSleepProfile, getSleepSampleAgeHours, isHealthSleepStale } from "../../sleep/sleep";
import { resolveDecisionSleepInput } from "../../sleep/resolveDecisionSleepInput";
import type { DecisionInputs, PlannedWorkoutSummary } from "../../types/decision";
import type { WorkoutSummary } from "../../workouts/homeInsights";
import { buildRecentTrainingSummary, normalizeDailyDecisionContext, toLocalDateKey } from "./todayPlanContext";

export type RecoveryInputs = Pick<DecisionInputs, "soreness" | "fatigue" | "motivation">;
export const RECOVERY_INPUTS_KEY = "home-inputs-v1";

const rating = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(10, Math.round(value))) : fallback;

export async function loadWorkoutPlanContext(uid: string, plannedWorkout: PlannedWorkoutSummary, override?: RecoveryInputs) {
  const now = new Date();
  const [userSnapshot, nutritionProfile, sleep, meals, recoveryRaw, history] = await Promise.all([
    getDoc(doc(db, "users", uid)), getNutritionProfile(uid), getSleepProfile(uid), getMealsForDate(uid),
    AsyncStorage.getItem(`${RECOVERY_INPUTS_KEY}:${uid}`),
    getDocs(query(collection(db, "users", uid, "workouts"), orderBy("date", "desc"), limit(120))),
  ]);
  if (!userSnapshot.exists()) throw new Error("User profile is unavailable");
  const user = userSnapshot.data();
  let saved: Partial<RecoveryInputs> = {};
  try { saved = recoveryRaw ? JSON.parse(recoveryRaw) : {}; } catch { /* Use defaults for an invalid local check-in. */ }
  const recovery: RecoveryInputs = override ?? {
    soreness: rating(saved?.soreness, 4), fatigue: rating(saved?.fatigue, 4), motivation: rating(saved?.motivation, 6),
  };
  const dietPhase = user?.dietPhase === "Cut" || user?.dietPhase === "Bulk" ? user.dietPhase : "Maintain";
  const trainingPhase = user?.trainingPhase === "Strength" || user?.trainingPhase === "Power" ? user.trainingPhase : "Hypertrophy";
  const sleepTargetHours = typeof user?.sleepSettings?.targetHours === "number" ? user.sleepSettings.targetHours : 7;
  const target = getCalorieTargetForDietPhase(nutritionProfile.calorieTargetsByDietPhase, dietPhase);
  const trends = await getNutritionTrendReport(uid, target, 7);
  const completed = trends.dailyHistory.filter((day) => day.dateKey < toLocalDateKey(now)).slice(0, 7);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = completed.find((day) => day.dateKey === toLocalDateKey(yesterdayDate));
  const recentAverage = completed.length ? completed.reduce((sum, day) => sum + day.calories, 0) / completed.length : null;
  const workouts: WorkoutSummary[] = [];
  history.forEach((document) => {
    const data = document.data();
    const date = data.date?.toDate?.() ?? data.endedAt?.toDate?.() ?? data.createdAt?.toDate?.();
    if (!(date instanceof Date)) return;
    workouts.push({ id: document.id, title: data.title ?? "Workout", date, trainingPhase: data.trainingPhase ?? null,
      exercises: (data.exercises ?? []).map((exercise: any) => ({
        name: exercise.name ?? "Exercise", mode: exercise.mode === "cardio" ? "cardio" : "resistance",
        sets: (exercise.sets ?? []).map((set: any) => ({
          weightKg: typeof set.weightKg === "number" ? set.weightKg : null, reps: String(set.reps ?? ""),
          rpe: set.rpe != null && set.rpe !== "" && Number.isFinite(Number(set.rpe)) ? Number(set.rpe) : null,
          setType: set.setType ?? "normal", distanceKm: set.distanceKm ?? null, durationSec: set.durationSec ?? null,
        })),
      })),
    });
  });
  const resolvedSleep = resolveDecisionSleepInput(sleep.source === "manual" ? sleep.latestSleepHours ?? sleepTargetHours : sleepTargetHours, {
    source: sleep.source, latestSleepHours: sleep.latestSleepHours,
    sampleAgeHours: isHealthSleepStale(sleep, now) ? null : getSleepSampleAgeHours(sleep.sampleRecordedAt),
  });
  const inputs: DecisionInputs = {
    sleepHours: resolvedSleep.sleepHours, sleepSource: resolvedSleep.sleepSource, sleepSampleAgeHours: resolvedSleep.sleepSampleAgeHours,
    ...recovery, dietPhase, trainingPhase, plannedWorkout,
    dailyContext: normalizeDailyDecisionContext(user?.todayPlanContext, plannedWorkout, now),
    recentTraining: buildRecentTrainingSummary(workouts, plannedWorkout, now),
    nutrition: {
      caloriesConsumedToday: Math.round(meals.reduce((sum, meal) => sum + meal.calories, 0)),
      proteinGramsToday: meals.some((meal) => meal.proteinGrams != null) ? Math.round(meals.reduce((sum, meal) => sum + (meal.proteinGrams ?? 0), 0)) : null,
      calorieTarget: target, yesterdayCalories: yesterday?.calories ?? null, yesterdayAdherence: yesterday?.adherence ?? null,
      recentAdherence: classifyCalorieTargetAdherence(recentAverage, target), recentCompletedDaysTracked: completed.length,
    },
  };
  return { inputs, workouts, sleepTargetHours, recovery };
}
