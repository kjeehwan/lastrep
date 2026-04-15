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
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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

const HOME_INPUTS_KEY = "home-inputs-v1";
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
  const [showDayModal, setShowDayModal] = useState(false);
  const [lastTapAt, setLastTapAt] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [workoutsLoading, setWorkoutsLoading] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [nutritionSnapshot, setNutritionSnapshot] = useState<NutritionSnapshot>({
    averageCalories: null,
    consistencyScore: null,
  });
  const [sleepSnapshot, setSleepSnapshot] = useState<SleepSnapshot>({
    averageSleepHours: null,
    nightsCaptured: 0,
  });
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
          .sort((a, b) => a.startedAt.toMillis() - b.startedAt.toMillis());
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
          .sort((a, b) => a.startedAt.toMillis() - b.startedAt.toMillis());
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
      try {
        const raw = await AsyncStorage.getItem(HOME_INPUTS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (typeof parsed.soreness === "number") setSoreness(parsed.soreness);
        if (typeof parsed.fatigue === "number") setFatigue(parsed.fatigue);
        if (typeof parsed.motivation === "number") setMotivation(parsed.motivation);
      } catch (e) {
        console.log("Failed to load home inputs, clearing cache", e);
        try {
          await AsyncStorage.removeItem(HOME_INPUTS_KEY);
        } catch {
          // no-op
        }
      }
    };
    loadInputs();
  }, []);

  useEffect(() => {
    const save = async () => {
      try {
        await AsyncStorage.setItem(
          HOME_INPUTS_KEY,
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
    save();
  }, [soreness, fatigue, motivation]);

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
            sets: (exercise?.sets ?? []).map((set: any) => ({
              weightKg: typeof set?.weightKg === "number" ? set.weightKg : null,
              reps: String(set?.reps ?? ""),
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
        const recentSleep = sleepProfile.recentNightlyHours ?? [];
        const sleepValues = recentSleep
          .map((entry) => entry.sleepHours)
          .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
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
      Alert.alert("Seed complete", "Added sample workouts for the last 4 weeks.");
    } catch (error) {
      console.log("Failed to seed sample workouts", error);
      Alert.alert("Seed failed", "Could not add sample workouts.");
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
      Alert.alert("Cleared", "Removed seeded workouts.");
    } catch (error) {
      console.log("Failed to clear seeded workouts", error);
      Alert.alert("Clear failed", "Could not remove seeded workouts.");
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
          <TouchableOpacity onPress={() => router.push("/settings" as Href)} style={{ marginLeft: 12 }}>
            <Ionicons name="settings-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calendar</Text>
          <View style={styles.card}>
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
                    Alert.alert(
                      "Clear seeded workouts?",
                      "This removes only workouts created by Seed sample month.",
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Clear", style: "destructive", onPress: () => void clearSeededWorkouts() },
                      ]
                    )
                  }
                >
                  <Text style={styles.devButtonText}>Clear seeded</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dashboard</Text>
          <View style={styles.card}>
            <View style={styles.metricRow}>
              <View style={styles.metricChip}>
                <Text style={styles.metricLabel}>Workouts</Text>
                <Text style={styles.metricValue}>{weeklyMetrics.workoutsThisWeek}</Text>
                <Text style={styles.metricSub}>Last week: {weeklyMetrics.workoutsLastWeek}</Text>
              </View>
              <View style={styles.metricChip}>
                <Text style={styles.metricLabel}>Volume trend</Text>
                <Text style={styles.metricValue}>{Math.round(weeklyMetrics.avgVolumeThisWeek)}</Text>
                <Text style={styles.metricSub}>
                  {weeklyMetrics.improvingByVolume ? "Improving" : "Flat/Down"} vs last week
                </Text>
              </View>
            </View>
            <View style={styles.metricRow}>
              <View style={styles.metricChip}>
                <Text style={styles.metricLabel}>Adherence</Text>
                <Text style={styles.metricValue}>
                  {nutritionSnapshot.consistencyScore == null
                    ? "-"
                    : `${nutritionSnapshot.consistencyScore}%`}
                </Text>
                <Text style={styles.metricSub}>Calories on-target consistency</Text>
              </View>
              <View style={styles.metricChip}>
                <Text style={styles.metricLabel}>Calories</Text>
                <Text style={styles.metricValue}>
                  {nutritionSnapshot.averageCalories == null
                    ? "-"
                    : `${Math.round(nutritionSnapshot.averageCalories)}`}
                </Text>
                <Text style={styles.metricSub}>Avg daily (last 7 full days)</Text>
              </View>
            </View>
            <View style={styles.metricRow}>
              <View style={styles.metricChip}>
                <Text style={styles.metricLabel}>Sleep trend</Text>
                <Text style={styles.metricValue}>
                  {sleepSnapshot.averageSleepHours == null
                    ? "-"
                    : `${sleepSnapshot.averageSleepHours}h`}
                </Text>
                <Text style={styles.metricSub}>{sleepSnapshot.nightsCaptured} nights captured</Text>
              </View>
              <View style={styles.metricChip}>
                <Text style={styles.metricLabel}>Are you improving?</Text>
                <Text style={styles.metricValue}>
                  {weeklyMetrics.improvingByVolume || weeklyMetrics.improvingBySets
                    ? "Yes"
                    : "Not yet"}
                </Text>
                <Text style={styles.metricSub}>Based on weekly sets/volume</Text>
              </View>
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

            <TouchableOpacity
              style={styles.secondaryButtonWide}
              onPress={() => setShowAdjustInputsModal(true)}
            >
              <Text style={styles.secondaryButtonText}>Adjust inputs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButtonWide, loading && styles.disabled]}
              onPress={handleDecision}
              disabled={loading}
            >
              <Text style={styles.primaryText}>{loading ? "Working..." : "Get today's decision"}</Text>
            </TouchableOpacity>

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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Train</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>Log a full session without templates or history browsing.</Text>
            <TouchableOpacity
              style={styles.primaryButtonWide}
              onPress={() =>
                router.push(
                  `/(tabs)/workout/log?trainingPhase=${encodeURIComponent(trainingPhase)}` as Href
                )
              }
            >
              <Text style={styles.primaryText}>Start workout</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nutrition</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>Log today&apos;s meals and keep a simple calorie total.</Text>
            <TouchableOpacity
              style={styles.primaryButtonWide}
              onPress={() => router.push("/nutrition" as Href)}
            >
              <Text style={styles.primaryText}>Open nutrition</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

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
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 4 },
});
