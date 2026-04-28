import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Href, Redirect, useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NormalizedDecisionError, ReasonCode } from "../../src/contracts";
import { auth, db } from "../../src/config/firebaseConfig";
import { useEntitlement } from "../../src/hooks/useEntitlement";
import { useOfflineStatus } from "../../src/hooks/useOfflineStatus";
import {
  getCalorieTargetForDietPhase,
  getNutritionProfile,
  getNutritionTrendReport,
  getTodayDecisionNutritionSummary,
} from "../../src/nutrition/meals";
import { showAppAlert, showAppDialog } from "../../src/ui/appDialog";
import { getUserData } from "../../src/userData";
import {
  getSleepProfile,
  getSleepSampleAgeHours,
  isHealthSleepStale,
} from "../../src/sleep/sleep";
import { resolveDecisionSleepInput } from "../../src/sleep/resolveDecisionSleepInput";
import { getDecision, isNormalizedDecisionError } from "../../src/services/decision/getDecision";
import { hashDecisionInputs } from "../../src/services/decision/inputHash";
import type { DecisionInputs, DietPhase, LastResultPayload, TrainingPhase } from "../../src/types/decision";
import { isExpectedOfflineError } from "../../src/utils/networkErrors";
import {
  computeWeeklyWorkoutMetrics,
  getCalendarMatrix,
  getDaySummaryMap,
  getWorkoutSetCount,
  getWorkoutVolumeKg,
  toDateKey,
  type WorkoutSummary,
} from "../../src/workouts/homeInsights";
import {
  buildProgramCalendarEntryForDate,
  buildWorkoutCountByDateMap,
  normalizeProgram,
  type WorkoutProgram,
} from "../../src/workouts/program";

const HOME_INPUTS_KEY_PREFIX = "home-inputs-v1";
const HOME_FIRST_TIME_BANNER_KEY_PREFIX = "home-first-time-banner-dismissed-v1";
const TRAINING_PHASES: TrainingPhase[] = ["Hypertrophy", "Strength", "Power"];
const DIET_PHASES: DietPhase[] = ["Cut", "Maintain", "Bulk"];

const isTrainingPhase = (value: string): value is TrainingPhase =>
  TRAINING_PHASES.includes(value as TrainingPhase);
const isDietPhase = (value: string): value is DietPhase => DIET_PHASES.includes(value as DietPhase);

const formatDecisionLabel = (decision: string) => decision.replace("_", " ");
const formatIntensityLabel = (value?: number) => {
  if (value == null || value === 0) return "No change";
  const sign = value > 0 ? "+" : "";
  return `Intensity: ${sign}${value}%`;
};

const getReasonMessage = (reasonCode: ReasonCode): string => {
  switch (reasonCode) {
    case "FREE_WINDOW_EXHAUSTED":
      return "Free window is exhausted.";
    case "DAILY_LIMIT":
      return "Daily limit reached.";
    case "COOLDOWN_ACTIVE":
      return "Please wait before requesting another decision.";
    default:
      return "Unable to get a decision right now.";
  }
};

const formatCooldownMessage = (cooldownSeconds: number | null): string => {
  if (cooldownSeconds == null) return "Please wait before requesting another decision.";
  if (cooldownSeconds <= 0) return "Cooldown complete. Try again now.";
  const minutes = Math.max(1, Math.ceil(cooldownSeconds / 60));
  return `Try again in ${minutes} min.`;
};

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

type NutritionSnapshot = {
  averageCalories: number | null;
  consistencyScore: number | null;
};

type SleepSnapshot = {
  averageSleepHours: number | null;
  nightsCaptured: number;
};

type DashboardMetricKey =
  | "workouts"
  | "volume"
  | "adherence"
  | "calories"
  | "sleep"
  | "improving";

type GraphPoint = {
  label: string;
  value: number;
};

type TrainingPhaseHistoryEntry = {
  phase: TrainingPhase;
  startedAt: Timestamp;
};

type DietPhaseHistoryEntry = {
  phase: DietPhase;
  startedAt: Timestamp;
};

const TRAINING_PHASE_COLORS: Record<TrainingPhase, string> = {
  Hypertrophy: "#60a5fa",
  Strength: "#f59e0b",
  Power: "#f43f5e",
};

const DIET_PHASE_COLORS: Record<DietPhase, string> = {
  Cut: "#38bdf8",
  Maintain: "#34d399",
  Bulk: "#f97316",
};

