import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer } from "expo-audio";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Keyboard,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Image } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { db } from "../../../src/config/firebaseConfig";
import WorkoutGestureTextInput from "../../../src/components/WorkoutGestureTextInput";
import WorkoutSetList from "../../../src/components/WorkoutSetList";
import type { Decision } from "../../../src/types/decision";
import { showAppAlert, showAppDialog } from "../../../src/ui/appDialog";
import { isExpectedOfflineError } from "../../../src/utils/networkErrors";
import { scheduleAfterInteractions } from "../../../src/utils/scheduleAfterInteractions";
import { popPendingExerciseSelection } from "../../../src/workouts/addExerciseBridge";
import { loadFreeExerciseDbCatalog } from "../../../src/workouts/freeExerciseDbCatalog";
import { resolveFreeExerciseDbImagesForNames } from "../../../src/workouts/freeExerciseDbImages";
import {
  EXERCISE_CATALOG,
  EXERCISE_GROUPS,
  type ExerciseCatalogItem,
  type ExerciseGroupKey,
} from "../../../src/workouts/exerciseCatalog";
import {
  DEFAULT_WORKOUT_TEMPLATES,
  getAverageRpe,
  getDominantGroup,
  goalToLabel,
  isPhaseGoalAligned,
  pickTemplate,
  resolveRecommendationTargets,
  type WorkoutLike,
} from "../../../src/workouts/recommendationHeuristics";
import { getCalendarMatrix } from "../../../src/workouts/homeInsights";

type Unit = "kg" | "lbs" | "km" | "mi";
type SetType = "warmup" | "normal" | "failure" | "drop";
type ExerciseMode = "resistance" | "cardio";
type SetEntry = {
  weightKg: number | null;
  // Preserve partially typed decimals such as "20." until the user finishes the value.
  weightText?: string;
  reps: string;
  rpe?: string;
  distanceKm?: number | null;
  durationSec?: number | null;
  zone?: string;
  setType?: SetType;
  done: boolean;
  baselineWeightKg?: number | null;
  baselineReps?: string;
  baselineAdjusted?: boolean;
};
type Exercise = {
  id: string;
  name: string;
  notes?: string;
  tempo?: string;
  cardioSessionType?: "steady" | "intervals" | "sprint" | "recovery";
  cardioEffortLevel?: "easy" | "moderate" | "hard" | "max";
  sets: SetEntry[];
};
type FollowedAnswer = "yes" | "partial" | "no";
type HelpfulAnswer = "yes" | "neutral" | "no";
type PastWorkout = {
  id: string;
  title: string;
  date: Date;
  durationMin?: number | null;
  exercises: {
    name: string;
    notes?: string;
    tempo?: string;
    zone?: string;
    mode?: ExerciseMode;
    cardioSessionType?: "steady" | "intervals" | "sprint" | "recovery";
    cardioEffortLevel?: "easy" | "moderate" | "hard" | "max";
    sets: {
      weightKg: number | null;
      reps: string;
      rpe?: string;
      distanceKm?: number | null;
      durationSec?: number | null;
      zone?: string;
      setType?: SetType;
    }[];
  }[];
};

const isSameDateKey = (left: string, right: string) => left.trim() === right.trim();

type Routine = {
  id: string;
  name: string;
  exercises: {
    name: string;
    notes?: string;
    tempo?: string;
    zone?: string;
    mode?: ExerciseMode;
    cardioSessionType?: "steady" | "intervals" | "sprint" | "recovery";
    cardioEffortLevel?: "easy" | "moderate" | "hard" | "max";
    sets: {
      reps: string;
      targetRpe?: string;
      defaultWeightKg?: number | null;
      defaultDistanceKm?: number | null;
      defaultDurationSec?: number | null;
      defaultZone?: string;
      setType?: SetType;
    }[];
  }[];
  createdAt: Date | null;
  updatedAt: Date | null;
};

const DRAFT_KEY_PREFIX = "workout-log-draft-v1";
const FAVORITES_KEY = "workout-favorite-exercises-v1";
const FAVORITES_KEY_PREFIX = "workout-favorite-exercises-v1";
const REST_PREFS_KEY = "workout-rest-preferences-v1";
const REST_PREFS_KEY_PREFIX = "workout-rest-preferences-v1";
const TEMPO_FORMAT_HINT =
  "Use eccentric-hold-concentric-hold (e.g. 3-0-X-0). Numbers are seconds, X is explosive.";
const TEMPO_TOKENS = ["X", "0", "1", "2", "3"] as const;
const DEFAULT_TEMPO = "3-0-X-0";
const DEFAULT_TEMPO_INDICES = [4, 1, 0, 1];
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
const SET_TYPE_LABELS: { value: SetType; title: string; marker: string; description: string }[] = [
  { value: "warmup", title: "Warm-up", marker: "W", description: "Prep set with lighter load." },
  { value: "normal", title: "Normal", marker: "N", description: "Standard working set." },
  { value: "failure", title: "Failure", marker: "F", description: "Set pushed to failure." },
  { value: "drop", title: "Drop", marker: "D", description: "Immediately reduce load and continue." },
];
const CARDIO_SESSION_TYPES = [
  { value: "steady", label: "Steady" },
  { value: "intervals", label: "Intervals" },
  { value: "sprint", label: "Sprint" },
  { value: "recovery", label: "Recovery" },
] as const;
const CARDIO_EFFORT_LEVELS = [
  { value: "easy", label: "Easy" },
  { value: "moderate", label: "Moderate" },
  { value: "hard", label: "Hard" },
  { value: "max", label: "Max" },
] as const;
const isValidSetType = (value: string): value is SetType =>
  value === "warmup" || value === "normal" || value === "failure" || value === "drop";
const toSetType = (value: unknown): SetType =>
  typeof value === "string" && isValidSetType(value) ? value : "normal";
const toLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const isValidTempo = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^(?:\d+|[xX])-(?:\d+|[xX])-(?:\d+|[xX])-(?:\d+|[xX])$/.test(trimmed);
};

const tempoTokenToIndex = (token: string) => {
  const normalized = token.trim().toUpperCase();
  const idx = TEMPO_TOKENS.findIndex((item) => item === normalized);
  return idx >= 0 ? idx : null;
};

const parseTempoToIndices = (tempo?: string) => {
  const candidate = (tempo || "").trim() || DEFAULT_TEMPO;
  const parts = candidate.split("-");
  if (parts.length !== 4) return [...DEFAULT_TEMPO_INDICES];
  const mapped = parts.map((part) => tempoTokenToIndex(part));
  if (mapped.some((value) => value == null)) return [...DEFAULT_TEMPO_INDICES];
  return mapped as number[];
};

const formatTempoFromIndices = (indices: number[]) =>
  indices
    .slice(0, 4)
    .map((index) => TEMPO_TOKENS[Math.max(0, Math.min(TEMPO_TOKENS.length - 1, index))])
    .join("-");

