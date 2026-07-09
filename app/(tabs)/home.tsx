import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
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
import {
  BarChart,
  ChartRangeSelector,
  type ChartPoint,
  type ChartRange,
} from "../../src/components/charts/TrendCharts";
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
import { useNow } from "../../src/hooks/useNow";
import { scheduleAfterInteractions } from "../../src/utils/scheduleAfterInteractions";
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
const HOME_READINESS_HISTORY_KEY_PREFIX = "home-readiness-history-v1";
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
type WeightUnit = "kg" | "lbs";
type EnergyUnit = "kcal" | "kJ";

type DashboardMetricKey =
  | "workouts"
  | "volume"
  | "adherence"
  | "calories"
  | "sleep"
  | "recovery"
  | "recovery_sleep"
  | "recovery_soreness"
  | "recovery_fatigue"
  | "recovery_motivation";

type TrainingPhaseHistoryEntry = {
  phase: TrainingPhase;
  startedAt: Timestamp;
};

type DietPhaseHistoryEntry = {
  phase: DietPhase;
  startedAt: Timestamp;
};
type ReadinessHistoryRecord = {
  soreness: number;
  fatigue: number;
  motivation: number;
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
const KG_TO_LBS = 2.20462;
const KCAL_TO_KJ = 4.184;
const isWeightUnit = (value: unknown): value is WeightUnit => value === "kg" || value === "lbs";
const isEnergyUnit = (value: unknown): value is EnergyUnit => value === "kcal" || value === "kJ";
const resolveEnergyUnit = (data: any): EnergyUnit => {
  const direct = data?.energyUnit;
  if (isEnergyUnit(direct)) return direct;
  const nested = data?.preferences?.energyUnit ?? data?.nutritionPreferences?.energyUnit;
  if (isEnergyUnit(nested)) return nested;
  return "kcal";
};
const resolveWeightUnit = (data: any): WeightUnit => {
  const direct = data?.weightUnit;
  if (isWeightUnit(direct)) return direct;
  const directAlt = data?.preferredWeightUnit ?? data?.unit;
  if (isWeightUnit(directAlt)) return directAlt;
  const nested = data?.preferences?.weightUnit;
  if (isWeightUnit(nested)) return nested;
  const nestedAlt = data?.profile?.weightUnit ?? data?.workoutPreferences?.weightUnit;
  if (isWeightUnit(nestedAlt)) return nestedAlt;
  return "kg";
};
const convertKgToUnit = (valueKg: number, unit: WeightUnit): number =>
  unit === "lbs" ? valueKg * KG_TO_LBS : valueKg;
const convertKcalToUnit = (valueKcal: number, unit: EnergyUnit): number =>
  unit === "kJ" ? valueKcal * KCAL_TO_KJ : valueKcal;

export default function Home() {
  const router = useRouter();
  const workoutsHeatmapScrollRef = React.useRef<ScrollView | null>(null);
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [userNickname, setUserNickname] = useState<string | null>(null);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [profileDescription, setProfileDescription] = useState<string | null>(null);
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
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [activeDashboardMetric, setActiveDashboardMetric] = useState<DashboardMetricKey | null>(
    null
  );
  const [hideRestDaysInVolume, setHideRestDaysInVolume] = useState(false);
  const [truncateZeroDaysInCalories, setTruncateZeroDaysInCalories] = useState(false);
  const [hideZeroDaysInSleep, setHideZeroDaysInSleep] = useState(false);
  const [dashboardRange, setDashboardRange] = useState<ChartRange>(7);
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
  const [nutritionCalorieHistory, setNutritionCalorieHistory] = useState<ChartPoint[]>([]);
  const [nutritionAdherenceHistory, setNutritionAdherenceHistory] = useState<ChartPoint[]>([]);
  const [sleepSnapshot, setSleepSnapshot] = useState<SleepSnapshot>({
    averageSleepHours: null,
    nightsCaptured: 0,
  });
  const [sleepHistory, setSleepHistory] = useState<ChartPoint[]>([]);
  const [trainingPhaseStartedAt, setTrainingPhaseStartedAt] = useState<Timestamp | null>(null);
  const [dietPhaseStartedAt, setDietPhaseStartedAt] = useState<Timestamp | null>(null);
  const [trainingPhaseHistory, setTrainingPhaseHistory] = useState<TrainingPhaseHistoryEntry[]>([]);
  const [dietPhaseHistory, setDietPhaseHistory] = useState<DietPhaseHistoryEntry[]>([]);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg");
  const [energyUnit, setEnergyUnit] = useState<EnergyUnit>("kcal");
  const [sorenessHistory, setSorenessHistory] = useState<ChartPoint[]>([]);
  const [fatigueHistory, setFatigueHistory] = useState<ChartPoint[]>([]);
  const [motivationHistory, setMotivationHistory] = useState<ChartPoint[]>([]);
  const hasDeferredInitialInsightsRef = useRef(false);
  const homeInsightsRequestRef = useRef<Promise<void> | null>(null);
  const lastHomeInsightsLoadAtRef = useRef(0);

  const entitlement = useEntitlement(authReady, uid);
  const { isOffline } = useOfflineStatus();
  const nowMs = useNow(60_000);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthReady(true);
      if (!user) {
        setUid(null);
        setUserNickname(null);
        setProfilePhotoUri(null);
        setProfileDescription(null);
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
    if (!uid) return;

    const unsubscribe = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const data: any = snap.data();
        const nickname = typeof data?.nickname === "string" ? data.nickname.trim() : "";
        const photoUri = typeof data?.profilePhotoUri === "string" ? data.profilePhotoUri.trim() : "";
        const description =
          typeof data?.description === "string" ? data.description.trim() : "";
        setUserNickname(nickname || null);
        setProfilePhotoUri(photoUri || null);
        setProfileDescription(description || null);
        if (isTrainingPhase(data?.trainingPhase)) {
          setTrainingPhase(data.trainingPhase);
        }
        if (isDietPhase(data?.dietPhase)) {
          setDietPhase(data.dietPhase);
        }
        setWeightUnit(resolveWeightUnit(data));
        setEnergyUnit(resolveEnergyUnit(data));
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
    const loadReadinessHistory = async () => {
      if (!uid) return;
      const key = `${HOME_READINESS_HISTORY_KEY_PREFIX}:${uid}`;
      let parsedHistory: Record<string, ReadinessHistoryRecord> = {};
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            parsedHistory = parsed as Record<string, ReadinessHistoryRecord>;
          }
        }
      } catch (error) {
        console.log("Failed to load readiness history", error);
      }

      const pointsSoreness: ChartPoint[] = [];
      const pointsFatigue: ChartPoint[] = [];
      const pointsMotivation: ChartPoint[] = [];
      const start = new Date();
      start.setDate(start.getDate() - 29);
      start.setHours(12, 0, 0, 0);
      const end = new Date();
      end.setHours(12, 0, 0, 0);
      const cursor = new Date(start);
      while (cursor.getTime() <= end.getTime()) {
        const dateKey = toDateKey(cursor);
        const record = parsedHistory[dateKey];
        pointsSoreness.push({
          key: dateKey,
          label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
          value: typeof record?.soreness === "number" ? record.soreness : 0,
        });
        pointsFatigue.push({
          key: dateKey,
          label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
          value: typeof record?.fatigue === "number" ? record.fatigue : 0,
        });
        pointsMotivation.push({
          key: dateKey,
          label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
          value: typeof record?.motivation === "number" ? record.motivation : 0,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      setSorenessHistory(pointsSoreness);
      setFatigueHistory(pointsFatigue);
      setMotivationHistory(pointsMotivation);
    };
    void loadReadinessHistory();
  }, [uid]);

  useEffect(() => {
    const saveReadinessHistory = async () => {
      if (!uid) return;
      const key = `${HOME_READINESS_HISTORY_KEY_PREFIX}:${uid}`;
      let parsedHistory: Record<string, ReadinessHistoryRecord> = {};
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            parsedHistory = parsed as Record<string, ReadinessHistoryRecord>;
          }
        }
      } catch {
        // no-op
      }
      const todayKey = toDateKey(new Date());
      parsedHistory[todayKey] = { soreness, fatigue, motivation };
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 29);
      cutoff.setHours(0, 0, 0, 0);
      for (const dateKey of Object.keys(parsedHistory)) {
        const d = new Date(`${dateKey}T00:00:00`);
        if (d.getTime() < cutoff.getTime()) delete parsedHistory[dateKey];
      }
      try {
        await AsyncStorage.setItem(key, JSON.stringify(parsedHistory));
      } catch (error) {
        console.log("Failed to save readiness history", error);
      }
    };
    void saveReadinessHistory();
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
    if (homeInsightsRequestRef.current) return homeInsightsRequestRef.current;
    let request: Promise<void> | null = null;
    request = (async () => {
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
          setWeightUnit(resolveWeightUnit(userData));
          setEnergyUnit(resolveEnergyUnit(userData));
          const target = getCalorieTargetForDietPhase(
            profile.calorieTargetsByDietPhase,
            userDietPhase
          );
          const nutritionTrends = await getNutritionTrendReport(uid, target, 30);
          const last7Days = nutritionTrends.dailyHistory.slice(0, 7);
          const averageCalories7d =
            last7Days.length > 0
              ? Math.round(
                  last7Days.reduce((sum, day) => sum + day.calories, 0) / last7Days.length
                )
              : null;
          setNutritionSnapshot({
            averageCalories: averageCalories7d,
            consistencyScore: nutritionTrends.consistencyScore ?? null,
          });
          const byDate = new Map(
            nutritionTrends.dailyHistory.map((entry) => [entry.dateKey, entry.calories])
          );
          const calorieHistory: ChartPoint[] = [];
          const start = new Date();
          start.setDate(start.getDate() - 29);
          start.setHours(12, 0, 0, 0);
          const end = new Date();
          end.setHours(12, 0, 0, 0);
          const cursor = new Date(start);
          while (cursor.getTime() <= end.getTime()) {
            const key = toDateKey(cursor);
            calorieHistory.push({
              key,
              label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
              value: Math.round(convertKcalToUnit(byDate.get(key) ?? 0, energyUnit)),
            });
            cursor.setDate(cursor.getDate() + 1);
          }
          const adherenceHistory = [...nutritionTrends.dailyHistory]
            .reverse()
            .map((entry) => ({
              key: entry.dateKey,
              label: entry.dateKey.slice(5),
              value: entry.adherence === "on_target" ? 100 : entry.adherence ? 0 : 50,
            }));
          setNutritionCalorieHistory(calorieHistory);
          setNutritionAdherenceHistory(adherenceHistory);
          const recentSleep = sleepProfile.recentNightlyHours ?? [];
          const last7Sleep = recentSleep.slice(0, 7);
          const sleepValues = last7Sleep
            .map((entry) => entry.sleepHours)
            .filter(
              (value): value is number => typeof value === "number" && Number.isFinite(value)
            );
          const sleepByDate = new Map(
            recentSleep.map((entry) => [entry.dateKey, entry.sleepHours])
          );
          const nextSleepHistory: ChartPoint[] = [];
          const sleepStart = new Date();
          sleepStart.setDate(sleepStart.getDate() - 29);
          sleepStart.setHours(12, 0, 0, 0);
          const sleepEnd = new Date();
          sleepEnd.setHours(12, 0, 0, 0);
          const sleepCursor = new Date(sleepStart);
          while (sleepCursor.getTime() <= sleepEnd.getTime()) {
            const key = toDateKey(sleepCursor);
            nextSleepHistory.push({
              key,
              label: `${sleepCursor.getMonth() + 1}/${sleepCursor.getDate()}`,
              value: sleepByDate.get(key) ?? 0,
            });
            sleepCursor.setDate(sleepCursor.getDate() + 1);
          }
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
    })();
    homeInsightsRequestRef.current = request;
    try {
      await request;
    } finally {
      if (homeInsightsRequestRef.current === request) {
        homeInsightsRequestRef.current = null;
      }
    }
  }, [uid, dietPhase, energyUnit]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const shouldRefreshNow =
        !hasDeferredInitialInsightsRef.current || now - lastHomeInsightsLoadAtRef.current >= 30_000;
      if (!shouldRefreshNow) {
        return undefined;
      }
      hasDeferredInitialInsightsRef.current = true;
      const task = scheduleAfterInteractions(async () => {
        lastHomeInsightsLoadAtRef.current = Date.now();
        await loadHomeInsights();
      });
      return () => task.cancel();
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
    const diffMs = nowMs - start.getTime();
    const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
    return Math.max(1, week);
  }, [nowMs, trainingPhaseStartedAt]);
  const dietPhaseWeek = useMemo(() => {
    if (!dietPhaseStartedAt) return 1;
    const start = dietPhaseStartedAt.toDate();
    const diffMs = nowMs - start.getTime();
    const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
    return Math.max(1, week);
  }, [dietPhaseStartedAt, nowMs]);

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
        return "Workouts";
      case "volume":
        return `Volume (${weightUnit})`;
      case "adherence":
        return "Adherence Trend";
      case "calories":
        return `Calories (${energyUnit})`;
      case "sleep":
        return "Sleep (hours)";
      case "recovery":
        return "Recovery Readiness";
      case "recovery_sleep":
        return "Recovery - Sleep";
      case "recovery_soreness":
        return "Recovery - Soreness";
      case "recovery_fatigue":
        return "Recovery - Fatigue";
      case "recovery_motivation":
        return "Recovery - Motivation";
      default:
        return "";
    }
  }, [activeDashboardMetric, weightUnit, energyUnit]);

  const dashboardGraphUnit = useMemo(() => {
    switch (activeDashboardMetric) {
      case "volume":
        return weightUnit;
      case "calories":
        return energyUnit;
      case "sleep":
      case "recovery_sleep":
        return "h";
      case "adherence":
      case "recovery":
        return "%";
      case "recovery_soreness":
      case "recovery_fatigue":
      case "recovery_motivation":
        return "/10";
      default:
        return "";
    }
  }, [activeDashboardMetric, weightUnit, energyUnit]);

  const recoveryReadiness = useMemo(() => {
    const sleepRatio =
      sleepSnapshot.averageSleepHours != null && sleepTargetHours > 0
        ? Math.max(0, Math.min(1, sleepSnapshot.averageSleepHours / sleepTargetHours))
        : 0.5;
    const sorenessScore = Math.max(0, Math.min(1, 1 - soreness / 10));
    const fatigueScore = Math.max(0, Math.min(1, 1 - fatigue / 10));
    const motivationScore = Math.max(0, Math.min(1, motivation / 10));
    const score = Math.round(
      (sleepRatio * 0.3 + sorenessScore * 0.3 + fatigueScore * 0.3 + motivationScore * 0.1) * 100
    );
    const label = score >= 75 ? "Ready" : score >= 50 ? "Neutral" : "Recover";
    return { score, label, sleepRatio, sorenessScore, fatigueScore, motivationScore };
  }, [sleepSnapshot.averageSleepHours, sleepTargetHours, soreness, fatigue, motivation]);

  const workoutsWeeklyHistory = useMemo<ChartPoint[]>(() => {
    const weekStartKey = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + mondayOffset);
      d.setHours(0, 0, 0, 0);
      return d;
    };
    const toWeekKey = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const counts = new Map<string, number>();
    let earliestWeek: Date | null = null;
    for (const workout of workouts) {
      const ws = weekStartKey(workout.date);
      const key = toWeekKey(ws);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!earliestWeek || ws.getTime() < earliestWeek.getTime()) earliestWeek = ws;
    }

    const currentWeek = weekStartKey(new Date());
    const startWeek = earliestWeek ?? currentWeek;
    const points: ChartPoint[] = [];
    const cursor = new Date(startWeek);
    while (cursor.getTime() <= currentWeek.getTime()) {
      const key = toWeekKey(cursor);
      points.push({
        key,
        label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
        value: counts.get(key) ?? 0,
      });
      cursor.setDate(cursor.getDate() + 7);
    }
    return points;
  }, [workouts]);

  const volumeDailyHistoryAll = useMemo<ChartPoint[]>(() => {
    const byDay = new Map<string, number>();
    for (const workout of workouts) {
      const key = toDateKey(workout.date);
      byDay.set(key, (byDay.get(key) ?? 0) + getWorkoutVolumeKg(workout));
    }

    if (byDay.size === 0) return [];
    const sortedKeys = [...byDay.keys()].sort();
    const start = new Date(`${sortedKeys[0]}T12:00:00`);
    const end = new Date();
    end.setHours(12, 0, 0, 0);

    const points: ChartPoint[] = [];
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      const key = toDateKey(cursor);
      points.push({
        key,
        label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
        value: Math.round(convertKgToUnit(byDay.get(key) ?? 0, weightUnit)),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return points;
  }, [workouts, weightUnit]);

  const volumeDailyHistory = useMemo(
    () => (hideRestDaysInVolume ? volumeDailyHistoryAll.filter((point) => point.value > 0) : volumeDailyHistoryAll),
    [hideRestDaysInVolume, volumeDailyHistoryAll]
  );

  const workoutsHeatmap = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rangeStart = new Date(today.getFullYear() - 1, today.getMonth(), 1);
    rangeStart.setHours(0, 0, 0, 0);

    const dailyVolumeKg = new Map<string, number>();
    for (const workout of workouts) {
      const d = new Date(workout.date);
      d.setHours(0, 0, 0, 0);
      const key = toDateKey(d);
      dailyVolumeKg.set(key, (dailyVolumeKg.get(key) ?? 0) + getWorkoutVolumeKg(workout));
    }

    const gridStart = new Date(rangeStart);
    const startDay = gridStart.getDay();
    const daysFromMonday = startDay === 0 ? 6 : startDay - 1;
    gridStart.setDate(gridStart.getDate() - daysFromMonday); // Monday-start columns
    const gridEnd = new Date(today);
    const endDay = gridEnd.getDay();
    const daysToSunday = endDay === 0 ? 0 : 7 - endDay;
    gridEnd.setDate(gridEnd.getDate() + daysToSunday);

    const weeks: { key: string; date: Date; volumeKg: number; inRange: boolean }[][] = [];
    const monthLabels: { weekIndex: number; label: string }[] = [];
    const nonZeroVolumes: number[] = [];
    const cursor = new Date(gridStart);
    let weekIndex = 0;
    while (cursor.getTime() <= gridEnd.getTime()) {
      const weekStart = new Date(cursor);
      const week: { key: string; date: Date; volumeKg: number; inRange: boolean }[] = [];
      for (let i = 0; i < 7; i += 1) {
        const key = toDateKey(cursor);
        const inRange = cursor.getTime() >= rangeStart.getTime() && cursor.getTime() <= today.getTime();
        const volumeKg = inRange ? dailyVolumeKg.get(key) ?? 0 : 0;
        if (inRange && volumeKg > 0) nonZeroVolumes.push(volumeKg);
        week.push({
          key,
          date: new Date(cursor),
          volumeKg,
          inRange,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      if (weekStart.getDate() <= 7) {
        monthLabels.push({
          weekIndex,
          label: weekStart.toLocaleDateString(undefined, { month: "short" }),
        });
      }
      weeks.push(week);
      weekIndex += 1;
    }
    const sortedVolumes = [...nonZeroVolumes].sort((a, b) => a - b);
    const pickPercentile = (p: number) => {
      if (!sortedVolumes.length) return 0;
      const idx = Math.min(sortedVolumes.length - 1, Math.max(0, Math.floor((sortedVolumes.length - 1) * p)));
      return sortedVolumes[idx];
    };
    const lowCut = pickPercentile(0.33);
    const highCut = pickPercentile(0.66);
    return { weeks, monthLabels, lowCut, highCut };
  }, [workouts]);

  useEffect(() => {
    if (activeDashboardMetric !== "workouts") return;
    const timer = setTimeout(() => {
      workoutsHeatmapScrollRef.current?.scrollToEnd({ animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [activeDashboardMetric, workoutsHeatmap.weeks.length]);

  const dashboardGraphData = useMemo<ChartPoint[]>(() => {
    switch (activeDashboardMetric) {
      case "workouts":
        return workoutsWeeklyHistory;
      case "volume":
        return volumeDailyHistory;
      case "adherence":
        return nutritionAdherenceHistory;
      case "calories":
        return truncateZeroDaysInCalories
          ? nutritionCalorieHistory.filter((point) => point.value > 0)
          : nutritionCalorieHistory;
      case "sleep":
        return hideZeroDaysInSleep ? sleepHistory.filter((point) => point.value > 0) : sleepHistory;
      case "recovery_sleep":
        return sleepHistory;
      case "recovery_soreness":
        return hideZeroDaysInSleep ? sorenessHistory.filter((point) => point.value > 0) : sorenessHistory;
      case "recovery_fatigue":
        return hideZeroDaysInSleep ? fatigueHistory.filter((point) => point.value > 0) : fatigueHistory;
      case "recovery_motivation":
        return hideZeroDaysInSleep ? motivationHistory.filter((point) => point.value > 0) : motivationHistory;
      case "recovery":
        return [
          { key: "sleep", label: "Sleep", value: Math.round(recoveryReadiness.sleepRatio * 100) },
          { key: "soreness", label: "Soreness", value: Math.round(recoveryReadiness.sorenessScore * 100) },
          { key: "fatigue", label: "Fatigue", value: Math.round(recoveryReadiness.fatigueScore * 100) },
          { key: "motivation", label: "Motivation", value: Math.round(recoveryReadiness.motivationScore * 100) },
        ];
      default:
        return [];
    }
  }, [
    activeDashboardMetric,
    nutritionAdherenceHistory,
    nutritionCalorieHistory,
    sleepHistory,
    recoveryReadiness.fatigueScore,
    recoveryReadiness.motivationScore,
    recoveryReadiness.sleepRatio,
    recoveryReadiness.sorenessScore,
    truncateZeroDaysInCalories,
    hideZeroDaysInSleep,
    volumeDailyHistory,
    workoutsWeeklyHistory,
    sorenessHistory,
    fatigueHistory,
    motivationHistory,
  ]);

  const dashboardGraphDataScoped = useMemo(() => {
    if (
      activeDashboardMetric === "adherence"
    ) {
      return dashboardGraphData.slice(-dashboardRange);
    }
    return dashboardGraphData;
  }, [activeDashboardMetric, dashboardGraphData, dashboardRange]);

  const renderMiniTrendStrip = useCallback((points: ChartPoint[], color: string) => {
    if (!points.length) {
      return <View style={styles.miniTrendRow} />;
    }
    const scoped = points.slice(-7);
    const max = Math.max(1, ...scoped.map((p) => p.value));
    return (
      <View style={styles.miniTrendRow}>
        {scoped.map((point) => {
          const h = Math.max(3, Math.round((point.value / max) * 18));
          return (
            <View key={point.key} style={styles.miniTrendCell}>
              <View style={[styles.miniTrendBar, { height: h, backgroundColor: color }]} />
            </View>
          );
        })}
      </View>
    );
  }, []);

  const formatWorkoutsDelta = useCallback((current: number, previous: number) => {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return { text: "-", tone: "neutral" as const };
    const delta = Math.round(current - previous);
    if (delta > 0) return { text: `+${delta}`, tone: "up" as const };
    if (delta < 0) return { text: `${delta}`, tone: "down" as const };
    return { text: "-", tone: "neutral" as const };
  }, []);

  const formatAbsolutePercentDelta = useCallback((current: number, previous: number) => {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) {
      return { text: "0 (0%)", tone: "neutral" as const };
    }
    const delta = current - previous;
    const roundedDelta = Math.round(delta);
    const signedDelta = roundedDelta > 0 ? `+${roundedDelta}` : `${roundedDelta}`;
    if (previous === 0) {
      if (current === 0) return { text: "0 (0%)", tone: "neutral" as const };
      return { text: `${signedDelta} (n/a)`, tone: roundedDelta > 0 ? ("up" as const) : ("down" as const) };
    }
    const pct = Math.round((delta / previous) * 100);
    const signedPct = pct > 0 ? `+${pct}` : `${pct}`;
    if (roundedDelta > 0) return { text: `${signedDelta} (${signedPct}%)`, tone: "up" as const };
    if (roundedDelta < 0) return { text: `${signedDelta} (${signedPct}%)`, tone: "down" as const };
    return { text: "0 (0%)", tone: "neutral" as const };
  }, []);

  const weeklyDeltas = useMemo(() => {
    const averageFromTailWindow = (values: number[], startFromEnd: number, length: number) => {
      const start = Math.max(0, values.length - startFromEnd - length);
      const end = Math.max(0, values.length - startFromEnd);
      const window = values.slice(start, end);
      if (window.length === 0) return 0;
      return window.reduce((sum, v) => sum + v, 0) / window.length;
    };

    const calorieValues = nutritionCalorieHistory.map((p) => p.value);
    const caloriesCurrent = averageFromTailWindow(calorieValues, 0, 7);
    const caloriesPrev = averageFromTailWindow(calorieValues, 7, 7);

    const sleepValues = sleepHistory.map((p) => p.value);
    const sleepCurrent = averageFromTailWindow(sleepValues, 0, 7);
    const sleepPrev = averageFromTailWindow(sleepValues, 7, 7);

    return {
      workouts: formatWorkoutsDelta(weeklyMetrics.workoutsThisWeek, weeklyMetrics.workoutsLastWeek),
      volume: formatAbsolutePercentDelta(
        convertKgToUnit(weeklyMetrics.avgVolumeThisWeek, weightUnit),
        convertKgToUnit(weeklyMetrics.avgVolumeLastWeek, weightUnit)
      ),
      calories: formatAbsolutePercentDelta(caloriesCurrent, caloriesPrev),
      sleep: formatAbsolutePercentDelta(sleepCurrent, sleepPrev),
    };
  }, [nutritionCalorieHistory, sleepHistory, weeklyMetrics, formatAbsolutePercentDelta, weightUnit, formatWorkoutsDelta]);

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
          <View style={styles.headerTopRow}>
            <Text style={styles.greeting}>lastrep</Text>
            <View style={styles.iconContainer}>
              <TouchableOpacity onPress={() => setShowCalendarModal(true)}>
                <Ionicons name="calendar-outline" size={26} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/settings" as Href)} style={{ marginLeft: 12 }}>
                <Ionicons name="settings-outline" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            style={styles.userRow}
            activeOpacity={0.85}
            onPress={() => setShowProfileModal(true)}
          >
            {profilePhotoUri ? (
              <Image source={{ uri: profilePhotoUri }} style={styles.headerAvatar} contentFit="cover" />
            ) : (
              <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
                <Text style={styles.headerAvatarInitial}>
                  {(userNickname ?? "L").trim().charAt(0).toUpperCase() || "L"}
                </Text>
              </View>
            )}
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
          <Text style={styles.sectionTitle}>Today&apos;s Plan</Text>
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
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Readiness</Text>
            <TouchableOpacity
              style={styles.snapshotInfoBtn}
              onPress={() =>
                showAppAlert(
                  "Recovery readiness",
                  "Score weights:\n- Sleep: 30%\n- Soreness: 30%\n- Fatigue: 30%\n- Motivation: 10%\n\nNotes:\n- Soreness/Fatigue are inverted (lower is better).\n\nLabels:\n- Ready: >= 75\n- Neutral: 50-74\n- Recover: < 50"
                )
              }
            >
              <Ionicons name="information-circle-outline" size={16} color="#cdd1ea" />
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            <Text style={styles.metricValue}>{recoveryReadiness.score}%</Text>
            <Text style={styles.metricSub}>{recoveryReadiness.label} based on sleep, soreness, fatigue, motivation</Text>
            <View style={[styles.metricRow, styles.metricRowWrap]}>
              <TouchableOpacity
                style={[styles.metricChip, styles.metricChipCompact, styles.metricChipQuarter]}
                onPress={() => setActiveDashboardMetric("recovery_sleep")}
              >
                <Text style={styles.metricLabel}>Sleep</Text>
                <Text style={styles.metricValueSmall}>
                  {sleepSnapshot.averageSleepHours == null ? "-" : `${sleepSnapshot.averageSleepHours}h`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.metricChip, styles.metricChipCompact, styles.metricChipQuarter]}
                onPress={() => setActiveDashboardMetric("recovery_soreness")}
              >
                <Text style={styles.metricLabel}>Soreness</Text>
                <Text style={styles.metricValueSmall}>{soreness}/10</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.metricChip, styles.metricChipCompact, styles.metricChipQuarter]}
                onPress={() => setActiveDashboardMetric("recovery_fatigue")}
              >
                <Text style={styles.metricLabel}>Fatigue</Text>
                <Text style={styles.metricValueSmall}>{fatigue}/10</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.metricChip, styles.metricChipCompact, styles.metricChipQuarter]}
                onPress={() => setActiveDashboardMetric("recovery_motivation")}
              >
                <Text style={styles.metricLabel}>Motivation</Text>
                <Text style={styles.metricValueSmall}>{motivation}/10</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Weekly Trends</Text>
            <TouchableOpacity
              style={styles.snapshotInfoBtn}
              onPress={() => showAppAlert("Snapshot change", "Each change is compared against the previous week.")}
            >
              <Ionicons name="information-circle-outline" size={16} color="#cdd1ea" />
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            <View style={styles.metricRow}>
              <TouchableOpacity style={styles.metricChip} onPress={() => setActiveDashboardMetric("workouts")}>
                <Text style={styles.metricLabelTitle}>Workouts</Text>
                <Text style={styles.metricValue}>{weeklyMetrics.workoutsThisWeek}</Text>
                <Text style={[styles.metricDeltaInline, weeklyDeltas.workouts.tone === "up" ? styles.metricDeltaUp : weeklyDeltas.workouts.tone === "down" ? styles.metricDeltaDown : styles.metricDeltaNeutral]}>{weeklyDeltas.workouts.text}</Text>
                {renderMiniTrendStrip(workoutsWeeklyHistory, "#60a5fa")}
              </TouchableOpacity>
              <TouchableOpacity style={styles.metricChip} onPress={() => setActiveDashboardMetric("volume")}>
                <Text style={styles.metricLabelTitle}>{`Volume (${weightUnit})`}</Text>
                <Text style={styles.metricValue}>
                  {Math.round(convertKgToUnit(weeklyMetrics.avgVolumeThisWeek, weightUnit))}
                </Text>
                <Text style={[styles.metricDeltaInline, weeklyDeltas.volume.tone === "up" ? styles.metricDeltaUp : weeklyDeltas.volume.tone === "down" ? styles.metricDeltaDown : styles.metricDeltaNeutral]}>{weeklyDeltas.volume.text}</Text>
                {renderMiniTrendStrip(volumeDailyHistory, "#a78bfa")}
              </TouchableOpacity>
            </View>
            <View style={styles.metricRow}>
              <TouchableOpacity style={styles.metricChip} onPress={() => setActiveDashboardMetric("calories")}>
                <Text style={styles.metricLabelTitle}>{`Calories (${energyUnit})`}</Text>
                <Text style={styles.metricValue}>
                  {nutritionSnapshot.averageCalories == null ? "-" : `${Math.round(convertKcalToUnit(nutritionSnapshot.averageCalories, energyUnit))}`}
                </Text>
                <Text style={[styles.metricDeltaInline, weeklyDeltas.calories.tone === "up" ? styles.metricDeltaUp : weeklyDeltas.calories.tone === "down" ? styles.metricDeltaDown : styles.metricDeltaNeutral]}>{weeklyDeltas.calories.text}</Text>
                {renderMiniTrendStrip(nutritionCalorieHistory, "#fbbf24")}
              </TouchableOpacity>
              <TouchableOpacity style={styles.metricChip} onPress={() => setActiveDashboardMetric("sleep")}>
                <Text style={styles.metricLabelTitle}>Sleep (hours)</Text>
                <Text style={styles.metricValue}>
                  {sleepSnapshot.averageSleepHours == null ? "-" : `${sleepSnapshot.averageSleepHours}`}
                </Text>
                <Text style={[styles.metricDeltaInline, weeklyDeltas.sleep.tone === "up" ? styles.metricDeltaUp : weeklyDeltas.sleep.tone === "down" ? styles.metricDeltaDown : styles.metricDeltaNeutral]}>{weeklyDeltas.sleep.text}</Text>
                {renderMiniTrendStrip(sleepHistory, "#4ade80")}
              </TouchableOpacity>
            </View>
            {workoutsLoading ? <Text style={styles.cardText}>Refreshing snapshot...</Text> : null}
            {insightsError ? <Text style={styles.noticeSub}>{insightsError}</Text> : null}
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
                ? `${selectedDateKey}: ${selectedDaySummary.workoutCount} workout(s), ${selectedDaySummary.totalSets} sets, ${Math.round(convertKgToUnit(selectedDaySummary.totalVolumeKg, weightUnit))} ${weightUnit} volume`
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
        <TouchableWithoutFeedback onPress={() => setActiveDashboardMetric(null)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalCard}>
            <View style={styles.calendarModalHeaderRow}>
              <Text style={styles.modalTitle}>{dashboardGraphTitle}</Text>
              <TouchableOpacity onPress={() => setActiveDashboardMetric(null)} style={styles.calendarCloseButton}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            {activeDashboardMetric === "adherence" ? (
              <ChartRangeSelector value={dashboardRange} onChange={setDashboardRange} />
            ) : activeDashboardMetric === "volume" ? (
              <TouchableOpacity
                style={styles.chartToggleButton}
                onPress={() => setHideRestDaysInVolume((prev) => !prev)}
              >
                <Text style={styles.chartToggleButtonText}>
                  {hideRestDaysInVolume ? "Show zero days" : "Hide zero days"}
                </Text>
              </TouchableOpacity>
            ) : activeDashboardMetric === "calories" ? (
              <TouchableOpacity
                style={styles.chartToggleButton}
                onPress={() => setTruncateZeroDaysInCalories((prev) => !prev)}
              >
                <Text style={styles.chartToggleButtonText}>
                  {truncateZeroDaysInCalories ? "Show zero days" : "Hide zero days"}
                </Text>
              </TouchableOpacity>
            ) : activeDashboardMetric === "sleep" || activeDashboardMetric === "recovery_sleep" || activeDashboardMetric === "recovery_soreness" || activeDashboardMetric === "recovery_fatigue" || activeDashboardMetric === "recovery_motivation" ? (
              <TouchableOpacity
                style={styles.chartToggleButton}
                onPress={() => setHideZeroDaysInSleep((prev) => !prev)}
              >
                <Text style={styles.chartToggleButtonText}>
                  {hideZeroDaysInSleep ? "Show zero days" : "Hide zero days"}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.chartRangeSpacer} />
            )}
            {activeDashboardMetric === "workouts" ? (
              workoutsHeatmap.weeks.length === 0 ? (
                <Text style={styles.cardText}>No data yet.</Text>
              ) : (
                <View style={styles.heatmapWrap}>
                  <View style={styles.heatmapLegendRow}>
                    <Text style={styles.noticeSub}>Rest</Text>
                    <View style={[styles.heatmapLegendBox, styles.heatmapLevel0]} />
                    <View style={[styles.heatmapLegendBox, styles.heatmapLevel1]} />
                    <View style={[styles.heatmapLegendBox, styles.heatmapLevel2]} />
                    <View style={[styles.heatmapLegendBox, styles.heatmapLevel3]} />
                    <Text style={styles.noticeSub}>High volume</Text>
                  </View>
                  <View style={styles.heatmapBodyRow}>
                    <View style={styles.heatmapYAxis}>
                      {["M", "", "W", "", "F", "", "S"].map((label, index) => (
                        <View key={`heatmap-y-${index}`} style={styles.heatmapYAxisSlot}>
                          <Text style={styles.heatmapYAxisLabel}>{label}</Text>
                        </View>
                      ))}
                    </View>
                    <ScrollView
                      ref={workoutsHeatmapScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.heatmapScrollContent}
                    >
                      <View>
                        <View style={styles.heatmapMonthHeader}>
                          <View
                            style={[
                              styles.heatmapMonthLabelsTrack,
                              { width: Math.max(16, workoutsHeatmap.weeks.length * 16) },
                            ]}
                          >
                            {workoutsHeatmap.monthLabels.map((m) => (
                              <Text
                                key={`${m.weekIndex}-${m.label}`}
                                style={[styles.heatmapMonthLabel, { left: m.weekIndex * 16 - 10 }]}
                              >
                                {m.label}
                              </Text>
                            ))}
                          </View>
                        </View>
                        <View style={styles.heatmapGrid}>
                          {workoutsHeatmap.weeks.map((week, weekIndex) => (
                            <View key={`wk-${weekIndex}`} style={styles.heatmapWeekCol}>
                              {week.map((cell) => {
                                const level =
                                  !cell.inRange
                                    ? -1
                                    : cell.volumeKg <= 0
                                    ? 0
                                    : cell.volumeKg <= workoutsHeatmap.lowCut
                                    ? 1
                                    : cell.volumeKg <= workoutsHeatmap.highCut
                                    ? 2
                                    : 3;
                                return (
                                  <TouchableOpacity
                                    key={cell.key}
                                    style={[
                                      styles.heatmapCell,
                                      level < 0
                                        ? styles.heatmapFuture
                                        : level === 0
                                        ? styles.heatmapLevel0
                                        : level === 1
                                        ? styles.heatmapLevel1
                                        : level === 2
                                        ? styles.heatmapLevel2
                                        : styles.heatmapLevel3,
                                    ]}
                                    onPress={() => {
                                      setSelectedDateKey(cell.key);
                                      setShowDayModal(true);
                                    }}
                                  />
                                );
                              })}
                            </View>
                          ))}
                        </View>
                      </View>
                    </ScrollView>
                  </View>
                </View>
              )
            ) : dashboardGraphDataScoped.length === 0 ? (
              <Text style={styles.cardText}>No data yet.</Text>
            ) : (
              <BarChart
                points={dashboardGraphDataScoped}
                unit={dashboardGraphUnit}
              />
            )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
                      {getWorkoutSetCount(workout)} sets - {Math.round(convertKgToUnit(getWorkoutVolumeKg(workout), weightUnit))} {weightUnit}
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
                              : `${typeof set.weightKg === "number" ? `${Math.round(convertKgToUnit(set.weightKg, weightUnit) * 10) / 10} ${weightUnit}` : "-"} x ${
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

      <Modal visible={showProfileModal} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowProfileModal(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.profileModalCard}>
                {profilePhotoUri ? (
                  <Image
                    source={{ uri: profilePhotoUri }}
                    style={styles.profileModalAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.profileModalAvatar, styles.headerAvatarPlaceholder]}>
                    <Text style={styles.profileModalInitial}>
                      {(userNickname ?? "L").trim().charAt(0).toUpperCase() || "L"}
                    </Text>
                  </View>
                )}
                <Text style={styles.profileModalName}>{userNickname ?? "Lifter"}</Text>
                {profileDescription ? (
                  <Text style={styles.profileModalDescription}>{profileDescription}</Text>
                ) : (
                  <Text style={styles.profileModalDescriptionMuted}>
                    No description added yet.
                  </Text>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
    flex: 1,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerAvatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarInitial: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },
  greeting: {
    color: "#ccc",
    fontSize: 18,
    fontWeight: "700",
  },
  userName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flexWrap: "nowrap",
    marginTop: 12,
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
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  snapshotInfoBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
  metricRowWrap: {
    flexWrap: "wrap",
  },
  metricChip: {
    flex: 1,
    minHeight: 116,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 2,
  },
  metricChipCompact: {
    minHeight: 0,
    paddingVertical: 10,
  },
  metricChipQuarter: {
    flexBasis: "48%",
    flexGrow: 0,
  },
  metricLabel: {
    color: "#9aa1c3",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metricValue: { color: "#fff", fontSize: 20, fontWeight: "800" },
  metricValueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  metricLabelTitle: { color: "#9aa1c3", fontSize: 11, fontWeight: "700" },
  metricValueSmall: { color: "#fff", fontSize: 16, fontWeight: "800" },
  metricSub: { color: "#aeb3ce", fontSize: 11, lineHeight: 15, minHeight: 30 },
  metricDelta: { fontSize: 11, fontWeight: "700", minHeight: 16 },
  metricDeltaInline: { fontSize: 11, fontWeight: "700", marginTop: -1 },
  metricDeltaUp: { color: "#4ade80" },
  metricDeltaDown: { color: "#f87171" },
  metricDeltaNeutral: { color: "#9aa1c3" },
  miniTrendRow: {
    marginTop: "auto",
    paddingTop: 8,
    height: 20,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  miniTrendCell: {
    flex: 1,
    height: 20,
    justifyContent: "flex-end",
  },
  miniTrendBar: {
    width: "100%",
    borderRadius: 3,
    opacity: 0.9,
  },
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
  profileModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#161625",
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 14,
  },
  profileModalAvatar: {
    width: 148,
    height: 148,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  profileModalInitial: {
    color: "#fff",
    fontSize: 52,
    fontWeight: "800",
  },
  profileModalName: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  profileModalDescription: {
    color: "#d5d9ea",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  profileModalDescriptionMuted: {
    color: "#8e96ad",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
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
  heatmapWrap: { gap: 10, marginTop: 6 },
  heatmapLegendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heatmapLegendBox: { width: 12, height: 12, borderRadius: 3 },
  heatmapMonthHeader: { flexDirection: "row", alignItems: "center" },
  heatmapAxisSpacer: { width: 16 },
  heatmapMonthLabelsTrack: { position: "relative", height: 16, minWidth: 16 },
  heatmapMonthLabel: {
    position: "absolute",
    top: 0,
    width: 32,
    color: "#9aa1c3",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  heatmapScrollContent: { paddingVertical: 2, paddingRight: 10 },
  heatmapBodyRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  heatmapYAxis: { width: 12, paddingTop: 18, gap: 4 },
  heatmapYAxisSlot: { height: 12, justifyContent: "center", alignItems: "center" },
  heatmapYAxisLabel: { color: "#9aa1c3", fontSize: 9, fontWeight: "700", lineHeight: 10, textAlign: "center" },
  heatmapGrid: { flexDirection: "row", gap: 4 },
  heatmapWeekCol: { gap: 4 },
  heatmapCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  heatmapFuture: { backgroundColor: "rgba(255,255,255,0.02)" },
  heatmapLevel0: { backgroundColor: "rgba(255,255,255,0.08)" },
  heatmapLevel1: { backgroundColor: "rgba(96,165,250,0.45)" },
  heatmapLevel2: { backgroundColor: "rgba(96,165,250,0.7)" },
  heatmapLevel3: { backgroundColor: "#60a5fa" },
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
  chartRangeSpacer: { height: 34 },
  chartToggleButton: {
    alignSelf: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chartToggleButtonText: { color: "#d8daec", fontSize: 12, fontWeight: "700" },
});