export default function Home() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [userNickname, setUserNickname] = useState<string | null>(null);
  const [showFirstTimeBanner, setShowFirstTimeBanner] = useState(false);

  const [soreness, setSoreness] = useState(4);
  const [fatigue, setFatigue] = useState(4);
  const [motivation, setMotivation] = useState(6);
  const [trainingPhase, setTrainingPhase] = useState<TrainingPhase>("Hypertrophy");
  const [dietPhase, setDietPhase] = useState<DietPhase>("Maintain");
  const [sleepTargetHours, setSleepTargetHours] = useState(7);

  const [loading, setLoading] = useState(false);
  const [gateError, setGateError] = useState<NormalizedDecisionError | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);
  const [latestDecision, setLatestDecision] = useState<LastResultPayload | null>(null);
  const [showAdjustHelp, setShowAdjustHelp] = useState(false);
  const [showAdjustInputsModal, setShowAdjustInputsModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [activeDashboardMetric, setActiveDashboardMetric] = useState<DashboardMetricKey | null>(
    null
  );
  const [lastTapAt, setLastTapAt] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [workoutsLoading, setWorkoutsLoading] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [workoutProgram, setWorkoutProgram] = useState<WorkoutProgram | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [nutritionSnapshot, setNutritionSnapshot] = useState<NutritionSnapshot>({
    averageCalories: null,
    consistencyScore: null,
  });
  const [nutritionCalorieHistory, setNutritionCalorieHistory] = useState<GraphPoint[]>([]);
  const [nutritionAdherenceHistory, setNutritionAdherenceHistory] = useState<GraphPoint[]>([]);
  const [sleepSnapshot, setSleepSnapshot] = useState<SleepSnapshot>({
    averageSleepHours: null,
    nightsCaptured: 0,
  });
  const [sleepHistory, setSleepHistory] = useState<GraphPoint[]>([]);
  const [trainingPhaseStartedAt, setTrainingPhaseStartedAt] = useState<Timestamp | null>(null);
  const [dietPhaseStartedAt, setDietPhaseStartedAt] = useState<Timestamp | null>(null);
  const [trainingPhaseHistory, setTrainingPhaseHistory] = useState<TrainingPhaseHistoryEntry[]>([]);
  const [dietPhaseHistory, setDietPhaseHistory] = useState<DietPhaseHistoryEntry[]>([]);

  const entitlement = useEntitlement(authReady, uid);
  const { isOffline } = useOfflineStatus();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthReady(true);
      if (!user) {
        setUid(null);
        setUserNickname(null);
        setShowFirstTimeBanner(false);
        setLatestDecision(null);
        setRedirectTo("/auth/sign-in");
        return;
      }

      setRedirectTo(null);
      setUid(user.uid);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    (async () => {
      try {
        const key = `${HOME_FIRST_TIME_BANNER_KEY_PREFIX}:${uid}`;
        const raw = await AsyncStorage.getItem(key);
        if (!active) return;
        setShowFirstTimeBanner(raw !== "true");
      } catch {
        if (!active) return;
        setShowFirstTimeBanner(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setUserNickname(null);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const data: any = snap.data();
        const nickname = typeof data?.nickname === "string" ? data.nickname.trim() : "";
        setUserNickname(nickname || null);
        if (isTrainingPhase(data?.trainingPhase)) {
          setTrainingPhase(data.trainingPhase);
        }
        if (isDietPhase(data?.dietPhase)) {
          setDietPhase(data.dietPhase);
        }
        setWorkoutProgram(normalizeProgram(data?.workoutProgram));
        setTrainingPhaseStartedAt(
          data?.trainingPhaseStartedAt instanceof Timestamp ? data.trainingPhaseStartedAt : null
        );
        setDietPhaseStartedAt(
          data?.dietPhaseStartedAt instanceof Timestamp ? data.dietPhaseStartedAt : null
        );
        const rawTrainingHistory = Array.isArray(data?.trainingPhaseHistory)
          ? data.trainingPhaseHistory
          : [];
        const rawDietHistory = Array.isArray(data?.dietPhaseHistory) ? data.dietPhaseHistory : [];
        const parsedTrainingHistory = rawTrainingHistory
          .map((entry: any) => ({
            phase: isTrainingPhase(entry?.phase) ? entry.phase : null,
            startedAt: entry?.startedAt instanceof Timestamp ? entry.startedAt : null,
          }))
          .filter(
            (
              entry: {
                phase: TrainingPhase | null;
                startedAt: Timestamp | null;
              }
            ): entry is TrainingPhaseHistoryEntry =>
              entry.phase != null && entry.startedAt != null
          )
          .sort(
            (a: TrainingPhaseHistoryEntry, b: TrainingPhaseHistoryEntry) =>
              a.startedAt.toMillis() - b.startedAt.toMillis()
          );
        const parsedDietHistory = rawDietHistory
          .map((entry: any) => ({
            phase: isDietPhase(entry?.phase) ? entry.phase : null,
            startedAt: entry?.startedAt instanceof Timestamp ? entry.startedAt : null,
          }))
          .filter(
            (
              entry: {
                phase: DietPhase | null;
                startedAt: Timestamp | null;
              }
            ): entry is DietPhaseHistoryEntry =>
              entry.phase != null && entry.startedAt != null
          )
          .sort(
            (a: DietPhaseHistoryEntry, b: DietPhaseHistoryEntry) =>
              a.startedAt.toMillis() - b.startedAt.toMillis()
          );
        setTrainingPhaseHistory(parsedTrainingHistory);
        setDietPhaseHistory(parsedDietHistory);
        const target = data?.sleepSettings?.targetHours;
        if (typeof target === "number" && Number.isFinite(target) && target > 0 && target <= 24) {
          setSleepTargetHours(Math.round(target * 10) / 10);
        }

        const lastResult = data?.usage?.decisions?.lastResult;
        if (lastResult) {
          setLatestDecision(lastResult as LastResultPayload);
        }
      },
      (e) => {
        if (!isExpectedOfflineError(e)) {
          console.log("Failed to subscribe user profile", e);
        }
      }
    );

    return unsubscribe;
  }, [uid]);

  useEffect(() => {
    const loadInputs = async () => {
      if (!uid) return;
      const key = `${HOME_INPUTS_KEY_PREFIX}:${uid}`;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (typeof parsed.soreness === "number") setSoreness(parsed.soreness);
        if (typeof parsed.fatigue === "number") setFatigue(parsed.fatigue);
        if (typeof parsed.motivation === "number") setMotivation(parsed.motivation);
      } catch (e) {
        console.log("Failed to load home inputs, clearing cache", e);
        try {
          await AsyncStorage.removeItem(key);
        } catch {
          // no-op
        }
      }
    };
    void loadInputs();
  }, [uid]);

  useEffect(() => {
    const save = async () => {
      if (!uid) return;
      const key = `${HOME_INPUTS_KEY_PREFIX}:${uid}`;
      try {
        await AsyncStorage.setItem(
          key,
          JSON.stringify({
            soreness,
            fatigue,
            motivation,
          })
        );
      } catch (e) {
        console.log("Failed to save home inputs", e);
      }
    };
    void save();
  }, [uid, soreness, fatigue, motivation]);

  useEffect(() => {
    if (cooldownSeconds == null || cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((previous) => {
        if (previous == null) return previous;
        return previous > 0 ? previous - 1 : 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const loadHomeInsights = useCallback(async () => {
    if (!uid) return;
    setWorkoutsLoading(true);
    setInsightsError(null);
    try {
      const workoutsRef = collection(db, "users", uid, "workouts");
      const workoutsSnap = await getDocs(query(workoutsRef, orderBy("date", "desc"), limit(120)));
      const parsedWorkouts: WorkoutSummary[] = [];
      workoutsSnap.forEach((docSnap) => {
        const data: any = docSnap.data();
        const rawDate =
          data?.date?.toDate?.() ||
          data?.endedAt?.toDate?.() ||
          data?.createdAt?.toDate?.() ||
          null;
        if (!(rawDate instanceof Date)) return;
        parsedWorkouts.push({
          id: docSnap.id,
          title: typeof data?.title === "string" ? data.title : "Workout",
          date: rawDate,
          trainingPhase: typeof data?.trainingPhase === "string" ? data.trainingPhase : null,
          exercises: (data?.exercises ?? []).map((exercise: any) => ({
            name: typeof exercise?.name === "string" ? exercise.name : "Exercise",
            notes: typeof exercise?.notes === "string" ? exercise.notes : "",
            tempo: typeof exercise?.tempo === "string" ? exercise.tempo : "",
            zone: typeof exercise?.zone === "string" ? exercise.zone : "",
            mode: exercise?.mode === "cardio" ? "cardio" : "resistance",
            sets: (exercise?.sets ?? []).map((set: any) => ({
              weightKg: typeof set?.weightKg === "number" ? set.weightKg : null,
              reps: String(set?.reps ?? ""),
              distanceKm: typeof set?.distanceKm === "number" ? set.distanceKm : null,
              durationSec: typeof set?.durationSec === "number" ? set.durationSec : null,
              zone: typeof set?.zone === "string" ? set.zone : null,
              setType: typeof set?.setType === "string" ? set.setType : null,
              rpe:
                typeof set?.rpe === "number" && Number.isFinite(set.rpe)
                  ? set.rpe
                  : null,
            })),
          })),
        });
      });
      setWorkouts(parsedWorkouts);

      try {
        const [profile, userData, sleepProfile] = await Promise.all([
          getNutritionProfile(uid),
          getUserData(uid),
          getSleepProfile(uid),
        ]);
        const userDietPhase =
          typeof userData?.dietPhase === "string" && isDietPhase(userData.dietPhase)
            ? userData.dietPhase
            : dietPhase;
        const target = getCalorieTargetForDietPhase(profile.calorieTargetsByDietPhase, userDietPhase);
        const nutritionTrends = await getNutritionTrendReport(uid, target, 7);
        setNutritionSnapshot({
          averageCalories: nutritionTrends.averageCalories ?? null,
          consistencyScore: nutritionTrends.consistencyScore ?? null,
        });
        const calorieHistory = [...nutritionTrends.dailyHistory]
          .reverse()
          .map((entry) => ({
            label: entry.dateKey.slice(5),
            value: entry.calories,
          }));
        const adherenceHistory = [...nutritionTrends.dailyHistory]
          .reverse()
          .map((entry) => ({
            label: entry.dateKey.slice(5),
            value: entry.adherence === "on_target" ? 100 : entry.adherence ? 0 : 50,
          }));
        setNutritionCalorieHistory(calorieHistory);
        setNutritionAdherenceHistory(adherenceHistory);
        const recentSleep = sleepProfile.recentNightlyHours ?? [];
        const sleepValues = recentSleep
          .map((entry) => entry.sleepHours)
          .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
        const nextSleepHistory = [...recentSleep]
          .reverse()
          .map((entry) => ({
            label: entry.dateKey.slice(5),
            value: entry.sleepHours,
          }))
          .filter((entry) => Number.isFinite(entry.value));
        setSleepHistory(nextSleepHistory);
        const avgSleep =
          sleepValues.length > 0
            ? Math.round(
                (sleepValues.reduce((sum, value) => sum + value, 0) / sleepValues.length) * 10
              ) / 10
            : null;
        setSleepSnapshot({
          averageSleepHours: avgSleep,
          nightsCaptured: sleepValues.length,
        });
      } catch (contextError) {
        if (!isExpectedOfflineError(contextError)) {
          console.log("Failed to load nutrition/sleep insight context", contextError);
        }
      }
    } catch (error) {
      if (!isExpectedOfflineError(error)) {
        console.log("Failed to load home insights", error);
      }
      setInsightsError(
        isExpectedOfflineError(error)
          ? "You're offline. Insights will refresh when you reconnect."
          : "Couldn't refresh home insights right now."
      );
    } finally {
      setWorkoutsLoading(false);
    }
  }, [uid, dietPhase]);

  useFocusEffect(
    useCallback(() => {
      void loadHomeInsights();
      return undefined;
    }, [loadHomeInsights])
  );

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return undefined;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        BackHandler.exitApp();
        return true;
      });
      return () => subscription.remove();
    }, [])
  );

  const daySummaryMap = useMemo(() => getDaySummaryMap(workouts), [workouts]);
  const selectedDaySummary = daySummaryMap.get(selectedDateKey) ?? null;
  const calendarMatrix = useMemo(() => getCalendarMatrix(calendarMonth), [calendarMonth]);
  const visibleCalendarWeeks = useMemo(
    () =>
      calendarMatrix.filter((week) =>
        week.some((day) => day.getMonth() === calendarMonth.getMonth())
      ),
    [calendarMatrix, calendarMonth]
  );
  const weeklyMetrics = useMemo(() => computeWeeklyWorkoutMetrics(workouts), [workouts]);
  const trainingPhaseWeek = useMemo(() => {
    if (!trainingPhaseStartedAt) return 1;
    const start = trainingPhaseStartedAt.toDate();
    const diffMs = Date.now() - start.getTime();
    const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
    return Math.max(1, week);
  }, [trainingPhaseStartedAt]);
  const dietPhaseWeek = useMemo(() => {
    if (!dietPhaseStartedAt) return 1;
    const start = dietPhaseStartedAt.toDate();
    const diffMs = Date.now() - start.getTime();
    const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
    return Math.max(1, week);
  }, [dietPhaseStartedAt]);

  const selectedDayWorkouts = useMemo(
    () => workouts.filter((workout) => toDateKey(workout.date) === selectedDateKey),
    [workouts, selectedDateKey]
  );
  const workoutCountByDate = useMemo(
    () => buildWorkoutCountByDateMap(workouts.map((workout) => workout.date)),
    [workouts]
  );
  const selectedProgramEntry = useMemo(
    () =>
      workoutProgram
        ? buildProgramCalendarEntryForDate(
            new Date(`${selectedDateKey}T12:00:00`),
            workoutProgram,
            workoutCountByDate
          )
        : null,
    [selectedDateKey, workoutCountByDate, workoutProgram]
  );

  const dashboardGraphTitle = useMemo(() => {
    switch (activeDashboardMetric) {
      case "workouts":
        return "Workouts Completed";
      case "volume":
        return "Volume Trend";
      case "adherence":
        return "Adherence Trend";
      case "calories":
        return "Calories Trend";
      case "sleep":
        return "Sleep Trend";
      case "improving":
        return "Improvement Signal";
      default:
        return "";
    }
  }, [activeDashboardMetric]);

  const dashboardGraphUnit = useMemo(() => {
    switch (activeDashboardMetric) {
      case "volume":
        return "kg";
      case "calories":
        return "kcal";
      case "sleep":
        return "h";
      case "adherence":
      case "improving":
        return "%";
      default:
        return "";
    }
  }, [activeDashboardMetric]);

  const dashboardGraphData = useMemo<GraphPoint[]>(() => {
    switch (activeDashboardMetric) {
      case "workouts":
        return [
          { label: "Last wk", value: weeklyMetrics.workoutsLastWeek },
          { label: "This wk", value: weeklyMetrics.workoutsThisWeek },
        ];
      case "volume":
        return [
          { label: "Last wk", value: Math.round(weeklyMetrics.avgVolumeLastWeek) },
          { label: "This wk", value: Math.round(weeklyMetrics.avgVolumeThisWeek) },
        ];
      case "adherence":
        return nutritionAdherenceHistory;
      case "calories":
        return nutritionCalorieHistory;
      case "sleep":
        return sleepHistory;
      case "improving":
        return [
          { label: "Volume", value: weeklyMetrics.improvingByVolume ? 100 : 0 },
          { label: "Sets", value: weeklyMetrics.improvingBySets ? 100 : 0 },
        ];
      default:
        return [];
    }
  }, [
    activeDashboardMetric,
    nutritionAdherenceHistory,
    nutritionCalorieHistory,
    sleepHistory,
    weeklyMetrics.avgVolumeLastWeek,
    weeklyMetrics.avgVolumeThisWeek,
    weeklyMetrics.improvingBySets,
    weeklyMetrics.improvingByVolume,
    weeklyMetrics.workoutsLastWeek,
    weeklyMetrics.workoutsThisWeek,
  ]);

  const seedSampleMonth = async () => {
    if (!uid || seedLoading) return;
    setSeedLoading(true);
    try {
      const now = new Date();
      const templates = [
        {
          title: "Upper A",
          exercises: [
            { name: "Bench Press", sets: [{ weightKg: 70, reps: "8" }, { weightKg: 72.5, reps: "6" }] },
            { name: "Barbell Row", sets: [{ weightKg: 65, reps: "8" }, { weightKg: 67.5, reps: "7" }] },
          ],
        },
        {
          title: "Lower A",
          exercises: [
            { name: "Squat", sets: [{ weightKg: 100, reps: "5" }, { weightKg: 105, reps: "5" }] },
            { name: "Romanian Deadlift", sets: [{ weightKg: 90, reps: "8" }, { weightKg: 92.5, reps: "8" }] },
          ],
        },
        {
          title: "Upper B",
          exercises: [
            { name: "Overhead Press", sets: [{ weightKg: 45, reps: "8" }, { weightKg: 47.5, reps: "6" }] },
            { name: "Lat Pulldown", sets: [{ weightKg: 60, reps: "10" }, { weightKg: 65, reps: "8" }] },
          ],
        },
      ] as const;

      const writes: Promise<unknown>[] = [];
      for (let dayOffset = 0; dayOffset < 28; dayOffset += 1) {
        if (dayOffset % 2 !== 0) continue;
        const baseDate = new Date(now);
        baseDate.setDate(now.getDate() - dayOffset);
        baseDate.setHours(18, 30, 0, 0);
        const template = templates[dayOffset % templates.length];
        const progression = Math.max(0, Math.floor((28 - dayOffset) / 7));
        const exercises = template.exercises.map((exercise) => ({
          name: exercise.name,
          sets: exercise.sets.map((set) => ({
            weightKg: Math.round((set.weightKg + progression * 1.25) * 10) / 10,
            reps: set.reps,
          })),
        }));
        writes.push(
          addDoc(collection(db, "users", uid, "workouts"), {
            title: template.title,
            date: Timestamp.fromDate(baseDate),
            trainingPhase,
            exercises,
            followedRecommendation: "yes",
            helpful: "yes",
            createdAt: Timestamp.now(),
            seededBy: "phase-7b",
          })
        );
      }
      await Promise.all(writes);
      await loadHomeInsights();
      showAppAlert("Seed complete", "Added sample workouts for the last 4 weeks.");
    } catch (error) {
      console.log("Failed to seed sample workouts", error);
      showAppAlert("Seed failed", "Could not add sample workouts.");
    } finally {
      setSeedLoading(false);
    }
  };

  const clearSeededWorkouts = async () => {
    if (!uid || seedLoading) return;
    setSeedLoading(true);
    try {
      const seededSnap = await getDocs(
        query(collection(db, "users", uid, "workouts"), where("seededBy", "==", "phase-7b"), limit(200))
      );
      const deletes: Promise<void>[] = [];
      seededSnap.forEach((docSnap) => {
        deletes.push(deleteDoc(doc(db, "users", uid, "workouts", docSnap.id)));
      });
      await Promise.all(deletes);
      await loadHomeInsights();
      showAppAlert("Cleared", "Removed seeded workouts.");
    } catch (error) {
      console.log("Failed to clear seeded workouts", error);
      showAppAlert("Clear failed", "Could not remove seeded workouts.");
    } finally {
      setSeedLoading(false);
    }
  };

  const shouldShowUpgradeCta =
    gateError?.bucket === "business_gate" && entitlement.state === "inactive";

  const handleOpenPaywallFromGate = () => {
    if (gateError?.bucket !== "business_gate" || entitlement.state !== "inactive") return;

    const paywallParams =
      gateError.reasonCode === "COOLDOWN_ACTIVE"
        ? { sourceScreen: "cooldown_gate", reasonCode: "cooldown_gate" }
        : { sourceScreen: "home_gate", reasonCode: "decision_limit" };

    router.push({
      pathname: "/paywall",
      params: paywallParams,
    });
  };

  const resolvePhaseForDate = <TPhase extends string>(
    date: Date,
    history: { phase: TPhase; startedAt: Timestamp }[],
    fallbackPhase: TPhase
  ): TPhase => {
    if (!history.length) return fallbackPhase;
    const targetDateKey = toDateKey(date);
    let selected = history[0].phase;
    for (const entry of history) {
      const entryDateKey = toDateKey(entry.startedAt.toDate());
      if (entryDateKey <= targetDateKey) {
        selected = entry.phase;
      } else {
        break;
      }
    }
    return selected;
  };

  const handleDecision = async () => {
    if (!uid || loading) return;
    const nowMs = Date.now();
    if (nowMs - lastTapAt < 500) return;

    setLastTapAt(nowMs);
    if (isOffline) {
      setGateError({
        bucket: "other",
        message: "You're offline. Connect to get today's decision.",
      });
      setCooldownSeconds(null);
      return;
    }
    setLoading(true);
    setGateError(null);
    setCooldownSeconds(null);

    try {
        let nutrition: DecisionInputs["nutrition"] = null;
        let effectiveSleepHours = sleepTargetHours;
        let sleepSource: DecisionInputs["sleepSource"] = "manual";
        let sleepSampleAgeHours: DecisionInputs["sleepSampleAgeHours"] = 0;
        try {
          nutrition = await getTodayDecisionNutritionSummary(uid, dietPhase);
        } catch (nutritionError) {
          if (!isExpectedOfflineError(nutritionError)) {
            console.log("Failed to load nutrition summary", nutritionError);
          }
        }

        try {
          const sleepProfile = await getSleepProfile(uid);
          const sampleAgeHours = getSleepSampleAgeHours(sleepProfile.sampleRecordedAt);
          const stale = isHealthSleepStale(sleepProfile, new Date());
          const resolvedSleep = resolveDecisionSleepInput(sleepTargetHours, {
            source: sleepProfile.source,
            latestSleepHours: sleepProfile.latestSleepHours,
            sampleAgeHours: stale ? null : sampleAgeHours,
          });
          effectiveSleepHours = resolvedSleep.sleepHours;
          sleepSource = resolvedSleep.sleepSource;
          sleepSampleAgeHours = resolvedSleep.sleepSampleAgeHours;
        } catch (sleepError) {
          if (!isExpectedOfflineError(sleepError)) {
            console.log("Failed to resolve sleep source", sleepError);
          }
        }

      const inputs: DecisionInputs = {
        sleepHours: effectiveSleepHours,
        sleepSource,
        sleepSampleAgeHours,
        soreness,
        fatigue,
        motivation,
        trainingPhase,
        dietPhase,
        nutrition,
      };

      const result = await getDecision(inputs);
      const payload: LastResultPayload = {
        createdAt: Timestamp.now(),
        inputs,
        result,
      };
      const inputHash = hashDecisionInputs(inputs);

      const userRef = doc(db, "users", uid);
      await setDoc(
        userRef,
        { usage: { decisions: { lastResult: payload, lastInputHash: inputHash } } },
        { merge: true }
        );
        await updateDoc(userRef, {
          "usage.decisions.lastResult.inputs.phase": deleteField(),
          "usage.decisions.lastResult.inputs.nutrition.calorieTargetAdherence":
            deleteField(),
        });

      setLatestDecision(payload);
    } catch (error) {
      if (isNormalizedDecisionError(error)) {
        setGateError(error);
        if (error.bucket === "business_gate" && error.reasonCode === "COOLDOWN_ACTIVE") {
          if (typeof error.retryAfterSeconds === "number") {
            setCooldownSeconds(error.retryAfterSeconds);
          }
        }
        return;
      }

      console.log("Decision request failed", error);
      setGateError({
        bucket: "other",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (redirectTo) return <Redirect href={redirectTo} />;

  const dismissFirstTimeBanner = async () => {
    if (!uid) return;
    setShowFirstTimeBanner(false);
    try {
      const key = `${HOME_FIRST_TIME_BANNER_KEY_PREFIX}:${uid}`;
      await AsyncStorage.setItem(key, "true");
    } catch {
      // no-op
    }
  };

  const openWorkoutLog = async () => {
    router.push("/(tabs)/workout/log" as Href);
  };

  const openRoutineBuilder = async () => {
    router.push("/(tabs)/workout/log?createRoutine=1" as Href);
  };

  const shouldShowFirstTimeBanner = showFirstTimeBanner && workouts.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>lastrep</Text>
          <View style={styles.userRow}>
            <Text style={styles.userName}>{userNickname ?? "Lifter"}</Text>
            <View
              style={[
                styles.entitlementBadge,
                entitlement.state === "active"
                  ? styles.entitlementBadgeActive
                  : entitlement.state === "inactive"
                    ? styles.entitlementBadgeInactive
                    : styles.entitlementBadgeLoading,
              ]}
            >
              <Text
                style={[
                  styles.entitlementBadgeText,
                  entitlement.state === "active"
                    ? styles.entitlementBadgeTextActive
                    : styles.entitlementBadgeTextMuted,
                ]}
              >
                {entitlement.state === "active"
                  ? "Premium"
                  : entitlement.state === "inactive"
                    ? "Free"
                    : "Checking"}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.iconContainer}>
          <TouchableOpacity onPress={() => setShowCalendarModal(true)}>
            <Ionicons name="calendar-outline" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/settings" as Href)} style={{ marginLeft: 12 }}>
            <Ionicons name="settings-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {shouldShowFirstTimeBanner ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Get Started</Text>
            <View style={[styles.card, styles.firstTimeBannerCard]}>
              <View style={styles.firstTimeBannerHeader}>
                <Text style={[styles.cardText, styles.firstTimeBannerText]}>
                  Set up your first routine or jump into your first workout.
                </Text>
                <TouchableOpacity onPress={() => void dismissFirstTimeBanner()} style={styles.firstTimeDismiss}>
                  <Ionicons name="close" size={16} color="#cfd3eb" />
                </TouchableOpacity>
              </View>
              <View style={styles.firstTimeActions}>
                <TouchableOpacity
                  style={[styles.secondaryButtonWide, styles.firstTimeActionButton]}
                  onPress={() => void openRoutineBuilder()}
                >
                  <Text style={styles.secondaryButtonText}>Create routine</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButtonWide, styles.firstTimeActionButton]}
                  onPress={() => void openWorkoutLog()}
                >
                  <Text style={styles.primaryText}>Start workout</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dashboard</Text>
          <View style={styles.card}>
            <View style={styles.metricRow}>
              <TouchableOpacity
                style={styles.metricChip}
                onPress={() => setActiveDashboardMetric("workouts")}
              >
                <Text style={styles.metricLabel}>Workouts</Text>
                <Text style={styles.metricValue}>{weeklyMetrics.workoutsThisWeek}</Text>
                <Text style={styles.metricSub}>Last week: {weeklyMetrics.workoutsLastWeek}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.metricChip}
                onPress={() => setActiveDashboardMetric("volume")}
              >
                <Text style={styles.metricLabel}>Volume trend</Text>
                <Text style={styles.metricValue}>
                  {Math.round(weeklyMetrics.avgVolumeThisWeek)} kg
                </Text>
                <Text style={styles.metricSub}>
                  {weeklyMetrics.improvingByVolume ? "Improving" : "Flat/Down"} vs last week
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.metricRow}>
              <TouchableOpacity
                style={styles.metricChip}
                onPress={() => setActiveDashboardMetric("adherence")}
              >
                <Text style={styles.metricLabel}>Adherence</Text>
                <Text style={styles.metricValue}>
                  {nutritionSnapshot.consistencyScore == null
                    ? "-"
                    : `${nutritionSnapshot.consistencyScore}%`}
                </Text>
                <Text style={styles.metricSub}>Calories on-target consistency</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.metricChip}
                onPress={() => setActiveDashboardMetric("calories")}
              >
                <Text style={styles.metricLabel}>Calories</Text>
                <Text style={styles.metricValue}>
                  {nutritionSnapshot.averageCalories == null
                    ? "-"
                    : `${Math.round(nutritionSnapshot.averageCalories)}`}
                </Text>
                <Text style={styles.metricSub}>Avg daily (last 7 full days)</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.metricRow}>
              <TouchableOpacity
                style={styles.metricChip}
                onPress={() => setActiveDashboardMetric("sleep")}
              >
                <Text style={styles.metricLabel}>Sleep trend</Text>
                <Text style={styles.metricValue}>
                  {sleepSnapshot.averageSleepHours == null
                    ? "-"
                    : `${sleepSnapshot.averageSleepHours}h`}
                </Text>
                <Text style={styles.metricSub}>{sleepSnapshot.nightsCaptured} nights captured</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.metricChip}
                onPress={() => setActiveDashboardMetric("improving")}
              >
                <Text style={styles.metricLabel}>Are you improving?</Text>
                <Text style={styles.metricValue}>
                  {weeklyMetrics.improvingByVolume || weeklyMetrics.improvingBySets
                    ? "Yes"
                    : "Not yet"}
                </Text>
                <Text style={styles.metricSub}>Based on weekly sets/volume</Text>
              </TouchableOpacity>
            </View>
            {workoutsLoading ? <Text style={styles.cardText}>Refreshing dashboard...</Text> : null}
            {insightsError ? <Text style={styles.noticeSub}>{insightsError}</Text> : null}
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inputs</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>
              Soreness {soreness} - Fatigue {fatigue} - Motivation {motivation}
            </Text>
            <View style={styles.inputActionsRow}>
              <TouchableOpacity
                style={[styles.secondaryButtonWide, styles.inputActionButton]}
                onPress={() => setShowAdjustInputsModal(true)}
              >
                <Text style={styles.secondaryButtonText}>Adjust inputs</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButtonWide, styles.inputActionButton, loading && styles.disabled]}
                onPress={handleDecision}
                disabled={loading}
              >
                <Text style={styles.primaryText}>{loading ? "Working..." : "Get today's decision"}</Text>
              </TouchableOpacity>
            </View>

            {gateError ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>
                  {gateError.bucket === "business_gate"
                    ? getReasonMessage(gateError.reasonCode)
                    : gateError.message ?? "Unable to get a decision right now."}
                </Text>
                {gateError.bucket === "business_gate" && gateError.reasonCode === "COOLDOWN_ACTIVE" ? (
                  <Text style={styles.noticeSub}>{formatCooldownMessage(cooldownSeconds)}</Text>
                ) : null}
                {gateError.bucket === "seatbelt" ? (
                  <Text style={styles.noticeSub}>Too many requests. Try again shortly.</Text>
                ) : null}
                {shouldShowUpgradeCta ? (
                  <TouchableOpacity style={styles.paywallButton} onPress={handleOpenPaywallFromGate}>
                    <Text style={styles.paywallText}>Upgrade to Premium</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Decision</Text>
          <View style={styles.card}>
            {latestDecision ? (
              <>
                <Text style={styles.decisionTitle}>{formatDecisionLabel(latestDecision.result.decision)}</Text>
                <View style={styles.bulletList}>
                  {latestDecision.result.explanation.map((line, index) => (
                    <Text key={`${line}-${index}`} style={styles.bulletItem}>
                      - {line}
                    </Text>
                  ))}
                </View>
                <View style={styles.adjustRow}>
                  <Text style={styles.adjustText}>
                    {formatIntensityLabel(latestDecision.result.adjustments?.intensityPct)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowAdjustHelp((previous) => !previous)}
                    style={styles.helpIcon}
                    accessibilityLabel="What does intensity mean?"
                  >
                    <Ionicons name="help-circle-outline" size={18} color="#9aa1c3" />
                  </TouchableOpacity>
                </View>
                {showAdjustHelp ? (
                  <Text style={styles.helpText}>Intensity adjustment = change the weight on your sets.</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.cardText}>No decision yet.</Text>
            )}
          </View>
        </View>

      </ScrollView>

      <Modal visible={showCalendarModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.calendarModalHeaderRow}>
              <Text style={styles.modalTitle}>Calendar</Text>
              <TouchableOpacity onPress={() => setShowCalendarModal(false)} style={styles.calendarCloseButton}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.calendarHeaderRow}>
              <TouchableOpacity
                style={styles.calendarNavButton}
                onPress={() =>
                  setCalendarMonth(
                    (previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1)
                  )
                }
              >
                <Ionicons name="chevron-back" size={18} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.calendarMonthText}>
                {MONTH_LABELS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
              </Text>
              <TouchableOpacity
                style={styles.calendarNavButton}
                onPress={() =>
                  setCalendarMonth(
                    (previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1)
                  )
                }
              >
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarWeekdayRow}>
              {WEEKDAY_LABELS.map((label, index) => (
                <Text key={`${label}-${index}`} style={styles.calendarWeekdayText}>
                  {label}
                </Text>
              ))}
            </View>

            {visibleCalendarWeeks.map((week, weekIndex) => (
              <View key={`week-${weekIndex}`} style={styles.calendarWeekRow}>
                {week.map((day) => {
                  const dateKey = toDateKey(day);
                  const inCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                  const isToday = dateKey === toDateKey(new Date());
                  const isSelected = dateKey === selectedDateKey;
                  const daySummary = daySummaryMap.get(dateKey);
                  const programEntry = workoutProgram
                    ? buildProgramCalendarEntryForDate(day, workoutProgram, workoutCountByDate)
                    : null;
                  const dayTrainingPhase = resolvePhaseForDate(
                    day,
                    trainingPhaseHistory,
                    trainingPhase
                  );
                  const dayDietPhase = resolvePhaseForDate(day, dietPhaseHistory, dietPhase);
                  return (
                    <TouchableOpacity
                      key={dateKey}
                      style={[
                        styles.calendarDayCell,
                        !inCurrentMonth && styles.calendarDayCellOutOfMonth,
                        isSelected && styles.calendarDayCellSelected,
                        isToday && styles.calendarDayCellToday,
                      ]}
                      onPress={() => {
                        setSelectedDateKey(dateKey);
                        setShowDayModal(true);
                      }}
                    >
                      <Text
                        style={[
                          styles.calendarDayText,
                          !inCurrentMonth && styles.calendarDayTextMuted,
                          isSelected && styles.calendarDayTextSelected,
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                      <View style={styles.phaseTracks}>
                        <View
                          style={[
                            styles.phaseTrack,
                            { backgroundColor: TRAINING_PHASE_COLORS[dayTrainingPhase] },
                          ]}
                        />
                        <View
                          style={[
                            styles.phaseTrack,
                            { backgroundColor: DIET_PHASE_COLORS[dayDietPhase] },
                          ]}
                        />
                      </View>
                      <View
                        style={[
                          styles.calendarWorkoutDot,
                          !daySummary?.workoutCount && styles.calendarWorkoutDotHidden,
                        ]}
                      />
                      {programEntry ? (
                        <Text style={styles.calendarProgramTag}>
                          {programEntry.type === "rest" ? "R" : `D${programEntry.dayNumber}`}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            <View style={styles.phaseWeekRow}>
              <View
                style={[
                  styles.phasePill,
                  { borderColor: TRAINING_PHASE_COLORS[trainingPhase] },
                ]}
              >
                <View
                  style={[
                    styles.phasePillDot,
                    { backgroundColor: TRAINING_PHASE_COLORS[trainingPhase] },
                  ]}
                />
                <Text style={styles.phaseWeekText}>
                  Training: {trainingPhase} - Week {trainingPhaseWeek}
                </Text>
              </View>
              <View
                style={[
                  styles.phasePill,
                  { borderColor: DIET_PHASE_COLORS[dietPhase] },
                ]}
              >
                <View
                  style={[
                    styles.phasePillDot,
                    { backgroundColor: DIET_PHASE_COLORS[dietPhase] },
                  ]}
                />
                <Text style={styles.phaseWeekText}>
                  Diet: {dietPhase} - Week {dietPhaseWeek}
                </Text>
              </View>
            </View>

            <Text style={styles.cardText}>
              {selectedDaySummary
                ? `${selectedDateKey}: ${selectedDaySummary.workoutCount} workout(s), ${selectedDaySummary.totalSets} sets, ${Math.round(selectedDaySummary.totalVolumeKg)} kg volume`
                : `${selectedDateKey}: no workouts logged`}
            </Text>
            {selectedProgramEntry ? (
              <Text style={styles.noticeSub}>
                Program:{" "}
                {selectedProgramEntry.type === "rest"
                  ? "Rest"
                  : `Day ${selectedProgramEntry.dayNumber} (${selectedProgramEntry.title})`}
              </Text>
            ) : null}
            {__DEV__ ? (
              <View style={styles.devActionsRow}>
                <TouchableOpacity
                  style={[styles.devButton, seedLoading && styles.disabled]}
                  disabled={seedLoading}
                  onPress={seedSampleMonth}
                >
                  <Text style={styles.devButtonText}>
                    {seedLoading ? "Working..." : "Seed sample month"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.devButton, styles.devButtonDanger, seedLoading && styles.disabled]}
                  disabled={seedLoading}
                  onPress={() =>
                    showAppDialog({
                      title: "Clear seeded workouts?",
                      message: "This removes only workouts created by Seed sample month.",
                      buttons: [
                        { text: "Cancel", role: "cancel" },
                        { text: "Clear", role: "destructive", onPress: () => void clearSeededWorkouts() },
                      ],
                    })
                  }
                >
                  <Text style={styles.devButtonText}>Clear seeded</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={activeDashboardMetric != null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.calendarModalHeaderRow}>
              <Text style={styles.modalTitle}>{dashboardGraphTitle}</Text>
              <TouchableOpacity onPress={() => setActiveDashboardMetric(null)} style={styles.calendarCloseButton}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            {dashboardGraphData.length === 0 ? (
              <Text style={styles.cardText}>No data yet.</Text>
            ) : (
              <View style={styles.graphContainer}>
                {dashboardGraphData.map((point) => {
                  const maxValue =
                    Math.max(...dashboardGraphData.map((item) => item.value), 1);
                  const barHeight = Math.max(8, (point.value / maxValue) * 120);
                  return (
                    <View key={`${point.label}-${point.value}`} style={styles.graphBarWrap}>
                      <Text style={styles.graphValueText}>
                        {Math.round(point.value)}
                        {dashboardGraphUnit ? ` ${dashboardGraphUnit}` : ""}
                      </Text>
                      <View style={[styles.graphBar, { height: barHeight }]} />
                      <Text style={styles.graphLabelText}>{point.label}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showDayModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Workout Day</Text>
            <Text style={styles.noticeSub}>{selectedDateKey}</Text>

            <ScrollView style={styles.dayModalScroll} contentContainerStyle={{ gap: 10 }}>
              {selectedDayWorkouts.length === 0 ? (
                <Text style={styles.cardText}>No workouts logged on this date.</Text>
              ) : (
                selectedDayWorkouts.map((workout) => (
                  <View key={workout.id} style={styles.dayWorkoutCard}>
                    <Text style={styles.dayWorkoutTitle}>{workout.title}</Text>
                    <Text style={styles.noticeSub}>
                      {workout.trainingPhase ? `${workout.trainingPhase} - ` : ""}
                      {workout.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                    <Text style={styles.noticeSub}>
                      {getWorkoutSetCount(workout)} sets - {Math.round(getWorkoutVolumeKg(workout))} kg
                      volume
                    </Text>
                    {workout.exercises.map((exercise, exerciseIndex) => (
                      <View key={`${workout.id}-${exercise.name}-${exerciseIndex}`} style={styles.dayExerciseBlock}>
                        <Text style={styles.dayExerciseName}>{exercise.name}</Text>
                        {exercise.mode === "cardio" ? (
                          <Text style={styles.noticeSub}>Zone: {exercise.zone || "-"}</Text>
                        ) : exercise.tempo ? (
                          <Text style={styles.noticeSub}>Tempo: {exercise.tempo}</Text>
                        ) : null}
                        {exercise.notes ? <Text style={styles.noticeSub}>Notes: {exercise.notes}</Text> : null}
                        {exercise.sets.map((set, setIndex) => (
                          <Text key={`${workout.id}-${exerciseIndex}-set-${setIndex}`} style={styles.noticeSub}>
                            Set{" "}
                            {set.setType === "warmup"
                              ? "W"
                              : set.setType === "failure"
                              ? "F"
                              : set.setType === "drop"
                              ? "D"
                              : setIndex + 1}
                            :{" "}
                            {exercise.mode === "cardio"
                              ? `${typeof set.distanceKm === "number" ? `${Math.round(set.distanceKm * 100) / 100} km` : "-"} · ${
                                  typeof set.durationSec === "number"
                                    ? `${Math.floor(set.durationSec / 60)}:${String(set.durationSec % 60).padStart(2, "0")}`
                                    : "-"
                                }${set.zone ? ` · Zone ${set.zone}` : ""}`
                              : `${typeof set.weightKg === "number" ? `${Math.round(set.weightKg * 10) / 10} kg` : "-"} x ${
                                  set.reps || "-"
                                }${typeof set.rpe === "number" ? ` - RPE ${set.rpe}` : ""}`}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.primaryButtonWide, { marginTop: 8 }]}
              onPress={() => setShowDayModal(false)}
            >
              <Text style={styles.primaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showAdjustInputsModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Adjust inputs</Text>

            <Text style={styles.label}>Soreness: {soreness}</Text>
            <Slider
              value={soreness}
              onValueChange={(v: number) => setSoreness(Math.round(v))}
              minimumValue={0}
              maximumValue={10}
              step={1}
              minimumTrackTintColor="#7b61ff"
              maximumTrackTintColor="#555"
              thumbTintColor="#fff"
            />

            <Text style={styles.label}>Fatigue: {fatigue}</Text>
            <Slider
              value={fatigue}
              onValueChange={(v: number) => setFatigue(Math.round(v))}
              minimumValue={0}
              maximumValue={10}
              step={1}
              minimumTrackTintColor="#7b61ff"
              maximumTrackTintColor="#555"
              thumbTintColor="#fff"
            />

            <Text style={styles.label}>Motivation: {motivation}</Text>
            <Slider
              value={motivation}
              onValueChange={(v: number) => setMotivation(Math.round(v))}
              minimumValue={0}
              maximumValue={10}
              step={1}
              minimumTrackTintColor="#7b61ff"
              maximumTrackTintColor="#555"
              thumbTintColor="#fff"
            />

            <TouchableOpacity
              style={[styles.primaryButtonWide, { marginTop: 8 }]}
              onPress={() => setShowAdjustInputsModal(false)}
            >
              <Text style={styles.primaryText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d1a",
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  headerLeft: {
    flexShrink: 1,
  },
  greeting: {
    color: "#ccc",
    fontSize: 18,
    fontWeight: "700",
  },
  userName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  entitlementBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  entitlementBadgeActive: {
    backgroundColor: "#a6e3a1",
  },
  entitlementBadgeInactive: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  entitlementBadgeLoading: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  entitlementBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  entitlementBadgeTextActive: {
    color: "#0d0d1a",
  },
  entitlementBadgeTextMuted: {
    color: "#fff",
  },
  iconContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  scrollContent: {
    paddingBottom: 120,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  firstTimeBannerCard: {
    marginTop: 0,
  },
  firstTimeBannerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  firstTimeBannerText: {
    flex: 1,
    maxWidth: "82%",
    lineHeight: 20,
    marginTop: 1,
  },
  firstTimeDismiss: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  firstTimeActions: {
    flexDirection: "row",
    gap: 10,
  },
  firstTimeActionButton: {
    flex: 1,
  },
  calendarHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calendarNavButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  calendarMonthText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  calendarWeekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calendarWeekdayText: {
    color: "#8f96b8",
    width: "14.28%",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 12,
  },
  calendarWeekRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  calendarDayCell: {
    width: "14.2857%",
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
    paddingBottom: 3,
    gap: 3,
  },
  calendarDayCellSelected: {
    backgroundColor: "rgba(123,97,255,0.25)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(123,97,255,0.8)",
  },
  calendarDayCellOutOfMonth: {
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  calendarDayCellToday: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.28)",
  },
  calendarDayText: { color: "#d8daec", fontWeight: "700", fontSize: 12 },
  calendarDayTextMuted: { color: "#767c9a" },
  calendarDayTextSelected: { color: "#fff" },
  calendarWorkoutDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#7b61ff",
  },
  calendarWorkoutDotHidden: {
    opacity: 0,
  },
  calendarProgramTag: {
    color: "#cdd1ea",
    fontSize: 9,
    fontWeight: "800",
    marginTop: 1,
  },
  phaseTracks: {
    width: "100%",
    gap: 2,
    marginTop: 1,
  },
  phaseTrack: {
    width: "100%",
    height: 2,
    borderRadius: 0,
  },
  phaseWeekRow: {
    marginTop: 2,
    gap: 4,
  },
  phasePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  phasePillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseWeekText: { color: "#cdd1ea", fontSize: 13, fontWeight: "600" },
  metricRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricChip: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 3,
  },
  metricLabel: {
    color: "#9aa1c3",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metricValue: { color: "#fff", fontSize: 20, fontWeight: "800" },
  metricSub: { color: "#aeb3ce", fontSize: 11, lineHeight: 15 },
  devActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  devButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "rgba(123,97,255,0.25)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(123,97,255,0.8)",
  },
  devButtonDanger: {
    backgroundColor: "rgba(248,113,113,0.22)",
    borderColor: "rgba(248,113,113,0.7)",
  },
  devButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  label: { color: "#cfcfe6", fontSize: 14, fontWeight: "600" },
  secondaryButtonWide: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  secondaryButtonText: { color: "#fff", fontWeight: "700" },
  primaryButtonWide: {
    backgroundColor: "#7b61ff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  inputActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  inputActionButton: {
    flex: 1,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
  },
  disabled: { opacity: 0.6 },
  cardText: { color: "#aaa", fontSize: 15 },
  notice: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  noticeText: { color: "#fff", fontWeight: "700" },
  noticeSub: { color: "#9aa1c3", fontSize: 12 },
  paywallButton: {
    borderColor: "rgba(255,255,255,0.3)",
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  paywallText: { color: "#fff", fontWeight: "700" },
  decisionTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  bulletList: { gap: 6 },
  bulletItem: { color: "#d8daec", fontSize: 14 },
  adjustRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  adjustText: { color: "#9aa1c3", fontSize: 13 },
  helpIcon: { paddingHorizontal: 4, paddingVertical: 2 },
  helpText: { color: "#9aa1c3", fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#111427",
    borderRadius: 16,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  calendarModalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calendarCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  graphContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 8,
    minHeight: 160,
  },
  graphBarWrap: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  graphBar: {
    width: "85%",
    borderRadius: 8,
    backgroundColor: "#7b61ff",
    minHeight: 8,
  },
  graphValueText: {
    color: "#d8daec",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  graphLabelText: {
    color: "#9aa1c3",
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  dayModalScroll: {
    maxHeight: 320,
    marginTop: 6,
  },
  dayWorkoutCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 12,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  dayWorkoutTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  dayExerciseBlock: { marginTop: 8, gap: 2 },
  dayExerciseName: { color: "#d8daec", fontSize: 13, fontWeight: "700" },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 4 },
});
