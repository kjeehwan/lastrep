import { DailyMovement } from "../../src/health/DailyMovement";
import { EditWorkoutDetailsSheet } from "../../src/home/EditWorkoutDetailsSheet";
import { recordedDuration, workoutDurationLabel } from "../../src/workouts/workoutDetails";
import { NotebookInfoButton } from "../../src/ui/notebook/NotebookInfoButton";
import { PopupBackdrop } from "../../src/ui/PopupBackdrop";
import { NotebookProvider, useNotebook, useNotebookStyles, notebookSheet } from "../../src/ui/notebook/Notebook";
import { notebookFonts, type NotebookColors } from "../../src/ui/notebook/tokens";
import { NotebookModal as Modal } from "../../src/ui/notebook/NotebookModal";
import { NotebookUtilityIcon } from "../../src/ui/notebook/NotebookUtilityIcon";
import { useNotebookStatusBar } from "../../src/ui/notebook/useNotebookStatusBar";
import { mondayCalendarMatrix, draftWorkoutSummary } from "../../src/home/notebookPresentation";
import { HomeWorkoutComparison } from "../../src/home/HomeWorkoutComparison";
import { HomeDailyComparison } from "../../src/home/HomeDailyComparison";
import { HomeRecoverySheet } from "../../src/home/HomeRecoverySheet";
import { TodayPlanContextModal } from "../../src/services/decision/TodayPlanContextModal";
import { Ionicons } from "@expo/vector-icons";
import LastrepLogo from "../../components/LastrepLogo";
import { useStartupReady } from "../../src/branding/useStartupReady";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ProfilePhoto } from "../../src/profile/ProfilePhoto";
import { profilePhotoReference } from "../../src/profile/profilePhotoReference";
import { BodyCompositionHistoryChart } from "../../src/bodyComposition/BodyCompositionHistoryChart";
import { AddMeasurementSheet } from "../../src/bodyComposition/AddMeasurementSheet";
import type { BodyCompositionMetric, BodyCompositionHistoryPoint } from "../../src/bodyComposition/bodyCompositionHistory";
import { phaseForDate, phaseWeek, saveUserPhases } from "../../src/profile/phaseState";
import { CalendarOverlay, type CalendarOverlayHandle } from "../../src/ui/CalendarOverlay";
import { AdaptiveModalCard } from "../../src/ui/AdaptiveModalCard";
import { normalizeBodyCompositionHistory } from "../../src/bodyComposition/normalizeBodyCompositionHistory";
import { USER_BODY_COMPOSITION_FIELD, type BodyCompositionHistoryEntry } from "../../src/contracts/bodyComposition";
import { formatEffort, resolveEffortScale, type EffortScale } from "../../src/workouts/effortScale";
import { Href, Redirect, useFocusEffect, useIsFocused, usePathname, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  updateDoc,
  deleteField,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  useWindowDimensions,
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../src/config/firebaseConfig";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEntitlement } from "../../src/hooks/useEntitlement";
import { hasHealthSyncConsent } from "../../src/health/healthSyncConsent";
import {
  getCalorieTargetForDietPhase,
  getMealsForDate,
  getNutritionProfile,
  getNutritionTrendReport,
} from "../../src/nutrition/meals";
import {
  BarChart,
  ChartRangeSelector,
  type ChartPoint,
  type ChartRange,
} from "../../src/components/charts/TrendCharts";
import { showAppDialog } from "../../src/ui/appDialog";
import { getUserData } from "../../src/userData";
import {
  getSleepProfile,
  hasHealthSleepPermission,
} from "../../src/sleep/sleep";
import {
  parseWorkoutDraftPlan,
  normalizeDailyDecisionContext,
  getDailyContextSummary,
} from "../../src/services/decision/todayPlanContext";
import type {
  DailyDecisionContext,
  DietPhase,
  PlannedWorkoutSummary,
  TrainingPhase,
} from "../../src/types/decision";
import { useNow } from "../../src/hooks/useNow";
import { scheduleAfterInteractions } from "../../src/utils/scheduleAfterInteractions";
import { isExpectedOfflineError } from "../../src/utils/networkErrors";
import {
  computeWeeklyWorkoutMetrics,
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
const WORKOUT_DRAFT_KEY_PREFIX = "workout-log-draft-v1";
const TRAINING_PHASES: TrainingPhase[] = ["Hypertrophy", "Strength", "Power"];
const DIET_PHASES: DietPhase[] = ["Cut", "Maintain", "Bulk"];

const isTrainingPhase = (value: string): value is TrainingPhase =>
  TRAINING_PHASES.includes(value as TrainingPhase);
const isDietPhase = (value: string): value is DietPhase => DIET_PHASES.includes(value as DietPhase);

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;
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
  todayCalories: number | null;
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


type ReadinessHistoryRecord = {
  soreness: number;
  fatigue: number;
  motivation: number;
};

const KG_TO_LBS = 2.20462;
const HEATMAP_CELL_SIZE = 44;
const HEATMAP_CELL_GAP = 4;
const HEATMAP_WEEK_WIDTH = HEATMAP_CELL_SIZE + HEATMAP_CELL_GAP;
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

export default function HomeRoute() { return <NotebookProvider><Home /></NotebookProvider>; }

function Home() {
  const insets = useSafeAreaInsets();
  const { colors } = useNotebook();
  const styles = useNotebookStyles(createStyles);
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.5;
  useNotebookStatusBar();
  const [info, setInfo] = useState<{ title: string; message?: string } | null>(null);
  const showAppAlert = (title: string, message?: string) => setInfo({ title, message });
  const router = useRouter();
  const trendsRef = useRef<HomeTrendHandle>(null);
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [bodyHistory, setBodyHistory] = useState<BodyCompositionHistoryEntry[]>([]);
  const [bodyHistoryLoaded, setBodyHistoryLoaded] = useState(false);
  const [bodyHistoryError, setBodyHistoryError] = useState(false);
  const [effortScale, setEffortScale] = useState<EffortScale>("rpe");
  const [userNickname, setUserNickname] = useState<string | null>(null);
  const [profileDataLoaded, setProfileDataLoaded] = useState(false);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [profileDescription, setProfileDescription] = useState<string | null>(null);
  const [showFirstTimeBanner, setShowFirstTimeBanner] = useState(false);

  const [hasRecoveryCheckIn, setHasRecoveryCheckIn] = useState(false);
  const [rawDailyContext, setRawDailyContext] = useState<unknown>(null);
  const [contextVisible, setContextVisible] = useState(false);
  const [contextSaving, setContextSaving] = useState(false);
  const [soreness, setSoreness] = useState(4);
  const [fatigue, setFatigue] = useState(4);
  const [motivation, setMotivation] = useState(6);
  const [trainingPhase, setTrainingPhase] = useState<TrainingPhase>("Hypertrophy");
  const [dietPhase, setDietPhase] = useState<DietPhase>("Maintain");
  const [sleepTargetHours, setSleepTargetHours] = useState(7);

  const [showAdjustInputsModal, setShowAdjustInputsModal] = useState(false);
  const [workoutDraftPlan, setWorkoutDraftPlan] = useState<PlannedWorkoutSummary | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const calendarRef = useRef<CalendarOverlayHandle>(null);
  const [showMeasurementSheet, setShowMeasurementSheet] = useState(false);
  const [selectedMeasurementPoint, setSelectedMeasurementPoint] = useState<BodyCompositionHistoryPoint | null>(null);
  const [editingMeasurement, setEditingMeasurement] = useState<{ entry: BodyCompositionHistoryEntry; metric: BodyCompositionMetric } | undefined>();
  const [measurementChart, setMeasurementChart] = useState<{ metric: BodyCompositionMetric; revision: number; recordedAtMs?: number }>({ metric: "weight", revision: 0 });
  const [phaseSaving, setPhaseSaving] = useState(false);
  const [phasePicker, setPhasePicker] = useState<"trainingPhase" | "dietPhase" | null>(null);
  const [returnToCalendar, setReturnToCalendar] = useState(false);
  const [phaseHistory, setPhaseHistory] = useState<{ training: unknown; diet: unknown }>({ training: [], diet: [] });
  const [showDayModal, setShowDayModal] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSummary | null>(null);
  const [workoutDetailsSaved, setWorkoutDetailsSaved] = useState(false);
  const workoutRevision = useRef(0);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [workoutsLoading, setWorkoutsLoading] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [workoutHistoryStatus, setWorkoutHistoryStatus] = useState<{ uid: string; hasWorkouts: boolean } | null>(null);
  const [workoutProgram, setWorkoutProgram] = useState<WorkoutProgram | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [nutritionSnapshot, setNutritionSnapshot] = useState<NutritionSnapshot>({
    averageCalories: null,
    consistencyScore: null,
    todayCalories: null,
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
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg");
  const [energyUnit, setEnergyUnit] = useState<EnergyUnit>("kcal");
  const [sorenessHistory, setSorenessHistory] = useState<ChartPoint[]>([]);
  const [fatigueHistory, setFatigueHistory] = useState<ChartPoint[]>([]);
  const [motivationHistory, setMotivationHistory] = useState<ChartPoint[]>([]);
  const [homeContextLoaded, setHomeContextLoaded] = useState(false);
  const [healthSyncStatusLoaded, setHealthSyncStatusLoaded] = useState(false);
  const [healthSyncNeedsAttention, setHealthSyncNeedsAttention] = useState(false);
  const recoveryInputsHydratedRef = useRef<string | null>(null);
  const hasDeferredInitialInsightsRef = useRef(false);
  const homeInsightsRequestRef = useRef<Promise<void> | null>(null);
  const lastHomeInsightsLoadAtRef = useRef(0);

  const entitlement = useEntitlement(authReady, uid);
  const focused = useIsFocused();
  const pathname = usePathname();
  useStartupReady(Boolean(authReady && uid && profileDataLoaded && homeContextLoaded && healthSyncStatusLoaded), 8000, focused && pathname === "/home");
  const nowMs = useNow(60_000);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setEditingWorkout(null);
      setWorkoutDetailsSaved(false);
      setShowDayModal(false);
      workoutRevision.current += 1;
      setProfileDataLoaded(false);
      setUserNickname(null);
      setProfilePhotoUri(null);
      setProfileDescription(null);
      setRawDailyContext(null);
      setHasRecoveryCheckIn(false);
      setContextVisible(false);
      setShowAdjustInputsModal(false);
      recoveryInputsHydratedRef.current = null;
      setWorkoutHistoryStatus(null);
      setShowFirstTimeBanner(false);
      setBodyHistory([]);
      setBodyHistoryLoaded(false);
      setBodyHistoryError(false);
      setAuthReady(true);
      if (!user) {
        setUid(null);
        setUserNickname(null);
        setProfilePhotoUri(null);
        setProfileDescription(null);
        setShowFirstTimeBanner(false);
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
        if (!data) return; // An empty offline cache is not a loaded generic account.
        setProfileDataLoaded(true);
        setRawDailyContext(data?.todayPlanContext ?? null);
        setBodyHistory(normalizeBodyCompositionHistory(data?.[USER_BODY_COMPOSITION_FIELD]?.history));
        setBodyHistoryLoaded(true);
        setBodyHistoryError(false);
        setEffortScale(resolveEffortScale(data?.effortScale));
        const nickname = typeof data?.nickname === "string" ? data.nickname.trim() : "";
        const photoUri = profilePhotoReference(data);
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
        setPhaseHistory({ training: data?.trainingPhaseHistory, diet: data?.dietPhaseHistory });
        const target = data?.sleepSettings?.targetHours;
        if (typeof target === "number" && Number.isFinite(target) && target > 0 && target <= 24) {
          setSleepTargetHours(Math.round(target * 10) / 10);
        }
      },
      (e) => {
        setBodyHistoryError(true);
        if (!isExpectedOfflineError(e)) {
          console.log("Failed to subscribe user profile", e);
        }
      }
    );

    return unsubscribe;
  }, [uid]);

  useFocusEffect(useCallback(() => {
    if (!uid) return undefined;
    let active = true;
    const task = scheduleAfterInteractions(async () => {
      try {
        const raw = await AsyncStorage.getItem(`${HOME_INPUTS_KEY_PREFIX}:${uid}`);
        if (!active) return;
        const parsed = raw ? JSON.parse(raw) : {};
        recoveryInputsHydratedRef.current = uid;
        setHasRecoveryCheckIn(Boolean(raw));
        setSoreness(typeof parsed.soreness === "number" ? parsed.soreness : 4);
        setFatigue(typeof parsed.fatigue === "number" ? parsed.fatigue : 4);
        setMotivation(typeof parsed.motivation === "number" ? parsed.motivation : 6);
      } catch (error) {
        console.log("Failed to load recovery inputs", error);
      }
    });
    return () => { active = false; task.cancel(); };
  }, [uid]));

  useEffect(() => {
    const save = async () => {
      if (!uid || !hasRecoveryCheckIn || recoveryInputsHydratedRef.current !== uid) return;
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
  }, [uid, soreness, fatigue, motivation, hasRecoveryCheckIn]);

  useFocusEffect(useCallback(() => {
    let active = true;
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

      if (!active) return;
      try {
        const inputsRaw = await AsyncStorage.getItem(`${HOME_INPUTS_KEY_PREFIX}:${uid}`);
        if (!active) return;
        const inputs = inputsRaw ? JSON.parse(inputsRaw) : null;
        if (inputs && typeof inputs.soreness === "number" && typeof inputs.fatigue === "number" && typeof inputs.motivation === "number") {
          parsedHistory[toDateKey(new Date())] = inputs;
        }
      } catch { /* Keep the recorded history if the current check-in cannot be read. */ }

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
    const task = scheduleAfterInteractions(loadReadinessHistory);
    return () => { active = false; task.cancel(); };
  }, [uid]));

  useEffect(() => {
    const saveReadinessHistory = async () => {
      if (!uid || recoveryInputsHydratedRef.current !== uid) return;
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

  const loadHomeInsights = useCallback(async () => {
    if (!uid) return;
    if (homeInsightsRequestRef.current) return homeInsightsRequestRef.current;
    let request: Promise<void> | null = null;
    request = (async () => {
      const requestedRevision = workoutRevision.current;
      setWorkoutsLoading(true);
      setHomeContextLoaded(false);
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
            durationMin: recordedDuration(data.durationMin),
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
        if (workoutRevision.current === requestedRevision && auth.currentUser?.uid === uid) setWorkouts(parsedWorkouts);
        if (auth.currentUser?.uid === uid) {
          setWorkoutHistoryStatus({ uid, hasWorkouts: !workoutsSnap.empty });
        }

        try {
          const [profile, userData, sleepProfile, todayMeals] = await Promise.all([
            getNutritionProfile(uid),
            getUserData(uid),
            getSleepProfile(uid),
            getMealsForDate(uid),
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
          const byDate = new Map(
            nutritionTrends.dailyHistory.map((entry) => [entry.dateKey, entry.calories])
          );
          setNutritionSnapshot({
            averageCalories: averageCalories7d,
            consistencyScore: nutritionTrends.consistencyScore ?? null,
            todayCalories: Math.round(
              todayMeals.reduce((sum, meal) => sum + meal.calories, 0)
            ),
          });
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
        if (auth.currentUser?.uid === uid) setWorkoutHistoryStatus(null);
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
        setHomeContextLoaded(true);
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
      if (!uid) {
        setWorkoutDraftPlan(null);
        return undefined;
      }
      let active = true;
      const task = scheduleAfterInteractions(async () => {
        const rawDraft = await AsyncStorage.getItem(`${WORKOUT_DRAFT_KEY_PREFIX}:${uid}`).catch(() => null);
        if (!active) return;
        setWorkoutDraftPlan(parseWorkoutDraftPlan(rawDraft));
      });
      return () => {
        active = false;
        task.cancel();
      };
    }, [uid])
  );

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
      if (Platform.OS !== "android" || !uid) {
        setHealthSyncStatusLoaded(true);
        setHealthSyncNeedsAttention(false);
        return undefined;
      }

      let active = true;
      const task = scheduleAfterInteractions(async () => {
        try {
          const [consentAccepted, sleepPermissionGranted] = await Promise.all([
            hasHealthSyncConsent(uid),
            hasHealthSleepPermission(),
          ]);
          if (!active) return;
          setHealthSyncNeedsAttention(!consentAccepted || !sleepPermissionGranted);
        } catch (error) {
          if (!active) return;
          console.log("Failed to check health sync status", error);
          setHealthSyncNeedsAttention(true);
        } finally {
          if (active) setHealthSyncStatusLoaded(true);
        }
      });

      return () => {
        active = false;
        task.cancel();
      };
    }, [uid])
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
  const calendarMatrix = useMemo(() => mondayCalendarMatrix(calendarMonth), [calendarMonth]);
  const visibleCalendarWeeks = useMemo(
    () =>
      calendarMatrix.filter((week) =>
        week.some((day) => day.getMonth() === calendarMonth.getMonth())
      ),
    [calendarMatrix, calendarMonth]
  );
  const weeklyMetrics = useMemo(() => computeWeeklyWorkoutMetrics(workouts), [workouts]);
  const trainingPhaseWeek = phaseWeek(trainingPhaseStartedAt?.toMillis() ?? null, nowMs);
  const dietPhaseWeek = phaseWeek(dietPhaseStartedAt?.toMillis() ?? null, nowMs);

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


  const changePhase = async (key: 'trainingPhase' | 'dietPhase', phase: string) => {
    if (!uid || phaseSaving) return;
    setPhaseSaving(true);
    try { await saveUserPhases(uid, { [key]: phase }); setPhasePicker(null); }
    catch { showAppAlert('Could not change phase', 'Check your connection and try again.'); }
    finally { setPhaseSaving(false); }
  };

  const closeDayDetails = () => {
    setWorkoutDetailsSaved(false);
    setShowDayModal(false);
    if (returnToCalendar) calendarRef.current?.open();
    setReturnToCalendar(false);
  };

  const selectedDayEndMs = new Date(`${selectedDateKey}T23:59:59.999`).getTime();
  const selectedTrainingPhase = phaseForDate(phaseHistory.training, trainingPhase, trainingPhaseStartedAt?.toMillis() ?? null, selectedDayEndMs);
  const selectedDietPhase = phaseForDate(phaseHistory.diet, dietPhase, dietPhaseStartedAt?.toMillis() ?? null, selectedDayEndMs);

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

  const contextPlan: PlannedWorkoutSummary = workoutDraftPlan ?? { source: "none", title: null, exerciseNames: [] };
  const dailyContext = normalizeDailyDecisionContext(rawDailyContext, contextPlan, new Date(nowMs));
  const shouldShowFirstTimeBanner = showFirstTimeBanner && workoutHistoryStatus?.uid === uid && !workoutHistoryStatus.hasWorkouts;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <View style={styles.header}>
        <LastrepLogo variant="header" />
        <View style={styles.iconContainer}>
          <TouchableOpacity style={styles.headerUtility} accessibilityRole="button" accessibilityLabel="Open calendar" onPress={() => calendarRef.current?.open()}><NotebookUtilityIcon name="calendar" color={colors.ink} /></TouchableOpacity>
          <TouchableOpacity style={styles.headerUtility} accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => router.push("/settings" as Href)}><NotebookUtilityIcon name="settings" color={colors.ink} /></TouchableOpacity>
          <TouchableOpacity style={styles.headerUtility} accessibilityRole="button" accessibilityLabel={`View profile, ${profileDataLoaded ? userNickname ?? "Lifter" : "not loaded"}`} onPress={() => setShowProfileModal(true)}>
            {uid && profilePhotoUri ? <ProfilePhoto uid={uid} reference={profilePhotoUri} initial={(userNickname ?? "L").charAt(0).toUpperCase()} style={styles.headerAvatar} contentFit="cover" /> : <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}><Text style={styles.headerAvatarInitial}>{(userNickname ?? "L").charAt(0).toUpperCase()}</Text></View>}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.pageHeading}><Text style={styles.noticeSub}>{new Date(nowMs).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</Text><Text style={styles.pageTitle}>Your daily record.</Text></View>
        <View style={[styles.homePhaseRow, largeText && { flexDirection: "column" }]}>
          {(['trainingPhase', 'dietPhase'] as const).map((key) => {
            const training = key === 'trainingPhase';
            const week = training ? trainingPhaseWeek : dietPhaseWeek;
            return <TouchableOpacity key={key} accessibilityRole="button" accessibilityLabel={training ? 'Change training phase' : 'Change diet phase'} disabled={!bodyHistoryLoaded || phaseSaving} style={styles.homePhaseSelector} onPress={() => setPhasePicker(key)}>
              <Text style={styles.phaseSelectorLabel}>{training ? 'Training' : 'Diet'}</Text>
              <View style={styles.phaseSelectorValueRow}><Text style={styles.phaseSelectorValue}>{training ? trainingPhase : dietPhase}</Text><Ionicons name="chevron-down" size={14} color={colors.muted} /></View>
              {week != null ? <Text style={styles.phaseSelectorWeek}>Week {week}</Text> : null}
            </TouchableOpacity>;
          })}
        </View>

        {shouldShowFirstTimeBanner ? (
          <View style={styles.section}>
            <View style={[styles.card, styles.firstTimeBannerCard]}>
              <View style={styles.firstTimeBannerHeader}>
                <Text style={styles.cardHeading}>Get Started</Text>
                <TouchableOpacity onPress={() => void dismissFirstTimeBanner()} style={styles.firstTimeDismiss} accessibilityLabel="Dismiss Get Started" accessibilityRole="button">
                  <Ionicons name="close" size={16} color={colors.muted} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.cardText, styles.firstTimeBannerText]}>
                Set up your first routine or jump into your first workout.
              </Text>
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
          {!shouldShowFirstTimeBanner ? <View style={styles.workoutSection}>
            <Text style={styles.noticeSub}>{workoutDraftPlan ? "Your workout" : "Your next session"}</Text>
            <Text style={styles.workoutTitle}>{workoutDraftPlan?.title || "Start a workout"}</Text>
            <Text style={styles.cardText}>{draftWorkoutSummary(workoutDraftPlan)}</Text>
            <TouchableOpacity style={styles.primaryButtonWide} onPress={() => void openWorkoutLog()} accessibilityRole="button"><Text style={styles.primaryText}>{workoutDraftPlan ? "Continue workout" : "Start workout"}</Text></TouchableOpacity>
          </View> : null}
            {homeContextLoaded &&
            healthSyncStatusLoaded &&
            (nutritionSnapshot.todayCalories === 0 || healthSyncNeedsAttention) ? (
              <View style={[styles.card, styles.contextActions]}>
                <Text style={styles.cardHeading}>Complete today&apos;s picture</Text>
                {nutritionSnapshot.todayCalories === 0 ? (
                  <TouchableOpacity
                    style={styles.contextActionRow}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/nutrition",
                        params: { focusMeals: String(Date.now()) },
                      } as Href)
                    }
                  >
                    <View style={styles.contextActionIcon}>
                      <Ionicons name="restaurant-outline" size={17} color={colors.accent} />
                    </View>
                    <View style={styles.contextActionCopy}>
                      <Text style={styles.contextActionLabel}>Log a meal</Text>
                      <Text style={styles.contextActionHint}>No nutrition recorded today</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={17} color={colors.muted} />
                  </TouchableOpacity>
                ) : null}
                {healthSyncNeedsAttention ? (
                  <TouchableOpacity
                    style={styles.contextActionRow}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/profile",
                        params: { from: "/home", openHealth: String(Date.now()) },
                      } as Href)
                    }
                  >
                    <View style={styles.contextActionIcon}>
                      <Ionicons name="heart-outline" size={17} color={colors.muted} />
                    </View>
                    <View style={styles.contextActionCopy}>
                      <Text style={styles.contextActionLabel}>Connect health data</Text>
                      <Text style={styles.contextActionHint}>Sleep permission is not connected</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={17} color={colors.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.homeSectionHeading}>Progress</Text>
            </View>
            <DailyMovement uid={uid} />
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.cardHeading, { fontFamily: notebookFonts.semibold, fontSize: 16 }]}>Body composition</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add or edit body composition data" onPress={() => {
                const entry = selectedMeasurementPoint ? bodyHistory.find((row) => row.recordedAt?.toMillis() === selectedMeasurementPoint.recordedAtMs && row.source === selectedMeasurementPoint.source) : undefined;
                setEditingMeasurement(entry && selectedMeasurementPoint ? { entry, metric: selectedMeasurementPoint.key.split('-')[0] as BodyCompositionMetric } : undefined);
                setShowMeasurementSheet(true);
              }} style={styles.addDataButton}>
                <Text style={styles.addDataText}>+ Add/edit</Text>
              </TouchableOpacity>
            </View>
            {bodyHistoryError ? (
              <Text style={styles.noticeSub}>Couldn&apos;t refresh progress. Please try again when connected.</Text>
            ) : null}
            {bodyHistoryLoaded ? (
              <BodyCompositionHistoryChart key={`${uid}:${measurementChart.revision}`} initialMetric={measurementChart.metric} initialRecordedAtMs={measurementChart.recordedAtMs} onSelectionChange={setSelectedMeasurementPoint} history={bodyHistory} weightUnit={weightUnit} standalone />
            ) : !bodyHistoryError ? (
              <Text style={styles.noticeSub}>Loading measurements...</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.card, styles.outlinedPanel]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.homeSectionHeading}>Readiness</Text>
              <NotebookInfoButton label="About recovery readiness" onPress={() =>
                  showAppAlert(
                    "Recovery readiness",
                    "Score weights:\n- Sleep: 30%\n- Soreness: 30%\n- Fatigue: 30%\n- Motivation: 10%\n\nNotes:\n- Soreness/Fatigue are inverted (lower is better).\n\nLabels:\n- Ready: >= 75\n- Neutral: 50-74\n- Recover: < 50"
                  )
                } />
            </View>
            <Text style={styles.metricValue}>{hasRecoveryCheckIn && sleepSnapshot.averageSleepHours != null ? `${recoveryReadiness.score}%` : "Not enough information yet"}</Text>
            <Text style={styles.metricSub}>{hasRecoveryCheckIn && sleepSnapshot.averageSleepHours != null ? `${recoveryReadiness.label}. A recovery summary, not a workout prescription.` : "Recorded sleep and a recovery check-in help complete this summary."}</Text>
            <TouchableOpacity style={styles.todayPlanLinkButton} onPress={() => setShowAdjustInputsModal(true)}><Text style={styles.todayPlanLinkText}>Edit recovery check-in</Text></TouchableOpacity>
            <View style={[styles.metricRow, styles.metricRowWrap, largeText && { flexDirection: "column" }]}>
              <TouchableOpacity
                style={[styles.metricChip, styles.metricChipCompact, styles.metricChipQuarter]}
                onPress={() => trendsRef.current?.open("recovery_sleep")}
              >
                <Text style={styles.metricLabel}>Sleep</Text>
                <Text style={styles.metricValueSmall}>
                  {sleepSnapshot.averageSleepHours == null ? "-" : `${sleepSnapshot.averageSleepHours}h`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.metricChip, styles.metricChipCompact, styles.metricChipQuarter]}
                onPress={() => trendsRef.current?.open("recovery_soreness")}
              >
                <Text style={styles.metricLabel}>Soreness</Text>
                <Text style={styles.metricValueSmall}>{hasRecoveryCheckIn ? `${soreness}/10` : "Not recorded"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.metricChip, styles.metricChipCompact, styles.metricChipQuarter]}
                onPress={() => trendsRef.current?.open("recovery_fatigue")}
              >
                <Text style={styles.metricLabel}>Fatigue</Text>
                <Text style={styles.metricValueSmall}>{hasRecoveryCheckIn ? `${fatigue}/10` : "Not recorded"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.metricChip, styles.metricChipCompact, styles.metricChipQuarter]}
                onPress={() => trendsRef.current?.open("recovery_motivation")}
              >
                <Text style={styles.metricLabel}>Motivation</Text>
                <Text style={styles.metricValueSmall}>{hasRecoveryCheckIn ? `${motivation}/10` : "Not recorded"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.homeSectionHeading}>Weekly Trends</Text>
              <NotebookInfoButton label="About weekly trends" onPress={() => showAppAlert("Snapshot change", "The last 7 days are compared with the previous 7 days. Only recorded data is included.")} />
            </View>
            {[
              { key: "workouts" as const, label: "Workouts", value: String(weeklyMetrics.workoutsThisWeek), detail: weeklyDeltas.workouts.text },
              { key: "volume" as const, label: "Avg. session volume", value: weeklyMetrics.workoutsThisWeek ? `${Math.round(convertKgToUnit(weeklyMetrics.avgVolumeThisWeek, weightUnit))} ${weightUnit}` : "Not recorded", detail: weeklyDeltas.volume.text },
              { key: "calories" as const, label: "Avg. logged calories", value: nutritionSnapshot.averageCalories == null ? "Not recorded" : `${Math.round(convertKcalToUnit(nutritionSnapshot.averageCalories, energyUnit))} ${energyUnit}`, detail: weeklyDeltas.calories.text },
              { key: "sleep" as const, label: "Avg. recorded sleep", value: sleepSnapshot.averageSleepHours == null ? "Not recorded" : `${sleepSnapshot.averageSleepHours} h`, detail: weeklyDeltas.sleep.text },
            ].map((row) => <TouchableOpacity key={row.key} style={[styles.weeklyRow, largeText && { flexDirection: "column", alignItems: "stretch" }]} accessibilityRole="button" onPress={() => trendsRef.current?.open(row.key)}><View style={{ flex: 1 }}><Text style={styles.weeklyLabel}>{row.label}</Text><Text style={styles.noticeSub}>Last 7 days / {row.detail}</Text></View><Text style={styles.weeklyValue}>{row.value}</Text><Ionicons name="chevron-forward" size={16} color={colors.muted} /></TouchableOpacity>)}
            {workoutsLoading ? <Text style={styles.cardText}>Refreshing snapshot...</Text> : null}
            {insightsError ? <Text style={styles.noticeSub}>{insightsError}</Text> : null}
          </View>
        </View>

      </ScrollView>

      <Modal visible={info != null} transparent animationType="fade" onRequestClose={() => setInfo(null)}><PopupBackdrop style={styles.modalBackdrop} onClose={() => setInfo(null)}><AdaptiveModalCard contentSized style={styles.modalCard}><Text style={styles.modalTitle}>{info?.title}</Text>{info?.message ? <Text style={styles.cardText}>{info.message}</Text> : null}<TouchableOpacity style={[styles.secondaryButtonWide, { marginTop: 20 }]} onPress={() => setInfo(null)}><Text style={styles.secondaryButtonText}>Close</Text></TouchableOpacity></AdaptiveModalCard></PopupBackdrop></Modal>
      {showMeasurementSheet && uid ? <AddMeasurementSheet key={`${uid}:${editingMeasurement?.entry.recordedAt?.toMillis() ?? "new"}:${editingMeasurement?.entry.source ?? "manual"}`} uid={uid} entry={editingMeasurement?.entry} history={bodyHistory} weightUnit={weightUnit} onClose={() => setShowMeasurementSheet(false)} onDeleted={() => { setSelectedMeasurementPoint(null); setMeasurementChart((previous) => ({ ...previous, revision: previous.revision + 1, recordedAtMs: editingMeasurement?.entry.recordedAt?.toMillis() })); }} onSaved={(input, editedEntry) => {
        const metric: BodyCompositionMetric = input.weightKg != null ? "weight" : input.bodyFatPercent != null ? "bodyFat" : input.leanBodyMassKg != null ? "leanBodyMass" : "skeletalMuscleMass";
        setMeasurementChart((previous) => ({ metric: editedEntry ? editingMeasurement?.metric ?? metric : metric, revision: previous.revision + 1, recordedAtMs: editedEntry?.recordedAt?.toMillis() }));
      }} /> : null}
      <Modal visible={phasePicker != null} transparent animationType="fade" onRequestClose={() => { if (!phaseSaving) setPhasePicker(null); }}>
        <PopupBackdrop style={styles.modalBackdrop} onClose={() => { if (!phaseSaving) setPhasePicker(null); }}>
          <AdaptiveModalCard contentSized style={styles.modalCard}>
            <Text style={styles.modalTitle}>{phasePicker === 'trainingPhase' ? 'Training phase' : 'Diet phase'}</Text>
            <Text style={styles.noticeSub}>Switching starts the new phase at Week 1.</Text>
            {(phasePicker === 'trainingPhase' ? TRAINING_PHASES : DIET_PHASES).map((phase) => {
              const selected = phase === (phasePicker === 'trainingPhase' ? trainingPhase : dietPhase);
              return <TouchableOpacity key={phase} accessibilityRole="button" accessibilityState={{ selected }} disabled={phaseSaving} style={[styles.phasePickerOption, selected && styles.phaseChoiceActive]} onPress={() => { if (phasePicker) void changePhase(phasePicker, phase); }}><Text style={styles.phaseChoiceText}>{phase}</Text>{selected ? <Ionicons name="checkmark" size={20} color={colors.ink} /> : null}</TouchableOpacity>;
            })}
            <View style={styles.phaseStatus}><Text accessibilityLiveRegion="polite" style={styles.noticeSub}>{phaseSaving ? "Saving..." : " "}</Text></View>
            <TouchableOpacity disabled={phaseSaving} style={[styles.secondaryButtonWide, { marginTop: 16 }]} onPress={() => setPhasePicker(null)}><Text style={styles.phaseChoiceText}>Cancel</Text></TouchableOpacity>
          </AdaptiveModalCard>
        </PopupBackdrop>
      </Modal>

      <CalendarOverlay ref={calendarRef}>
        <PopupBackdrop style={styles.modalBackdrop} onClose={() => calendarRef.current?.close()}>
          <AdaptiveModalCard contentSized style={styles.modalCard}>
            <View style={[styles.calendarModalHeaderRow, { marginBottom: 16 }]}>
              <Text style={styles.modalTitle}>Calendar</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close calendar" onPress={() => calendarRef.current?.close()} style={styles.calendarCloseButton}>
                <Ionicons name="close" size={18} color={colors.ink} />
              </TouchableOpacity>
            </View>
            <View style={styles.calendarHeaderRow}>
              <TouchableOpacity
                style={styles.calendarNavButton}
                accessibilityRole="button" accessibilityLabel="Previous month"
                onPress={() =>
                  setCalendarMonth(
                    (previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1)
                  )
                }
              >
                <Ionicons name="chevron-back" size={18} color={colors.ink} />
              </TouchableOpacity>
              <Text style={styles.calendarMonthText}>
                {MONTH_LABELS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
              </Text>
              <TouchableOpacity
                style={styles.calendarNavButton}
                accessibilityRole="button" accessibilityLabel="Next month"
                onPress={() =>
                  setCalendarMonth(
                    (previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1)
                  )
                }
              >
                <Ionicons name="chevron-forward" size={18} color={colors.ink} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarPhaseLabels}>
              <Text style={styles.noticeSub}>Training: {trainingPhase}</Text>
              <Text style={styles.noticeSub}>Diet: {dietPhase}</Text>
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
                        setReturnToCalendar(true);
                        calendarRef.current?.close();
                        setShowDayModal(true);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${dateKey}${isToday ? ", today" : ""}, ${daySummary?.workoutCount || 0} workouts`}
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
                      <View
                        style={[
                          styles.calendarWorkoutDot,
                          !daySummary?.workoutCount && styles.calendarWorkoutDotHidden,
                        ]}
                      />

                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

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
          </AdaptiveModalCard>
        </PopupBackdrop>
      </CalendarOverlay>

      <HomeTrendOverlay ref={trendsRef} workouts={workouts} nowMs={nowMs} weightUnit={weightUnit} energyUnit={energyUnit} workoutsWeeklyHistory={workoutsWeeklyHistory} volumeDailyHistoryAll={volumeDailyHistoryAll} nutritionAdherenceHistory={nutritionAdherenceHistory} nutritionCalorieHistory={nutritionCalorieHistory} sleepHistory={sleepHistory} sorenessHistory={sorenessHistory} fatigueHistory={fatigueHistory} motivationHistory={motivationHistory} recoveryReadiness={recoveryReadiness} workoutsHeatmap={workoutsHeatmap} onDay={(key) => { setSelectedDateKey(key); setReturnToCalendar(false); setShowDayModal(true); }} />

      <Modal visible={showDayModal && !editingWorkout} transparent animationType="fade" onRequestClose={closeDayDetails}>
        <PopupBackdrop style={styles.modalBackdrop} onClose={closeDayDetails}>
          <AdaptiveModalCard contentSized style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selectedDayWorkouts.length ? "Workout Day" : "Rest Day"}</Text>
            {workoutDetailsSaved ? <Text accessibilityRole="alert" style={styles.cardText}>✓ Workout details updated</Text> : null}
            <Text style={styles.noticeSub}>{selectedDateKey}</Text>
            <Text style={styles.cardText}>{selectedDaySummary ? `${selectedDaySummary.workoutCount} workout(s), ${selectedDaySummary.totalSets} sets, ${Math.round(convertKgToUnit(selectedDaySummary.totalVolumeKg, weightUnit))} ${weightUnit}` : "No workouts logged"}</Text>
            {selectedTrainingPhase || selectedDietPhase ? <Text style={styles.noticeSub}>{[selectedTrainingPhase && `Training: ${selectedTrainingPhase}`, selectedDietPhase && `Diet: ${selectedDietPhase}`].filter(Boolean).join(" | ")}</Text> : null}
            {selectedProgramEntry ? <Text style={styles.noticeSub}>Program: {selectedProgramEntry.type === "rest" ? "Rest" : `Day ${selectedProgramEntry.dayNumber} (${selectedProgramEntry.title})`}</Text> : null}

            <ScrollView style={styles.dayModalScroll} contentContainerStyle={{ gap: 10 }}>
              {selectedDayWorkouts.length === 0 ? null : (
                selectedDayWorkouts.map((workout) => (
                  <View key={workout.id} style={styles.dayWorkoutCard}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <Text style={styles.dayWorkoutTitle}>{workout.title}</Text>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Edit details for ${workout.title}`} style={{ minHeight: 44, justifyContent: "center" }} onPress={() => { setWorkoutDetailsSaved(false); setEditingWorkout(workout); }}><Text style={{ color: colors.accent, fontFamily: notebookFonts.semibold, fontSize: 16 }}>Edit details</Text></TouchableOpacity>
                    </View>
                    <Text style={styles.noticeSub}>{workoutDurationLabel(workout.durationMin)}</Text>
                    <Text style={styles.noticeSub}>
                      {workout.trainingPhase ? `${workout.trainingPhase} - ` : ""}
                      {workout.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                    <Text style={styles.noticeSub}>
                      {getWorkoutSetCount(workout)} sets - {Math.round(convertKgToUnit(getWorkoutVolumeKg(workout), weightUnit))} {weightUnit}
                    </Text>
                    {workout.exercises.map((exercise, exerciseIndex) => (
                      <View key={`${workout.id}-${exercise.name}-${exerciseIndex}`} style={styles.dayExerciseBlock}>
                        <Text style={styles.dayExerciseName}>{exercise.name}</Text>
                        {exercise.mode === "cardio" ? (
                          exercise.zone ? <Text style={styles.noticeSub}>Zone: {exercise.zone}</Text> : null
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
                                }${formatEffort(set.rpe, effortScale)}`}
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
              onPress={closeDayDetails}
            >
              <Text style={styles.primaryText}>Close</Text>
            </TouchableOpacity>
          </AdaptiveModalCard>
        </PopupBackdrop>
      </Modal>

      {uid && editingWorkout ? <EditWorkoutDetailsSheet key={`${uid}:${editingWorkout.id}`} uid={uid} workout={editingWorkout} onClose={() => setEditingWorkout(null)} onRefresh={() => { setEditingWorkout(null); void loadHomeInsights(); }} onSaved={details => {
        if (auth.currentUser?.uid !== uid) return;
        workoutRevision.current += 1;
        setWorkouts(current => current.map(workout => workout.id === editingWorkout.id ? { ...workout, ...details } : workout).sort((a, b) => b.date.getTime() - a.date.getTime()));
        setSelectedDateKey(toDateKey(details.date));
        setCalendarMonth(new Date(details.date.getFullYear(), details.date.getMonth(), 1));
        setWorkoutDetailsSaved(true); setEditingWorkout(null);
      }} /> : null}

      <Modal visible={showProfileModal} transparent animationType="fade" onRequestClose={() => setShowProfileModal(false)}>
          <PopupBackdrop style={[styles.modalBackdrop, { justifyContent: "center", paddingHorizontal: 20 }]} onClose={() => setShowProfileModal(false)}>
              <AdaptiveModalCard contentSized style={styles.profileModalCard} contentContainerStyle={{ alignItems: "center", gap: 14 }}>
                {profilePhotoUri ? (
                  <ProfilePhoto
                    uid={uid}
                    reference={profilePhotoUri}
                    initial={(userNickname ?? "L").charAt(0).toUpperCase()}
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
                <Text style={styles.profileModalName}>{profileDataLoaded ? userNickname ?? "Lifter" : "Profile not loaded"}</Text>
                {profileDataLoaded ? <View style={[styles.entitlementBadge, { alignSelf: "center" }, entitlement.state === "active" ? styles.entitlementBadgeActive : styles.entitlementBadgeInactive]}><Text style={[styles.entitlementBadgeText, entitlement.state === "active" ? styles.entitlementBadgeTextActive : styles.entitlementBadgeTextMuted]}>{entitlement.state === "active" ? "Premium" : entitlement.state === "inactive" ? "Free" : "Checking"}</Text></View> : null}
                {profileDescription ? (
                  <Text style={styles.profileModalDescription}>{profileDescription}</Text>
                ) : (
                  <Text style={styles.profileModalDescriptionMuted}>
                    {profileDataLoaded ? "No description added yet." : "Profile details are not available yet."}
                  </Text>
                )}
              </AdaptiveModalCard>
          </PopupBackdrop>
      </Modal>

      {showAdjustInputsModal ? <HomeRecoverySheet initial={{ soreness, fatigue, motivation }} contextSummary={getDailyContextSummary(dailyContext)} onContext={() => setContextVisible(true)} onClose={() => setShowAdjustInputsModal(false)} onSave={async (value) => {
        if (!uid) return;
        await AsyncStorage.setItem(`${HOME_INPUTS_KEY_PREFIX}:${uid}`, JSON.stringify(value));
        setHasRecoveryCheckIn(true); setSoreness(value.soreness); setFatigue(value.fatigue); setMotivation(value.motivation); setShowAdjustInputsModal(false);
      }} /> : null}
      {contextVisible ? <TodayPlanContextModal key={`${uid}:${dailyContext?.dateKey ?? "new"}`} visible context={dailyContext} plan={contextPlan} saving={contextSaving} onClose={() => setContextVisible(false)} onSave={(context: DailyDecisionContext) => { if (!uid || contextSaving) return; setContextSaving(true); const updatedAt = Timestamp.now(); void updateDoc(doc(db, "users", uid), { todayPlanContext: { ...context, updatedAt }, activePainContext: context.pain ? { ...context.pain, updatedAt } : deleteField() }).then(() => setContextVisible(false)).catch(() => showAppAlert("Context not saved", "Please try again.")).finally(() => setContextSaving(false)); }} /> : null}



    </View>
  );
}

type HomeTrendHandle = { open: (metric: DashboardMetricKey) => void };
type HomeTrendProps = {
  workouts: WorkoutSummary[]; nowMs: number; weightUnit: WeightUnit; energyUnit: EnergyUnit;
  workoutsWeeklyHistory: ChartPoint[]; volumeDailyHistoryAll: ChartPoint[];
  nutritionAdherenceHistory: ChartPoint[]; nutritionCalorieHistory: ChartPoint[];
  sleepHistory: ChartPoint[]; sorenessHistory: ChartPoint[]; fatigueHistory: ChartPoint[]; motivationHistory: ChartPoint[];
  recoveryReadiness: { sleepRatio: number; sorenessScore: number; fatigueScore: number; motivationScore: number };
  workoutsHeatmap: { weeks: { key: string; date: Date; volumeKg: number; inRange: boolean }[][]; monthLabels: { weekIndex: number; label: string }[]; lowCut: number; highCut: number };
  onDay: (key: string) => void;
};
const HomeTrendOverlay = React.forwardRef<HomeTrendHandle, HomeTrendProps>(function HomeTrendOverlay({ workouts, nowMs, weightUnit, energyUnit, workoutsWeeklyHistory, volumeDailyHistoryAll, nutritionAdherenceHistory, nutritionCalorieHistory, sleepHistory, sorenessHistory, fatigueHistory, motivationHistory, recoveryReadiness, workoutsHeatmap, onDay }, ref) {
  const { colors } = useNotebook();
  const styles = useNotebookStyles(createStyles);
  const heatmapHeaderHeight = Math.ceil(22 * Math.max(1, useWindowDimensions().fontScale));
  const workoutsHeatmapScrollRef = useRef<ScrollView>(null);
  const [contentReady, setContentReady] = useState(false);
  const [activeDashboardMetric, setActiveDashboardMetric] = useState<DashboardMetricKey | null>(
    null
  );
  const [hideRestDaysInVolume, setHideRestDaysInVolume] = useState(false);
  const [truncateZeroDaysInCalories, setTruncateZeroDaysInCalories] = useState(false);
  const [hideZeroDaysInSleep, setHideZeroDaysInSleep] = useState(false);
  const [dashboardRange, setDashboardRange] = useState<ChartRange>(7);

  const close = () => { setActiveDashboardMetric(null); setContentReady(false); };
  React.useImperativeHandle(ref, () => ({ open(metric) { setContentReady(false); setActiveDashboardMetric(metric); } }), []);
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

  const volumeDailyHistory = useMemo(
    () => (hideRestDaysInVolume ? volumeDailyHistoryAll.filter((point) => point.value > 0) : volumeDailyHistoryAll),
    [hideRestDaysInVolume, volumeDailyHistoryAll]
  );

  useEffect(() => {
    if (activeDashboardMetric !== "workouts") return;
    const timer = setTimeout(() => {
      workoutsHeatmapScrollRef.current?.scrollToEnd({ animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [activeDashboardMetric, contentReady, workoutsHeatmap.weeks.length]);

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



  if (!activeDashboardMetric) return null;
  return (<Modal visible transparent animationType="none" onShow={() => setContentReady(true)} onRequestClose={close}>
        <PopupBackdrop style={styles.modalBackdrop} onClose={close}>
              <AdaptiveModalCard contentSized style={styles.modalCard}>
            <View style={styles.calendarModalHeaderRow}>
              <Text style={styles.modalTitle}>{dashboardGraphTitle}</Text>
              <TouchableOpacity onPress={close} style={styles.calendarCloseButton}>
                <Ionicons name="close" size={18} color={colors.ink} />
              </TouchableOpacity>
            </View>
            {contentReady ? <>
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
                    <View style={[styles.heatmapYAxis, { paddingTop: heatmapHeaderHeight }]}>
                      {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
                        <View key={`heatmap-y-${index}`} style={styles.heatmapYAxisSlot}>
                          <Text style={styles.heatmapYAxisLabel}>{label}</Text>
                        </View>
                      ))}
                    </View>
                    <ScrollView
                      ref={workoutsHeatmapScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      onContentSizeChange={() => workoutsHeatmapScrollRef.current?.scrollToEnd({ animated: false })}
                      contentContainerStyle={styles.heatmapScrollContent}
                    >
                      <View>
                        <View style={styles.heatmapMonthHeader}>
                          <View
                            style={[
                              styles.heatmapMonthLabelsTrack,
                              { width: Math.max(HEATMAP_WEEK_WIDTH, workoutsHeatmap.weeks.length * HEATMAP_WEEK_WIDTH), height: heatmapHeaderHeight },
                            ]}
                          >
                            {workoutsHeatmap.monthLabels.map((m) => (
                              <Text
                                key={`${m.weekIndex}-${m.label}`}
                                style={[styles.heatmapMonthLabel, { left: m.weekIndex * HEATMAP_WEEK_WIDTH }]}
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
                                    accessibilityRole="button"
                                    accessibilityLabel={`${cell.key}, ${Math.round(convertKgToUnit(cell.volumeKg, weightUnit))} ${weightUnit} workout volume`}
                                    disabled={!cell.inRange}
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
                                      onDay(cell.key);
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
                key={activeDashboardMetric}
                points={dashboardGraphDataScoped}
                unit={dashboardGraphUnit}
              />
            )}
            {activeDashboardMetric === "workouts" || activeDashboardMetric === "volume" ? <HomeWorkoutComparison workouts={workouts} nowMs={nowMs} weightUnit={weightUnit} showVolume={activeDashboardMetric === "volume"} /> : null}
            {activeDashboardMetric === "calories" || activeDashboardMetric === "sleep" ? <HomeDailyComparison points={activeDashboardMetric === "calories" ? nutritionCalorieHistory : sleepHistory} nowMs={nowMs} unit={activeDashboardMetric === "calories" ? energyUnit : "h"} /> : null}
            </> : <ActivityIndicator accessibilityLabel="Loading trend" color={colors.accent} style={{ marginVertical: 24 }} />}
              </AdaptiveModalCard>
            </PopupBackdrop>
      </Modal>);
});

const createStyles = (colors: NotebookColors) => { const base = notebookSheet({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: { width: "100%", maxWidth: 760, alignSelf: "center",
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
    backgroundColor: colors.rule,
  },
  headerAvatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarInitial: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
  },
  userName: {
    color: colors.ink,
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
    backgroundColor: colors.accentSoft,
  },
  entitlementBadgeInactive: {
    backgroundColor: colors.rule,
  },
  entitlementBadgeLoading: {
    backgroundColor: colors.rule,
  },
  entitlementBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  entitlementBadgeTextActive: {
    color: colors.canvas,
  },
  entitlementBadgeTextMuted: {
    color: colors.ink,
  },
  iconContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  scrollContent: { width: "100%", maxWidth: 760, alignSelf: "center",
    paddingBottom: 120,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  cardHeading: { color: colors.ink, fontSize: 20, fontWeight: "800", flexShrink: 1 },
  snapshotInfoBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: colors.rule,
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
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
    lineHeight: 20,
    marginTop: 1,
  },
  firstTimeDismiss: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.rule,
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
    backgroundColor: colors.rule,
  },
  calendarMonthText: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  calendarWeekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calendarWeekdayText: {
    color: colors.muted,
    width: "14.28%",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 12,
  },
  calendarWeekRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  homePhaseRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  homePhaseSelector: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.rule },
  phaseSelectorLabel: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  phaseSelectorValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  phaseSelectorValue: { flexShrink: 1, color: colors.ink, fontSize: 14, fontWeight: '600' },
  phaseSelectorWeek: { color: colors.muted, fontSize: 12, marginTop: 4 },
  calendarPhaseLabels: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 8 },
  addDataButton: { paddingHorizontal: 8, paddingVertical: 10 },
  addDataText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  calendarDetailsButton: { paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: colors.accentSoft },
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
    backgroundColor: colors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentSoft,
  },
  calendarDayCellOutOfMonth: {
    backgroundColor: colors.rule,
  },
  calendarDayCellToday: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  calendarDayText: { color: colors.muted, fontWeight: "700", fontSize: 15 },
  calendarDayTextMuted: { color: colors.muted },
  calendarDayTextSelected: { color: colors.ink },
  calendarWorkoutDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  calendarWorkoutDotHidden: {
    opacity: 0,
  },
  calendarProgramTag: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
    marginTop: 1,
  },
  phaseChoiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
  phaseChoice: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.rule },
  phasePickerOption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 0, borderBottomWidth: 1, borderBottomColor: colors.rule, backgroundColor: "transparent" },
  phaseChoiceActive: { backgroundColor: colors.subtle, borderBottomColor: colors.ink },
  phaseStatus: { paddingTop: 12, minHeight: 36 },
  phaseChoiceText: { color: colors.ink, fontWeight: '600' },
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
    backgroundColor: colors.rule,
  },
  phasePillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseWeekText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
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
    backgroundColor: colors.rule,
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
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metricValue: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  metricValueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  metricLabelTitle: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  metricValueSmall: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  metricSub: { color: colors.muted, fontSize: 11, lineHeight: 15, minHeight: 30 },
  metricDelta: { fontSize: 11, fontWeight: "700", minHeight: 16 },
  metricDeltaInline: { fontSize: 11, fontWeight: "700", marginTop: -1 },
  metricDeltaUp: { color: colors.muted },
  metricDeltaDown: { color: colors.danger },
  metricDeltaNeutral: { color: colors.muted },
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
    backgroundColor: colors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentSoft,
  },
  devButtonDanger: {
    backgroundColor: colors.rule,
    borderColor: colors.rule,
  },
  devButtonText: { color: colors.ink, fontWeight: "700", fontSize: 12 },
  label: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  secondaryButtonWide: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.rule,
    backgroundColor: colors.rule,
  },
  secondaryButtonText: { color: colors.ink, fontWeight: "700" },
  primaryButtonWide: {
    backgroundColor: colors.accent,
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
  contextActions: {
    marginTop: 14,
  },
  contextActionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  contextActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.rule,
  },
  contextActionCopy: { flex: 1 },
  contextActionLabel: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  contextActionHint: { color: colors.muted, fontSize: 11, marginTop: 2 },
  primaryText: {
    color: colors.ink,
    fontWeight: "700",
  },
  disabled: { opacity: 0.6 },
  cardText: { color: colors.muted, fontSize: 15 },
  stalePlanText: {
    color: colors.accent,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  notice: {
    backgroundColor: colors.rule,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  noticeText: { color: colors.ink, fontWeight: "700" },
  noticeSub: { color: colors.muted, fontSize: 12 },
  paywallButton: {
    borderColor: colors.rule,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  paywallText: { color: colors.ink, fontWeight: "700" },
  workoutShortcutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  todayPlanMetaCopy: { flex: 1 },
  todayPlanMetaLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  todayPlanMetaValue: { color: colors.muted, fontSize: 15, fontWeight: "800", marginTop: 3 },
  todayPlanLinkButton: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  todayPlanLinkText: { color: colors.accent, fontSize: 12, fontWeight: "800" },
  decisionTitle: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  decisionHeadline: { color: colors.muted, fontSize: 17, lineHeight: 22, fontWeight: "800" },
  decisionAction: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  bulletList: { gap: 6 },
  bulletItem: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  cautionBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    backgroundColor: colors.rule,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    padding: 11,
  },
  cautionText: { color: colors.warning, fontSize: 12, lineHeight: 17, flex: 1 },
  exercisePlanList: {
    gap: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.rule,
    paddingTop: 12,
  },
  exercisePlanTitle: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  exercisePlanRow: {
    borderRadius: 12,
    backgroundColor: colors.rule,
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 4,
  },
  exercisePlanHeader: { gap: 3 },
  exercisePlanName: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  exercisePlanPrescription: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  exercisePlanPrescriptionWarning: { color: colors.accent },
  exercisePlanReason: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  exercisePlanSharedReason: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  applyPlanButton: {
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: colors.accent,
    paddingVertical: 11,
    marginTop: 2,
  },
  applyPlanButtonText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  todayContextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    backgroundColor: colors.rule,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  todayContextIcon: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  todayContextCopy: { flex: 1 },
  todayContextTitle: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  todayContextSummary: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 2 },
  adjustRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  adjustText: { color: colors.muted, fontSize: 13 },
  helpIcon: { paddingHorizontal: 4, paddingVertical: 2 },
  helpText: { color: colors.muted, fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  profileModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.muted,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 14,
  },
  profileModalAvatar: {
    width: 148,
    height: 148,
    borderRadius: 40,
    backgroundColor: colors.rule,
  },
  profileModalInitial: {
    color: colors.ink,
    fontSize: 52,
    fontWeight: "800",
  },
  profileModalName: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  profileModalDescription: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  profileModalDescriptionMuted: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  modalCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
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
    backgroundColor: colors.rule,
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
    backgroundColor: colors.accent,
    minHeight: 8,
  },
  graphValueText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  graphLabelText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  heatmapWrap: { gap: 10, marginTop: 6 },
  heatmapLegendRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  heatmapLegendBox: { width: 12, height: 12, borderRadius: 3 },
  heatmapMonthHeader: { flexDirection: "row", alignItems: "center" },
  heatmapAxisSpacer: { width: 16 },
  heatmapMonthLabelsTrack: { position: "relative", height: 16, minWidth: 16 },
  heatmapMonthLabel: {
    position: "absolute",
    top: 0,
    width: 32,
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  heatmapScrollContent: { paddingVertical: 2, paddingRight: 10 },
  heatmapBodyRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  heatmapYAxis: { width: 20, paddingTop: 22, gap: HEATMAP_CELL_GAP },
  heatmapYAxisSlot: { height: HEATMAP_CELL_SIZE, justifyContent: "center", alignItems: "center" },
  heatmapYAxisLabel: { color: colors.muted, fontSize: 9, fontWeight: "700", lineHeight: 10, textAlign: "center" },
  heatmapGrid: { flexDirection: "row", gap: HEATMAP_CELL_GAP },
  heatmapWeekCol: { gap: HEATMAP_CELL_GAP },
  heatmapCell: {
    width: HEATMAP_CELL_SIZE,
    height: HEATMAP_CELL_SIZE,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  heatmapFuture: { backgroundColor: colors.rule },
  heatmapLevel0: { backgroundColor: colors.rule },
  heatmapLevel1: { backgroundColor: colors.accentSoft },
  heatmapLevel2: { backgroundColor: colors.accentSoft },
  heatmapLevel3: { backgroundColor: colors.muted },
  dayModalScroll: {
    maxHeight: 320,
    marginTop: 6,
  },
  dayWorkoutCard: {
    backgroundColor: colors.rule,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  dayWorkoutTitle: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  dayExerciseBlock: { marginTop: 8, gap: 2 },
  dayExerciseName: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  modalTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", marginBottom: 4 },
  chartRangeSpacer: { height: 34 },
  chartToggleButton: {
    alignSelf: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chartToggleButtonText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
}); return { ...base, ...notebookSheet({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { width: "100%", maxWidth: 760, alignSelf: "center", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.rule },
  iconContainer: { flexDirection: "row", alignItems: "center", gap: 4 }, headerUtility: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  scrollContent: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  pageHeading: { gap: 4, marginBottom: 16 }, pageTitle: { color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: 28, lineHeight: 36 },
  homePhaseRow: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.rule, marginBottom: 20 },
  homePhaseSelector: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: "transparent", minHeight: 80, gap: 4 },
  section: { marginTop: 0 }, card: { backgroundColor: "transparent", borderRadius: 0, borderWidth: 0, borderTopWidth: 1, borderTopColor: colors.rule, paddingHorizontal: 0, paddingVertical: 20, gap: 12 },
  outlinedPanel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.rule, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 16, marginVertical: 16 },
  contextActions: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.rule, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 16, marginVertical: 20 },
  homeSectionHeading: { color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: 24, fontWeight: "400", flexShrink: 1 },
  cardHeading: { color: colors.ink, fontSize: 20, fontWeight: "600", flexShrink: 1 }, sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "600" },
  workoutSection: { borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: 16, paddingVertical: 4, gap: 8, marginBottom: 24 },
  workoutTitle: { color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: 26, lineHeight: 32 },
  primaryButtonWide: { backgroundColor: colors.primary, minHeight: 48, borderRadius: 8, padding: 12, alignItems: "center", justifyContent: "center", marginTop: 16 }, primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: "600" },
  secondaryButtonWide: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, minHeight: 48, borderRadius: 8, padding: 12, alignItems: "center", justifyContent: "center" }, secondaryButtonText: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  metricValue: { color: colors.ink, fontSize: 28, fontWeight: "600" }, metricChip: { flex: 1, backgroundColor: "transparent", borderWidth: 0, borderRadius: 0, paddingHorizontal: 4, paddingVertical: 12, minHeight: 64 },
  metricChipQuarter: { flexBasis: "42%", flexGrow: 1 }, metricRowWrap: { flexWrap: "wrap" }, metricSub: { color: colors.muted, fontSize: 14 },
  weeklyRow: { flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.rule, minHeight: 72, paddingVertical: 12 }, weeklyLabel: { color: colors.ink, fontSize: 16, fontWeight: "600" }, weeklyValue: { color: colors.ink, fontSize: 18, fontWeight: "600", flexShrink: 1 },
  snapshotInfoBtn: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  firstTimeBannerCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.rule, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 20 },
  todayPlanLinkButton: { minHeight: 48, justifyContent: "center", backgroundColor: "transparent", borderWidth: 0, paddingHorizontal: 0 }, todayPlanLinkText: { color: colors.accent, fontSize: 16, fontWeight: "600" },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" }, modalCard: { width: "100%", maxWidth: 560, backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  profileModalCard: { ...base.profileModalCard, backgroundColor: colors.surface, borderColor: colors.rule, borderRadius: 8 },
  modalTitle: { color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: 22, fontWeight: "600", marginBottom: 16 },
  calendarCloseButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }, calendarNavButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  calendarDayCellSelected: { backgroundColor: colors.primary }, calendarDayTextSelected: { color: colors.onPrimary }, calendarDayCellToday: { borderWidth: 1, borderColor: colors.accent }, calendarWorkoutDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  phaseChoiceActive: { backgroundColor: colors.subtle, borderBottomColor: colors.ink },
  firstTimeActions: { flexDirection: "column", gap: 12 }, firstTimeActionButton: { flex: 0 },
  entitlementBadgeActive: { backgroundColor: colors.accentSoft }, entitlementBadgeTextActive: { color: colors.accent },
  metricDeltaUp: { color: colors.muted }, metricDeltaDown: { color: colors.muted }, metricDeltaNeutral: { color: colors.muted },
  heatmapLevel0: { backgroundColor: colors.subtle }, heatmapLevel1: { backgroundColor: colors.rule }, heatmapLevel2: { backgroundColor: colors.muted }, heatmapLevel3: { backgroundColor: colors.accent },
}) }; };