export default function WorkoutLog() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTabletLayout = width >= 600;
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseUnits, setExerciseUnits] = useState<Record<string, Unit>>({});
  const [favoriteExercises, setFavoriteExercises] = useState<string[]>([]);
  const [favoritesHydratedUid, setFavoritesHydratedUid] = useState<string | null>(null);
  const [freeDbCatalog, setFreeDbCatalog] = useState<ExerciseCatalogItem[]>([]);
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null);
  const [replaceSearch, setReplaceSearch] = useState("");
  const [replaceGroup, setReplaceGroup] = useState<string>("all");
  const [showExerciseDemo, setShowExerciseDemo] = useState(false);
  const [activeDemoExercise, setActiveDemoExercise] = useState<ExerciseCatalogItem | null>(null);
  const [activeDemoImageUris, setActiveDemoImageUris] = useState<string[]>([]);
  const [exerciseImageMap, setExerciseImageMap] = useState<Record<string, string[]>>({});
  const [showExerciseActionsModal, setShowExerciseActionsModal] = useState(false);
  const [activeExerciseActionId, setActiveExerciseActionId] = useState<string | null>(null);
  const [undoDeletedSet, setUndoDeletedSet] = useState<{
    exerciseId: string;
    setIndex: number;
    set: SetEntry;
  } | null>(null);
  const [showRestTimerModal, setShowRestTimerModal] = useState(false);
  const [activeRestTimerExerciseId, setActiveRestTimerExerciseId] = useState<string | null>(null);
  const [restPreferenceByName, setRestPreferenceByName] = useState<Record<string, number>>({});
  const [restPrefsHydratedUid, setRestPrefsHydratedUid] = useState<string | null>(null);
  const [restPreferenceByExercise, setRestPreferenceByExercise] = useState<Record<string, number>>({});
  const [restCustomInputByExercise, setRestCustomInputByExercise] = useState<Record<string, string>>({});
  const [restTimerByExercise, setRestTimerByExercise] = useState<
    Record<string, { remainingSec: number; running: boolean }>
  >({});
  const [saving, setSaving] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [workoutTimerRunning, setWorkoutTimerRunning] = useState(false);
  const [sessionDateText, setSessionDateText] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  });
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [durationAdjustHoursText, setDurationAdjustHoursText] = useState("00");
  const [durationAdjustMinutesText, setDurationAdjustMinutesText] = useState("00");
  const [showCardioTimeModal, setShowCardioTimeModal] = useState(false);
  const [cardioTimeTarget, setCardioTimeTarget] = useState<{ exerciseId: string; setIndex: number } | null>(null);
  const [cardioTimeHoursText, setCardioTimeHoursText] = useState("00");
  const [cardioTimeMinutesText, setCardioTimeMinutesText] = useState("00");
  const [showCardioDistanceModal, setShowCardioDistanceModal] = useState(false);
  const [cardioDistanceTarget, setCardioDistanceTarget] = useState<{ exerciseId: string; setIndex: number } | null>(
    null
  );
  const [cardioDistanceWholeText, setCardioDistanceWholeText] = useState("0");
  const [cardioDistanceDecimalText, setCardioDistanceDecimalText] = useState("00");
  const [sessionPhase, setSessionPhase] = useState("Hypertrophy");
  const [recentExercises, setRecentExercises] = useState<string[]>([]);
  const [pastWorkouts, setPastWorkouts] = useState<PastWorkout[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [showMyRoutinesModal, setShowMyRoutinesModal] = useState(false);
  const [showRoutineNameModal, setShowRoutineNameModal] = useState(false);
  const [showRoutineStartModal, setShowRoutineStartModal] = useState(false);
  const [showRoutineActionsModal, setShowRoutineActionsModal] = useState(false);
  const [showRoutineDeleteModal, setShowRoutineDeleteModal] = useState(false);
  const [routineNameInput, setRoutineNameInput] = useState("");
  const [routineFormError, setRoutineFormError] = useState<string | null>(null);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [routineBuilderMode, setRoutineBuilderMode] = useState(false);
  const [routineSaving, setRoutineSaving] = useState(false);
  const [uiFeedback, setUiFeedback] = useState<string | null>(null);
  const [lastAppliedRoutineId, setLastAppliedRoutineId] = useState<string | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [recommendationSummary, setRecommendationSummary] = useState<string[]>([]);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showFinishTitleInput, setShowFinishTitleInput] = useState(false);
  const [showTempoEditorModal, setShowTempoEditorModal] = useState(false);
  const [activeTempoExerciseId, setActiveTempoExerciseId] = useState<string | null>(null);
  const [tempoDraftIndices, setTempoDraftIndices] = useState<number[]>([...DEFAULT_TEMPO_INDICES]);
  const [showDiscardConfirmModal, setShowDiscardConfirmModal] = useState(false);
  const [followedAnswer, setFollowedAnswer] = useState<FollowedAnswer | null>(null);
  const [helpfulAnswer, setHelpfulAnswer] = useState<HelpfulAnswer | null>(null);
  const [baselineDate, setBaselineDate] = useState<Date | null>(null);
  const [latestDecision, setLatestDecision] = useState<{
    decision?: Decision;
    adjustments?: { intensityPct?: number };
  } | null>(null);
  const [activeSetMenu, setActiveSetMenu] = useState<{
    exerciseId: string;
    setIndex: number;
  } | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const routerParams = useLocalSearchParams<{ trainingPhase?: string; createRoutine?: string }>();
  const auth = getAuth();
  const [activeUid, setActiveUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const scrollNativeGesture = useMemo(() => Gesture.Native(), []);
  const workoutStartedAtMsRef = useRef<number | null>(null);
  const draftSavedAtRef = useRef<Date | null>(null);
  const buildExerciseDraftRef = useRef<((name: string, id: string) => Exercise) | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startupLoadTaskRef = useRef<{ cancel: () => void } | null>(null);
  const focusHydrationTaskRef = useRef<{ cancel: () => void } | null>(null);
  const focusRefreshTaskRef = useRef<{ cancel: () => void } | null>(null);
  const favoriteHydrationTaskRef = useRef<{ cancel: () => void } | null>(null);
  const lastFocusHydrationAtRef = useRef(0);
  const createRoutineParamHandledRef = useRef(false);
  const lastCompletedSetByExerciseRef = useRef<Record<string, number>>({});
  const lastSetToggleAtRef = useRef<Record<string, number>>({});
  const gongPlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const restTimerSnapshotRef = useRef<Record<string, { remainingSec: number; running: boolean }>>({});
  const getDraftKey = useCallback((uid: string) => `${DRAFT_KEY_PREFIX}:${uid}`, []);
  const handleGoBack = useCallback(() => {
    router.replace("/home");
  }, [router]);

  const playGong = useCallback(async () => {
    try {
      if (!gongPlayerRef.current) {
        gongPlayerRef.current = createAudioPlayer(require("../../../assets/sounds/gong.wav"));
      }
      gongPlayerRef.current.seekTo(0);
      gongPlayerRef.current.play();
    } catch (error) {
      console.log("Failed to play rest gong", error);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setActiveUid(user?.uid ?? null);
    });
    return unsubscribe;
  }, [auth]);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const convertWeight = (value: number, from: Unit, to: Unit) => {
    if (Number.isNaN(value)) return null;
    if (from === to) return value;
    return from === "kg" ? value * 2.20462 : value * 0.453592;
  };

  const formatWeightInput = (weightKg: number | null, targetUnit: Unit) => {
    if (weightKg === null || Number.isNaN(weightKg)) return "";
    const val = targetUnit === "kg" ? weightKg : weightKg * 2.20462;
    return `${Math.round(val * 10) / 10}`;
  };

  const formatDecisionLabel = (decision?: Decision) =>
    decision ? decision.replace("_", " ") : "";

  const formatIntensityPct = (value?: number) => {
    if (value == null) return "0%";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value}%`;
  };

  const roundWeightKg = (weightKg: number, unit: Unit) => {
    if (!Number.isFinite(weightKg)) return weightKg;
    if (unit === "kg") {
      const step = 2.5;
      return Math.round(weightKg / step) * step;
    }
    const lbs = weightKg * 2.20462;
    const step = 5;
    const roundedLbs = Math.round(lbs / step) * step;
    return roundedLbs * 0.453592;
  };

  const getAdjustmentOptions = () => [-20, -10, 0, 10, 20];
  const normalizeExerciseName = (value: string) => value.trim().toLowerCase();
  const getSetTypeMarker = (set: SetEntry, index: number) => {
    const type = toSetType(set.setType);
    if (type === "warmup") return "W";
    if (type === "failure") return "F";
    if (type === "drop") return "D";
    return `${index + 1}`;
  };
  const parseSessionDate = (raw: string): Date | null => {
    const trimmed = raw.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
      date.getFullYear() !== year ||
      date.getMonth() + 1 !== month ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  };
  const formatElapsedTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };
  const parseDistanceKm = (raw: string, unit: Unit): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    if (unit === "km") return parsed;
    if (unit === "mi") return parsed * 1.60934;
    return parsed;
  };
  const formatDistanceInput = (distanceKm: number | null, unit: Unit) => {
    if (distanceKm == null || Number.isNaN(distanceKm)) return "";
    const value = unit === "mi" ? distanceKm / 1.60934 : distanceKm;
    return `${Math.round(value * 100) / 100}`;
  };
  const parseDurationSecFromInput = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const hhmmss = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmmss) {
      const minutes = Number(hhmmss[1]);
      const seconds = Number(hhmmss[2]);
      if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds > 59) return null;
      return minutes * 60 + seconds;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed);
  };
  const formatDurationHoursMinutes = (durationSec: number | null) => {
    if (durationSec == null || Number.isNaN(durationSec)) return "";
    const totalMinutes = Math.floor(durationSec / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };
  const formatDurationInput = (durationSec: number | null) => {
    if (durationSec == null || Number.isNaN(durationSec)) return "";
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const getSavedRestPreference = useCallback(
    (exerciseName: string) => {
      const key = exerciseName.trim().toLowerCase();
      return restPreferenceByName[key] ?? 90;
    },
    [restPreferenceByName]
  );

  const imageLookupKey = (exerciseName: string) => exerciseName.trim().toLowerCase();
  const getExerciseModeByName = useCallback(
    (exerciseName: string): ExerciseMode => {
      const key = exerciseName.trim().toLowerCase();
      const found = [...EXERCISE_CATALOG, ...freeDbCatalog].find(
        (item) => item.name.trim().toLowerCase() === key
      );
      return found?.group === "cardio" ? "cardio" : "resistance";
    },
    [freeDbCatalog]
  );


  const addExercise = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const mode = getExerciseModeByName(trimmed);
      const restSeconds = getSavedRestPreference(trimmed);
      setExercises((prev) => {
        const exists = prev.some((e) => e.name.toLowerCase() === trimmed.toLowerCase());
        if (exists) return prev;
        const draft = buildExerciseDraftRef.current;
        if (!draft) return prev;
        return [...prev, draft(trimmed, id)];
      });
      // default to kg for resistance and km for cardio
      setExerciseUnits((prev) => ({ ...prev, [id]: mode === "cardio" ? "km" : "kg" }));
      setRestPreferenceByExercise((prev) => ({ ...prev, [id]: restSeconds }));
      setRestCustomInputByExercise((prev) => ({ ...prev, [id]: "" }));
      setRestTimerByExercise((prev) => ({ ...prev, [id]: { remainingSec: restSeconds, running: false } }));
    },
    [getExerciseModeByName, getSavedRestPreference]
  );

  const openAddExercise = useCallback(() => {
    router.push({
      pathname: "/(tabs)/workout/add-exercise",
      params: {
        recent: JSON.stringify(recentExercises.slice(0, 60)),
      },
    });
  }, [router, recentExercises]);

  const mergedCatalog = useMemo(() => {
    const map = new Map<string, ExerciseCatalogItem>();
    [...EXERCISE_CATALOG, ...freeDbCatalog].forEach((item) => {
      const key = item.name.trim().toLowerCase();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  }, [freeDbCatalog]);

  const catalogIndex = useMemo(() => {
    type IndexedItem = {
      item: ExerciseCatalogItem;
      nameLower: string;
      searchText: string;
    };

    const byName = new Map<string, ExerciseCatalogItem>();
    const groups: Record<ExerciseGroupKey | "all", IndexedItem[]> = {
      all: [],
      chest: [],
      back: [],
      legs: [],
      shoulders: [],
      arms: [],
      core: [],
      cardio: [],
    };

    mergedCatalog.forEach((item) => {
      const nameLower = item.name.trim().toLowerCase();
      const searchText = [
        item.name,
        ...item.aliases,
        ...item.primaryMuscles,
        ...item.secondaryMuscles,
        ...item.equipment,
        item.movementPattern,
      ]
        .join(" ")
        .toLowerCase();
      const indexed: IndexedItem = { item, nameLower, searchText };
      byName.set(nameLower, item);
      groups.all.push(indexed);
      groups[item.group].push(indexed);
    });

    (Object.keys(groups) as (keyof typeof groups)[]).forEach((key) => {
      groups[key].sort((a, b) => a.item.name.localeCompare(b.item.name));
    });

    return { byName, groups };
  }, [mergedCatalog]);

  const findCatalogExercise = useCallback(
    (name: string) => catalogIndex.byName.get(name.trim().toLowerCase()) ?? null,
    [catalogIndex]
  );
  const getExerciseMode = useCallback(
    (exerciseName: string): ExerciseMode =>
      findCatalogExercise(exerciseName)?.group === "cardio" ? "cardio" : "resistance",
    [findCatalogExercise]
  );
  const getExerciseZone = useCallback((exercise: Exercise) => {
    const explicit = String(exercise.tempo || "").trim();
    if (explicit) return explicit;
    const firstSetZone = exercise.sets.find((set) => String(set.zone || "").trim())?.zone;
    return String(firstSetZone || "").trim();
  }, []);
  const formatLastSetSummary = useCallback(
    (set: {
      weightKg: number | null;
      reps: string;
      rpe?: string;
      distanceKm?: number | null;
      durationSec?: number | null;
      zone?: string;
    }) => {
      const unit: Unit = "kg";
      const distance = formatDistanceInput(set.distanceKm ?? null, unit);
      const duration = formatDurationInput(set.durationSec ?? null);
      const zone = String(set.zone || "").trim();
      if (distance || duration || zone) {
        const distText = distance ? `${distance} km` : "-";
        const timeText = formatDurationHoursMinutes(set.durationSec ?? null) || duration || "-";
        if (zone) {
          return `${distText} in ${timeText} · Z${zone}`;
        }
        return `${distText} in ${timeText}`;
      }
      const weight = formatWeightInput(set.weightKg, unit) || "-";
      const reps = String(set.reps || "").trim() || "-";
      const rpe = String(set.rpe || "").trim();
      if (set.weightKg == null || set.weightKg <= 0) {
        return `${reps} reps${rpe ? ` @ RPE ${rpe}` : ""}`;
      }
      return `${weight} kg x ${reps}${rpe ? ` @ RPE ${rpe}` : ""}`;
    },
    []
  );

  const searchMergedCatalog = useCallback(
    (params: { query: string; group: ExerciseGroupKey | "all" }) => {
      const normalize = (value: string) =>
        value
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      const isSubsequenceLocal = (needleValue: string, haystack: string) => {
        if (!needleValue) return true;
        let index = 0;
        for (let i = 0; i < haystack.length && index < needleValue.length; i += 1) {
          if (haystack[i] === needleValue[index]) index += 1;
        }
        return index === needleValue.length;
      };
      const scoreSearch = (needleValue: string, title: string, haystack: string) => {
        if (!needleValue) return 1;
        let score = 0;
        if (title.startsWith(needleValue)) score += 120;
        if (title.includes(needleValue)) score += 80;
        if (haystack.includes(needleValue)) score += 60;
        const tokens = needleValue.split(" ").filter(Boolean);
        score += tokens.filter((token) => haystack.includes(token)).length * 20;
        if (isSubsequenceLocal(needleValue.replace(/\s+/g, ""), title.replace(/\s+/g, ""))) score += 20;
        return score;
      };
      const needle = normalize(params.query);
      let pool = catalogIndex.groups[params.group];
      if (!needle) {
        return pool.map((entry) => entry.item);
      }
      const seen = new Set<string>();
      const deduped = pool.filter((entry) => {
        if (seen.has(entry.nameLower)) return false;
        seen.add(entry.nameLower);
        return true;
      });
      return deduped
        .map((entry) => ({
          item: entry.item,
          score: scoreSearch(needle, normalize(entry.item.name), normalize(entry.searchText)),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
        .map((entry) => entry.item);
    },
    [catalogIndex]
  );

  const getSubstitutionCandidates = useCallback(
    (exerciseName: string, limit = 16) => {
      const target = findCatalogExercise(exerciseName);
      if (!target) return [];
      const score = (candidate: ExerciseCatalogItem) => {
        let value = 0;
        if (candidate.group === target.group) value += 5;
        if (candidate.movementPattern === target.movementPattern) value += 4;
        if (candidate.primaryMuscles.some((muscle) => target.primaryMuscles.includes(muscle))) value += 4;
        if (candidate.secondaryMuscles.some((muscle) => target.primaryMuscles.includes(muscle))) value += 2;
        if (candidate.primaryMuscles.some((muscle) => target.secondaryMuscles.includes(muscle))) value += 2;
        if (candidate.equipment.some((equipment) => target.equipment.includes(equipment))) value += 3;
        if (candidate.difficulty === target.difficulty) value += 1;
        return value;
      };
      return mergedCatalog
        .filter((candidate) => candidate.name.toLowerCase() !== target.name.toLowerCase())
        .map((candidate) => ({ candidate, score: score(candidate) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name))
        .slice(0, limit)
        .map((entry) => entry.candidate);
    },
    [findCatalogExercise, mergedCatalog]
  );

  const replacementOptions = useMemo(() => {
    const targetExercise = exercises.find((exercise) => exercise.id === replaceTarget);
    if (targetExercise) {
      const targetCatalog = findCatalogExercise(targetExercise.name);
      // A custom name has no reliable metadata. Do not show arbitrary alphabetic exercises.
      if (!targetCatalog && !replaceSearch.trim()) return [];
      const searchGroup =
        replaceGroup === "all"
          ? targetCatalog?.group ?? "all"
          : (replaceGroup as ExerciseGroupKey);
      const normalizedTargetName = targetExercise.name.trim().toLowerCase();
      const substitutions = getSubstitutionCandidates(targetExercise.name, 24);
      const searched = searchMergedCatalog({
        query: replaceSearch,
        group: searchGroup,
      });
      const merged = [...substitutions, ...searched].filter(
        (candidate) => candidate.name.trim().toLowerCase() !== normalizedTargetName
      );
      const deduped: ExerciseCatalogItem[] = [];
      const seen = new Set<string>();
      merged.forEach((candidate) => {
        const key = candidate.name.trim().toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        deduped.push(candidate);
      });
      return deduped.slice(0, 24);
    }
    return searchMergedCatalog({
      query: replaceSearch,
      group: replaceGroup === "all" ? "all" : (replaceGroup as ExerciseGroupKey),
    });
  }, [replaceGroup, replaceSearch, replaceTarget, exercises, findCatalogExercise, getSubstitutionCandidates, searchMergedCatalog]);

  const loadPastWorkouts = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const workoutsRef = collection(db, "users", user.uid, "workouts");
      const snap = await getDocs(query(workoutsRef, orderBy("date", "desc"), limit(20)));
      const names: string[] = [];
      const workouts: PastWorkout[] = [];
      snap.forEach((docSnap) => {
        const data: any = docSnap.data();
        const rawDate =
          data?.date?.toDate?.() ||
          data?.endedAt?.toDate?.() ||
          data?.createdAt?.toDate?.() ||
          null;
        if (rawDate) {
          workouts.push({
            id: docSnap.id,
            title: data?.title || "Workout",
            date: rawDate,
            durationMin:
              typeof data?.durationMin === "number" && Number.isFinite(data.durationMin)
                ? data.durationMin
                : null,
            exercises: (data?.exercises || []).map((ex: any) => ({
              name: ex?.name || "Exercise",
              notes: typeof ex?.notes === "string" ? ex.notes : "",
              tempo: typeof ex?.tempo === "string" ? ex.tempo : "",
              zone: typeof ex?.zone === "string" ? ex.zone : "",
              mode: ex?.mode === "cardio" ? "cardio" : "resistance",
              cardioSessionType:
                ex?.cardioSessionType === "steady" ||
                ex?.cardioSessionType === "intervals" ||
                ex?.cardioSessionType === "sprint" ||
                ex?.cardioSessionType === "recovery"
                  ? ex.cardioSessionType
                  : undefined,
              cardioEffortLevel:
                ex?.cardioEffortLevel === "easy" ||
                ex?.cardioEffortLevel === "moderate" ||
                ex?.cardioEffortLevel === "hard" ||
                ex?.cardioEffortLevel === "max"
                  ? ex.cardioEffortLevel
                  : undefined,
              sets: (ex?.sets || []).map((set: any) => ({
                weightKg: typeof set?.weightKg === "number" ? set.weightKg : null,
                reps: String(set?.reps ?? ""),
                rpe:
                  typeof set?.rpe === "number" || typeof set?.rpe === "string"
                    ? String(set.rpe)
                    : "",
                distanceKm: typeof set?.distanceKm === "number" ? set.distanceKm : null,
                durationSec: typeof set?.durationSec === "number" ? set.durationSec : null,
                zone: typeof set?.zone === "string" ? set.zone : "",
                setType: toSetType(set?.setType),
              })),
            })),
          });
        }
        (data.exercises || []).forEach((ex: any) => {
          if (ex?.name && !names.includes(ex.name)) names.push(ex.name);
        });
      });
      setRecentExercises(names);
      setPastWorkouts(workouts);
    } catch (e) {
      if (!isExpectedOfflineError(e)) {
        console.log("Failed to load recent exercises", e);
      }
    }
  }, [auth]);

  const loadRoutines = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const routinesRef = collection(db, "users", user.uid, "routines");
      const snap = await getDocs(query(routinesRef, orderBy("updatedAt", "desc"), limit(50)));
      const next: Routine[] = [];
      snap.forEach((docSnap) => {
        const data: any = docSnap.data();
        next.push({
          id: docSnap.id,
          name: typeof data?.name === "string" && data.name.trim() ? data.name.trim() : "Routine",
          exercises: (data?.exercises || []).map((exercise: any) => ({
            name: typeof exercise?.name === "string" ? exercise.name : "Exercise",
            notes: typeof exercise?.notes === "string" ? exercise.notes : "",
            tempo: typeof exercise?.tempo === "string" ? exercise.tempo : "",
            zone: typeof exercise?.zone === "string" ? exercise.zone : "",
            mode: exercise?.mode === "cardio" ? "cardio" : "resistance",
            cardioSessionType:
              exercise?.cardioSessionType === "steady" ||
              exercise?.cardioSessionType === "intervals" ||
              exercise?.cardioSessionType === "sprint" ||
              exercise?.cardioSessionType === "recovery"
                ? exercise.cardioSessionType
                : undefined,
            cardioEffortLevel:
              exercise?.cardioEffortLevel === "easy" ||
              exercise?.cardioEffortLevel === "moderate" ||
              exercise?.cardioEffortLevel === "hard" ||
              exercise?.cardioEffortLevel === "max"
                ? exercise.cardioEffortLevel
                : undefined,
            sets: (exercise?.sets || []).map((set: any) => ({
              reps: String(set?.reps ?? ""),
              targetRpe:
                typeof set?.targetRpe === "number" || typeof set?.targetRpe === "string"
                  ? String(set.targetRpe)
                  : "",
              defaultWeightKg: typeof set?.defaultWeightKg === "number" ? set.defaultWeightKg : null,
              defaultDistanceKm: typeof set?.defaultDistanceKm === "number" ? set.defaultDistanceKm : null,
              defaultDurationSec: typeof set?.defaultDurationSec === "number" ? set.defaultDurationSec : null,
              defaultZone: typeof set?.defaultZone === "string" ? set.defaultZone : "",
              setType: toSetType(set?.setType),
            })),
          })),
          createdAt: data?.createdAt?.toDate?.() ?? null,
          updatedAt: data?.updatedAt?.toDate?.() ?? null,
        });
      });
      setRoutines(next);
    } catch (error) {
      if (!isExpectedOfflineError(error)) {
        console.log("Failed to load routines", error);
      }
    }
  }, [auth]);

  const loadLatestDecision = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) return;
      const data: any = snap.data();
      const last = data?.usage?.decisions?.lastResult;
      if (last?.result) {
        setLatestDecision({
          decision: last.result.decision,
          adjustments: last.result.adjustments,
        });
      }
    } catch (e) {
      if (!isExpectedOfflineError(e)) {
        console.log("Failed to load latest decision", e);
      }
    }
  }, [auth]);

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const raw = await AsyncStorage.getItem(getDraftKey(user.uid));
        if (!raw) {
          // No draft for this account: clear any in-memory state from previous account/session.
          setExercises([]);
          setExerciseUnits({});
          setRestPreferenceByExercise({});
          setRestCustomInputByExercise({});
          setRestTimerByExercise({});
          setSessionTitle("");
          setSessionDateText(toLocalDateKey(new Date()));
          setElapsedSeconds(0);
          setWorkoutTimerRunning(false);
          workoutStartedAtMsRef.current = null;
          return;
        }
        if (raw) {
          const parsed = JSON.parse(raw);
          const todayKey = toLocalDateKey(new Date());
          const savedAtDate =
            typeof parsed.draftSavedAt === "number" && Number.isFinite(parsed.draftSavedAt)
              ? new Date(parsed.draftSavedAt)
              : null;
          draftSavedAtRef.current = savedAtDate;
          if (parsed.exercises) {
            const hydratedExercises: Exercise[] = (parsed.exercises as any[]).map((exercise: any) => ({
              id: typeof exercise?.id === "string" ? exercise.id : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
              name: typeof exercise?.name === "string" ? exercise.name : "Exercise",
              notes: typeof exercise?.notes === "string" ? exercise.notes : "",
              tempo: typeof exercise?.tempo === "string" ? exercise.tempo : "",
              cardioSessionType:
                exercise?.cardioSessionType === "steady" ||
                exercise?.cardioSessionType === "intervals" ||
                exercise?.cardioSessionType === "sprint" ||
                exercise?.cardioSessionType === "recovery"
                  ? exercise.cardioSessionType
                  : undefined,
              cardioEffortLevel:
                exercise?.cardioEffortLevel === "easy" ||
                exercise?.cardioEffortLevel === "moderate" ||
                exercise?.cardioEffortLevel === "hard" ||
                exercise?.cardioEffortLevel === "max"
                  ? exercise.cardioEffortLevel
                  : undefined,
              sets: Array.isArray(exercise?.sets)
                ? exercise.sets.map((set: any) => ({
                    weightKg: typeof set?.weightKg === "number" ? set.weightKg : null,
                    weightText: typeof set?.weightText === "string" ? set.weightText : undefined,
                    reps: String(set?.reps ?? ""),
                    rpe:
                      typeof set?.rpe === "number" || typeof set?.rpe === "string"
                        ? String(set.rpe)
                        : "",
                    distanceKm: typeof set?.distanceKm === "number" ? set.distanceKm : null,
                    durationSec: typeof set?.durationSec === "number" ? set.durationSec : null,
                    zone: typeof set?.zone === "string" ? set.zone : "",
                    setType: toSetType(set?.setType),
                    done: Boolean(set?.done),
                    baselineWeightKg: typeof set?.baselineWeightKg === "number" ? set.baselineWeightKg : null,
                    baselineReps:
                      typeof set?.baselineReps === "string" ? set.baselineReps : String(set?.reps ?? ""),
                    baselineAdjusted: Boolean(set?.baselineAdjusted),
                  }))
                : [],
            }));
            setExercises(hydratedExercises);
            const initialRestPrefs: Record<string, number> = {};
            const initialRestTimers: Record<string, { remainingSec: number; running: boolean }> = {};
            hydratedExercises.forEach((exercise: Exercise) => {
              initialRestPrefs[exercise.id] = 90;
              initialRestTimers[exercise.id] = { remainingSec: 90, running: false };
            });
            setRestPreferenceByExercise(initialRestPrefs);
            setRestCustomInputByExercise({});
            setRestTimerByExercise(initialRestTimers);
          }
          if (parsed.exerciseUnits) setExerciseUnits(parsed.exerciseUnits);
          if (parsed.sessionTitle) setSessionTitle(parsed.sessionTitle);
          if (typeof parsed.sessionDateText === "string" && parseSessionDate(parsed.sessionDateText)) {
            const shouldRefreshDraftDate =
              !savedAtDate ||
              !isSameDateKey(toLocalDateKey(savedAtDate), todayKey);
            setSessionDateText(shouldRefreshDraftDate ? todayKey : parsed.sessionDateText);
          }
          setElapsedSeconds(
            typeof parsed.elapsedSeconds === "number" && Number.isFinite(parsed.elapsedSeconds)
              ? Math.max(0, Math.round(parsed.elapsedSeconds))
              : 0
          );
          setWorkoutTimerRunning(false);
          workoutStartedAtMsRef.current = null;
        }
      } catch (e) {
        console.log("Failed to load draft, clearing cache", e);
        try {
          const user = auth.currentUser;
          if (user) {
            await AsyncStorage.removeItem(getDraftKey(user.uid));
          }
        } catch {
          // no-op
        }
      }
    };
    startupLoadTaskRef.current?.cancel();
    startupLoadTaskRef.current = scheduleAfterInteractions(async () => {
      await loadDraft();
      await Promise.allSettled([loadPastWorkouts(), loadRoutines()]);
    });
    return () => {
      startupLoadTaskRef.current?.cancel();
    };
  }, [auth.currentUser, loadPastWorkouts, loadRoutines, auth, getDraftKey]);

  useEffect(() => {
    if (routerParams.trainingPhase) {
      setSessionPhase(String(routerParams.trainingPhase));
    }
  }, [routerParams.trainingPhase]);

  useEffect(() => {
    const shouldCreateRoutine = String(routerParams.createRoutine ?? "") === "1";
    if (!shouldCreateRoutine) {
      createRoutineParamHandledRef.current = false;
      return;
    }
    if (createRoutineParamHandledRef.current) return;
    createRoutineParamHandledRef.current = true;
    setRoutineBuilderMode(true);
    setShowRoutineStartModal(true);
    setRoutineFormError(null);
    setRoutineNameInput("");
    router.replace("/(tabs)/workout/log");
  }, [router, routerParams.createRoutine]);

  const loadFavoriteExercises = useCallback(async () => {
    if (!activeUid) {
      setFavoriteExercises([]);
      setFavoritesHydratedUid(null);
      return;
    }
    try {
      const scopedKey = `${FAVORITES_KEY_PREFIX}:${activeUid}`;
      let raw = await AsyncStorage.getItem(scopedKey);
      // Backward compatibility with pre-scoped favorites key.
      if (!raw) {
        raw = await AsyncStorage.getItem(FAVORITES_KEY);
      }
      if (!raw) {
        setFavoriteExercises([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setFavoriteExercises(parsed.filter((value) => typeof value === "string"));
      } else {
        setFavoriteExercises([]);
      }
    } catch (error) {
      console.log("Failed to load favorite exercises", error);
      setFavoriteExercises([]);
    } finally {
      setFavoritesHydratedUid(activeUid);
    }
  }, [activeUid]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        handleGoBack();
        return true;
      });
      focusHydrationTaskRef.current?.cancel();
      focusHydrationTaskRef.current = scheduleAfterInteractions(async () => {
        const pendingExerciseName = await popPendingExerciseSelection(activeUid);
        if (!active || !pendingExerciseName) return;
        addExercise(pendingExerciseName);
        setUiFeedback(`Added ${pendingExerciseName}.`);
      });
      const savedAt = draftSavedAtRef.current;
      const todayKey = toLocalDateKey(new Date());
      if (
        savedAt &&
        !isSameDateKey(toLocalDateKey(savedAt), todayKey) &&
        isSameDateKey(sessionDateText, toLocalDateKey(savedAt))
      ) {
        setSessionDateText(todayKey);
      }
      const shouldHydrateFocus = Date.now() - lastFocusHydrationAtRef.current >= 30_000;
      if (shouldHydrateFocus) {
        focusRefreshTaskRef.current?.cancel();
        focusRefreshTaskRef.current = scheduleAfterInteractions(async () => {
          lastFocusHydrationAtRef.current = Date.now();
          await Promise.allSettled([loadLatestDecision(), loadFavoriteExercises()]);
        });
      }
      return () => {
        active = false;
        focusHydrationTaskRef.current?.cancel();
        focusRefreshTaskRef.current?.cancel();
        subscription.remove();
      };
    }, [loadLatestDecision, loadFavoriteExercises, addExercise, activeUid, handleGoBack, sessionDateText])
  );

  // Persist draft
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const user = auth.currentUser;
      if (!user) return;
      AsyncStorage.setItem(
        getDraftKey(user.uid),
        JSON.stringify({
          exercises,
          exerciseUnits,
          sessionTitle,
          sessionDateText,
          elapsedSeconds,
          workoutTimerRunning,
          draftSavedAt: Date.now(),
        })
      )
        .then(() => {
          draftSavedAtRef.current = new Date();
        })
        .catch((e) => console.log("Failed to save draft", e));
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [exercises, exerciseUnits, sessionTitle, sessionDateText, elapsedSeconds, workoutTimerRunning, auth, getDraftKey]);

  // Elapsed timer
  useEffect(() => {
    if (!workoutTimerRunning) return;
    if (workoutStartedAtMsRef.current == null) {
      workoutStartedAtMsRef.current = Date.now() - elapsedSeconds * 1000;
    }
    const id = setInterval(() => {
      const startMs = workoutStartedAtMsRef.current ?? Date.now();
      const diff = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setElapsedSeconds(diff);
    }, 1000);
    return () => clearInterval(id);
  }, [workoutTimerRunning, elapsedSeconds]);

  useEffect(() => {
    if (!uiFeedback) return;
    const timer = setTimeout(() => setUiFeedback(null), 2800);
    return () => clearTimeout(timer);
  }, [uiFeedback]);

  useEffect(() => {
    favoriteHydrationTaskRef.current?.cancel();
    favoriteHydrationTaskRef.current = scheduleAfterInteractions(async () => {
      await loadFavoriteExercises();
    });
    return () => {
      favoriteHydrationTaskRef.current?.cancel();
    };
  }, [loadFavoriteExercises]);

  useEffect(() => {
    let cancelled = false;
    const loadCatalog = async () => {
      const remote = await loadFreeExerciseDbCatalog();
      if (cancelled || !remote.length) return;
      setFreeDbCatalog(remote);
    };
    const task = scheduleAfterInteractions(loadCatalog);
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, []);

  useEffect(() => {
    if (!activeUid || favoritesHydratedUid !== activeUid) return;
    const scopedKey = `${FAVORITES_KEY_PREFIX}:${activeUid}`;
    AsyncStorage.setItem(scopedKey, JSON.stringify(favoriteExercises)).catch((error) =>
      console.log("Failed to save favorite exercises", error)
    );
  }, [favoriteExercises, activeUid, favoritesHydratedUid]);

  useEffect(() => {
    if (!activeUid) {
      setRestPreferenceByName({});
      setRestPrefsHydratedUid(null);
      return;
    }
    const loadRestPreferences = async () => {
      try {
        const scopedKey = `${REST_PREFS_KEY_PREFIX}:${activeUid}`;
        let raw = await AsyncStorage.getItem(scopedKey);
        // Backward compatibility with pre-scoped rest prefs key.
        if (!raw) {
          raw = await AsyncStorage.getItem(REST_PREFS_KEY);
        }
        if (!raw) {
          setRestPreferenceByName({});
          return;
        }
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          const next: Record<string, number> = {};
          Object.entries(parsed).forEach(([key, value]) => {
            const parsedValue = Number(value);
            if (Number.isFinite(parsedValue) && parsedValue > 0) {
              next[key] = parsedValue;
            }
          });
          setRestPreferenceByName(next);
        } else {
          setRestPreferenceByName({});
        }
      } catch (error) {
        console.log("Failed to load rest preferences", error);
        setRestPreferenceByName({});
      } finally {
        setRestPrefsHydratedUid(activeUid);
      }
    };
    void loadRestPreferences();
  }, [activeUid]);

  useEffect(() => {
    if (!activeUid || restPrefsHydratedUid !== activeUid) return;
    const scopedKey = `${REST_PREFS_KEY_PREFIX}:${activeUid}`;
    AsyncStorage.setItem(scopedKey, JSON.stringify(restPreferenceByName)).catch((error) =>
      console.log("Failed to save rest preferences", error)
    );
  }, [restPreferenceByName, activeUid, restPrefsHydratedUid]);

  useEffect(() => {
    if (!exercises.length) return;
    setRestPreferenceByExercise((prev) => {
      const next: Record<string, number> = {};
      exercises.forEach((exercise) => {
        const key = exercise.name.trim().toLowerCase();
        next[exercise.id] = restPreferenceByName[key] ?? 90;
      });
      return next;
    });
    setRestTimerByExercise((prev) => {
      const next = { ...prev };
      exercises.forEach((exercise) => {
        const key = exercise.name.trim().toLowerCase();
        const restSeconds = restPreferenceByName[key] ?? 90;
        const current = next[exercise.id];
        if (!current) {
          next[exercise.id] = { remainingSec: restSeconds, running: false };
          return;
        }
        // Keep active countdowns, but align idle timers to the saved preference.
        if (!current.running && current.remainingSec !== restSeconds) {
          next[exercise.id] = { remainingSec: restSeconds, running: false };
        }
      });
      return next;
    });
  }, [exercises, restPreferenceByName]);

  useEffect(() => {
    const hasRunningTimer = Object.values(restTimerByExercise).some((entry) => entry.running);
    if (!hasRunningTimer) return;
    const interval = setInterval(() => {
      setRestTimerByExercise((prev) => {
        let mutated = false;
        const next: typeof prev = {};
        Object.entries(prev).forEach(([exerciseId, timer]) => {
          if (!timer.running) {
            next[exerciseId] = timer;
            return;
          }
          const remaining = Math.max(0, timer.remainingSec - 1);
          if (remaining !== timer.remainingSec) mutated = true;
          next[exerciseId] = { remainingSec: remaining, running: remaining > 0 };
        });
        return mutated ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [restTimerByExercise]);

  useEffect(() => {
    const previous = restTimerSnapshotRef.current;
    Object.entries(restTimerByExercise).forEach(([exerciseId, timer]) => {
      const prior = previous[exerciseId];
      const completedNow =
        prior != null &&
        prior.running &&
        prior.remainingSec > 0 &&
        !timer.running &&
        timer.remainingSec === 0;
      if (completedNow) {
        void playGong();
      }
    });
    restTimerSnapshotRef.current = restTimerByExercise;
  }, [restTimerByExercise, playGong]);

  useEffect(() => {
    return () => {
      if (gongPlayerRef.current) {
        gongPlayerRef.current.release();
        gongPlayerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!undoDeletedSet) return;
    const timeout = setTimeout(() => setUndoDeletedSet(null), 5000);
    return () => clearTimeout(timeout);
  }, [undoDeletedSet]);

  useEffect(() => {
    const names = Array.from(
      new Set(
        exercises
          .map((exercise) => exercise.name.trim())
          .filter((name) => Boolean(name) && Boolean(findCatalogExercise(name)))
      )
    );
    if (!names.length) return;
    let cancelled = false;
    const loadImages = async () => {
      const resolved = await resolveFreeExerciseDbImagesForNames(names);
      if (cancelled) return;
      setExerciseImageMap((prev) => ({ ...prev, ...resolved }));
    };
    void loadImages();
    return () => {
      cancelled = true;
    };
  }, [exercises, findCatalogExercise]);

  useEffect(() => {
    if (!activeRestTimerExerciseId) return;
    const exists = exercises.some((exercise) => exercise.id === activeRestTimerExerciseId);
    if (!exists) {
      setShowRestTimerModal(false);
      setActiveRestTimerExerciseId(null);
    }
  }, [activeRestTimerExerciseId, exercises]);

  useEffect(() => {
    if (!activeExerciseActionId) return;
    const exists = exercises.some((exercise) => exercise.id === activeExerciseActionId);
    if (!exists) {
      setShowExerciseActionsModal(false);
      setActiveExerciseActionId(null);
    }
  }, [activeExerciseActionId, exercises]);

  const addEmptySet = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: [
                ...ex.sets,
                {
                  weightKg: null,
                  reps: "",
                  rpe: "",
                  distanceKm: null,
                  durationSec: null,
                  zone: "",
                  setType: "normal",
                  done: false,
                },
              ],
            }
          : ex
      )
    );
  };

  const setSetDone = (exerciseId: string, setIndex: number, nextDone: boolean) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((s, idx) => (idx === setIndex ? { ...s, done: nextDone } : s)),
            }
          : ex
      )
    );
  };

  const toggleSetDone = (exerciseId: string, setIndex: number) => {
    const toggleKey = `${exerciseId}:${setIndex}`;
    const now = Date.now();
    const lastToggleAt = lastSetToggleAtRef.current[toggleKey] ?? 0;
    if (now - lastToggleAt < 120) return;
    lastSetToggleAtRef.current[toggleKey] = now;

    const exercise = exercises.find((ex) => ex.id === exerciseId);
    const targetSet = exercise?.sets?.[setIndex];
    if (!targetSet) return;
    const nextDone = !targetSet.done;
    setSetDone(exerciseId, setIndex, nextDone);
    if (nextDone) {
      lastCompletedSetByExerciseRef.current[exerciseId] = setIndex;
      startRestTimer(exerciseId);
      return;
    }
    resetRestTimer(exerciseId);
    delete lastCompletedSetByExerciseRef.current[exerciseId];
  };


  const updateSetWeight = (exerciseId: string, setIndex: number, unit: Unit, value: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
            ...ex,
            sets: ex.sets.map((s, idx) =>
              idx === setIndex
                ? getExerciseMode(ex.name) === "cardio"
                  ? { ...s, distanceKm: parseDistanceKm(value, unit) }
                  : {
                      ...s,
                      weightKg:
                        value.trim() === "" || Number.isNaN(parseFloat(value))
                          ? null
                          : unit === "kg"
                            ? parseFloat(value)
                            : convertWeight(parseFloat(value), "lbs", "kg"),
                      weightText: value,
                    }
                : s
            ),
          }
          : ex
      )
    );
  };

  const updateSetReps = (exerciseId: string, setIndex: number, value: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
            ...ex,
            sets: ex.sets.map((s, idx) =>
              idx === setIndex
                ? getExerciseMode(ex.name) === "cardio"
                  ? { ...s, durationSec: parseDurationSecFromInput(value) }
                  : { ...s, reps: value }
                : s
            ),
          }
          : ex
      )
    );
  };

  const updateSetRpe = (exerciseId: string, setIndex: number, value: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((s, idx) =>
                idx === setIndex
                  ? getExerciseMode(ex.name) === "cardio"
                    ? { ...s, zone: value }
                    : { ...s, rpe: value }
                  : s
              ),
            }
          : ex
      )
    );
  };
  const updateSetType = (exerciseId: string, setIndex: number, setType: SetType) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((s, idx) => (idx === setIndex ? { ...s, setType } : s)),
            }
          : ex
      )
    );
  };

  const updateExerciseNotes = (exerciseId: string, notes: string) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, notes } : ex))
    );
  };

  const updateExerciseTempo = (exerciseId: string, tempo: string) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, tempo } : ex))
    );
  };
  const updateCardioSessionType = (
    exerciseId: string,
    value: "steady" | "intervals" | "sprint" | "recovery"
  ) => {
    setExercises((prev) => prev.map((ex) => (ex.id === exerciseId ? { ...ex, cardioSessionType: value } : ex)));
  };
  const updateCardioEffortLevel = (
    exerciseId: string,
    value: "easy" | "moderate" | "hard" | "max"
  ) => {
    setExercises((prev) => prev.map((ex) => (ex.id === exerciseId ? { ...ex, cardioEffortLevel: value } : ex)));
  };
  const openCardioTimeModal = (exerciseId: string, setIndex: number, currentSec: number | null | undefined) => {
    const sec = Math.max(0, currentSec ?? 0);
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    setCardioTimeHoursText(String(hours).padStart(2, "0"));
    setCardioTimeMinutesText(String(minutes).padStart(2, "0"));
    setCardioTimeTarget({ exerciseId, setIndex });
    setShowCardioTimeModal(true);
  };
  const resetCardioTimeModal = () => {
    setCardioTimeHoursText("00");
    setCardioTimeMinutesText("00");
  };
  const applyCardioTimeModal = () => {
    if (!cardioTimeTarget) return;
    const h = Number(cardioTimeHoursText.trim());
    const m = Number(cardioTimeMinutesText.trim());
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0 || m > 59) {
      showAppAlert("Invalid time", "Use non-negative hours and minutes (minutes 0-59).");
      return;
    }
    const nextSec = Math.round(h) * 3600 + Math.round(m) * 60;
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === cardioTimeTarget.exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((s, idx) => (idx === cardioTimeTarget.setIndex ? { ...s, durationSec: nextSec } : s)),
            }
          : ex
      )
    );
    setShowCardioTimeModal(false);
    setCardioTimeTarget(null);
  };
  const openCardioDistanceModal = (exerciseId: string, setIndex: number, currentKm: number | null, unit: Unit) => {
    const display = currentKm == null ? 0 : unit === "mi" ? currentKm / 1.60934 : currentKm;
    const normalized = Math.max(0, Math.round(display * 100) / 100);
    const whole = Math.floor(normalized);
    const decimal = Math.round((normalized - whole) * 100);
    setCardioDistanceWholeText(String(whole));
    setCardioDistanceDecimalText(String(decimal).padStart(2, "0"));
    setCardioDistanceTarget({ exerciseId, setIndex });
    setShowCardioDistanceModal(true);
  };
  const resetCardioDistanceModal = () => {
    setCardioDistanceWholeText("0");
    setCardioDistanceDecimalText("00");
  };
  const applyCardioDistanceModal = (unit: Unit) => {
    if (!cardioDistanceTarget) return;
    const whole = Number(cardioDistanceWholeText.trim());
    const decimalRaw = cardioDistanceDecimalText.trim();
    const decimal = Number(decimalRaw);
    if (!Number.isFinite(whole) || !Number.isFinite(decimal) || whole < 0 || decimal < 0 || decimal > 99) {
      showAppAlert("Invalid distance", "Use valid whole and decimal values (decimal 00-99).");
      return;
    }
    const decimalPart = decimalRaw.length <= 1 ? decimal / 10 : decimal / 100;
    const combined = whole + decimalPart;
    const km = unit === "mi" ? combined * 1.60934 : combined;
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === cardioDistanceTarget.exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((s, idx) => (idx === cardioDistanceTarget.setIndex ? { ...s, distanceKm: km } : s)),
            }
          : ex
      )
    );
    setShowCardioDistanceModal(false);
    setCardioDistanceTarget(null);
  };

  const toggleFavoriteExercise = useCallback((exerciseName: string) => {
    const needle = exerciseName.trim().toLowerCase();
    if (!needle) return;
    setFavoriteExercises((prev) => {
      const exists = prev.some((entry) => entry.toLowerCase() === needle);
      if (exists) return prev.filter((entry) => entry.toLowerCase() !== needle);
      return [...prev, exerciseName.trim()];
    });
  }, []);

  const openExerciseDemo = async (exerciseName: string) => {
    const catalogExercise = findCatalogExercise(exerciseName);
    if (!catalogExercise) {
      showAppAlert("No demo available", "This custom exercise does not have a demo yet.");
      return;
    }
    const key = imageLookupKey(exerciseName);
    const resolved = await resolveFreeExerciseDbImagesForNames([exerciseName]);
    const next = resolved[key] ?? [];
    if (next.length) {
      setExerciseImageMap((prev) => ({ ...prev, ...resolved }));
    }
    const remoteImages = next.length ? next : exerciseImageMap[key] ?? [];
    if (!catalogExercise && !remoteImages.length) {
      setUiFeedback("No demo available for this exercise yet.");
      return;
    }
    setActiveDemoImageUris(remoteImages.slice(0, 2));
    setActiveDemoExercise(catalogExercise);
    setShowExerciseDemo(true);
  };

  const closeExerciseDemo = () => {
    setShowExerciseDemo(false);
    setActiveDemoExercise(null);
    setActiveDemoImageUris([]);
  };

  const openExerciseActions = (exerciseId: string) => {
    setActiveExerciseActionId(exerciseId);
    setShowExerciseActionsModal(true);
  };

  const closeExerciseActions = () => {
    setShowExerciseActionsModal(false);
    setActiveExerciseActionId(null);
  };

  const openRestTimerModal = (exerciseId: string) => {
    setActiveRestTimerExerciseId(exerciseId);
    setShowRestTimerModal(true);
  };

  const closeRestTimerModal = () => {
    setShowRestTimerModal(false);
    setActiveRestTimerExerciseId(null);
  };

  const removeSetWithUndo = (exerciseId: string, setIndex: number) => {
    setExercises((prev) => {
      const exercise = prev.find((item) => item.id === exerciseId);
      if (!exercise || !exercise.sets[setIndex]) return prev;
      const set = exercise.sets[setIndex];
      setUndoDeletedSet({ exerciseId, setIndex, set });
      return prev.map((item) =>
        item.id === exerciseId
          ? { ...item, sets: item.sets.filter((_, index) => index !== setIndex) }
          : item
      );
    });
  };

  const undoRemoveSet = () => {
    if (!undoDeletedSet) return;
    setExercises((prev) =>
      prev.map((exercise) => {
        if (exercise.id !== undoDeletedSet.exerciseId) return exercise;
        const nextSets = [...exercise.sets];
        const targetIndex = Math.min(undoDeletedSet.setIndex, nextSets.length);
        nextSets.splice(targetIndex, 0, undoDeletedSet.set);
        return { ...exercise, sets: nextSets };
      })
    );
    setUndoDeletedSet(null);
    setUiFeedback("Set restored.");
  };

  const setRestPreference = (exerciseId: string, seconds: number) => {
    setRestPreferenceByExercise((prev) => ({ ...prev, [exerciseId]: seconds }));
    const exerciseName = exercises.find((exercise) => exercise.id === exerciseId)?.name;
    if (exerciseName) {
      setRestPreferenceByName((prev) => ({
        ...prev,
        [exerciseName.trim().toLowerCase()]: seconds,
      }));
    }
    setRestTimerByExercise((prev) => {
      const current = prev[exerciseId];
      if (current?.running) return prev;
      return { ...prev, [exerciseId]: { remainingSec: seconds, running: false } };
    });
  };

  const applyCustomRestPreference = (exerciseId: string) => {
    const raw = (restCustomInputByExercise[exerciseId] ?? "").trim();
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setUiFeedback("Enter a valid custom rest time in seconds.");
      return;
    }
    const capped = Math.min(900, Math.max(15, Math.round(parsed)));
    setRestPreference(exerciseId, capped);
    setRestCustomInputByExercise((prev) => ({ ...prev, [exerciseId]: `${capped}` }));
  };

  const startRestTimer = (exerciseId: string) => {
    const fallback = restPreferenceByExercise[exerciseId] ?? 90;
    setRestTimerByExercise((prev) => {
      const current = prev[exerciseId];
      const initial = current && current.remainingSec > 0 ? current.remainingSec : fallback;
      return { ...prev, [exerciseId]: { remainingSec: initial, running: true } };
    });
  };

  const pauseRestTimer = (exerciseId: string) => {
    setRestTimerByExercise((prev) => {
      const current = prev[exerciseId];
      if (!current) return prev;
      return { ...prev, [exerciseId]: { ...current, running: false } };
    });
  };

  const resetRestTimer = (exerciseId: string) => {
    const target = restPreferenceByExercise[exerciseId] ?? 90;
    setRestTimerByExercise((prev) => ({
      ...prev,
      [exerciseId]: { remainingSec: target, running: false },
    }));
  };

  const openSetMenu = (exerciseId: string, setIndex: number) => {
    setActiveSetMenu({ exerciseId, setIndex });
  };

  const closeSetMenu = () => {
    setActiveSetMenu(null);
  };

  const openTempoEditor = (exerciseId: string, currentTempo?: string) => {
    setActiveTempoExerciseId(exerciseId);
    setTempoDraftIndices(parseTempoToIndices(currentTempo));
    setShowTempoEditorModal(true);
  };

  const closeTempoEditor = () => {
    setShowTempoEditorModal(false);
    setActiveTempoExerciseId(null);
  };

  const setTempoDraftIndex = (segmentIndex: number, tokenIndex: number) => {
    setTempoDraftIndices((prev) =>
      prev.map((value, idx) => (idx === segmentIndex ? tokenIndex : value))
    );
  };

  const saveTempoDraft = () => {
    if (!activeTempoExerciseId) return;
    updateExerciseTempo(activeTempoExerciseId, formatTempoFromIndices(tempoDraftIndices));
    closeTempoEditor();
  };
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const openDatePicker = () => {
    const parsed = parseSessionDate(sessionDateText) ?? new Date();
    setDatePickerMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    setShowDatePickerModal(true);
  };
  const openDurationAdjustModal = () => {
    if (workoutTimerRunning) {
      setWorkoutTimerRunning(false);
      workoutStartedAtMsRef.current = null;
    }
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    setDurationAdjustHoursText(String(hours).padStart(2, "0"));
    setDurationAdjustMinutesText(String(minutes).padStart(2, "0"));
    setShowDurationModal(true);
  };
  const startWorkoutTimer = () => {
    if (workoutTimerRunning) return;
    workoutStartedAtMsRef.current = Date.now() - elapsedSeconds * 1000;
    setWorkoutTimerRunning(true);
  };
  const applyDurationAdjustment = () => {
    const parsedHours = Number(durationAdjustHoursText.trim());
    const parsedMinutes = Number(durationAdjustMinutesText.trim());
    if (
      !Number.isFinite(parsedHours) ||
      !Number.isFinite(parsedMinutes) ||
      parsedHours < 0 ||
      parsedMinutes < 0 ||
      parsedMinutes > 59
    ) {
      showAppAlert("Invalid duration", "Use non-negative hours and minutes (minutes 0-59).");
      return;
    }
    const nextSeconds = Math.max(0, Math.round(parsedHours) * 3600 + Math.round(parsedMinutes) * 60);
    setElapsedSeconds(nextSeconds);
    setWorkoutTimerRunning(false);
    workoutStartedAtMsRef.current = null;
    setShowDurationModal(false);
  };
  const resetDurationTimer = () => {
    setElapsedSeconds(0);
    setWorkoutTimerRunning(false);
    workoutStartedAtMsRef.current = null;
    setDurationAdjustHoursText("00");
    setDurationAdjustMinutesText("00");
  };

  const applySetAdjustment = (exerciseId: string, setIndex: number, unit: Unit, percent: number) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((s, idx) => {
                if (idx !== setIndex) return s;
                if (getExerciseMode(ex.name) === "cardio") return s;
                if (s.weightKg === null || s.weightKg <= 0) return s;
                const baseline = s.baselineWeightKg ?? s.weightKg;
                const adjustedFlag = percent === 0 ? s.baselineAdjusted ?? false : true;
                if (percent === 0) {
                  return {
                    ...s,
                    baselineWeightKg: baseline,
                    baselineAdjusted: adjustedFlag,
                    weightKg: baseline,
                  };
                }
                const adjusted = baseline * (1 + percent / 100);
                return {
                  ...s,
                  baselineWeightKg: baseline,
                  baselineAdjusted: adjustedFlag,
                  weightKg: roundWeightKg(adjusted, unit),
                };
              }),
            }
          : ex
      )
    );
    closeSetMenu();
  };


  const replaceExercise = (exerciseId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const target = exercises.find((ex) => ex.id === exerciseId);
    const doReplace = () => {
      setExercises((prev) =>
        prev.map((ex) => (ex.id === exerciseId ? buildExerciseDraft(trimmed, ex.id) : ex))
      );
      const mode = getExerciseModeByName(trimmed);
      const restSeconds = getSavedRestPreference(trimmed);
      setExerciseUnits((prev) => ({ ...prev, [exerciseId]: mode === "cardio" ? "km" : "kg" }));
      setRestPreferenceByExercise((prev) => ({ ...prev, [exerciseId]: restSeconds }));
      setRestCustomInputByExercise((prev) => ({ ...prev, [exerciseId]: "" }));
      setRestTimerByExercise((prev) => ({ ...prev, [exerciseId]: { remainingSec: restSeconds, running: false } }));
      setUiFeedback(`Replaced with ${trimmed}. Loaded its recent-set baseline when available.`);
      setReplaceTarget(null);
      setReplaceSearch("");
      setReplaceGroup("all");
    };
    if (target && target.sets.length > 0) {
      showAppDialog({
        title: "Replace exercise?",
        message: "This will reset the current sets and preload the new exercise from its recent history when available.",
        buttons: [
          { text: "Cancel", role: "cancel" },
          { text: "Replace", role: "destructive", onPress: doReplace },
        ],
      });
    } else {
      doReplace();
    }
  };

  const deleteExercise = (exerciseId: string) => {
    const target = exercises.find((ex) => ex.id === exerciseId);
    const doDelete = () => {
      setExercises((prev) => prev.filter((ex) => ex.id !== exerciseId));
      setExerciseUnits((prev) => {
        const copy = { ...prev };
        delete copy[exerciseId];
        return copy;
      });
      setRestPreferenceByExercise((prev) => {
        const copy = { ...prev };
        delete copy[exerciseId];
        return copy;
      });
      setRestCustomInputByExercise((prev) => {
        const copy = { ...prev };
        delete copy[exerciseId];
        return copy;
      });
      setRestTimerByExercise((prev) => {
        const copy = { ...prev };
        delete copy[exerciseId];
        return copy;
      });
      if (replaceTarget === exerciseId) {
        setReplaceTarget(null);
        setReplaceSearch("");
        setReplaceGroup("all");
      }
    };

    if (target && target.sets.length > 0) {
      showAppDialog({
        title: "Delete exercise?",
        message: "This will remove the exercise and all its sets.",
        buttons: [
          { text: "Cancel", role: "cancel" },
          { text: "Delete", role: "destructive", onPress: doDelete },
        ],
      });
    } else {
      doDelete();
    }
  };

  const applyPastWorkout = (workout: PastWorkout) => {
      const nextExercises: Exercise[] = workout.exercises.map((ex) => ({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: ex.name,
        notes: ex.notes ?? "",
        tempo: (ex.mode === "cardio" ? ex.zone : ex.tempo) ?? "",
        cardioSessionType: ex.cardioSessionType,
        cardioEffortLevel: ex.cardioEffortLevel,
        sets: ex.sets.map((s) => ({
          weightKg: s.weightKg ?? null,
          reps: s.reps,
          rpe: s.rpe ?? "",
          distanceKm: s.distanceKm ?? null,
          durationSec: s.durationSec ?? null,
          zone: s.zone ?? "",
          setType: toSetType(s.setType),
          done: false,
          baselineWeightKg: s.weightKg ?? null,
          baselineReps: s.reps,
        })),
      }));
    setExercises(nextExercises);
    setSessionTitle(workout.title || "Workout");
    setSessionDateText(toLocalDateKey(workout.date));
    setElapsedSeconds(
      typeof workout.durationMin === "number" && Number.isFinite(workout.durationMin)
        ? Math.max(0, Math.round(workout.durationMin * 60))
        : 0
    );
    setWorkoutTimerRunning(false);
    workoutStartedAtMsRef.current = null;
    setBaselineDate(workout.date);
    setExerciseUnits(() => {
      const next: Record<string, Unit> = {};
      nextExercises.forEach((ex) => {
        next[ex.id] = getExerciseMode(ex.name) === "cardio" ? "km" : "kg";
      });
      return next;
    });
    setRestPreferenceByExercise(() => {
      const next: Record<string, number> = {};
      nextExercises.forEach((ex) => {
        next[ex.id] = getSavedRestPreference(ex.name);
      });
      return next;
    });
    setRestCustomInputByExercise({});
    setRestTimerByExercise(() => {
      const next: Record<string, { remainingSec: number; running: boolean }> = {};
      nextExercises.forEach((ex) => {
        const restSeconds = getSavedRestPreference(ex.name);
        next[ex.id] = { remainingSec: restSeconds, running: false };
      });
      return next;
    });
    setShowRepeatPicker(false);
  };

  const finishWorkout = () => {
    if (!exercises.length) return;
    setFollowedAnswer(null);
    setHelpfulAnswer(null);
    setShowFinishTitleInput(!sessionTitle.trim());
    setShowFinishModal(true);
  };

  const discardWorkout = () => {
    if (!exercises.length && !sessionTitle.trim()) return;
    setShowDiscardConfirmModal(true);
  };

  const confirmDiscardWorkout = () => {
    setExercises([]);
    setExerciseUnits({});
    setRestPreferenceByExercise({});
    setRestCustomInputByExercise({});
    setRestTimerByExercise({});
    setSessionTitle("");
    setSessionDateText(toLocalDateKey(new Date()));
    setElapsedSeconds(0);
    setWorkoutTimerRunning(false);
    workoutStartedAtMsRef.current = null;
    setBaselineDate(null);
    setFollowedAnswer(null);
    setHelpfulAnswer(null);
    setShowFinishTitleInput(false);
    setShowFinishModal(false);
    setShowDiscardConfirmModal(false);
    setRecommendationSummary([]);
    setLastAppliedRoutineId(null);
    const user = auth.currentUser;
    if (user) {
      AsyncStorage.removeItem(getDraftKey(user.uid)).catch(() => {});
    }
  };

  const saveWorkout = async () => {
    if (saving) return;
    if (!followedAnswer || !helpfulAnswer) {
      showAppAlert("Quick questions", "Please answer both questions before saving.");
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      showAppAlert("Not signed in", "Please sign in again to save your workout.");
      return;
    }
    try {
      setSaving(true);
      const parsedSessionDate = parseSessionDate(sessionDateText);
      if (!parsedSessionDate) {
        showAppAlert("Invalid date", "Use YYYY-MM-DD format.");
        setSaving(false);
        return;
      }
      const sanitizedExercises = exercises
        .map((ex) => {
        const mode = getExerciseMode(ex.name);
        const cleanedSets = ex.sets.filter((s) => {
          if (mode === "cardio") {
            const hasDistance = typeof s.distanceKm === "number" && s.distanceKm >= 0;
            const hasDuration = typeof s.durationSec === "number" && s.durationSec >= 0;
            const hasZone = String(s.zone || "").trim().length > 0;
            return hasDistance || hasDuration || hasZone;
          }
          return Boolean(String(s.reps || "").trim());
        });
          return cleanedSets.length
            ? {
                ...ex,
                mode,
                notes: String(ex.notes || "").trim(),
                tempo: mode === "cardio" ? "" : String(ex.tempo || "").trim(),
                zone: mode === "cardio" ? String(getExerciseZone(ex) || "").trim() : "",
                cardioSessionType: ex.cardioSessionType,
                cardioEffortLevel: ex.cardioEffortLevel,
                sets: cleanedSets.map((set) => ({
                  ...set,
                  rpe: mode === "cardio" ? "" : String(set.rpe || "").trim(),
                  zone: String(set.zone || "").trim(),
                  setType: toSetType(set.setType),
                })),
              }
            : null;
        })
        .filter(Boolean) as (Exercise & { mode: ExerciseMode; zone?: string })[];

      const invalidTempoExercise = sanitizedExercises.find(
        (exercise) => exercise.mode !== "cardio" && !isValidTempo(exercise.tempo || "")
      );
      if (invalidTempoExercise) {
        showAppAlert("Invalid tempo", `${invalidTempoExercise.name}: ${TEMPO_FORMAT_HINT}`);
        setSaving(false);
        return;
      }

      const invalidRpe = sanitizedExercises.find((exercise) =>
        exercise.mode !== "cardio" &&
        exercise.sets.some((set) => {
          const raw = String(set.rpe || "").trim();
          if (!raw) return false;
          const parsed = Number(raw);
          return !Number.isFinite(parsed) || parsed < 1 || parsed > 10;
        })
      );
      if (invalidRpe) {
        showAppAlert("Invalid RPE", "RPE must be a number between 1 and 10.");
        setSaving(false);
        return;
      }

      const totalCleanSets = sanitizedExercises.reduce((sum, ex) => sum + ex.sets.length, 0);
      if (totalCleanSets === 0) {
        showAppAlert("Nothing to save", "Add reps to at least one set before saving.");
        setSaving(false);
        return;
      }

      const payload = {
        title: sessionTitle || "Workout",
        date: Timestamp.fromDate(parsedSessionDate),
        durationMin: elapsedMinutes,
        trainingPhase: sessionPhase,
        exercises: sanitizedExercises.map((ex) => ({
          name: ex.name,
          mode: ex.mode,
          notes: String(ex.notes || "").trim(),
          tempo: ex.mode === "cardio" ? "" : String(ex.tempo || "").trim(),
          zone: ex.mode === "cardio" ? String(ex.zone || "").trim() : "",
          cardioSessionType: ex.mode === "cardio" ? ex.cardioSessionType ?? null : null,
          cardioEffortLevel: ex.mode === "cardio" ? ex.cardioEffortLevel ?? null : null,
          sets: ex.sets.map((s) => ({
            weightKg: ex.mode === "cardio" ? null : s.weightKg,
            reps: ex.mode === "cardio" ? "" : s.reps,
            distanceKm: ex.mode === "cardio" ? s.distanceKm ?? null : null,
            durationSec: ex.mode === "cardio" ? s.durationSec ?? null : null,
            zone: ex.mode === "cardio" ? String(s.zone || "").trim() : null,
            setType: toSetType(s.setType),
            rpe:
              ex.mode === "cardio" || String(s.rpe || "").trim() === ""
                ? null
                : Number.isFinite(Number(s.rpe))
                ? Number(String(s.rpe).trim())
                : null,
          })),
        })),
        followedRecommendation: followedAnswer || "unknown",
        helpful: helpfulAnswer || "unknown",
        createdAt: Timestamp.now(),
      };
      await addDoc(collection(db, "users", user.uid, "workouts"), payload);
      if (__DEV__) {
        showAppAlert("Workout saved", "Nice work.");
      }
        setExercises([]);
        setExerciseUnits({});
        setRestPreferenceByExercise({});
        setRestCustomInputByExercise({});
        setRestTimerByExercise({});
      setSessionTitle("");
      setSessionDateText(toLocalDateKey(new Date()));
      setElapsedSeconds(0);
      setWorkoutTimerRunning(false);
      workoutStartedAtMsRef.current = null;
      setRecommendationSummary([]);
      setLastAppliedRoutineId(null);
      setBaselineDate(null);
      AsyncStorage.removeItem(getDraftKey(user.uid)).catch(() => { });
      setShowFinishModal(false);
      setShowFinishTitleInput(false);
      await loadPastWorkouts();
      if (!__DEV__) {
        showAppAlert("Workout saved", "Nice work.");
      }
      router.replace("/(tabs)/home");
    } catch (e) {
      console.log("Error saving workout", e);
      showAppAlert("Save failed", "We couldn't save your workout. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleExerciseUnit = (exerciseId: string, next: Unit) => {
    setExerciseUnits((prev) => {
      const current = prev[exerciseId] || "kg";
      if (current === next) return prev;
      return { ...prev, [exerciseId]: next };
    });
    setExercises((prev) =>
      prev.map((exercise) =>
        exercise.id === exerciseId
          ? { ...exercise, sets: exercise.sets.map((set) => ({ ...set, weightText: undefined })) }
          : exercise
      )
    );
  };

  const duplicateLastSet = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        if (!ex.sets.length) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [...ex.sets, { ...last, done: false, setType: "normal" }],
        };
      })
    );
  };

  const buildRoutineExercisesFromEditor = () =>
    exercises.map((exercise) => ({
      name: exercise.name,
      notes: String(exercise.notes || "").trim(),
      tempo: getExerciseMode(exercise.name) === "cardio" ? "" : String(exercise.tempo || "").trim(),
      zone: getExerciseMode(exercise.name) === "cardio" ? String(getExerciseZone(exercise) || "").trim() : "",
      mode: getExerciseMode(exercise.name),
      cardioSessionType:
        getExerciseMode(exercise.name) === "cardio" ? exercise.cardioSessionType ?? null : null,
      cardioEffortLevel:
        getExerciseMode(exercise.name) === "cardio" ? exercise.cardioEffortLevel ?? null : null,
      sets: exercise.sets.map((set) => ({
        reps: String(set.reps || "").trim(),
        targetRpe:
          getExerciseMode(exercise.name) === "cardio" ? String(set.zone || "").trim() : String(set.rpe || "").trim(),
        defaultWeightKg: typeof set.weightKg === "number" ? set.weightKg : null,
        defaultDistanceKm: typeof set.distanceKm === "number" ? set.distanceKm : null,
        defaultDurationSec: typeof set.durationSec === "number" ? set.durationSec : null,
        defaultZone: String(set.zone || "").trim(),
        setType: toSetType(set.setType),
      })),
    }));

  const startRoutineBuilderEmpty = () => {
    setExercises([]);
    setExerciseUnits({});
    setRestPreferenceByExercise({});
    setRestCustomInputByExercise({});
    setRestTimerByExercise({});
    setSessionTitle("");
    setSessionDateText(toLocalDateKey(new Date()));
    setElapsedSeconds(0);
    setWorkoutTimerRunning(false);
    workoutStartedAtMsRef.current = null;
    setRoutineBuilderMode(true);
    setShowRoutineStartModal(false);
  };

  const startRoutineBuilderWithCurrent = () => {
    setRoutineBuilderMode(true);
    setShowRoutineStartModal(false);
  };

  const beginCreateRoutine = () => {
    if (!exercises.length && !sessionTitle.trim()) {
      startRoutineBuilderEmpty();
      return;
    }
    setShowRoutineStartModal(true);
  };

  const openCreateRoutineModal = () => {
    setEditingRoutineId(null);
    setRoutineNameInput(sessionTitle.trim() || "New routine");
    setRoutineFormError(null);
    setShowRoutineNameModal(true);
  };

  const openEditRoutineModal = (routine: Routine) => {
    setEditingRoutineId(routine.id);
    setRoutineNameInput(routine.name);
    setRoutineFormError(null);
    setRoutineBuilderMode(true);
    setShowRoutineNameModal(true);
  };

  const saveRoutine = async () => {
    const user = auth.currentUser;
    if (!user || routineSaving) return;
    const name = routineNameInput.trim();
    if (!name) {
      setRoutineFormError("Please enter a routine name.");
      return;
    }
    const routineExercises = buildRoutineExercisesFromEditor();
    if (!routineExercises.length) {
      setRoutineFormError("Add at least one exercise before saving a routine.");
      return;
    }
    setRoutineFormError(null);
    setRoutineSaving(true);
    try {
      const payload = {
        name,
        exercises: routineExercises,
        updatedAt: Timestamp.now(),
        ...(editingRoutineId ? {} : { createdAt: Timestamp.now() }),
      };
      if (editingRoutineId) {
        await setDoc(doc(db, "users", user.uid, "routines", editingRoutineId), payload, { merge: true });
      } else {
        await addDoc(collection(db, "users", user.uid, "routines"), payload);
      }
      setShowRoutineNameModal(false);
      setRoutineNameInput("");
      setEditingRoutineId(null);
      setRoutineBuilderMode(false);
      await loadRoutines();
      setUiFeedback(editingRoutineId ? "Routine updated." : "Routine saved.");
    } catch (error) {
      console.log("Failed to save routine", error);
      setRoutineFormError("Couldn't save routine right now. Please try again.");
    } finally {
      setRoutineSaving(false);
    }
  };

  const deleteRoutineById = async (routine: Routine) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "routines", routine.id));
      await loadRoutines();
      setUiFeedback("Routine deleted.");
    } catch (error) {
      console.log("Failed to delete routine", error);
      setUiFeedback("Couldn't delete routine right now.");
    }
  };

  const applyRoutineToEditor = (routine: Routine, mode: "replace" | "append") => {
    const mapped: Exercise[] = routine.exercises.map((exercise) => ({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: exercise.name,
      notes: exercise.notes ?? "",
      tempo: (exercise.mode === "cardio" ? exercise.zone : exercise.tempo) ?? "",
      cardioSessionType: exercise.cardioSessionType,
      cardioEffortLevel: exercise.cardioEffortLevel,
      sets: exercise.sets.map((set) => ({
        weightKg: typeof set.defaultWeightKg === "number" ? set.defaultWeightKg : null,
        reps: set.reps,
        rpe: exercise.mode === "cardio" ? "" : set.targetRpe ?? "",
        distanceKm: typeof set.defaultDistanceKm === "number" ? set.defaultDistanceKm : null,
        durationSec: typeof set.defaultDurationSec === "number" ? set.defaultDurationSec : null,
        zone: set.defaultZone ?? "",
        setType: toSetType(set.setType),
        done: false,
        baselineWeightKg: typeof set.defaultWeightKg === "number" ? set.defaultWeightKg : null,
        baselineReps: set.reps,
      })),
    }));
    setExercises((prev) => (mode === "append" ? [...prev, ...mapped] : mapped));
    setExerciseUnits((prev) => {
      const next = { ...prev };
      mapped.forEach((exercise) => {
        next[exercise.id] = getExerciseMode(exercise.name) === "cardio" ? "km" : "kg";
      });
      return next;
    });
    setRestPreferenceByExercise((prev) => {
      const next = mode === "append" ? { ...prev } : {};
      mapped.forEach((exercise) => {
        next[exercise.id] = getSavedRestPreference(exercise.name);
      });
      return next;
    });
    setRestCustomInputByExercise((prev) => {
      const next = mode === "append" ? { ...prev } : {};
      mapped.forEach((exercise) => {
        next[exercise.id] = "";
      });
      return next;
    });
    setRestTimerByExercise((prev) => {
      const next = mode === "append" ? { ...prev } : {};
      mapped.forEach((exercise) => {
        const restSeconds = getSavedRestPreference(exercise.name);
        next[exercise.id] = { remainingSec: restSeconds, running: false };
      });
      return next;
    });
    setSessionTitle(routine.name);
    if (mode === "replace") {
      setSessionDateText(toLocalDateKey(new Date()));
      setElapsedSeconds(0);
      setWorkoutTimerRunning(false);
      workoutStartedAtMsRef.current = null;
      setLastAppliedRoutineId(routine.id);
      setUiFeedback(`Applied "${routine.name}".`);
    } else {
      setUiFeedback(`Appended "${routine.name}".`);
      setLastAppliedRoutineId(null);
    }
  };

  const handleApplyRoutine = (routine: Routine) => {
    applyRoutineToEditor(routine, "replace");
  };

  const handleRepeatPastWorkoutPress = () => {
    if (pastWorkouts.length === 0) {
      setUiFeedback("No previous workouts yet. Finish one workout to enable repeat.");
      return;
    }
    setShowRepeatPicker(true);
  };

  const appendLastAppliedRoutine = () => {
    if (!lastAppliedRoutineId) return;
    const routine = routines.find((item) => item.id === lastAppliedRoutineId);
    if (!routine) return;
    applyRoutineToEditor(routine, "append");
  };

  const openRoutineActions = (routine: Routine) => {
    setSelectedRoutine(routine);
    setShowRoutineActionsModal(true);
  };

  const closeRoutineActions = () => {
    setShowRoutineActionsModal(false);
    setSelectedRoutine(null);
  };

  const handleUpdateSelectedRoutine = () => {
    if (!selectedRoutine) return;
    setShowRoutineActionsModal(false);
    openEditRoutineModal(selectedRoutine);
  };

  const handleAskDeleteSelectedRoutine = () => {
    setShowRoutineActionsModal(false);
    setShowRoutineDeleteModal(true);
  };

  const handleConfirmDeleteSelectedRoutine = async () => {
    if (!selectedRoutine) {
      setShowRoutineDeleteModal(false);
      return;
    }
    await deleteRoutineById(selectedRoutine);
    setShowRoutineDeleteModal(false);
    setSelectedRoutine(null);
  };

  const buildLastKnownWeightMap = () => {
    const map = new Map<string, number>();
    pastWorkouts.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        const key = exercise.name.toLowerCase();
        if (map.has(key)) return;
        const firstWeight = exercise.sets.find((set) => typeof set.weightKg === "number")?.weightKg;
        if (typeof firstWeight === "number") {
          map.set(key, firstWeight);
        }
      });
    });
    return map;
  };

  const recommendWorkout = async () => {
    if (recommending) return;
    setRecommending(true);
    try {
      const user = auth.currentUser;
      const userSnap = user ? await getDoc(doc(db, "users", user.uid)) : null;
      const userData: any = userSnap?.data?.() ?? {};
      const goal = String(userData?.goal || "");
      const goalLabel = goalToLabel(goal);
      const trainingPhase =
        typeof userData?.trainingPhase === "string" ? userData.trainingPhase : sessionPhase;
      const dietPhase = typeof userData?.dietPhase === "string" ? userData.dietPhase : "Maintain";

      const latestWorkout = pastWorkouts[0] ?? null;
      const latestWorkoutForHeuristics: WorkoutLike | null = latestWorkout
        ? {
            exercises: latestWorkout.exercises.map((exercise) => ({
              name: exercise.name,
              sets: exercise.sets.map((set) => ({ rpe: set.rpe })),
            })),
          }
        : null;
      const yesterdayGroup = getDominantGroup(latestWorkoutForHeuristics);
      const avgRpe = getAverageRpe(latestWorkoutForHeuristics);
      const highFatigue = avgRpe != null && avgRpe >= 9;
      const pickedTemplate = pickTemplate(
        DEFAULT_WORKOUT_TEMPLATES,
        yesterdayGroup,
        Math.max(0, Math.floor(Date.now() / (24 * 60 * 60 * 1000)))
      );
      const targets = resolveRecommendationTargets(
        trainingPhase,
        goal,
        dietPhase,
        latestDecision?.adjustments?.intensityPct ?? 0,
        highFatigue
      );
      const { targetSets, targetReps, intensityPct, tempo } = targets;
      const intensityFactor = 1 + intensityPct / 100;
      const lastKnownWeights = buildLastKnownWeightMap();
      const phaseGoalAligned = isPhaseGoalAligned(trainingPhase, goal);

      const recommendedExercises: Exercise[] = pickedTemplate.exercises.map((name) => {
        const knownWeight = lastKnownWeights.get(name.toLowerCase());
        const adjustedWeight =
          typeof knownWeight === "number" ? Math.round(knownWeight * intensityFactor * 10) / 10 : null;
        return {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name,
          notes: "",
          tempo,
          sets: Array.from({ length: targetSets }, () => ({
            weightKg: adjustedWeight,
            reps: targetReps,
            rpe: "",
            distanceKm: null,
            durationSec: null,
            zone: "",
            setType: "normal" as SetType,
            done: false,
            baselineWeightKg: adjustedWeight,
            baselineReps: targetReps,
          })),
        };
      });
      setExercises(recommendedExercises);
      setExerciseUnits(() => {
        const next: Record<string, Unit> = {};
        recommendedExercises.forEach((exercise) => {
          next[exercise.id] = "kg";
        });
        return next;
      });
      setRestPreferenceByExercise(() => {
        const next: Record<string, number> = {};
        recommendedExercises.forEach((exercise) => {
          next[exercise.id] = getSavedRestPreference(exercise.name);
        });
        return next;
      });
      setRestCustomInputByExercise(() => {
        const next: Record<string, string> = {};
        recommendedExercises.forEach((exercise) => {
          next[exercise.id] = "";
        });
        return next;
      });
      setRestTimerByExercise(() => {
        const next: Record<string, { remainingSec: number; running: boolean }> = {};
        recommendedExercises.forEach((exercise) => {
          const restSeconds = getSavedRestPreference(exercise.name);
          next[exercise.id] = { remainingSec: restSeconds, running: false };
        });
        return next;
      });
      setSessionTitle(`${pickedTemplate.name} (Recommended)`);
      setSessionDateText(toLocalDateKey(new Date()));
      setElapsedSeconds(0);
      setWorkoutTimerRunning(false);
      workoutStartedAtMsRef.current = null;
      setRecommendationSummary([
        phaseGoalAligned
          ? `Built for your ${trainingPhase} phase in a ${dietPhase} diet context.`
          : `Prioritized your ${trainingPhase} phase, while keeping your long-term goal (${goalLabel}) in mind.`,
        yesterdayGroup
          ? `Avoided repeating yesterday's main focus (${yesterdayGroup}).`
          : "No recent day focus detected, so a balanced split was selected.",
        highFatigue
          ? "Recent RPE trend was high, so today's set count/intensity was reduced."
          : "Intensity was tuned from your latest decision and training context.",
      ]);
      setUiFeedback("Recommended workout applied.");
      setLastAppliedRoutineId(null);
    } catch (error) {
      console.log("Failed to recommend workout", error);
      showAppAlert("Recommendation unavailable", "Please try again in a moment.");
    } finally {
      setRecommending(false);
    }
  };

  const totalSets = useMemo(
    () => exercises.reduce((sum, ex) => sum + ex.sets.length, 0),
    [exercises]
  );
  const activeRestExercise = useMemo(
    () =>
      activeRestTimerExerciseId
        ? exercises.find((exercise) => exercise.id === activeRestTimerExerciseId) ?? null
        : null,
    [activeRestTimerExerciseId, exercises]
  );
  const activeRestPreference = activeRestTimerExerciseId
    ? restPreferenceByExercise[activeRestTimerExerciseId] ?? 90
    : 90;
  const activeRestTimerState = activeRestTimerExerciseId
    ? restTimerByExercise[activeRestTimerExerciseId] ?? { remainingSec: activeRestPreference, running: false }
    : { remainingSec: activeRestPreference, running: false };
  const activeRestDisplayMin = Math.floor(activeRestTimerState.remainingSec / 60);
  const activeRestDisplaySec = `${activeRestTimerState.remainingSec % 60}`.padStart(2, "0");
  const activeActionExercise = useMemo(
    () =>
      activeExerciseActionId
        ? exercises.find((exercise) => exercise.id === activeExerciseActionId) ?? null
        : null,
    [activeExerciseActionId, exercises]
  );
  const activeActionIsFavorite = useMemo(() => {
    if (!activeActionExercise) return false;
    const needle = activeActionExercise.name.trim().toLowerCase();
    return favoriteExercises.some((entry) => entry.toLowerCase() === needle);
  }, [activeActionExercise, favoriteExercises]);
  const activeActionUnit = activeExerciseActionId
    ? exerciseUnits[activeExerciseActionId] || (activeActionMode === "cardio" ? "km" : "kg")
    : "kg";
  const activeActionMode =
    activeActionExercise && getExerciseMode(activeActionExercise.name) === "cardio" ? "cardio" : "resistance";
  const previousExerciseSetsByName = useMemo(() => {
    const map = new Map<string, PastWorkout["exercises"][number]["sets"]>();
    for (const workout of pastWorkouts) {
      for (const exercise of workout.exercises) {
        const key = normalizeExerciseName(exercise.name);
        if (!key || map.has(key)) continue;
        map.set(key, exercise.sets ?? []);
      }
    }
    return map;
  }, [pastWorkouts]);
  function buildExerciseDraft(name: string, id: string): Exercise {
    const trimmed = name.trim();
    const mode = getExerciseModeByName(trimmed);
    const previousSets = previousExerciseSetsByName.get(normalizeExerciseName(trimmed)) ?? [];
    const sets =
      previousSets.length > 0
        ? previousSets.map((set) => ({
            weightKg: mode === "cardio" ? null : set.weightKg ?? null,
            reps: mode === "cardio" ? "" : String(set.reps ?? ""),
            rpe: mode === "cardio" ? "" : String(set.rpe ?? ""),
            distanceKm: mode === "cardio" ? set.distanceKm ?? null : null,
            durationSec: mode === "cardio" ? set.durationSec ?? null : null,
            zone: mode === "cardio" ? String(set.zone ?? "") : "",
            setType: toSetType(set.setType),
            done: false,
            baselineWeightKg: mode === "cardio" ? null : set.weightKg ?? null,
            baselineReps: mode === "cardio" ? "" : String(set.reps ?? ""),
          }))
        : [
            {
              weightKg: null,
              reps: "",
              rpe: "",
              distanceKm: null,
              durationSec: null,
              zone: "",
              setType: "normal" as SetType,
              done: false,
            },
          ];
    return {
      id,
      name: trimmed,
      notes: "",
      tempo: mode === "cardio" ? "" : undefined,
      cardioSessionType: undefined,
      cardioEffortLevel: undefined,
      sets,
    };
  }
  buildExerciseDraftRef.current = buildExerciseDraft;
  const activeSetExercise = useMemo(() => {
    if (!activeSetMenu) return null;
    return exercises.find((exercise) => exercise.id === activeSetMenu.exerciseId) ?? null;
  }, [activeSetMenu, exercises]);
  const activeSet = useMemo(() => {
    if (!activeSetMenu || !activeSetExercise) return null;
    return activeSetExercise.sets[activeSetMenu.setIndex] ?? null;
  }, [activeSetExercise, activeSetMenu]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <GestureDetector gesture={scrollNativeGesture}>
          <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingBottom: 140 + keyboardHeight }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            scrollEventThrottle={16}
          >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{routineBuilderMode ? "Create Routine" : "Workout"}</Text>
          <TouchableOpacity
            onPress={discardWorkout}
            style={[styles.backButton, styles.discardHeaderButton]}
            disabled={saving}
          >
            <Ionicons name="trash-outline" size={18} color="#ffb8b8" />
          </TouchableOpacity>
        </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Session</Text>
        <TextInput
          placeholder="Session title (optional)"
          placeholderTextColor="#7a7a8c"
          value={sessionTitle}
          onChangeText={setSessionTitle}
          style={styles.input}
        />
        <View style={styles.sessionButtonRow}>
          <TouchableOpacity style={[styles.secondaryButton, styles.sessionActionButton]} onPress={openDatePicker}>
            <Text style={styles.secondaryText}>
              Date:{" "}
              {parseSessionDate(sessionDateText)?.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              }) ?? sessionDateText}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[workoutTimerRunning ? styles.primaryButton : styles.secondaryButton, styles.sessionActionButton]}
            onPress={workoutTimerRunning ? openDurationAdjustModal : startWorkoutTimer}
          >
            <Text style={workoutTimerRunning ? styles.primaryText : styles.secondaryText}>
              {workoutTimerRunning
                ? formatElapsedTimer(elapsedSeconds)
                : elapsedSeconds > 0
                ? "Resume Workout"
                : "Start Workout"}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.phaseRow}>
          <Text style={styles.muted}>Training phase: {sessionPhase}</Text>
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/profile", params: { from: "/(tabs)/workout/log" } })}
            style={styles.phaseLink}
          >
            <Text style={styles.phaseLinkText}>Change</Text>
          </TouchableOpacity>
        </View>
      </View>

      {baselineDate ? (
        <View style={styles.baselineBanner}>
          <Text style={styles.baselineText}>
            Baseline copied from{" "}
            {baselineDate.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" })}
          </Text>
          <Text style={styles.baselineSub}>
            Adjust per today&apos;s decision:{" "}
            {latestDecision?.decision
              ? `${formatDecisionLabel(latestDecision.decision)} (${formatIntensityPct(latestDecision.adjustments?.intensityPct)} weight)`
              : "??"}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Routines</Text>
        <Text style={styles.muted}>Reuse saved structures instead of rebuilding each session.</Text>
        <View style={styles.routineActionRow}>
          <TouchableOpacity
            style={[styles.primaryButton, styles.routineActionButton, { marginTop: 0 }]}
            onPress={beginCreateRoutine}
          >
            <Text style={styles.primaryText}>Create routine</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, styles.routineActionButton]}
            onPress={handleRepeatPastWorkoutPress}
          >
            <Text style={styles.secondaryText}>Repeat past workout</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.secondaryButton, { marginTop: 10 }, routines.length === 0 && styles.disabled]}
          onPress={() => setShowMyRoutinesModal(true)}
          disabled={routines.length === 0}
        >
          <Text style={styles.secondaryText}>My routines</Text>
        </TouchableOpacity>
        {routines.length === 0 ? (
          <Text style={[styles.muted, { marginTop: 8 }]}>
            No routines yet. Tap Create routine to build your first one.
          </Text>
        ) : null}

        {routineBuilderMode ? (
          <View style={styles.routineBuilderBanner}>
            <Text style={styles.recommendationLine}>
              Routine builder mode: use the workout editor below, then save.
            </Text>
            <View style={styles.routineActionRow}>
              <TouchableOpacity
                style={[styles.primaryButton, styles.routineActionButton, { marginTop: 0 }]}
                onPress={openCreateRoutineModal}
              >
                <Text style={styles.primaryText}>Save routine</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.routineActionButton]}
                onPress={() => setRoutineBuilderMode(false)}
              >
                <Text style={styles.secondaryText}>Exit builder</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Recommendation</Text>
        <Text style={styles.muted}>Autofill today&apos;s workout from your context and recent history.</Text>
        <TouchableOpacity
          style={[styles.primaryButton, { marginTop: 10, opacity: recommending ? 0.7 : 1 }]}
          onPress={recommendWorkout}
          disabled={recommending}
        >
          <Text style={styles.primaryText}>
            {recommending ? "Building recommendation..." : "Recommend workout"}
          </Text>
        </TouchableOpacity>
      </View>

      {uiFeedback ? (
        <View style={styles.feedbackBanner}>
          <Text style={styles.feedbackBannerText}>{uiFeedback}</Text>
          {undoDeletedSet ? (
            <TouchableOpacity onPress={undoRemoveSet} style={styles.feedbackBannerAction}>
              <Text style={styles.feedbackBannerActionText}>Undo</Text>
            </TouchableOpacity>
          ) : null}
          {!undoDeletedSet && lastAppliedRoutineId ? (
            <TouchableOpacity onPress={appendLastAppliedRoutine} style={styles.feedbackBannerAction}>
              <Text style={styles.feedbackBannerActionText}>Append instead</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {recommendationSummary.length > 0 ? (
        <View style={styles.recommendationCard}>
          <Text style={styles.sectionTitle}>Why this workout?</Text>
          {recommendationSummary.map((line, index) => (
            <Text key={`rec-line-${index}`} style={styles.recommendationLine}>
              - {line}
            </Text>
          ))}
        </View>
      ) : null}

      {exercises.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.muted}>No exercises added yet.</Text>
        </View>
      ) : (
        exercises.map((ex) => {
          const unit = exerciseUnits[ex.id] || "kg";
          const mode = getExerciseMode(ex.name);
          const isCardio = mode === "cardio";
          const usesNativeSetRows = Platform.OS === "android" && !isCardio;
          const weightLabel = isCardio
            ? "Distance"
            : unit === "kg"
            ? "kg"
            : unit === "lbs"
            ? "lbs"
            : "Weight";
          const repsLabel = isCardio ? "Time" : "Reps";
          const rpeLabel = isCardio ? "Zone" : "RPE";
          const previousSets = previousExerciseSetsByName.get(normalizeExerciseName(ex.name)) ?? [];
          const exerciseCatalogItem = findCatalogExercise(ex.name);
          const remoteDemoImages = exerciseImageMap[imageLookupKey(ex.name)] ?? [];
          const demoThumbnailUri = remoteDemoImages[0] ?? null;
          const demoThumbnail = exerciseCatalogItem?.demoImages?.[0] ?? null;
          const restTimer = restTimerByExercise[ex.id] ?? { remainingSec: 90, running: false };
          const restDisplayMin = Math.floor(restTimer.remainingSec / 60);
          const restDisplaySec = `${restTimer.remainingSec % 60}`.padStart(2, "0");
          return (
            <View key={ex.id} style={styles.card}>
              <View style={styles.exerciseHeader}>
                {exerciseCatalogItem ? (
                  <TouchableOpacity
                    style={styles.exerciseDemoThumbButton}
                    onPress={() => openExerciseDemo(ex.name)}
                    accessibilityLabel={`Open ${ex.name} demo`}
                  >
                    {demoThumbnailUri ? (
                      <Image source={demoThumbnailUri} style={styles.exerciseDemoThumbImage} contentFit="cover" />
                    ) : demoThumbnail ? (
                      <Image source={demoThumbnail} style={styles.exerciseDemoThumbImage} contentFit="cover" />
                    ) : (
                      <View style={styles.exerciseDemoThumbFallback}>
                        <Ionicons name="images-outline" size={18} color="#cdd0e0" />
                      </View>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.exerciseDemoThumbButton} accessibilityLabel="No demo available for this custom exercise">
                    <View style={styles.exerciseDemoThumbFallback}>
                      <Ionicons name="images-outline" size={18} color="#cdd0e0" />
                    </View>
                  </View>
                )}
                <Text
                  style={styles.exerciseName}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {ex.name}
                </Text>
                <TouchableOpacity style={styles.iconButton} onPress={() => openExerciseActions(ex.id)}>
                  <Ionicons name="ellipsis-horizontal" size={18} color="#cdd0e0" />
                </TouchableOpacity>
              </View>
              {replaceTarget === ex.id ? (
                <View style={[styles.pickerCard, { marginTop: 10 }]}>
                  <TextInput
                    placeholder="Search to replace"
                    placeholderTextColor="#7a7a8c"
                    value={replaceSearch}
                    onChangeText={setReplaceSearch}
                    style={[styles.input, { marginBottom: 8 }]}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.groupChips}
                  >
                    <TouchableOpacity
                      style={[styles.groupChip, replaceGroup === "all" && styles.groupChipActive]}
                      onPress={() => setReplaceGroup("all")}
                    >
                      <Text
                        style={[
                          styles.groupChipText,
                          replaceGroup === "all" && styles.groupChipTextActive,
                        ]}
                      >
                        All
                      </Text>
                    </TouchableOpacity>
                    {EXERCISE_GROUPS.map((g) => (
                      <TouchableOpacity
                        key={g.key}
                        style={[
                          styles.groupChip,
                          replaceGroup === g.key && styles.groupChipActive,
                        ]}
                        onPress={() => setReplaceGroup(g.key)}
                      >
                        <Text
                          style={[
                            styles.groupChipText,
                            replaceGroup === g.key && styles.groupChipTextActive,
                          ]}
                        >
                          {g.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <ScrollView
                    style={{ maxHeight: 180 }}
                    nestedScrollEnabled
                    bounces={false}
                    overScrollMode="never"
                    keyboardShouldPersistTaps="handled"
                    scrollEventThrottle={16}
                  >
                    {replacementOptions.map((item) => (
                      <TouchableOpacity
                        key={`${item.id}-${ex.id}`}
                        style={styles.pickerRow}
                        onPress={() => replaceExercise(ex.id, item.name)}
                      >
                        <Ionicons name="swap-horizontal-outline" size={18} color="#7b61ff" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pickerText}>{item.name}</Text>
                          <Text style={styles.muted}>
                            {item.primaryMuscles.slice(0, 2).join(", ")} | {item.equipment.slice(0, 2).join(", ")}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    {replacementOptions.length === 0 ? (
                      <Text style={styles.replacementEmptyText}>
                        {exerciseCatalogItem
                          ? "No matching alternatives. Try another search or body part."
                          : "Custom exercises do not have automatic alternatives. Search for the exercise you want instead."}
                      </Text>
                    ) : null}
                  </ScrollView>
                </View>
              ) : null}
              <View style={styles.exerciseMetaNotesSingle}>
                <TextInput
                  placeholder="Add notes"
                  placeholderTextColor="#7a7a8c"
                  value={ex.notes ?? ""}
                  onChangeText={(v) => updateExerciseNotes(ex.id, v)}
                  style={[styles.input, styles.metaInput]}
                />
              </View>
              {!isCardio ? (
                <View style={styles.inlineTipRow}>
                  <TouchableOpacity
                    style={styles.restTimerInlineButton}
                    onPress={() => openTempoEditor(ex.id, ex.tempo)}
                  >
                    <Ionicons name="speedometer-outline" size={14} color="#cdd0e0" />
                    <Text style={styles.restTimerInlineText}>
                      Tempo {(ex.tempo ?? "").trim() || DEFAULT_TEMPO}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.restTimerInlineButton}
                    onPress={() => openRestTimerModal(ex.id)}
                  >
                    <Ionicons name="timer-outline" size={14} color="#cdd0e0" />
                    <Text style={styles.restTimerInlineText}>
                      Rest {restDisplayMin}:{restDisplaySec}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <View
                style={[
                  styles.setHeaderRow,
                  isTabletLayout && styles.setHeaderRowTablet,
                  usesNativeSetRows && styles.nativeSetHeaderRow,
                ]}
              >
                {!isCardio ? <Text style={[styles.setHeaderText, styles.setHeaderSet]}>Set</Text> : null}
                <Text style={[styles.setHeaderText, styles.setHeaderCheck, usesNativeSetRows && styles.nativeSetHeaderCheck]}>
                  {"\u2713"}
                </Text>
                <Text style={[styles.setHeaderText, styles.setHeaderLast, usesNativeSetRows && styles.nativeSetHeaderLast]}>
                  Last
                </Text>
                <View style={[styles.setHeaderInputsGroup, usesNativeSetRows && styles.nativeSetHeaderInputsGroup]}>
                  <Text style={[styles.setHeaderText, styles.setColReps, usesNativeSetRows && styles.nativeSetHeaderInput]}>
                    {isCardio ? "Time" : weightLabel}
                  </Text>
                  <Text style={[styles.setHeaderText, styles.setColWeight, usesNativeSetRows && styles.nativeSetHeaderInput]}>
                    {isCardio ? String(unit).toLowerCase() : repsLabel}
                  </Text>
                  {!isCardio ? (
                    <Text style={[styles.setHeaderText, styles.setColRpe, usesNativeSetRows && styles.nativeSetHeaderInput]}>
                      {rpeLabel}
                    </Text>
                  ) : null}
                </View>
              </View>
              {ex.sets.length === 0 ? (
                <Text style={styles.muted}>No sets yet.</Text>
              ) : Platform.OS === "android" && !isCardio ? (
                <WorkoutSetList
                  key={`native-set-list-${ex.id}-${ex.sets
                    .map((set, idx) => `${idx}:${getSetTypeMarker(set, idx)}`)
                    .join("|")}-${String(unit).toLowerCase()}-${weightLabel}-${repsLabel}-${rpeLabel}`}
                  style={{ height: Math.max(ex.sets.length, 1) * 52 }}
                  weightLabel={weightLabel}
                  repsLabel={repsLabel}
                  rpeLabel={rpeLabel}
                  sets={ex.sets.map((set, idx) => ({
                    marker: getSetTypeMarker(set, idx),
                    last: previousSets[idx] ? formatLastSetSummary(previousSets[idx]) : "-",
                      weight: isCardio
                        ? formatDistanceInput(set.distanceKm ?? null, unit)
                        : set.weightText ?? formatWeightInput(set.weightKg, unit),
                    reps: isCardio ? formatDurationInput(set.durationSec ?? null) : set.reps,
                    rpe: isCardio ? String(set.zone || "") : set.rpe ?? "",
                    done: set.done,
                  }))}
                  onSetChange={({ nativeEvent }) => {
                    const idx = nativeEvent.index;
                    if (typeof idx !== "number" || idx < 0 || idx >= ex.sets.length) return;
                    if (nativeEvent.field === "weight") {
                      updateSetWeight(ex.id, idx, unit, nativeEvent.value ?? "");
                      return;
                    }
                    if (nativeEvent.field === "reps") {
                      updateSetReps(ex.id, idx, nativeEvent.value ?? "");
                      return;
                    }
                    updateSetRpe(ex.id, idx, nativeEvent.value ?? "");
                  }}
                  onToggleDone={({ nativeEvent }) => {
                    const idx = nativeEvent.index;
                    if (typeof idx !== "number" || idx < 0 || idx >= ex.sets.length) return;
                    toggleSetDone(ex.id, idx);
                  }}
                  onDeleteSet={({ nativeEvent }) => {
                    const idx = nativeEvent.index;
                    if (typeof idx !== "number" || idx < 0 || idx >= ex.sets.length) return;
                    removeSetWithUndo(ex.id, idx);
                  }}
                  onSetLabelPress={({ nativeEvent }) => {
                    const idx = nativeEvent.index;
                    if (typeof idx !== "number" || idx < 0 || idx >= ex.sets.length) return;
                    openSetMenu(ex.id, idx);
                  }}
                />
              ) : (
                ex.sets.map((s, idx) => (
                  <ReanimatedSwipeable
                    key={`${ex.id}-set-${idx}`}
                    simultaneousWithExternalGesture={scrollNativeGesture}
                    friction={1.2}
                    rightThreshold={12}
                    overshootRight={false}
                    dragOffsetFromLeftEdge={24}
                    dragOffsetFromRightEdge={24}
                    renderRightActions={() => (
                      <View style={styles.swipeDeleteContainer}>
                        <TouchableOpacity
                          style={styles.swipeDeleteButton}
                          onPress={() => removeSetWithUndo(ex.id, idx)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#fff" />
                          <Text style={styles.swipeDeleteText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  >
                    <View style={styles.setContainer}>
                      <View style={[styles.setInlineRow, isTabletLayout && styles.setInlineRowTablet]}>
                        {!isCardio ? (
                          <TouchableOpacity
                            onPress={() => openSetMenu(ex.id, idx)}
                            style={styles.setLabelButton}
                            accessibilityLabel={`Adjust set ${idx + 1} intensity`}
                          >
                            <Text style={[styles.setLabel, isTabletLayout && styles.setLabelTablet]}>
                              {getSetTypeMarker(s, idx)}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          style={[styles.checkboxInline, styles.checkboxHitbox]}
                          onPress={() => toggleSetDone(ex.id, idx)}
                          activeOpacity={0.8}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <View style={[styles.checkbox, s.done && styles.checkboxChecked]}>
                            {s.done ? <Ionicons name="checkmark" size={14} color="#0d0d1a" /> : null}
                          </View>
                        </TouchableOpacity>
                        <Text style={styles.lastSetText}>
                          {previousSets[idx] ? formatLastSetSummary(previousSets[idx]) : "-"}
                        </Text>
                        <View style={[styles.setInputsGroup, isTabletLayout && styles.setInputsGroupTablet]}>
                          {isCardio ? (
                            <>
                              <TouchableOpacity
                                style={[styles.input, styles.setInput, styles.setInputCompact, styles.setColReps]}
                                onPress={() => openCardioTimeModal(ex.id, idx, s.durationSec)}
                              >
                                <Text style={styles.cardioTapValue}>
                                  {formatDurationHoursMinutes(s.durationSec ?? null) || "hh:mm"}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.input, styles.setInput, styles.setInputCompact, styles.setColWeight]}
                                onPress={() => openCardioDistanceModal(ex.id, idx, s.distanceKm ?? null, unit)}
                              >
                                <Text style={styles.cardioTapValue}>
                                  {formatDistanceInput(s.distanceKm ?? null, unit) || String(unit)}
                                </Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <>
                              <WorkoutGestureTextInput
                                placeholder={weightLabel}
                                placeholderTextColor="#7a7a8c"
                                keyboardType="decimal-pad"
                                value={s.weightText ?? formatWeightInput(s.weightKg, unit)}
                                onChangeText={(v) => updateSetWeight(ex.id, idx, unit, v)}
                                selectTextOnFocus={false}
                                style={[
                                  styles.input,
                                  styles.setInput,
                                  styles.setInputCompact,
                                  styles.setColWeight,
                                  isTabletLayout && styles.setInputTablet,
                                ]}
                              />
                              <WorkoutGestureTextInput
                                placeholder={repsLabel}
                                placeholderTextColor="#7a7a8c"
                                keyboardType="numeric"
                                value={s.reps}
                                onChangeText={(v) => updateSetReps(ex.id, idx, v)}
                                selectTextOnFocus={false}
                                style={[
                                  styles.input,
                                  styles.setInput,
                                  styles.setInputCompact,
                                  styles.setColReps,
                                  isTabletLayout && styles.setInputTablet,
                                  styles.setInputReps,
                                  isTabletLayout && styles.setInputRepsTablet,
                                ]}
                              />
                              <WorkoutGestureTextInput
                                placeholder={rpeLabel}
                                placeholderTextColor="#7a7a8c"
                                keyboardType="decimal-pad"
                                value={s.rpe ?? ""}
                                onChangeText={(v) => updateSetRpe(ex.id, idx, v)}
                                selectTextOnFocus={false}
                                style={[
                                  styles.input,
                                  styles.setInput,
                                  styles.setInputCompact,
                                  styles.setColRpe,
                                  isTabletLayout && styles.setInputTablet,
                                ]}
                              />
                            </>
                          )}
                        </View>
                      </View>
                    </View>
                  </ReanimatedSwipeable>
                ))
              )}
              {isCardio ? (
                <>
                  <View style={styles.cardioMetaRow}>
                    <Text style={styles.cardioMetaLabel}>Session Type</Text>
                    <View style={styles.answerRow}>
                      {CARDIO_SESSION_TYPES.map((option) => (
                        <TouchableOpacity
                          key={`cardio-session-${ex.id}-${option.value}`}
                          style={[
                            styles.answerChip,
                            ex.cardioSessionType === option.value && styles.answerChipActive,
                          ]}
                          onPress={() => updateCardioSessionType(ex.id, option.value)}
                        >
                          <Text
                            style={[
                              styles.answerText,
                              ex.cardioSessionType === option.value && styles.answerTextActive,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.cardioMetaRow}>
                    <Text style={styles.cardioMetaLabel}>Effort Level</Text>
                    <View style={styles.answerRow}>
                      {CARDIO_EFFORT_LEVELS.map((option) => (
                        <TouchableOpacity
                          key={`cardio-effort-${ex.id}-${option.value}`}
                          style={[
                            styles.answerChip,
                            ex.cardioEffortLevel === option.value && styles.answerChipActive,
                          ]}
                          onPress={() => updateCardioEffortLevel(ex.id, option.value)}
                        >
                          <Text
                            style={[
                              styles.answerText,
                              ex.cardioEffortLevel === option.value && styles.answerTextActive,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              ) : null}
              <View style={styles.setActionsRow}>
                <TouchableOpacity
                  style={[styles.primaryButton, styles.setActionButton]}
                  onPress={() => addEmptySet(ex.id)}
                >
                  <Text style={styles.primaryText}>Add set</Text>
                </TouchableOpacity>
                {ex.sets.length > 0 ? (
                  <TouchableOpacity
                    style={[styles.secondaryButton, styles.setActionButton]}
                    onPress={() => duplicateLastSet(ex.id)}
                  >
                    <Text style={styles.secondaryText}>Duplicate last set</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.setActionButton} />
                )}
              </View>
              {undoDeletedSet?.exerciseId === ex.id ? (
                <View style={styles.inlineUndoBanner}>
                  <Text style={styles.inlineUndoBannerText}>Set deleted</Text>
                  <TouchableOpacity onPress={undoRemoveSet} style={styles.inlineUndoBannerAction}>
                    <Text style={styles.inlineUndoBannerActionText}>Undo</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <TouchableOpacity
        style={[styles.secondaryButton, { marginTop: 12 }]}
        onPress={openAddExercise}
      >
        <Text style={styles.secondaryText}>Add exercise</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryButton, { marginTop: 16, opacity: saving ? 0.6 : 1 }]}
        onPress={finishWorkout}
        disabled={saving}
      >
        <Text style={styles.secondaryText}>
          {saving ? "Saving..." : `Finish workout (${totalSets} sets)`}
        </Text>
      </TouchableOpacity>

      <Modal visible={showRepeatPicker} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Repeat a past workout</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {pastWorkouts.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={styles.pickerRow}
                  onPress={() => applyPastWorkout(w)}
                >
                  <Ionicons name="repeat-outline" size={18} color="#7b61ff" />
                  <View>
                    <Text style={styles.pickerText}>{w.title}</Text>
                    <Text style={styles.muted}>
                      {w.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 10 }]}
              onPress={() => setShowRepeatPicker(false)}
            >
              <Text style={styles.secondaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showMyRoutinesModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>My routines</Text>
            {routines.length === 0 ? (
              <Text style={styles.modalText}>No routines saved yet.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {routines.map((routine) => (
                  <View key={`my-routine-${routine.id}`} style={styles.routineCard}>
                    <View style={styles.routineCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerText}>{routine.name}</Text>
                        <Text style={styles.muted}>
                          {routine.exercises.map((exercise) => exercise.name).slice(0, 4).join(" | ")}
                          {routine.exercises.length > 4 ? " | ..." : ""}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.iconButton} onPress={() => openRoutineActions(routine)}>
                        <Ionicons name="ellipsis-horizontal" size={16} color="#cdd0e0" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.routineUseButton}
                      onPress={() => {
                        handleApplyRoutine(routine);
                        setShowMyRoutinesModal(false);
                      }}
                    >
                      <Text style={styles.primaryText}>Apply routine</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 10 }]}
              onPress={() => setShowMyRoutinesModal(false)}
            >
              <Text style={styles.secondaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showExerciseDemo} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{activeDemoExercise?.name ?? "Exercise Demo"}</Text>
            {activeDemoImageUris.length ? (
              <View style={styles.demoImageRow}>
                {activeDemoImageUris.slice(0, 2).map((image, index) => (
                  <Image
                    key={`remote-demo-${index}-${image}`}
                    source={image}
                    style={styles.demoImage}
                    contentFit="cover"
                  />
                ))}
              </View>
            ) : activeDemoExercise?.demoImages?.length ? (
              <View style={styles.demoImageRow}>
                {activeDemoExercise.demoImages.slice(0, 2).map((image, index) => (
                  <Image
                    key={`${activeDemoExercise.id}-demo-${index}`}
                    source={image}
                    style={styles.demoImage}
                    contentFit="cover"
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.modalText}>No images available yet.</Text>
            )}
            {(activeDemoExercise?.cues ?? []).slice(0, 3).map((cue) => (
              <Text key={`${activeDemoExercise?.id}-${cue}`} style={styles.modalText}>
                - {cue}
              </Text>
            ))}
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 12 }]}
              onPress={closeExerciseDemo}
            >
              <Text style={styles.secondaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showExerciseActionsModal} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={closeExerciseActions}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>
                  {activeActionExercise ? activeActionExercise.name : "Exercise Options"}
                </Text>

                <View style={styles.exerciseOptionRow}>
                  <Ionicons
                    name={activeActionMode === "cardio" ? "map-outline" : "barbell-outline"}
                    size={18}
                    color="#cdd0e0"
                  />
                  <View style={styles.exerciseOptionUnits}>
                    {(activeActionMode === "cardio" ? (["km", "mi"] as Unit[]) : (["kg", "lbs"] as Unit[])).map(
                      (option) => (
                      <TouchableOpacity
                        key={`unit-${option}`}
                        style={[
                          styles.answerChip,
                          styles.exerciseUnitChip,
                          activeActionUnit === option && styles.answerChipActive,
                        ]}
                        onPress={() =>
                          activeExerciseActionId ? toggleExerciseUnit(activeExerciseActionId, option) : undefined
                        }
                      >
                        <Text
                          style={[
                            styles.answerText,
                            activeActionUnit === option && styles.answerTextActive,
                          ]}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                      )
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.exerciseOptionRow}
                  onPress={() => {
                    if (!activeExerciseActionId) return;
                    setReplaceTarget((prev) => (prev === activeExerciseActionId ? null : activeExerciseActionId));
                    setReplaceSearch("");
                    setReplaceGroup("all");
                    closeExerciseActions();
                  }}
                >
                  <Ionicons name="swap-horizontal-outline" size={18} color="#cdd0e0" />
                  <Text style={styles.exerciseOptionText}>Replace exercise</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.exerciseOptionRow}
                  onPress={() => {
                    if (!activeActionExercise) return;
                    toggleFavoriteExercise(activeActionExercise.name);
                  }}
                >
                  <Ionicons
                    name={activeActionIsFavorite ? "star" : "star-outline"}
                    size={18}
                    color="#ffd166"
                  />
                  <Text style={styles.exerciseOptionText}>
                    {activeActionIsFavorite ? "Added to favorites" : "Add to favorites"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.exerciseOptionRow}
                  onPress={() => {
                    if (!activeExerciseActionId) return;
                    const targetId = activeExerciseActionId;
                    closeExerciseActions();
                    deleteExercise(targetId);
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color="#ff7a7a" />
                  <Text style={[styles.exerciseOptionText, { color: "#ff7a7a" }]}>Delete exercise</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={showRestTimerModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {activeRestExercise ? `${activeRestExercise.name} Rest Timer` : "Rest Timer"}
            </Text>
            <Text style={styles.modalText}>
              Current: {activeRestDisplayMin}:{activeRestDisplaySec}
            </Text>
            <View style={styles.answerRow}>
              {[60, 90, 120].map((seconds) => (
                <TouchableOpacity
                  key={`rest-modal-${seconds}`}
                  style={[
                    styles.answerChip,
                    activeRestPreference === seconds && styles.answerChipActive,
                  ]}
                  onPress={() =>
                    activeRestTimerExerciseId
                      ? setRestPreference(activeRestTimerExerciseId, seconds)
                      : undefined
                  }
                >
                  <Text
                    style={[
                      styles.answerText,
                      activeRestPreference === seconds && styles.answerTextActive,
                    ]}
                  >
                    {seconds}s
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.restCustomRow}>
              <TextInput
                placeholder="Custom (sec)"
                placeholderTextColor="#7a7a8c"
                keyboardType="numeric"
                value={
                  activeRestTimerExerciseId
                    ? restCustomInputByExercise[activeRestTimerExerciseId] ?? ""
                    : ""
                }
                onChangeText={(value) =>
                  activeRestTimerExerciseId
                    ? setRestCustomInputByExercise((prev) => ({
                        ...prev,
                        [activeRestTimerExerciseId]: value,
                      }))
                    : undefined
                }
                style={[styles.input, styles.restCustomInput]}
              />
              <TouchableOpacity
                style={[styles.secondaryButton, styles.restCustomApply]}
                onPress={() =>
                  activeRestTimerExerciseId
                    ? applyCustomRestPreference(activeRestTimerExerciseId)
                    : undefined
                }
              >
                <Text style={styles.secondaryText}>Set</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={() =>
                  activeRestTimerExerciseId
                    ? resetRestTimer(activeRestTimerExerciseId)
                    : undefined
                }
              >
                <Text style={styles.secondaryText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={closeRestTimerModal}
              >
                <Text style={styles.secondaryText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.modalActionButton, styles.modalPrimaryButton]}
                onPress={() => {
                  if (!activeRestTimerExerciseId) return;
                  if (activeRestTimerState.running) {
                    pauseRestTimer(activeRestTimerExerciseId);
                    return;
                  }
                  startRestTimer(activeRestTimerExerciseId);
                  closeRestTimerModal();
                }}
              >
                <Text style={styles.primaryText}>{activeRestTimerState.running ? "Pause" : "Start"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showRoutineStartModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create routine</Text>
            <Text style={styles.modalText}>
              Start with an empty editor or use your current workout draft.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 12 }]}
              onPress={startRoutineBuilderWithCurrent}
            >
              <Text style={styles.primaryText}>Use current workout</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 10 }]}
              onPress={startRoutineBuilderEmpty}
            >
              <Text style={styles.secondaryText}>Start empty</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 10 }]}
              onPress={() => setShowRoutineStartModal(false)}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showRoutineActionsModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectedRoutine ? selectedRoutine.name : "Routine actions"}
            </Text>
            <Text style={styles.modalText}>Choose what you want to do with this routine.</Text>
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 12 }]}
              onPress={handleUpdateSelectedRoutine}
              disabled={!selectedRoutine}
            >
              <Text style={styles.primaryText}>Update from current workout</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dangerButton, { marginTop: 10 }]}
              onPress={handleAskDeleteSelectedRoutine}
              disabled={!selectedRoutine}
            >
              <Text style={styles.primaryText}>Delete routine</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 10 }]}
              onPress={closeRoutineActions}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showRoutineDeleteModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete this routine?</Text>
            <Text style={styles.modalText}>
              {selectedRoutine
                ? `This will permanently remove "${selectedRoutine.name}".`
                : "This will permanently remove this routine."}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={() => {
                  setShowRoutineDeleteModal(false);
                  setSelectedRoutine(null);
                }}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerButton, styles.modalActionButton]}
                onPress={handleConfirmDeleteSelectedRoutine}
              >
                <Text style={styles.primaryText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showRoutineNameModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingRoutineId ? "Update routine" : "Save routine"}</Text>
            <TextInput
              placeholder="Routine name"
              placeholderTextColor="#7a7a8c"
              value={routineNameInput}
              onChangeText={setRoutineNameInput}
              style={styles.input}
            />
            {routineFormError ? <Text style={styles.modalErrorText}>{routineFormError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={() => {
                  setShowRoutineNameModal(false);
                  setEditingRoutineId(null);
                  setRoutineFormError(null);
                }}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.modalActionButton, styles.modalPrimaryButton]}
                onPress={saveRoutine}
                disabled={routineSaving}
              >
                <Text style={styles.primaryText}>{routineSaving ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDatePickerModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() =>
                  setDatePickerMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }
              >
                <Ionicons name="chevron-back" size={16} color="#cdd0e0" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {MONTH_LABELS[datePickerMonth.getMonth()]} {datePickerMonth.getFullYear()}
              </Text>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() =>
                  setDatePickerMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  )
                }
              >
                <Ionicons name="chevron-forward" size={16} color="#cdd0e0" />
              </TouchableOpacity>
            </View>
            <View style={styles.calendarWeekRow}>
              {WEEKDAY_LABELS.map((label, index) => (
                <Text key={`wk-${label}-${index}`} style={styles.calendarWeekdayText}>
                  {label}
                </Text>
              ))}
            </View>
            {getCalendarMatrix(datePickerMonth).map((week, weekIndex) => (
              <View key={`wk-row-${weekIndex}`} style={styles.calendarWeekRow}>
                {week.map((day) => {
                  const dayKey = toLocalDateKey(day);
                  const isActiveMonth = day.getMonth() === datePickerMonth.getMonth();
                  const selected = dayKey === sessionDateText;
                  return (
                    <TouchableOpacity
                      key={`day-${dayKey}`}
                      style={[
                        styles.calendarDayButton,
                        !isActiveMonth && styles.calendarDayOutside,
                        selected && styles.calendarDaySelected,
                      ]}
                      onPress={() => {
                        setSessionDateText(dayKey);
                        setShowDatePickerModal(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.calendarDayText,
                          !isActiveMonth && styles.calendarDayTextOutside,
                          selected && styles.calendarDayTextSelected,
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 10 }]}
              onPress={() => setShowDatePickerModal(false)}
            >
              <Text style={styles.secondaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDurationModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Adjust duration</Text>
            <Text style={styles.modalText}>Set workout duration (hours and minutes).</Text>
            <View style={styles.durationFieldRow}>
              <TextInput
                placeholder="00"
                placeholderTextColor="#7a7a8c"
                value={durationAdjustHoursText}
                onChangeText={setDurationAdjustHoursText}
                keyboardType="numeric"
                maxLength={2}
                style={styles.durationFieldInput}
              />
              <Text style={styles.durationFieldColon}>:</Text>
              <TextInput
                placeholder="00"
                placeholderTextColor="#7a7a8c"
                value={durationAdjustMinutesText}
                onChangeText={setDurationAdjustMinutesText}
                keyboardType="numeric"
                maxLength={2}
                style={styles.durationFieldInput}
              />
            </View>
            <View style={styles.durationFieldLabelRow}>
              <Text style={styles.durationFieldLabel}>Hours</Text>
              <Text style={styles.durationFieldLabel}>Minutes</Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={() => setShowDurationModal(false)}
              >
                <Text style={styles.secondaryText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={resetDurationTimer}
              >
                <Text style={styles.secondaryText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.modalActionButton, styles.modalPrimaryButton]}
                onPress={applyDurationAdjustment}
              >
                <Text style={styles.primaryText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showCardioTimeModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set Cardio Time</Text>
            <View style={styles.durationFieldRow}>
              <TextInput
                placeholder="00"
                placeholderTextColor="#7a7a8c"
                value={cardioTimeHoursText}
                onChangeText={setCardioTimeHoursText}
                keyboardType="numeric"
                maxLength={2}
                style={styles.durationFieldInput}
              />
              <Text style={styles.durationFieldColon}>:</Text>
              <TextInput
                placeholder="00"
                placeholderTextColor="#7a7a8c"
                value={cardioTimeMinutesText}
                onChangeText={setCardioTimeMinutesText}
                keyboardType="numeric"
                maxLength={2}
                style={styles.durationFieldInput}
              />
            </View>
            <View style={styles.durationFieldLabelRow}>
              <Text style={styles.durationFieldLabel}>Hours</Text>
              <Text style={styles.durationFieldLabel}>Minutes</Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={() => {
                  setShowCardioTimeModal(false);
                  setCardioTimeTarget(null);
                }}
              >
                <Text style={styles.secondaryText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={resetCardioTimeModal}
              >
                <Text style={styles.secondaryText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.modalActionButton, styles.modalPrimaryButton]}
                onPress={applyCardioTimeModal}
              >
                <Text style={styles.primaryText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showCardioDistanceModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set Distance</Text>
            <Text style={styles.modalText}>Whole and decimal values.</Text>
            <View style={styles.durationFieldRow}>
              <TextInput
                placeholder="0"
                placeholderTextColor="#7a7a8c"
                value={cardioDistanceWholeText}
                onChangeText={setCardioDistanceWholeText}
                keyboardType="numeric"
                maxLength={3}
                style={styles.durationFieldInput}
              />
              <Text style={styles.durationFieldColon}>.</Text>
              <TextInput
                placeholder="00"
                placeholderTextColor="#7a7a8c"
                value={cardioDistanceDecimalText}
                onChangeText={setCardioDistanceDecimalText}
                keyboardType="numeric"
                maxLength={2}
                style={styles.durationFieldInput}
              />
              <Text style={styles.distanceUnitSuffix}>
                {cardioDistanceTarget ? String(exerciseUnits[cardioDistanceTarget.exerciseId] || "km") : "km"}
              </Text>
            </View>
            <View style={styles.durationFieldLabelRow}>
              <Text style={styles.durationFieldLabel}>Whole</Text>
              <Text style={styles.durationFieldLabel}>Decimal</Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={() => {
                  setShowCardioDistanceModal(false);
                  setCardioDistanceTarget(null);
                }}
              >
                <Text style={styles.secondaryText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={resetCardioDistanceModal}
              >
                <Text style={styles.secondaryText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.modalActionButton, styles.modalPrimaryButton]}
                onPress={() => {
                  if (!cardioDistanceTarget) return;
                  const exerciseUnit = exerciseUnits[cardioDistanceTarget.exerciseId] || "km";
                  applyCardioDistanceModal(exerciseUnit);
                }}
              >
                <Text style={styles.primaryText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showFinishModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Quick questions</Text>
            <Text style={styles.modalText}>Followed recommendation?</Text>
            <View style={styles.answerRow}>
              {([
                { value: "yes", label: "Yes" },
                { value: "partial", label: "Partial" },
                { value: "no", label: "No" },
              ] as const).map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.answerChip, followedAnswer === option.value && styles.answerChipActive]}
                  onPress={() => setFollowedAnswer(option.value)}
                >
                  <Text style={[styles.answerText, followedAnswer === option.value && styles.answerTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalText, { marginTop: 12 }]}>Helpful?</Text>
            <View style={styles.answerRow}>
              {([
                { value: "yes", label: "Yes" },
                { value: "neutral", label: "Neutral" },
                { value: "no", label: "No" },
              ] as const).map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.answerChip, helpfulAnswer === option.value && styles.answerChipActive]}
                  onPress={() => setHelpfulAnswer(option.value)}
                >
                  <Text style={[styles.answerText, helpfulAnswer === option.value && styles.answerTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {showFinishTitleInput ? (
              <>
                <Text style={[styles.modalText, { marginTop: 12 }]}>Optional session title</Text>
                <TextInput
                  placeholder="e.g., Upper body"
                  placeholderTextColor="#7a7a8c"
                  value={sessionTitle}
                  onChangeText={setSessionTitle}
                  style={styles.input}
                />
              </>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={() => {
                  setShowFinishModal(false);
                  setShowFinishTitleInput(false);
                }}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.modalActionButton, styles.modalPrimaryButton]}
                onPress={saveWorkout}
                disabled={saving}
              >
                <Text style={styles.primaryText}>{saving ? "Saving..." : "Save workout"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showTempoEditorModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Adjust Tempo</Text>
            <Text style={styles.modalText}>
              Eccentric - Hold - Concentric - Hold
            </Text>
            <Text style={[styles.modalText, { marginBottom: 8 }]}>
              Values: X, 0, 1, 2, 3
            </Text>

            {[
              { label: "Eccentric", idx: 0 },
              { label: "Hold", idx: 1 },
              { label: "Concentric", idx: 2 },
              { label: "Hold", idx: 3 },
            ].map((segment) => (
              <View key={`tempo-segment-${segment.idx}`} style={styles.tempoSliderRow}>
                <Text style={styles.tempoSliderLabel}>{segment.label}</Text>
                <Slider
                  style={styles.tempoSlider}
                  minimumValue={0}
                  maximumValue={4}
                  step={1}
                  minimumTrackTintColor="#7b61ff"
                  maximumTrackTintColor="rgba(255,255,255,0.22)"
                  thumbTintColor="#cdd0e0"
                  value={tempoDraftIndices[segment.idx] ?? DEFAULT_TEMPO_INDICES[segment.idx]}
                  onValueChange={(value) => setTempoDraftIndex(segment.idx, Number(value))}
                />
                <Text style={styles.tempoSliderValue}>
                  {TEMPO_TOKENS[tempoDraftIndices[segment.idx] ?? DEFAULT_TEMPO_INDICES[segment.idx]]}
                </Text>
              </View>
            ))}

            <Text style={[styles.modalText, { marginTop: 6 }]}>
              Tempo: {formatTempoFromIndices(tempoDraftIndices)}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={closeTempoEditor}
              >
                <Text style={styles.secondaryText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.modalActionButton, styles.modalPrimaryButton]}
                onPress={saveTempoDraft}
              >
                <Text style={styles.primaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDiscardConfirmModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Discard this workout?</Text>
            <Text style={styles.modalText}>
              This will clear your current workout draft. You can&apos;t undo it.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={() => setShowDiscardConfirmModal(false)}
              >
                <Text style={styles.secondaryText}>Keep editing</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerButton, styles.modalActionButton]}
                onPress={confirmDiscardWorkout}
              >
                <Text style={styles.primaryText}>Discard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(activeSetMenu)} transparent animationType="slide">
        <View style={[styles.sheetBackdrop, { paddingBottom: insets.bottom + 72 }]}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetTitleRow}>
              <Text style={styles.modalTitle}>Set options</Text>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() =>
                  showAppAlert(
                    "Set types",
                    "Warm-up: lighter prep set.\nNormal: standard working set.\nFailure: pushed to failure.\nDrop: reduce load and continue."
                  )
                }
              >
                <Ionicons name="help-circle-outline" size={18} color="#cdd0e0" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalText}>Set type</Text>
            <View style={styles.answerRow}>
              {SET_TYPE_LABELS.map((typeOption) => (
                <TouchableOpacity
                  key={`set-type-${typeOption.value}`}
                  style={[
                    styles.answerChip,
                    toSetType(activeSet?.setType) === typeOption.value && styles.answerChipActive,
                  ]}
                  onPress={() => {
                    if (!activeSetMenu) return;
                    updateSetType(activeSetMenu.exerciseId, activeSetMenu.setIndex, typeOption.value);
                    closeSetMenu();
                  }}
                >
                  <Text
                    style={[
                      styles.answerText,
                      toSetType(activeSet?.setType) === typeOption.value && styles.answerTextActive,
                    ]}
                  >
                    {typeOption.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {activeSetExercise && getExerciseMode(activeSetExercise.name) !== "cardio" ? (
              <>
                <Text style={[styles.modalText, { marginTop: 10 }]}>
                  Apply percentage to this set&apos;s baseline weight.
                </Text>
                <View style={styles.answerRow}>
                  {getAdjustmentOptions().map((pct) => (
                    <TouchableOpacity
                      key={`adj-${pct}`}
                      style={styles.answerChip}
                      onPress={() => {
                        if (!activeSetMenu) return;
                        const unit = exerciseUnits[activeSetMenu.exerciseId] || "kg";
                        applySetAdjustment(activeSetMenu.exerciseId, activeSetMenu.setIndex, unit, pct);
                      }}
                    >
                      <Text style={styles.answerText}>{pct >= 0 ? `+${pct}%` : `${pct}%`}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 12 }]}
              onPress={closeSetMenu}
            >
              <Text style={styles.secondaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

          </ScrollView>
        </GestureDetector>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d0d1a" },
  keyboardAvoiding: { flex: 1 },
  container: { flex: 1, backgroundColor: "#0d0d1a" },
  content: { padding: 20, paddingTop: 20, paddingBottom: 140 },
  header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
      backgroundColor: "rgba(255,255,255,0.08)",
      alignItems: "center",
      justifyContent: "center",
    },
  discardHeaderButton: {
    borderColor: "rgba(255,122,122,0.6)",
    borderWidth: StyleSheet.hairlineWidth * 2,
    backgroundColor: "rgba(255,122,122,0.15)",
  },
  headerSpacer: { width: 22 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 10 },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    columnGap: 10,
    rowGap: 8,
  },
  sessionButtonRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  sessionActionButton: { flex: 1, marginTop: 0 },
  halfInput: { flexBasis: "48%", flexGrow: 1, minWidth: 120, marginBottom: 0 },
  primaryButton: {
    backgroundColor: "#7b61ff",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  primaryText: { color: "#fff", fontWeight: "700" },
  secondaryButton: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryText: { color: "#7b61ff", fontWeight: "700" },
  disabled: { opacity: 0.5 },
  muted: { color: "#a3a3b5" },
  exerciseBlock: { marginTop: 8 },
  exerciseName: { color: "#fff", fontWeight: "700", marginBottom: 0, flex: 1, flexShrink: 1, marginLeft: 6 },
  exerciseDemoThumbButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseDemoThumbImage: { width: "100%", height: "100%" },
  exerciseDemoThumbFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseMetaNotesSingle: { marginTop: 12, marginBottom: 8 },
  inlineTipRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  inlineZoneInputWrap: {
    marginBottom: 0,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.04)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inlineZoneInput: {
    flex: 1,
    marginBottom: 0,
    backgroundColor: "transparent",
    paddingVertical: 2,
    paddingHorizontal: 0,
    borderRadius: 0,
    textAlign: "left",
    fontSize: 12,
    color: "#d8daec",
  },
  restTimerInlineButton: {
    marginBottom: 0,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.04)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  restTimerInlineText: { color: "#d8daec", fontSize: 12, fontWeight: "700" },
  durationFieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 6,
  },
  durationFieldInput: {
    width: 88,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "800",
  },
  durationFieldColon: { color: "#fff", fontSize: 28, fontWeight: "800" },
  durationFieldLabelRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 36,
    marginBottom: 8,
  },
  durationFieldLabel: { color: "#9aa1c3", fontSize: 12, fontWeight: "700" },
  tempoSliderRow: { marginBottom: 10 },
  tempoSliderLabel: { color: "#d8daec", marginBottom: 4, fontWeight: "600" },
  tempoSlider: { width: "100%", height: 28 },
  tempoSliderValue: { color: "#fff", fontWeight: "700", textAlign: "right" },
  restCustomRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  restCustomInput: { flex: 1, marginBottom: 0, paddingVertical: 8 },
  restCustomApply: { paddingVertical: 10, paddingHorizontal: 14 },
  metaInput: { marginBottom: 0, paddingVertical: 8 },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  calendarWeekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  calendarWeekdayText: { color: "#9aa1c3", width: 34, textAlign: "center", fontWeight: "700" },
  calendarDayButton: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDayOutside: { opacity: 0.45 },
  calendarDaySelected: { backgroundColor: "#7b61ff" },
  calendarDayText: { color: "#cdd0e0", fontWeight: "600" },
  calendarDayTextOutside: { color: "#7d84a8" },
  calendarDayTextSelected: { color: "#fff", fontWeight: "700" },
  setHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    marginBottom: 2,
  },
  setHeaderRowTablet: { gap: 10 },
  // Mirrors WorkoutSetListView.kt: 4px row inset, 24px set marker, 40px touch column,
  // 84px last-set column, then a 6px inset before each editable field.
  nativeSetHeaderRow: { gap: 0, paddingHorizontal: 4 },
  setHeaderText: { color: "#9aa1c3", fontSize: 12, fontWeight: "700" },
  setHeaderSet: { width: 24, textAlign: "center" },
  setHeaderCheck: { width: 24, textAlign: "center" },
  nativeSetHeaderCheck: { width: 40, marginRight: 2 },
  setHeaderLast: { width: 84 },
  nativeSetHeaderLast: { marginLeft: 2 },
  setHeaderInputsGroup: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  nativeSetHeaderInputsGroup: { gap: 0 },
  nativeSetHeaderInput: { marginLeft: 6 },
  setColWeight: { flex: 1, textAlign: "center" },
  setColReps: { flex: 1, textAlign: "center" },
  setColRpe: { flex: 0.8, textAlign: "center" },
  setInlineRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  setInlineRowTablet: { gap: 10, width: "100%" },
  setLabelButton: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  setLabel: { color: "#cdd0e0", fontWeight: "700", fontSize: 13, width: 24, textAlign: "center" },
  setLabelTablet: { width: 28, fontSize: 15 },
  lastSetText: { width: 84, color: "#aab0cc", fontSize: 11, lineHeight: 14 },
  cardioTapValue: { color: "#fff", textAlign: "center", fontWeight: "700" },
  cardioMetaRow: { marginTop: 8 },
  cardioMetaLabel: { color: "#9aa1c3", fontSize: 12, fontWeight: "700", marginBottom: 6 },
  distanceUnitSuffix: { color: "#cdd0e0", fontSize: 16, fontWeight: "700", marginLeft: 4 },
  setInputsGroup: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  setInputsGroupTablet: { flex: 1 },
  setInput: { marginBottom: 0, paddingVertical: 10, minHeight: 40 },
  setInputCompact: { fontSize: 15, paddingHorizontal: 8, textAlign: "center" },
  setInputTablet: { flex: undefined, width: undefined, minWidth: undefined },
  setInputReps: { marginRight: 0 },
  setInputRepsTablet: { marginRight: 0 },
  checkboxInline: { paddingRight: 2 },
  checkboxHitbox: {
    minWidth: 34,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#cdd0e0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  checkboxChecked: {
    backgroundColor: "#7b61ff",
    borderColor: "#7b61ff",
  },
  inlineUndoBanner: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(123,97,255,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(123,97,255,0.35)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  inlineUndoBannerText: { color: "#e8e7ff", fontSize: 13, fontWeight: "600", flex: 1 },
  inlineUndoBannerAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(123,97,255,0.22)",
  },
  inlineUndoBannerActionText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  replacementEmptyText: { color: "#9aa1c3", fontSize: 13, lineHeight: 19, paddingVertical: 12 },
  pickerCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 8,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  pickerRow: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pickerRowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  pickerText: { color: "#fff", fontWeight: "600" },
  exercisePickerLoading: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  customRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  miniButton: {
    backgroundColor: "#7b61ff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  miniButtonText: { color: "#fff", fontWeight: "700" },
  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  routineActionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  routineActionButton: { flex: 1 },
  routineBuilderBanner: {
    marginTop: 10,
    borderRadius: 12,
    padding: 10,
    backgroundColor: "rgba(123,97,255,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(123,97,255,0.45)",
    gap: 4,
  },
  feedbackBanner: {
    marginTop: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(166,227,161,0.16)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(166,227,161,0.45)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  feedbackBannerText: { color: "#d7f5d3", fontSize: 12, fontWeight: "700", flex: 1 },
  feedbackBannerAction: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  feedbackBannerActionText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  recommendationCard: {
    backgroundColor: "rgba(123,97,255,0.12)",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(123,97,255,0.4)",
    gap: 4,
  },
  recommendationLine: { color: "#d8daec", fontSize: 12, lineHeight: 18 },
  routineCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  routineCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routineUseButton: {
    backgroundColor: "#7b61ff",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  toggleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  toggleChipActive: {
    backgroundColor: "#7b61ff",
    borderColor: "#7b61ff",
  },
  toggleText: { color: "#d8daec", fontWeight: "700" },
  toggleTextActive: { color: "#0d0d1a" },
  groupChips: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  groupChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  groupChipActive: {
    backgroundColor: "#7b61ff",
    borderColor: "#7b61ff",
  },
  groupChipText: { color: "#d8daec", fontWeight: "700" },
  groupChipTextActive: { color: "#0d0d1a" },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  setContainer: { marginBottom: 6 },
  swipeDeleteContainer: {
    justifyContent: "center",
    alignItems: "flex-end",
    marginBottom: 6,
    width: 96,
  },
  swipeDeleteButton: {
    backgroundColor: "rgba(248,113,113,0.95)",
    borderRadius: 10,
    width: 88,
    height: 42,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  swipeDeleteText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  iconButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  setActionsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  setActionButton: { flex: 1, marginTop: 0 },
  sessionMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  phaseRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  phaseLink: { paddingHorizontal: 6, paddingVertical: 2 },
  phaseLinkText: { color: "#7b61ff", fontWeight: "700" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: "#111427",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 8 },
  modalText: { color: "#d8daec", marginBottom: 4 },
  exerciseOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  exerciseOptionUnits: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  exerciseUnitChip: { paddingVertical: 6, paddingHorizontal: 10 },
  exerciseOptionText: { color: "#d8daec", fontWeight: "700", fontSize: 14 },
  demoImageRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  demoImage: { width: "48%", aspectRatio: 1, borderRadius: 10 },
  modalErrorText: { color: "#ff9a9a", marginBottom: 8, fontWeight: "600" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  modalActionButton: { flex: 1 },
  modalPrimaryButton: { marginTop: 0, paddingVertical: 12 },
  dangerButton: {
    backgroundColor: "rgba(248,113,113,0.9)",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  answerRow: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  answerChip: {
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  answerChipActive: { backgroundColor: "#7b61ff", borderColor: "#7b61ff" },
  answerText: { color: "#d8daec", fontWeight: "700", fontSize: 12 },
  answerTextActive: { color: "#0d0d1a" },
  baselineBanner: {
    backgroundColor: "rgba(123,97,255,0.12)",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(123,97,255,0.4)",
  },
  baselineText: { color: "#fff", fontWeight: "700" },
  baselineSub: { color: "#c9cde4", marginTop: 4 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    backgroundColor: "#111427",
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
});

