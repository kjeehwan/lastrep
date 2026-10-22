import { Play, Clock3, Gauge, Check } from "lucide-react-native";
import { NotebookHeader } from "../../../src/ui/notebook/NotebookHeader";
import { notebookRowHeight } from "../../../src/ui/notebook/tokens";
import { useNumberEntry } from "../../../src/ui/notebook/useNumberEntry";
import { lastResistanceSet } from "../../../src/workouts/workoutLog/setPresentation";
import { useNotebook, useNotebookStyles, notebookSheet } from "../../../src/ui/notebook/Notebook";
import { notebookFonts, type NotebookColors } from "../../../src/ui/notebook/tokens";
import { useEventCallbacks } from "../../../src/hooks/useEventCallbacks";
import { useInputVisibility } from "../../../src/ui/useInputVisibility";
import { KeyboardAwareModalFrame } from "../../../src/ui/KeyboardAwareModalFrame";
import { Ionicons } from "@expo/vector-icons";
import { useNow } from "../../../src/hooks/useNow";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer } from "expo-audio";
import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  Keyboard,
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
import { AdaptiveModalCard } from "../../../src/ui/AdaptiveModalCard";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { db } from "../../../src/config/firebaseConfig";
import WorkoutGestureTextInput from "../../../src/components/WorkoutGestureTextInput";
import type { Decision, LastResultPayload } from "../../../src/types/decision";
import { safeParseDecisionOutput } from "../../../src/services/decision/decisionValidation";
import { AvailableWeightsModal } from "../../../src/workouts/workoutLog/AvailableWeightsModal";
import { useAvailableWeights } from "../../../src/workouts/workoutLog/useAvailableWeights";
import { weightPreferenceKey } from "../../../src/workouts/availableWeights";
import { workoutGuidanceSignature, withAvailableWeights } from "../../../src/services/decision/workoutGuidance";
import { applyTodayPlanToWorkoutDraft } from "../../../src/services/decision/todayPlanDraft";
import { parseWorkoutDraftPlan, getDailyContextSummary } from "../../../src/services/decision/todayPlanContext";
import { TodayPlanContextModal } from "../../../src/services/decision/TodayPlanContextModal";
import { useWorkoutTodayPlan } from "../../../src/workouts/workoutLog/useWorkoutTodayPlan";
import { WorkoutTodayPlan } from "../../../src/workouts/workoutLog/WorkoutTodayPlan";
import { showAppAlert, showAppDialog } from "../../../src/ui/appDialog";
import { isExpectedOfflineError } from "../../../src/utils/networkErrors";
import { scheduleAfterInteractions } from "../../../src/utils/scheduleAfterInteractions";
import { scheduleAfterPaint } from "../../../src/utils/scheduleAfterPaint";
import { popPendingExerciseSelection } from "../../../src/workouts/addExerciseBridge";
import { getExerciseSubstitutions, indexExerciseSearch, replacementSearchOptions } from "../../../src/workouts/exerciseSearch";
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
  pickTemplate,
  resolveRecommendationTargets,
  type WorkoutLike,
} from "../../../src/workouts/recommendationHeuristics";
import {
  recommendExerciseProgression,
  type ExercisePerformanceSession,
  type ProgressionPhase,
} from "../../../src/workouts/exerciseProgression";
import { buildExerciseProgressInsights } from "../../../src/workouts/exerciseProgressInsights";
import { selectRecommendedExercises } from "../../../src/workouts/recommendationExerciseSelection";
import { getCalendarMatrix } from "../../../src/workouts/homeInsights";
import { useWorkoutDraftPersistence } from "../../../src/workouts/workoutLog/useWorkoutDraftPersistence";
import { useWorkoutElapsedTimer } from "../../../src/workouts/workoutLog/useWorkoutElapsedTimer";
import { serializeWorkoutDraft } from "../../../src/workouts/workoutLog/workoutDraft";
import { WorkoutModalShell } from "../../../src/workouts/workoutLog/WorkoutModalShell";
import { WorkoutRecommendationSection } from "../../../src/workouts/workoutLog/WorkoutRecommendationSection";
import { NotebookModal as Modal } from "../../../src/ui/notebook/NotebookModal";
import { WorkoutSessionCard } from "../../../src/workouts/workoutLog/WorkoutSessionCard";
import { WorkoutNativeSetRows } from "../../../src/workouts/workoutLog/WorkoutNativeSetRows";
import { ExerciseProgressSummary } from "../../../src/workouts/workoutLog/ExerciseProgressSummary";
import { effortInputValue, effortLabel, effortToRpe, formatEffort, isValidWorkoutEffort, resolveEffortScale, type EffortInput, type EffortScale } from "../../../src/workouts/effortScale";
import { advanceRest, nextRestDeadlineDelay, pauseRest, startRest, type RestClock } from "../../../src/workouts/workoutLog/timerClock";
import { RestTimerText } from "../../../src/workouts/workoutLog/TimerText";
import { freshSetEffort } from "../../../src/workouts/workoutLog/freshSetEffort";
import { applyCardioZone, resolveCardioZone, toggleCardioChoice } from "../../../src/workouts/workoutLog/cardioZone";

type Unit = "kg" | "lbs" | "km" | "mi";
type SetType = "warmup" | "normal" | "failure" | "drop";
type ExerciseMode = "resistance" | "cardio";
type RecommendationFocusId =
  | "auto"
  | "chest"
  | "chest-triceps"
  | "back"
  | "back-biceps"
  | "legs"
  | "anterior-legs"
  | "posterior-legs"
  | "shoulders"
  | "shoulders-arms"
  | "arms"
  | "push"
  | "pull";
type RecommendationLengthId = "quick" | "standard" | "extended";
type SetEntry = {
  weightKg: number | null;
  // Preserve partially typed decimals such as "20." until the user finishes the value.
  weightText?: string;
  reps: string;
  rpe?: string;
  effortInput?: EffortInput;
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
const RECOMMENDATION_LENGTH_KEY_PREFIX = "workout-recommendation-length-v1";
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
const RECOMMENDATION_FOCUSES: {
  id: RecommendationFocusId;
  label: string;
  template?: { name: string; primaryGroup: string; exercises: string[] };
}[] = [
  { id: "auto", label: "Auto" },
  {
    id: "chest",
    label: "Chest",
    template: { name: "Chest", primaryGroup: "chest", exercises: ["Bench Press", "Incline Dumbbell Press", "Cable Fly"] },
  },
  {
    id: "chest-triceps",
    label: "Chest + Triceps",
    template: { name: "Chest + Triceps", primaryGroup: "chest", exercises: ["Bench Press", "Incline Dumbbell Press", "Tricep Pushdown"] },
  },
  {
    id: "back",
    label: "Back",
    template: { name: "Back", primaryGroup: "back", exercises: ["Barbell Row", "Lat Pulldown", "Seated Cable Row"] },
  },
  {
    id: "back-biceps",
    label: "Back + Biceps",
    template: { name: "Back + Biceps", primaryGroup: "back", exercises: ["Barbell Row", "Lat Pulldown", "Bicep Curl"] },
  },
  {
    id: "legs",
    label: "Legs",
    template: { name: "Legs", primaryGroup: "legs", exercises: ["Squat", "Romanian Deadlift", "Leg Press"] },
  },
  {
    id: "anterior-legs",
    label: "Anterior Legs",
    template: { name: "Anterior Legs", primaryGroup: "legs", exercises: ["Squat", "Leg Press", "Leg Extension"] },
  },
  {
    id: "posterior-legs",
    label: "Posterior Legs",
    template: { name: "Posterior Legs", primaryGroup: "legs", exercises: ["Romanian Deadlift", "Leg Curl", "Hip Thrust"] },
  },
  {
    id: "shoulders",
    label: "Shoulders",
    template: { name: "Shoulders", primaryGroup: "shoulders", exercises: ["Overhead Press", "Lateral Raise", "Rear Delt Fly"] },
  },
  {
    id: "shoulders-arms",
    label: "Shoulders + Arms",
    template: { name: "Shoulders + Arms", primaryGroup: "shoulders", exercises: ["Overhead Press", "Lateral Raise", "Bicep Curl", "Tricep Pushdown"] },
  },
  {
    id: "arms",
    label: "Arms",
    template: { name: "Arms", primaryGroup: "arms", exercises: ["Bicep Curl", "Tricep Pushdown", "Skullcrusher"] },
  },
  {
    id: "push",
    label: "Push",
    template: { name: "Push", primaryGroup: "chest", exercises: ["Bench Press", "Overhead Press", "Tricep Pushdown"] },
  },
  {
    id: "pull",
    label: "Pull",
    template: { name: "Pull", primaryGroup: "back", exercises: ["Barbell Row", "Lat Pulldown", "Bicep Curl"] },
  },
];
const RECOMMENDATION_LENGTHS: {
  id: RecommendationLengthId;
  title: string;
  detail: string;
  exerciseCount: number;
  targetHardSets: number;
}[] = [
  { id: "quick", title: "Quick", detail: "30-40 min | 8-10 hard sets", exerciseCount: 3, targetHardSets: 9 },
  { id: "standard", title: "Standard", detail: "45-60 min | 12-16 hard sets", exerciseCount: 4, targetHardSets: 14 },
  { id: "extended", title: "Extended", detail: "60-75 min | 16-20 hard sets", exerciseCount: 5, targetHardSets: 18 },
];
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

const formatWeightInput = (weightKg: number | null, targetUnit: Unit) => {
  if (weightKg === null || Number.isNaN(weightKg)) return "";
  const val = targetUnit === "kg" ? weightKg : weightKg * 2.20462;
  return `${Math.round(val * 10) / 10}`;
};

const normalizeExerciseName = (value: string) => value.trim().toLowerCase();
function indexPreviousExerciseSets(pastWorkouts: PastWorkout[]) {
  const map = new Map<string, PastWorkout["exercises"][number]["sets"]>();
  for (const workout of pastWorkouts) {
    for (const exercise of workout.exercises) {
      const key = normalizeExerciseName(exercise.name);
      if (!key || map.has(key)) continue;
      map.set(key, exercise.sets ?? []);
    }
  }
  return map;
}

const getSetTypeMarker = (set: SetEntry, index: number) => {
  const type = toSetType(set.setType);
  if (type === "warmup") return "W";
  if (type === "failure") return "F";
  if (type === "drop") return "D";
  return `${index + 1}`;
};

const formatDistanceInput = (distanceKm: number | null, unit: Unit) => {
  if (distanceKm == null || Number.isNaN(distanceKm)) return "";
  const value = unit === "mi" ? distanceKm / 1.60934 : distanceKm;
  return `${Math.round(value * 100) / 100}`;
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

const imageLookupKey = (exerciseName: string) => exerciseName.trim().toLowerCase();

export default function WorkoutLog() {
  const { colors } = useNotebook();
  const styles = useNotebookStyles(createStyles);
  const router = useRouter();

  const isFocused = useIsFocused();
  const guidanceNowMs = useNow(60_000, isFocused);
  const { width, height, fontScale } = useWindowDimensions();
  const { scrollRef: noteScrollRef, onInputFocus: revealNote, onLayout: revealNoteOnLayout, onScroll: trackNoteScroll } = useInputVisibility();
  const [showSetup, setShowSetup] = useState(false);
  const [showSetTypeHelp, setShowSetTypeHelp] = useState(false);
  const [editingSet, setEditingSet] = useState<string | null>(null);
  const distanceWholeRef = useRef<TextInput>(null);
  const distanceDecimalRef = useRef<TextInput>(null);
  const distanceWholeEntry = useNumberEntry(distanceWholeRef);
  const distanceDecimalEntry = useNumberEntry(distanceDecimalRef);
  const insets = useSafeAreaInsets();
  const isTabletLayout = Math.min(width, height) >= 600;
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [effortScale, setEffortScale] = useState<EffortScale>("rpe");
  const [exerciseUnits, setExerciseUnits] = useState<Record<string, Unit>>({});
  const [favoriteExercises, setFavoriteExercises] = useState<string[]>([]);
  const [favoritesHydratedUid, setFavoritesHydratedUid] = useState<string | null>(null);
  const [freeDbCatalog, setFreeDbCatalog] = useState<ExerciseCatalogItem[]>([]);
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null);
  const [replaceSearch, setReplaceSearch] = useState("");
  const [replaceGroup, setReplaceGroup] = useState<string>("all");
  const [recommendationFocus, setRecommendationFocus] = useState<RecommendationFocusId>("auto");
  const [showExerciseDemo, setShowExerciseDemo] = useState(false);
  const [activeDemoExercise, setActiveDemoExercise] = useState<ExerciseCatalogItem | null>(null);
  const [activeDemoImageUris, setActiveDemoImageUris] = useState<string[]>([]);
  const [exerciseImageMap, setExerciseImageMap] = useState<Record<string, string[]>>({});
  const [showExerciseActionsModal, setShowExerciseActionsModal] = useState(false);
  const [activeExerciseActionId, setActiveExerciseActionId] = useState<string | null>(null);
  const [availableWeightsTarget, setAvailableWeightsTarget] = useState<{ name: string; unit: "kg" | "lbs" } | null>(null);
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
    Record<string, RestClock>
  >({});
  const [saving, setSaving] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const {
    elapsedSeconds,
    getElapsedSeconds,
    running: workoutTimerRunning,
    startedAtMs: workoutTimerStartedAtMs,
    restore: restoreElapsedTimer,
    start: startElapsedTimer,
    pause: pauseElapsedTimer,
    setDuration: setElapsedDuration,
    reset: resetElapsedTimer,
  } = useWorkoutElapsedTimer(0, false, isFocused, null);
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
  const previousExerciseSetsByName = useMemo(() => indexPreviousExerciseSets(pastWorkouts), [pastWorkouts]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [showMyRoutinesModal, setShowMyRoutinesModal] = useState(false);
  const [showRoutineNameModal, setShowRoutineNameModal] = useState(false);
  const [showRoutineStartModal, setShowRoutineStartModal] = useState(false);
  const [showRoutineActionsModal, setShowRoutineActionsModal] = useState(false);
  const [showRoutineDeleteModal, setShowRoutineDeleteModal] = useState(false);
  const [showDeloadConfirmModal, setShowDeloadConfirmModal] = useState(false);
  const [showExerciseHistoryModal, setShowExerciseHistoryModal] = useState(false);
  const [historyExerciseName, setHistoryExerciseName] = useState<string | null>(null);
  const [showWorkoutSavedModal, setShowWorkoutSavedModal] = useState(false);
  const [showRoutineUpdateAfterFinishModal, setShowRoutineUpdateAfterFinishModal] = useState(false);
  const [showRoutineUpdatedConfirmationModal, setShowRoutineUpdatedConfirmationModal] = useState(false);
  const [completedRoutineId, setCompletedRoutineId] = useState<string | null>(null);
  const [completedRoutineSnapshot, setCompletedRoutineSnapshot] = useState<Exercise[] | null>(null);
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
  const [showWorkoutLengthModal, setShowWorkoutLengthModal] = useState(false);
  const [recommendationLength, setRecommendationLength] = useState<RecommendationLengthId>("standard");
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
  const [appliedGuidance, setAppliedGuidance] = useState<{
    plan: LastResultPayload;
    before: Exercise[];
    after: Exercise[];
    signature: string;
  } | null>(null);
  const [activeSetMenu, setActiveSetMenu] = useState<{
    exerciseId: string;
    setIndex: number;
  } | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const routerParams = useLocalSearchParams<{
    trainingPhase?: string;
    createRoutine?: string;
    todayPlanApplied?: string;
    showTodayGuidance?: string;
  }>();
  const auth = getAuth();
  const [activeUid, setActiveUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const draftHydratedRef = useRef(false);
  const scrollNativeGesture = useMemo(() => Gesture.Native(), []);
  const draftSavedAtRef = useRef<Date | null>(null);
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
  const appliedRestPreferencesRef = useRef<Record<string, number>>({});
  const getDraftKey = useCallback((uid: string) => `${DRAFT_KEY_PREFIX}:${uid}`, []);
  const workoutDraftPayload = useMemo(
    () => ({
      exercises,
      exerciseUnits,
      sessionTitle,
      sessionDateText,
      elapsedSeconds,
      workoutTimerRunning,
      workoutTimerStartedAtMs,
      restTimerByExercise,
    }),
    [exercises, exerciseUnits, sessionTitle, sessionDateText, elapsedSeconds, workoutTimerRunning, workoutTimerStartedAtMs, restTimerByExercise]
  );
  const availableWeightsPreferences = useAvailableWeights(activeUid);
  // Guidance depends on prescriptions, not per-second timer display updates.
  const guidanceWorkout = useMemo(() => withAvailableWeights(parseWorkoutDraftPlan(JSON.stringify({
    exercises, sessionTitle, sessionDateText, draftSavedAt: guidanceNowMs,
  }), new Date(guidanceNowMs)), availableWeightsPreferences.values) ?? {
    source: "none" as const, title: null, exerciseNames: [],
  }, [exercises, sessionTitle, sessionDateText, guidanceNowMs, availableWeightsPreferences.values]);
  const todayPlan = useWorkoutTodayPlan(activeUid, guidanceWorkout);
  const todayGuidance = todayPlan.plan;
  const showTodayGuidance = todayPlan.visible;
  const setShowTodayGuidance = todayPlan.setVisible;
  const resetGuidance = todayPlan.reset;

  const workoutDraftStorageKey = auth.currentUser?.uid ? getDraftKey(auth.currentUser.uid) : null;
  const markWorkoutDraftSaved = useCallback(() => {
    draftSavedAtRef.current = new Date();
  }, []);
  const canPersistWorkoutDraft = useCallback(() => draftHydratedRef.current, []);
  useWorkoutDraftPersistence({
    draft: workoutDraftPayload,
    storageKey: workoutDraftStorageKey,
    canPersist: canPersistWorkoutDraft,
    onSaved: markWorkoutDraftSaved,
    serialize: serializeWorkoutDraft,
  });
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
      draftHydratedRef.current = false;
      restTimerSnapshotRef.current = {};
      setActiveUid(user?.uid ?? null);
      setEffortScale("rpe");
      appliedRestPreferencesRef.current = {};
      setAppliedGuidance(null);
      resetGuidance();
      setAvailableWeightsTarget(null);
    });
    return unsubscribe;
  }, [auth, resetGuidance]);

  useEffect(() => {
    if (!activeUid) return;
    return onSnapshot(doc(db, "users", activeUid), (snapshot) => {
      setEffortScale(resolveEffortScale(snapshot.data()?.effortScale));
    }, (error) => {
      if (!isExpectedOfflineError(error)) console.log("Failed to load exercise effort preference", error);
    });
  }, [activeUid]);

  useEffect(() => {
    let cancelled = false;
    if (!activeUid) {
      Promise.resolve().then(() => {
        if (!cancelled) setRecommendationLength("standard");
      });
      return () => {
        cancelled = true;
      };
    }

    AsyncStorage.getItem(`${RECOMMENDATION_LENGTH_KEY_PREFIX}:${activeUid}`)
      .then((savedLength) => {
        if (!cancelled && RECOMMENDATION_LENGTHS.some((option) => option.id === savedLength)) {
          setRecommendationLength(savedLength as RecommendationLengthId);
        }
      })
      .catch((error) => console.log("Failed to load recommendation length", error));

    return () => {
      cancelled = true;
    };
  }, [activeUid]);

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
  const parseDistanceKm = (raw: string, unit: Unit): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    if (unit === "km") return parsed;
    if (unit === "mi") return parsed * 1.60934;
    return parsed;
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


  const getSavedRestPreference = useCallback(
    (exerciseName: string) => {
      const key = exerciseName.trim().toLowerCase();
      return restPreferenceByName[key] ?? 90;
    },
    [restPreferenceByName]
  );

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

  const buildExerciseDraft = useCallback(
    (name: string, id: string): Exercise => {
      const trimmed = name.trim();
      const mode = getExerciseModeByName(trimmed);
      const previousSets =
        pastWorkouts
          .flatMap((workout) => workout.exercises)
          .find((exercise) => normalizeExerciseName(exercise.name) === normalizeExerciseName(trimmed))?.sets ?? [];
      const sets = previousSets.length
        ? previousSets.map((set) => ({
            weightKg: mode === "cardio" ? null : set.weightKg ?? null,
            reps: mode === "cardio" ? "" : String(set.reps ?? ""),
            ...freshSetEffort(),
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
        tempo: mode === "cardio" ? String(previousSets.find((set) => set.zone)?.zone || "") : undefined,
        cardioSessionType: undefined,
        cardioEffortLevel: undefined,
        sets,
      };
    },
    [getExerciseModeByName, pastWorkouts]
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
        return [...prev, buildExerciseDraft(trimmed, id)];
      });
      // default to kg for resistance and km for cardio
      setExerciseUnits((prev) => ({ ...prev, [id]: mode === "cardio" ? "km" : "kg" }));
      setRestPreferenceByExercise((prev) => ({ ...prev, [id]: restSeconds }));
      setRestCustomInputByExercise((prev) => ({ ...prev, [id]: "" }));
      setRestTimerByExercise((prev) => ({ ...prev, [id]: { remainingSec: restSeconds, running: false } }));
    },
    [buildExerciseDraft, getExerciseModeByName, getSavedRestPreference]
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

  const catalogByName = useMemo(() => new Map(mergedCatalog.map((item) => [
    item.name.trim().toLowerCase(), item,
  ])), [mergedCatalog]);

  const findCatalogExercise = useCallback(
    (name: string) => catalogByName.get(name.trim().toLowerCase()) ?? null,
    [catalogByName]
  );
  const getExerciseMode = useCallback(
    (exerciseName: string): ExerciseMode =>
      findCatalogExercise(exerciseName)?.group === "cardio" ? "cardio" : "resistance",
    [findCatalogExercise]
  );
  const getExerciseZone = useCallback((exercise: Exercise) => {
    return resolveCardioZone(exercise);
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
      const effort = formatEffort(set.rpe, effortScale);
      if (set.weightKg == null || set.weightKg <= 0) {
        return `${reps} reps${effort}`;
      }
      return `${weight} kg x ${reps}${effort}`;
    },
    [effortScale]
  );

  const exerciseSearchIndex = useMemo(() => indexExerciseSearch(mergedCatalog), [mergedCatalog]);

  const getSubstitutionCandidates = useCallback(
    (exerciseName: string, limit = 16) => {
      const target = findCatalogExercise(exerciseName);
      if (!target) return [];
      return getExerciseSubstitutions(mergedCatalog, target, limit);
    },
    [findCatalogExercise, mergedCatalog]
  );

  const replacementOptions = useMemo(() => {
    if (!replaceTarget) return [];
    const target = exercises.find((exercise) => exercise.id === replaceTarget);
    if (!target) return [];
    return replacementSearchOptions({
      index: exerciseSearchIndex,
      query: replaceSearch,
      group: replaceGroup === "all" ? "all" : (replaceGroup as ExerciseGroupKey),
      targetName: target.name,
      targetGroup: findCatalogExercise(target.name)?.group,
      suggestions: replaceSearch.trim() ? [] : getSubstitutionCandidates(target.name, Number.POSITIVE_INFINITY),
    });
  }, [replaceGroup, replaceSearch, replaceTarget, exercises, findCatalogExercise, getSubstitutionCandidates, exerciseSearchIndex]);

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
      if (auth.currentUser?.uid !== user.uid) return;
      if (!snap.exists()) { setLatestDecision(null); return; }
      const data: any = snap.data();
      const last = data?.usage?.decisions?.lastResult;
      const result = safeParseDecisionOutput(last?.result);
      if (result.success && last?.inputs && last?.createdAt instanceof Timestamp) {
        setLatestDecision({ decision: result.data.decision, adjustments: result.data.adjustments });
      } else {
        setLatestDecision(null);
      }
    } catch (e) {
      if (!isExpectedOfflineError(e)) {
        console.log("Failed to load latest decision", e);
      }
    }
  }, [auth]);

  useEffect(() => {
    draftHydratedRef.current = false;
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
          setElapsedDuration(0);
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
                    effortInput: set?.effortInput?.scale === "rpe" || set?.effortInput?.scale === "rir"
                      ? { scale: set.effortInput.scale, value: String(set.effortInput.value ?? ""), canonicalRpe: String(set.effortInput.canonicalRpe ?? "") }
                      : undefined,
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
            const initialRestTimers: Record<string, RestClock> = {};
            hydratedExercises.forEach((exercise: Exercise) => {
              initialRestPrefs[exercise.id] = 90;
              initialRestTimers[exercise.id] = { remainingSec: 90, running: false };
              const saved = parsed.restTimerByExercise?.[exercise.id];
              if (saved && typeof saved.remainingSec === "number" && Number.isFinite(saved.remainingSec) && saved.remainingSec >= 0 && saved.remainingSec <= 900) {
                const endsAtMs = typeof saved.endsAtMs === "number" && Number.isFinite(saved.endsAtMs) ? saved.endsAtMs : undefined;
                initialRestTimers[exercise.id] = advanceRest({ remainingSec: saved.remainingSec, running: saved.running === true && endsAtMs != null, endsAtMs }, Date.now());
              }
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
          restoreElapsedTimer(
            typeof parsed.elapsedSeconds === "number" && Number.isFinite(parsed.elapsedSeconds)
              ? Math.max(0, Math.round(parsed.elapsedSeconds))
              : 0,
            parsed.workoutTimerRunning === true && typeof parsed.workoutTimerStartedAtMs === "number" && Number.isFinite(parsed.workoutTimerStartedAtMs) && parsed.workoutTimerStartedAtMs <= Date.now()
              ? parsed.workoutTimerStartedAtMs : null
          );
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
      } finally {
        draftHydratedRef.current = true;
      }
    };
    let active = true;
    startupLoadTaskRef.current?.cancel();
    startupLoadTaskRef.current = scheduleAfterInteractions(async () => {
      await loadDraft();
      if (!active) return;
      startupLoadTaskRef.current = scheduleAfterPaint(async () => {
        await Promise.allSettled([loadPastWorkouts(), loadRoutines()]);
      });
    });
    return () => {
      active = false;
      startupLoadTaskRef.current?.cancel();
    };
  }, [
    auth.currentUser,
    loadPastWorkouts,
    loadRoutines,
    auth,
    getDraftKey,
    setElapsedDuration,
    restoreElapsedTimer,
    routerParams.todayPlanApplied,
  ]);

  useEffect(() => {
    if (!routerParams.trainingPhase) return;
    const task = scheduleAfterInteractions(() => {
      setSessionPhase(String(routerParams.trainingPhase));
    });
    return () => task.cancel();
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

  const pendingSelectionActions = useEventCallbacks({ addExercise });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        handleGoBack();
        return true;
      });
      focusHydrationTaskRef.current?.cancel();
      focusHydrationTaskRef.current = scheduleAfterInteractions(async () => {
        const pendingExerciseNames = await popPendingExerciseSelection(activeUid);
        if (!active || pendingExerciseNames.length === 0) return;
        pendingExerciseNames.forEach(pendingSelectionActions.addExercise);
        setUiFeedback(
          pendingExerciseNames.length === 1
            ? `Added ${pendingExerciseNames[0]}.`
            : `Added ${pendingExerciseNames.length} exercises.`
        );
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
      const decisionReadTask = scheduleAfterPaint(loadLatestDecision);
      const shouldHydrateFocus = Date.now() - lastFocusHydrationAtRef.current >= 30_000;
      if (shouldHydrateFocus) {
        focusRefreshTaskRef.current?.cancel();
        focusRefreshTaskRef.current = scheduleAfterInteractions(async () => {
          lastFocusHydrationAtRef.current = Date.now();
          await loadFavoriteExercises();
        });
      }
      return () => {
        active = false;
        decisionReadTask.cancel();
        focusHydrationTaskRef.current?.cancel();
        focusRefreshTaskRef.current?.cancel();
        subscription.remove();
      };
    }, [loadLatestDecision, loadFavoriteExercises, pendingSelectionActions, activeUid, handleGoBack, sessionDateText])
  );

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
      const task = scheduleAfterInteractions(() => {
        setRestPreferenceByName({});
        setRestPrefsHydratedUid(null);
      });
      return () => task.cancel();
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
    const task = scheduleAfterInteractions(() => {
    const previousPreferences = appliedRestPreferencesRef.current;
    appliedRestPreferencesRef.current = Object.fromEntries(exercises.map((exercise) => [exercise.id, restPreferenceByName[exercise.name.trim().toLowerCase()] ?? 90]));
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
        // Editing a set must not reset a paused or completed rest countdown.
        if (!current.running && previousPreferences[exercise.id] != null && previousPreferences[exercise.id] !== restSeconds) {
          next[exercise.id] = { remainingSec: restSeconds, running: false };
        }
      });
      return next;
    });
    });
    return () => task.cancel();
  }, [exercises, restPreferenceByName]);

  useEffect(() => {
    const delay = nextRestDeadlineDelay(restTimerByExercise, Date.now());
    if (delay === null) return;
    const refresh = () => {
      setRestTimerByExercise((prev) => {
        let mutated = false;
        const next: typeof prev = {};
        Object.entries(prev).forEach(([exerciseId, timer]) => {
          if (!timer.running) {
            next[exerciseId] = timer;
            return;
          }
          const updated = advanceRest(timer, Date.now());
          if (updated !== timer) mutated = true;
          next[exerciseId] = updated;
        });
        return mutated ? next : prev;
      });
    };
    const deadline = setTimeout(refresh, delay);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => { clearTimeout(deadline); subscription.remove(); };
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
      const task = scheduleAfterInteractions(() => {
        setShowRestTimerModal(false);
        setActiveRestTimerExerciseId(null);
      });
      return () => task.cancel();
    }
  }, [activeRestTimerExerciseId, exercises]);

  useEffect(() => {
    if (!activeExerciseActionId) return;
    const exists = exercises.some((exercise) => exercise.id === activeExerciseActionId);
    if (!exists) {
      const task = scheduleAfterInteractions(() => {
        setShowExerciseActionsModal(false);
        setActiveExerciseActionId(null);
      });
      return () => task.cancel();
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
                  zone: getExerciseMode(ex.name) === "cardio" ? getExerciseZone(ex) : "",
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
    if (lastSetToggleAtRef.current[toggleKey]) return;
    lastSetToggleAtRef.current[toggleKey] = 1;
    setTimeout(() => {
      delete lastSetToggleAtRef.current[toggleKey];
    }, 120);

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
                    : { ...s, rpe: effortToRpe(value, effortScale), effortInput: { scale: effortScale, value, canonicalRpe: effortToRpe(value, effortScale) } }
                  : s
              ),
            }
          : ex
      )
    );
  };

  const copyLastSetToCurrent = (exerciseId: string, setIndex: number) => {
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;
    const previousSets = previousExerciseSetsByName.get(normalizeExerciseName(exercise.name)) ?? [];
    const previous = previousSets[setIndex];
    if (!previous) {
      setUiFeedback("No previous set is available to copy.");
      return;
    }
    const mode = getExerciseMode(exercise.name);
    setExercises((prev) =>
      prev.map((item) =>
        item.id !== exerciseId
          ? item
          : {
              ...item,
              sets: item.sets.map((set, index) =>
                index !== setIndex
                  ? set
                  : {
                      ...set,
                      weightKg: mode === "cardio" ? null : previous.weightKg ?? null,
                      weightText: undefined,
                      reps: mode === "cardio" ? "" : String(previous.reps ?? ""),
                      rpe: mode === "cardio" ? "" : String(previous.rpe ?? ""),
                      effortInput: undefined,
                      distanceKm: mode === "cardio" ? previous.distanceKm ?? null : null,
                      durationSec: mode === "cardio" ? previous.durationSec ?? null : null,
                      zone: mode === "cardio" ? String(previous.zone ?? "") : "",
                      baselineWeightKg: mode === "cardio" ? null : previous.weightKg ?? null,
                      baselineReps: mode === "cardio" ? "" : String(previous.reps ?? ""),
                    }
              ),
            }
      )
    );
    setUiFeedback("Copied the previous set.");
  };

  const moveExercise = (exerciseId: string, direction: -1 | 1) => {
    setExercises((prev) => {
      const fromIndex = prev.findIndex((exercise) => exercise.id === exerciseId);
      const toIndex = fromIndex + direction;
      if (fromIndex < 0 || toIndex < 0 || toIndex >= prev.length) return prev;
      const next = [...prev];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
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
    setExercises((prev) => prev.map((ex) => (ex.id === exerciseId ? { ...ex, cardioSessionType: toggleCardioChoice(ex.cardioSessionType, value) } : ex)));
  };
  const updateCardioEffortLevel = (
    exerciseId: string,
    value: "easy" | "moderate" | "hard" | "max"
  ) => {
    setExercises((prev) => prev.map((ex) => (ex.id === exerciseId ? { ...ex, cardioEffortLevel: toggleCardioChoice(ex.cardioEffortLevel, value) } : ex)));
  };
  const openCardioTimeModal = (exerciseId: string, setIndex: number, currentSec: number | null | undefined) => {
    Keyboard.dismiss();
    setEditingSet(`${exerciseId}:${setIndex}`);
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
    Keyboard.dismiss();
    setEditingSet(`${exerciseId}:${setIndex}`);
    distanceWholeEntry.reset();
    distanceDecimalEntry.reset();
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
      return { ...prev, [exerciseId]: startRest(current, fallback, Date.now()) };
    });
  };

  const pauseRestTimer = (exerciseId: string) => {
    setRestTimerByExercise((prev) => {
      const current = prev[exerciseId];
      if (!current) return prev;
      return { ...prev, [exerciseId]: pauseRest(current, Date.now()) };
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
    setShowSetTypeHelp(false);
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
  const openDatePicker = () => {
    const parsed = parseSessionDate(sessionDateText) ?? new Date();
    setDatePickerMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    setShowDatePickerModal(true);
  };
  const openDurationAdjustModal = () => {
    const currentSeconds = getElapsedSeconds();
    if (workoutTimerRunning) {
      pauseElapsedTimer();
    }
    const hours = Math.floor(currentSeconds / 3600);
    const minutes = Math.floor((currentSeconds % 3600) / 60);
    setDurationAdjustHoursText(String(hours).padStart(2, "0"));
    setDurationAdjustMinutesText(String(minutes).padStart(2, "0"));
    setShowDurationModal(true);
  };
  const startWorkoutTimer = () => {
    if (workoutTimerRunning) return;
    startElapsedTimer();
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
    setElapsedDuration(nextSeconds);
    setShowDurationModal(false);
  };
  const resetDurationTimer = () => {
    resetElapsedTimer();
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
    setElapsedDuration(
      typeof workout.durationMin === "number" && Number.isFinite(workout.durationMin)
        ? Math.max(0, Math.round(workout.durationMin * 60))
        : 0
    );
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
    setElapsedDuration(0);
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
        exercise.sets.some((set) => !isValidWorkoutEffort(set.rpe))
      );
      if (invalidRpe) {
        showAppAlert(`Invalid ${effortLabel(effortScale)}`, effortScale === "rir" ? "RIR must be a number between 0 and 4." : "RPE must be a number between 6 and 10.");
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
        durationMin: Math.floor(getElapsedSeconds() / 60),
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
      const appliedRoutineId = lastAppliedRoutineId;
      const routineSnapshot = sanitizedExercises as Exercise[];
      setExercises([]);
      setExerciseUnits({});
      setRestPreferenceByExercise({});
      setRestCustomInputByExercise({});
      setRestTimerByExercise({});
      setSessionTitle("");
      setSessionDateText(toLocalDateKey(new Date()));
      setElapsedDuration(0);
      setRecommendationSummary([]);
      setLastAppliedRoutineId(null);
      setBaselineDate(null);
      AsyncStorage.removeItem(getDraftKey(user.uid)).catch(() => { });
      setShowFinishModal(false);
      setShowFinishTitleInput(false);
      await loadPastWorkouts();
      if (appliedRoutineId) {
        setCompletedRoutineId(appliedRoutineId);
        setCompletedRoutineSnapshot(routineSnapshot);
      }
      setShowWorkoutSavedModal(true);
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

  const buildRoutineExercisesFromEditor = (source: Exercise[] = exercises) =>
    source.map((exercise) => ({
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
    setElapsedDuration(0);
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

  const closeRoutineUpdateAfterFinish = () => {
    setShowWorkoutSavedModal(false);
    setShowRoutineUpdateAfterFinishModal(false);
    setShowRoutineUpdatedConfirmationModal(false);
    setCompletedRoutineId(null);
    setCompletedRoutineSnapshot(null);
    router.replace("/(tabs)/home");
  };

  const continueAfterWorkoutSaved = () => {
    setShowWorkoutSavedModal(false);
    if (completedRoutineId && completedRoutineSnapshot) {
      setShowRoutineUpdateAfterFinishModal(true);
      return;
    }
    router.replace("/(tabs)/home");
  };

  const updateAppliedRoutineAfterFinish = async () => {
    const user = auth.currentUser;
    const routine = completedRoutineId
      ? routines.find((item) => item.id === completedRoutineId)
      : null;
    const snapshot = completedRoutineSnapshot;
    if (!user || !routine || !snapshot) {
      closeRoutineUpdateAfterFinish();
      return;
    }
    try {
      await setDoc(
        doc(db, "users", user.uid, "routines", routine.id),
        { exercises: buildRoutineExercisesFromEditor(snapshot), updatedAt: Timestamp.now() },
        { merge: true }
      );
      await loadRoutines();
      setShowRoutineUpdateAfterFinishModal(false);
      setShowRoutineUpdatedConfirmationModal(true);
    } catch (error) {
      console.log("Failed to update routine after workout", error);
      showAppAlert("Routine not updated", "Your workout was saved, but the routine could not be updated.");
      closeRoutineUpdateAfterFinish();
    }
  };

  const applyRoutineToEditor = (
    routine: Routine,
    mode: "replace" | "append",
    options: { deload?: boolean } = {}
  ) => {
    setRecommendationSummary([]);
    const mapped: Exercise[] = routine.exercises.map((exercise) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const latestSets = previousExerciseSetsByName.get(normalizeExerciseName(exercise.name)) ?? [];
      const sets = latestSets.length
        ? latestSets.map((set) => ({
            weightKg: exercise.mode === "cardio" ? null : set.weightKg ?? null,
            reps: exercise.mode === "cardio" ? "" : String(set.reps ?? ""),
            rpe: "",
            distanceKm: exercise.mode === "cardio" ? set.distanceKm ?? null : null,
            durationSec: exercise.mode === "cardio" ? set.durationSec ?? null : null,
            zone: exercise.mode === "cardio" ? String(set.zone ?? "") : "",
            setType: toSetType(set.setType),
            done: false,
            baselineWeightKg: exercise.mode === "cardio" ? null : set.weightKg ?? null,
            baselineReps: exercise.mode === "cardio" ? "" : String(set.reps ?? ""),
          }))
        : exercise.sets.map((set) => ({
            weightKg: typeof set.defaultWeightKg === "number" ? set.defaultWeightKg : null,
            reps: set.reps,
            rpe: "",
            distanceKm: typeof set.defaultDistanceKm === "number" ? set.defaultDistanceKm : null,
            durationSec: typeof set.defaultDurationSec === "number" ? set.defaultDurationSec : null,
            zone: set.defaultZone ?? "",
            setType: toSetType(set.setType),
            done: false,
            baselineWeightKg: typeof set.defaultWeightKg === "number" ? set.defaultWeightKg : null,
            baselineReps: set.reps,
          }));
      return {
        id,
        name: exercise.name,
        notes: exercise.notes ?? "",
        tempo: (exercise.mode === "cardio" ? exercise.zone : exercise.tempo) ?? "",
        cardioSessionType: exercise.cardioSessionType,
        cardioEffortLevel: exercise.cardioEffortLevel,
        sets,
      };
    });
    const workoutExercises = options.deload
      ? mapped.map((exercise, index) => {
          const plannedSetCount = routine.exercises[index]?.sets.length ?? exercise.sets.length;
          const deloadSetCount = Math.max(1, Math.ceil(plannedSetCount * 0.6));
          const isCardio = getExerciseMode(exercise.name) === "cardio";
          return {
            ...exercise,
            sets: exercise.sets.slice(0, deloadSetCount).map((set) => ({
              ...set,
              weightKg:
                !isCardio && typeof set.weightKg === "number"
                  ? Math.round(set.weightKg * 0.85 * 2) / 2
                  : set.weightKg,
              baselineWeightKg:
                !isCardio && typeof set.baselineWeightKg === "number"
                  ? Math.round(set.baselineWeightKg * 0.85 * 2) / 2
                  : set.baselineWeightKg,
              durationSec:
                isCardio && typeof set.durationSec === "number" ? Math.round(set.durationSec * 0.8) : set.durationSec,
            })),
          };
        })
      : mapped;
    setExercises((prev) => (mode === "append" ? [...prev, ...workoutExercises] : workoutExercises));
    setExerciseUnits((prev) => {
      const next = { ...prev };
      workoutExercises.forEach((exercise) => {
        next[exercise.id] = getExerciseMode(exercise.name) === "cardio" ? "km" : "kg";
      });
      return next;
    });
    setRestPreferenceByExercise((prev) => {
      const next = mode === "append" ? { ...prev } : {};
      workoutExercises.forEach((exercise) => {
        next[exercise.id] = getSavedRestPreference(exercise.name);
      });
      return next;
    });
    setRestCustomInputByExercise((prev) => {
      const next = mode === "append" ? { ...prev } : {};
      workoutExercises.forEach((exercise) => {
        next[exercise.id] = "";
      });
      return next;
    });
    setRestTimerByExercise((prev) => {
      const next = mode === "append" ? { ...prev } : {};
      workoutExercises.forEach((exercise) => {
        const restSeconds = getSavedRestPreference(exercise.name);
        next[exercise.id] = { remainingSec: restSeconds, running: false };
      });
      return next;
    });
    setSessionTitle(options.deload ? `${routine.name} (Deload)` : routine.name);
    if (mode === "replace") {
      setSessionDateText(toLocalDateKey(new Date()));
      setElapsedDuration(0);
      setLastAppliedRoutineId(options.deload ? null : routine.id);
      setUiFeedback(options.deload ? `Applied deload for "${routine.name}".` : `Applied "${routine.name}".`);
    } else {
      setUiFeedback(`Appended "${routine.name}".`);
      setLastAppliedRoutineId(null);
    }
  };

  const handleApplyRoutine = (routine: Routine) => {
    applyRoutineToEditor(routine, "replace");
  };

  const openDeloadConfirm = (routine: Routine) => {
    setSelectedRoutine(routine);
    setShowRoutineActionsModal(false);
    setShowDeloadConfirmModal(true);
  };

  const applySelectedRoutineDeload = () => {
    if (!selectedRoutine) return;
    applyRoutineToEditor(selectedRoutine, "replace", { deload: true });
    setShowDeloadConfirmModal(false);
    setShowMyRoutinesModal(false);
    setSelectedRoutine(null);
  };

  const openExerciseHistory = (exerciseName: string) => {
    setHistoryExerciseName(exerciseName);
    setShowExerciseHistoryModal(true);
  };

  const exerciseHistory = useMemo(() => {
    const normalizedName = normalizeExerciseName(historyExerciseName ?? "");
    if (!normalizedName) return [] as { date: Date; sets: PastWorkout["exercises"][number]["sets"] }[];
    return pastWorkouts
      .flatMap((workout) =>
        workout.exercises
          .filter((exercise) => normalizeExerciseName(exercise.name) === normalizedName)
          .map((exercise) => ({ date: workout.date, sets: exercise.sets }))
      )
      .sort((left, right) => right.date.getTime() - left.date.getTime());
  }, [historyExerciseName, pastWorkouts]);

  const exerciseProgressInsights = useMemo(
    () =>
      buildExerciseProgressInsights(
        exerciseHistory.map((entry) => ({ date: entry.date, sets: entry.sets }))
      ),
    [exerciseHistory]
  );

  const exerciseProgressByDate = useMemo(
    () =>
      new Map(
        exerciseProgressInsights.sessions.map((session) => [session.date.getTime(), session])
      ),
    [exerciseProgressInsights.sessions]
  );
  const shouldShowStrengthProgress =
    historyExerciseName != null && getExerciseMode(historyExerciseName) === "resistance";

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

  const recommendWorkout = async (lengthId: RecommendationLengthId = recommendationLength) => {
    if (recommending) return;
    setRecommending(true);
    try {
      const user = auth.currentUser;
      const userSnap = user ? await getDoc(doc(db, "users", user.uid)) : null;
      const userData: any = userSnap?.data?.() ?? {};
      const goal = String(userData?.goal || "");
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
      const selectedFocus = RECOMMENDATION_FOCUSES.find((item) => item.id === recommendationFocus);
      const pickedTemplate =
        selectedFocus?.template ??
        pickTemplate(
          DEFAULT_WORKOUT_TEMPLATES,
          yesterdayGroup,
          Number(sessionDateText.replace(/-/g, "")) || 0
        );
      const targets = resolveRecommendationTargets(
        trainingPhase,
        goal,
        dietPhase,
        latestDecision?.adjustments?.intensityPct ?? 0,
        highFatigue
      );
      const selectedLength = RECOMMENDATION_LENGTHS.find((option) => option.id === lengthId) ?? RECOMMENDATION_LENGTHS[1];
      const { intensityPct, tempo } = targets;
      const selection = selectRecommendedExercises({
        focusId: selectedFocus?.id ?? "auto",
        primaryGroup: pickedTemplate.primaryGroup,
        templateExercises: pickedTemplate.exercises,
        exerciseCount: selectedLength.exerciseCount,
        catalog: mergedCatalog,
        completedExerciseNames: pastWorkouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.name)),
        recentlyTrainedExerciseNames: pastWorkouts.slice(0, 3).flatMap((workout) => workout.exercises.map((exercise) => exercise.name)),
        trainingPhase,
        dietPhase,
        highFatigue,
      });
      const exerciseNames = selection.exerciseNames;
      // High recent effort calls for a modest volume reduction across the session.
      const contextualSetBudget = highFatigue
        ? Math.max(exerciseNames.length * 2, Math.round(selectedLength.targetHardSets * 0.8))
        : selectedLength.targetHardSets;
      const baseSetsPerExercise = Math.floor(contextualSetBudget / Math.max(1, exerciseNames.length));
      const extraSets = contextualSetBudget % Math.max(1, exerciseNames.length);

      const recommendedExercises: Exercise[] = exerciseNames.map((name, index) => {
        const normalizedName = normalizeExerciseName(name);
        const sessions: ExercisePerformanceSession[] = pastWorkouts
          .map((workout) => workout.exercises.find((exercise) => normalizeExerciseName(exercise.name) === normalizedName))
          .filter((exercise): exercise is PastWorkout["exercises"][number] => Boolean(exercise))
          .map((exercise) => ({ sets: exercise.sets }));
        const progression = recommendExerciseProgression({
          exerciseName: name,
          sessions,
          phase: (trainingPhase === "Strength" || trainingPhase === "Power" ? trainingPhase : "Hypertrophy") as ProgressionPhase,
          baseSets: baseSetsPerExercise + (index < extraSets ? 1 : 0),
          decisionIntensityPct: intensityPct,
          dietPhase: dietPhase === "Cut" || dietPhase === "Bulk" ? dietPhase : "Maintain",
          highFatigue,
          availableWeights: availableWeightsPreferences.values[weightPreferenceKey(name)],
        });
        return {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name,
          notes: "",
          tempo,
          sets: Array.from({ length: progression.sets }, () => ({
            weightKg: progression.weightKg,
            reps: progression.reps,
            rpe: "",
            distanceKm: null,
            durationSec: null,
            zone: "",
            setType: "normal" as SetType,
            done: false,
            baselineWeightKg: progression.weightKg,
            baselineReps: progression.reps,
          })),
        };
      });
      setExercises(recommendedExercises);
      setExerciseUnits(() => {
        const next: Record<string, Unit> = {};
        recommendedExercises.forEach((exercise) => {
          next[exercise.id] = availableWeightsPreferences.values[weightPreferenceKey(exercise.name)]?.unit ?? "kg";
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
      setElapsedDuration(0);
      const plannedHardSetCount = recommendedExercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
      setRecommendationSummary([
        `${selectedFocus?.label ?? pickedTemplate.name} | ${selectedLength.title} | ${plannedHardSetCount} planned hard sets.`,
        selection.addedRoles.length
          ? `Added ${selection.addedRoles.join(" and ")} coverage to complete the session.`
          : null,
        `Sets, reps, and loads use your training phase, diet phase, latest performance, effort ratings, and today's decision. New exercises start without a load.`,
        highFatigue
          ? "Recent effort was high, so volume and intensity were reduced from the selected plan."
          : null,
      ].filter((line): line is string => Boolean(line)));
      setUiFeedback("Recommended workout applied.");
      setLastAppliedRoutineId(null);
    } catch (error) {
      console.log("Failed to recommend workout", error);
      showAppAlert("Recommendation unavailable", "Please try again in a moment.");
    } finally {
      setRecommending(false);
    }
  };

  const selectRecommendationLength = (lengthId: RecommendationLengthId) => {
    setRecommendationLength(lengthId);
    setShowWorkoutLengthModal(false);
    if (activeUid) {
      AsyncStorage.setItem(`${RECOMMENDATION_LENGTH_KEY_PREFIX}:${activeUid}`, lengthId).catch((error) =>
        console.log("Failed to save recommendation length", error)
      );
    }
    void recommendWorkout(lengthId);
  };

  const runningRest = exercises.find((exercise) => { const clock = restTimerByExercise[exercise.id]; return clock?.running || clock && clock.remainingSec > 0 && clock.remainingSec < (restPreferenceByExercise[exercise.id] ?? 90); });
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
  const activeActionMode =
    activeActionExercise && getExerciseMode(activeActionExercise.name) === "cardio" ? "cardio" : "resistance";
  const activeActionUnit = activeExerciseActionId
    ? exerciseUnits[activeExerciseActionId] || (activeActionMode === "cardio" ? "km" : "kg")
    : "kg";
  const activeActionIndex = activeExerciseActionId
    ? exercises.findIndex((exercise) => exercise.id === activeExerciseActionId)
    : -1;
  const activeSetExercise = useMemo(() => {
    if (!activeSetMenu) return null;
    return exercises.find((exercise) => exercise.id === activeSetMenu.exerciseId) ?? null;
  }, [activeSetMenu, exercises]);
  const activeSet = useMemo(() => {
    if (!activeSetMenu || !activeSetExercise) return null;
    return activeSetExercise.sets[activeSetMenu.setIndex] ?? null;
  }, [activeSetExercise, activeSetMenu]);

  const currentGuidanceSignature = useMemo(() => workoutGuidanceSignature(guidanceWorkout), [guidanceWorkout]);
  const guidanceApplied = Boolean(appliedGuidance && todayGuidance &&
    appliedGuidance.plan.createdAt.isEqual(todayGuidance.createdAt) &&
    appliedGuidance.signature === currentGuidanceSignature);
  const guidanceStale = todayPlan.inputsChanged || Boolean(todayGuidance && (
    toLocalDateKey(todayGuidance.createdAt.toDate()) !== toLocalDateKey(new Date()) ||
    sessionDateText !== toLocalDateKey(new Date()) ||
    (!guidanceApplied && workoutGuidanceSignature(todayGuidance.inputs.plannedWorkout) !== currentGuidanceSignature)
  ));
  const applyWorkoutGuidance = () => {
    if (!auth.currentUser || !todayGuidance || todayPlan.busy || todayPlan.error || guidanceStale || guidanceApplied || saving) return;
    try {
      const applied = applyTodayPlanToWorkoutDraft(serializeWorkoutDraft(workoutDraftPayload), todayGuidance.result.exerciseAdjustments ?? []);
      const next = JSON.parse(applied.raw).exercises as Exercise[];
      if (!applied.changedExercises) {
        showAppAlert("No changes applied", "The suggested changes do not affect any unfinished working sets.");
        return;
      }
      setAppliedGuidance({
        plan: todayGuidance,
        before: exercises,
        after: next,
        signature: workoutGuidanceSignature(withAvailableWeights(parseWorkoutDraftPlan(applied.raw), availableWeightsPreferences.values)),
      });
      setExercises(next);
      void AsyncStorage.setItem(getDraftKey(auth.currentUser!.uid), applied.raw)
        .catch((error) => console.log("Failed to save applied workout guidance", error));
      setShowTodayGuidance(false);
    } catch (error) {
      console.log("Failed to apply today's plan", error);
      showAppAlert("Plan not applied", "Please try again.");
    }
  };

  const cardActions = useEventCallbacks({ revealNote: revealNote, openExerciseDemo, openExerciseHistory, openExerciseActions, setReplaceSearch, setReplaceGroup, replaceExercise, updateExerciseNotes, openTempoEditor, openRestTimerModal, updateSetWeight, updateSetReps, updateSetRpe, toggleSetDone, removeSetWithUndo, openSetMenu, copyLastSetToCurrent, openCardioTimeModal, openCardioDistanceModal, setExercises, updateCardioSessionType, updateCardioEffortLevel, addEmptySet, duplicateLastSet, undoRemoveSet });
  // Cache unchanged card JSX so navigation and background context updates don't rebuild every row.
  const exerciseCards = useMemo(() => exercises.map((ex, exerciseIndex) => {
          const unit = exerciseUnits[ex.id] || "kg";
          const mode = getExerciseMode(ex.name);
          const isCardio = mode === "cardio";
          const largeText = fontScale >= 1.5;
          const usesNativeSetRows = Platform.OS === "android" && !isCardio;
          const weightLabel = isCardio
            ? "Distance"
            : unit === "kg"
            ? "kg"
            : unit === "lbs"
            ? "lbs"
            : "Weight";
          const repsLabel = isCardio ? "Time" : "Reps";
          const rpeLabel = isCardio ? "Zone" : effortLabel(effortScale);
          const previousSets = previousExerciseSetsByName.get(normalizeExerciseName(ex.name)) ?? [];
          const exerciseCatalogItem = findCatalogExercise(ex.name);
          const restTimer = restTimerByExercise[ex.id] ?? { remainingSec: 90, running: false };
          return (
            <View key={ex.id} style={styles.card}>
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseOrdinal}>{String(exerciseIndex + 1).padStart(2, "0")}</Text>
                <TouchableOpacity
                  style={styles.exerciseNameButton}
                  onPress={() => cardActions.openExerciseHistory(ex.name)}
                  accessibilityLabel={`View ${ex.name} history`}
                >
                  <Text style={styles.exerciseName}>
                    {ex.name}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => cardActions.openExerciseActions(ex.id)}>
                  <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
                </TouchableOpacity>
              </View>
              {replaceTarget === ex.id ? (
                <View style={[styles.pickerCard, { marginTop: 10 }]}>
                  <TextInput disableFullscreenUI
                    placeholder="Search to replace"
                    placeholderTextColor={colors.muted}
                    value={replaceSearch}
                    onChangeText={cardActions.setReplaceSearch}
                    style={[styles.input, { marginBottom: 8 }]}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.groupChips}
                  >
                    <TouchableOpacity
                      style={[styles.groupChip, replaceGroup === "all" && styles.groupChipActive]}
                      onPress={() => cardActions.setReplaceGroup("all")}
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
                        onPress={() => cardActions.setReplaceGroup(g.key)}
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
                        onPress={() => cardActions.replaceExercise(ex.id, item.name)}
                      >
                        <Ionicons name="swap-horizontal-outline" size={18} color={colors.accent} />
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
                          ? "No close alternatives found. Search for another exercise."
                          : "Custom exercises do not have automatic alternatives. Search for the exercise you want instead."}
                      </Text>
                    ) : null}
                  </ScrollView>
                </View>
              ) : null}
              <View style={[styles.inlineTipRow, largeText && { flexDirection: "column" }]}>
                <TouchableOpacity style={styles.restTimerInlineButton} onPress={() => cardActions.openExerciseDemo(ex.name)} accessibilityLabel={`Open ${ex.name} demo`}>
                  <Play size={16} strokeWidth={1.5} color={colors.muted} /><Text style={styles.restTimerInlineText}>Demo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.restTimerInlineButton} onPress={() => cardActions.openRestTimerModal(ex.id)}><Clock3 size={16} strokeWidth={1.5} color={colors.muted} /><RestTimerText style={styles.restTimerInlineText} clock={restTimer} prefix="Rest " /></TouchableOpacity>
                {!isCardio ? <TouchableOpacity style={styles.restTimerInlineButton} onPress={() => cardActions.openTempoEditor(ex.id, ex.tempo)}><Gauge size={16} strokeWidth={1.5} color={colors.muted} /><Text style={styles.restTimerInlineText}>Tempo{ex.tempo?.trim() ? " " + ex.tempo : ""}</Text></TouchableOpacity> : null}
              </View>
              <View style={styles.exerciseMetaNotesSingle}>
                <Text style={styles.noteLabel}>Note</Text>
                <TextInput disableFullscreenUI placeholder="Keep the last rep controlled" placeholderTextColor={colors.muted} accessibilityLabel={`${ex.name} note`}
                        onFocus={cardActions.revealNote} value={ex.notes ?? ""} onChangeText={(v) => cardActions.updateExerciseNotes(ex.id, v)} style={[styles.input, styles.metaInput]} />
              </View>
              <View
                style={[
                  styles.setHeaderRow,
                  largeText && { display: "none" },
                  isTabletLayout && styles.setHeaderRowTablet,
                  usesNativeSetRows && styles.nativeSetHeaderRow,
                ]}
              >
                {!isCardio ? <Text style={[styles.setHeaderText, styles.setHeaderSet]}>Set</Text> : null}
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
                <Text
                  style={[
                    styles.setHeaderText,
                    styles.setHeaderCheck,
                    isCardio && styles.cardioSetHeaderCheck,
                    usesNativeSetRows && styles.nativeSetHeaderCheck,
                  ]}
                >
                  Done
                </Text>
              </View>
              {ex.sets.length === 0 ? (
                <Text style={styles.muted}>No sets yet.</Text>
              ) : Platform.OS === "android" && !isCardio ? (
                <WorkoutNativeSetRows
                  activeSetIndex={ex.sets.findIndex((_set, index) => editingSet === `${ex.id}:${index}`)}
                  editingSuspended={showCardioTimeModal || showCardioDistanceModal}
                  onActivate={(index) => setEditingSet(`${ex.id}:${index}`)}
                  listKey={`native-set-list-${ex.id}-${ex.sets
                    .map((set, idx) => `${idx}:${getSetTypeMarker(set, idx)}`)
                    .join("|")}-${String(unit).toLowerCase()}-${weightLabel}-${repsLabel}-${rpeLabel}`}
                  style={{ height: Math.max(ex.sets.length, 1) * notebookRowHeight(fontScale) }}
                  notebookColors={colors}
                  fontFamily="NotebookSans"
                  weightLabel={weightLabel}
                  repsLabel={repsLabel}
                  rpeLabel={effortScale === "rir" ? "0-4" : "6-10"}
                  rows={ex.sets.map((set, idx) => ({
                    marker: getSetTypeMarker(set, idx),
                    last: previousSets[idx] ? lastResistanceSet(previousSets[idx], unit, effortScale) : "-",
                    weight: set.weightText ?? formatWeightInput(set.weightKg, unit),
                    reps: set.reps,
                    rpe: effortInputValue(set, effortScale),
                    done: set.done,
                  }))}
                  onChange={(index, field, value) => {
                    if (field === "weight") {
                      cardActions.updateSetWeight(ex.id, index, unit, value);
                      return;
                    }
                    if (field === "reps") {
                      cardActions.updateSetReps(ex.id, index, value);
                      return;
                    }
                    cardActions.updateSetRpe(ex.id, index, value);
                  }}
                  onToggleDone={(index) => cardActions.toggleSetDone(ex.id, index)}
                  onDeleteSet={(index) => cardActions.removeSetWithUndo(ex.id, index)}
                  onSetLabelPress={(index) => cardActions.openSetMenu(ex.id, index)}
                  onLastPress={(index) => cardActions.copyLastSetToCurrent(ex.id, index)}
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
                          onPress={() => cardActions.removeSetWithUndo(ex.id, idx)}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.ink} />
                          <Text style={styles.swipeDeleteText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  >
                    <View style={[styles.setContainer, (editingSet === `${ex.id}:${idx}` || cardioTimeTarget?.exerciseId === ex.id && cardioTimeTarget.setIndex === idx || cardioDistanceTarget?.exerciseId === ex.id && cardioDistanceTarget.setIndex === idx) && styles.activeSet]}>
                      <View style={[styles.setInlineRow, isTabletLayout && styles.setInlineRowTablet, largeText && { flexWrap: "wrap" }]}>
                        {!isCardio ? (
                          <TouchableOpacity
                            onPress={() => cardActions.openSetMenu(ex.id, idx)}
                            style={styles.setLabelButton}
                            accessibilityLabel={`Adjust set ${idx + 1} intensity`}
                          >
                            <Text style={[styles.setLabel, isTabletLayout && styles.setLabelTablet]}>
                              {getSetTypeMarker(s, idx)}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          style={styles.lastSetButton}
                          onPress={() => cardActions.copyLastSetToCurrent(ex.id, idx)}
                          disabled={!previousSets[idx]}
                          accessibilityLabel={`Copy previous values into set ${idx + 1}`}
                        >
                          <Text style={styles.lastSetText}>
                          {previousSets[idx] ? formatLastSetSummary(previousSets[idx]) : "-"}
                          </Text>
                        </TouchableOpacity>
                        <View style={[styles.setInputsGroup, isTabletLayout && styles.setInputsGroupTablet, largeText && { flexBasis: "100%", flexWrap: "wrap" }]}>
                          {isCardio ? (
                            <>
                              <TouchableOpacity
                                style={[styles.input, styles.setInput, styles.setInputCompact, styles.setColReps]}
                                onPress={() => cardActions.openCardioTimeModal(ex.id, idx, s.durationSec)}
                              >
                                <Text style={styles.cardioTapValue}>
                                  {formatDurationHoursMinutes(s.durationSec ?? null) || "hh:mm"}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.input, styles.setInput, styles.setInputCompact, styles.setColWeight]}
                                onPress={() => cardActions.openCardioDistanceModal(ex.id, idx, s.distanceKm ?? null, unit)}
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
                                placeholderTextColor={colors.muted}
                                keyboardType="decimal-pad"
                                value={s.weightText ?? formatWeightInput(s.weightKg, unit)}
                                onChangeText={(v) => cardActions.updateSetWeight(ex.id, idx, unit, v)}
                                onFocus={() => setEditingSet(`${ex.id}:${idx}`)}
                                selectTextOnFocus
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
                                placeholderTextColor={colors.muted}
                                keyboardType="numeric"
                                value={s.reps}
                                onChangeText={(v) => cardActions.updateSetReps(ex.id, idx, v)}
                                onFocus={() => setEditingSet(`${ex.id}:${idx}`)}
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
                                placeholder={effortScale === "rir" ? "0-4" : "6-10"}
                                placeholderTextColor={colors.muted}
                                keyboardType="decimal-pad"
                                value={effortInputValue(s, effortScale)}
                                onChangeText={(v) => cardActions.updateSetRpe(ex.id, idx, v)}
                                onFocus={() => setEditingSet(`${ex.id}:${idx}`)}
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
                        <TouchableOpacity
                          style={[styles.checkboxInline, styles.checkboxHitbox, largeText && { minWidth: 64, minHeight: 64 }]}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: s.done }}
                          accessibilityLabel={`${ex.name}, set ${idx + 1} completed`}
                          onPress={() => { setEditingSet(`${ex.id}:${idx}`); cardActions.toggleSetDone(ex.id, idx); }}
                          activeOpacity={0.8}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <View style={[styles.checkbox, s.done && styles.checkboxChecked, largeText && { width: 36, height: 36, borderWidth: 2, borderRadius: 6 }]}>
                            {s.done ? <Check size={largeText ? 28 : 16} strokeWidth={2} color={colors.onPrimary} /> : null}
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </ReanimatedSwipeable>
                ))
              )}
              {isCardio ? (
                <>
                  <View style={styles.cardioMetaRow}>
                    <Text style={styles.cardioMetaLabel}>Heart-rate zone</Text>
                    <View style={styles.answerRow}>
                      {["1", "2", "3", "4", "5"].map((zone) => (
                        <TouchableOpacity key={`cardio-zone-${ex.id}-${zone}`} accessibilityRole="button" accessibilityLabel={`Zone ${zone}`} accessibilityState={{ selected: getExerciseZone(ex) === zone }} style={[styles.answerChip, getExerciseZone(ex) === zone && styles.answerChipActive]} onPress={() => cardActions.setExercises((previous) => previous.map((exercise) => exercise.id === ex.id ? applyCardioZone(exercise, getExerciseZone(exercise) === zone ? "" : zone) : exercise))}>
                          <Text style={[styles.answerText, getExerciseZone(ex) === zone && styles.answerTextActive]}>{`Zone ${zone}`}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
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
                          onPress={() => cardActions.updateCardioSessionType(ex.id, option.value)}
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
                          onPress={() => cardActions.updateCardioEffortLevel(ex.id, option.value)}
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
                  style={[styles.textAction, styles.setActionButton]}
                  onPress={() => cardActions.addEmptySet(ex.id)}
                >
                  <Text style={styles.linkText}>+ Add set</Text>
                </TouchableOpacity>
                {ex.sets.length > 0 ? (
                  <TouchableOpacity
                    style={[styles.textAction, styles.setActionButton, { alignItems: "flex-end" }]}
                    onPress={() => cardActions.duplicateLastSet(ex.id)}
                  >
                    <Text style={styles.linkText}>Duplicate last set</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.setActionButton} />
                )}
              </View>
              {undoDeletedSet?.exerciseId === ex.id ? (
                <View style={styles.inlineUndoBanner}>
                  <Text style={styles.inlineUndoBannerText}>Set deleted</Text>
                  <TouchableOpacity onPress={cardActions.undoRemoveSet} style={styles.inlineUndoBannerAction}>
                    <Text style={styles.inlineUndoBannerActionText}>Undo</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        }), [exercises, exerciseUnits, getExerciseMode, effortScale, previousExerciseSetsByName, findCatalogExercise, restTimerByExercise, replaceTarget, replaceSearch, replaceGroup, replacementOptions, isTabletLayout, formatLastSetSummary, scrollNativeGesture, getExerciseZone, undoDeletedSet, cardActions, styles, colors, fontScale, editingSet, cardioTimeTarget, cardioDistanceTarget, showCardioTimeModal, showCardioDistanceModal]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <View style={styles.scrollShell}>
        <NotebookHeader compact={keyboardHeight > 0 && width > height} title={routineBuilderMode ? "Routine builder" : "Workout"} onBack={handleGoBack} action={exercises.length ? routineBuilderMode ? "Save" : "Finish" : undefined} onAction={routineBuilderMode ? openCreateRoutineModal : finishWorkout} disabled={saving} />
        <GestureDetector gesture={scrollNativeGesture}>
          <ScrollView
            ref={noteScrollRef}
            onLayout={revealNoteOnLayout}
            onScroll={trackNoteScroll}
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingBottom: 140 + keyboardHeight }]}
            keyboardShouldPersistTaps="handled"
            // Native set inputs manage keyboard visibility without ReactScrollView's focus traversal.
            scrollsChildToFocus={Platform.OS !== "android"}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            scrollEventThrottle={16}
          >
      {exercises.length > 0 || routineBuilderMode ? <WorkoutSessionCard
        title={sessionTitle}
        dateLabel={
          parseSessionDate(sessionDateText)?.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          }) ?? sessionDateText
        }
        elapsedSeconds={elapsedSeconds}
        startedAtMs={workoutTimerStartedAtMs}
        timerRunning={workoutTimerRunning}
        timerStarted={elapsedSeconds > 0}
        trainingPhase={sessionPhase}
        onTitleChange={setSessionTitle}
        onDatePress={openDatePicker}
        onTimerPress={workoutTimerRunning ? openDurationAdjustModal : startWorkoutTimer}
        onChangePhase={() => router.push({ pathname: "/profile", params: { from: "/(tabs)/workout/log" } })}
      /> : <View style={styles.emptyHeading}><Text style={styles.sessionTitle}>Your next session</Text><Text style={styles.muted}>Choose a routine or add your first exercise.</Text></View>}
      {exercises.length > 0 ? <View style={styles.sourceRow}><Text style={[styles.muted, { flex: 1 }]}>Routine: {routines.find((routine) => routine.id === lastAppliedRoutineId)?.name ?? "Custom workout"}</Text><TouchableOpacity onPress={() => setShowMyRoutinesModal(true)} style={styles.textAction}><Text style={styles.linkText}>Change</Text></TouchableOpacity></View> : null}

      {!routineBuilderMode && sessionDateText === toLocalDateKey(new Date()) ? (
        <WorkoutTodayPlan
          effortScale={effortScale}
          plan={todayGuidance}
          busy={todayPlan.busy || !availableWeightsPreferences.loaded}
          error={todayPlan.error}
          recovery={todayPlan.recovery}
          contextSummary={getDailyContextSummary(todayGuidance?.inputs.dailyContext ?? null)}
          onRecoveryChange={todayPlan.changeRecovery}
          onEditContext={() => { setShowTodayGuidance(false); todayPlan.setContextVisible(true); }}
          visible={showTodayGuidance}
          stale={guidanceStale}
          applied={guidanceApplied}
          canUndo={guidanceApplied && appliedGuidance?.after === exercises}
          unitForExercise={(name) => {
            const exercise = exercises.find((item) => normalizeExerciseName(item.name) === normalizeExerciseName(name));
            return exercise && exerciseUnits[exercise.id] === "lbs" ? "lbs" : "kg";
          }}
          onOpen={() => { if (guidanceApplied && !guidanceStale) setShowTodayGuidance(true); else void todayPlan.review(); }}
          onClose={() => setShowTodayGuidance(false)}
          onApply={applyWorkoutGuidance}
          onUndo={() => {
            if (appliedGuidance?.after !== exercises) return;
            setExercises(appliedGuidance.before);
            if (auth.currentUser) {
              void AsyncStorage.setItem(getDraftKey(auth.currentUser.uid), serializeWorkoutDraft({
                ...workoutDraftPayload, exercises: appliedGuidance.before,
              })).catch((error) => console.log("Failed to save guidance undo", error));
            }
            setAppliedGuidance(null);
          }}
          onUpdate={() => void todayPlan.review()}
        />
      ) : null}

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

      <View style={styles.sessionControls}>
        <View style={styles.sessionActionRow}>
          <TouchableOpacity style={styles.sessionAction} onPress={() => setShowMyRoutinesModal(true)}><Text style={styles.linkText}>My routines</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.sessionAction, styles.sessionActionRight]} onPress={beginCreateRoutine}><Text style={styles.linkText}>Create routine</Text></TouchableOpacity>
        </View>
        <View style={styles.sessionActionRow}>
          <TouchableOpacity style={styles.sessionAction} onPress={handleRepeatPastWorkoutPress}><Text style={styles.linkText}>Repeat past workout</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.sessionAction, styles.sessionActionRight]} onPress={() => setShowSetup(true)}><Text style={styles.linkText}>Recommend workout</Text></TouchableOpacity>
        </View>
        {routineBuilderMode ? <TouchableOpacity style={styles.textAction} onPress={() => setRoutineBuilderMode(false)}><Text style={styles.linkText}>Exit builder</Text></TouchableOpacity> : null}
        {exercises.length ? <TouchableOpacity style={styles.textAction} onPress={discardWorkout}><Text style={[styles.linkText, { color: colors.danger }]}>Discard workout</Text></TouchableOpacity> : null}
      </View>

      {exerciseCards}

      <TouchableOpacity
        style={[styles.secondaryButton, { marginTop: 12 }]}
        onPress={openAddExercise}
      >
        <Text style={styles.secondaryText}>Add exercise</Text>
      </TouchableOpacity>

      {exercises.length ? <TouchableOpacity style={[styles.secondaryButton, { marginTop: 12 }]} onPress={openCreateRoutineModal}><Text style={styles.secondaryText}>Save as routine</Text></TouchableOpacity> : null}
      <WorkoutModalShell visible={showSetup} onRequestClose={() => setShowSetup(false)} backdropStyle={styles.modalBackdrop} cardStyle={styles.modalCard}>
        <Text style={styles.modalTitle}>Recommend workout</Text>
        <WorkoutRecommendationSection styles={styles} focuses={RECOMMENDATION_FOCUSES} selectedFocus={recommendationFocus} recommending={recommending} summary={recommendationSummary} onSelectFocus={setRecommendationFocus} onOpenLengthPicker={() => { setShowSetup(false); setShowWorkoutLengthModal(true); }} />
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowSetup(false)}><Text style={styles.secondaryText}>Back to workout</Text></TouchableOpacity>
      </WorkoutModalShell>
      <Modal visible={showRepeatPicker} transparent animationType="fade" onRequestClose={() => setShowRepeatPicker(false)}>
        <View style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>Repeat a past workout</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {pastWorkouts.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={styles.pickerRow}
                  onPress={() => applyPastWorkout(w)}
                >
                  <Ionicons name="repeat-outline" size={18} color={colors.accent} />
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
          </AdaptiveModalCard>
        </View>
      </Modal>

      <Modal visible={showMyRoutinesModal} transparent animationType="fade" onRequestClose={() => setShowMyRoutinesModal(false)}>
        <View style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
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
                        <Ionicons name="ellipsis-horizontal" size={16} color={colors.muted} />
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
          </AdaptiveModalCard>
        </View>
      </Modal>

      <Modal visible={showExerciseDemo} transparent animationType="fade" onRequestClose={closeExerciseDemo}>
        <View style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
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
          </AdaptiveModalCard>
        </View>
      </Modal>

      <Modal visible={showExerciseActionsModal} transparent animationType="fade" onRequestClose={closeExerciseActions}>
        <TouchableWithoutFeedback onPress={closeExerciseActions}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <AdaptiveModalCard style={styles.modalCard}>
                <Text style={styles.modalTitle}>
                  {activeActionExercise ? activeActionExercise.name : "Exercise Options"}
                </Text>

                <View style={styles.exerciseOptionRow}>
                  <Ionicons
                    name={activeActionMode === "cardio" ? "map-outline" : "barbell-outline"}
                    size={18}
                    color={colors.muted}
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

                {activeActionMode === "resistance" ? (
                  <TouchableOpacity
                    style={[styles.exerciseOptionRow, !availableWeightsPreferences.loaded && styles.disabled]}
                    disabled={!availableWeightsPreferences.loaded}
                    onPress={() => {
                      if (!activeActionExercise) return;
                      setAvailableWeightsTarget({ name: activeActionExercise.name, unit: activeActionUnit === "lbs" ? "lbs" : "kg" });
                      closeExerciseActions();
                    }}
                  >
                    <Ionicons name="options-outline" size={18} color={colors.muted} />
                    <Text style={styles.exerciseOptionText}>{availableWeightsPreferences.loaded ? "Available weights" : availableWeightsPreferences.error ? "Weight settings unavailable" : "Loading weight settings..."}</Text>
                  </TouchableOpacity>
                ) : null}

                <View style={styles.exerciseReorderRow}>
                  <Ionicons name="swap-vertical-outline" size={18} color={colors.muted} />
                  <Text style={styles.exerciseOptionText}>Reorder</Text>
                  <View style={styles.exerciseMoveRow}>
                    <TouchableOpacity
                      style={[styles.exerciseMoveButton, activeActionIndex <= 0 && styles.disabled]}
                      disabled={!activeExerciseActionId || activeActionIndex <= 0}
                      onPress={() => activeExerciseActionId && moveExercise(activeExerciseActionId, -1)}
                    >
                      <Ionicons name="arrow-up-outline" size={15} color={colors.muted} />
                      <Text style={styles.exerciseMoveText}>Up</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.exerciseMoveButton,
                        (activeActionIndex < 0 || activeActionIndex >= exercises.length - 1) && styles.disabled,
                      ]}
                      disabled={!activeExerciseActionId || activeActionIndex < 0 || activeActionIndex >= exercises.length - 1}
                      onPress={() => activeExerciseActionId && moveExercise(activeExerciseActionId, 1)}
                    >
                      <Ionicons name="arrow-down-outline" size={15} color={colors.muted} />
                      <Text style={styles.exerciseMoveText}>Down</Text>
                    </TouchableOpacity>
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
                  <Ionicons name="swap-horizontal-outline" size={18} color={colors.muted} />
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
                    color={colors.accent}
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
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  <Text style={[styles.exerciseOptionText, { color: colors.danger }]}>Delete exercise</Text>
                </TouchableOpacity>
              </AdaptiveModalCard>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={showRestTimerModal} transparent animationType="fade" onRequestClose={closeRestTimerModal}>
        <KeyboardAwareModalFrame style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {activeRestExercise ? `${activeRestExercise.name} Rest Timer` : "Rest Timer"}
            </Text>
            <RestTimerText style={styles.modalText} clock={activeRestTimerState} prefix="Current: " />
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
              <TextInput selectTextOnFocus disableFullscreenUI
                placeholder="Custom (sec)"
                placeholderTextColor={colors.muted}
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
          </AdaptiveModalCard>
        </KeyboardAwareModalFrame>
      </Modal>

      <Modal visible={showRoutineStartModal} transparent animationType="fade" onRequestClose={() => setShowRoutineStartModal(false)}>
        <View style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
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
          </AdaptiveModalCard>
        </View>
      </Modal>

      <Modal visible={showRoutineActionsModal} transparent animationType="fade" onRequestClose={closeRoutineActions}>
        <View style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectedRoutine ? selectedRoutine.name : "Routine actions"}
            </Text>
            <TouchableOpacity
              style={styles.routineMenuRow}
              onPress={handleUpdateSelectedRoutine}
              disabled={!selectedRoutine}
            >
              <Text style={styles.linkText}>Update from current workout</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.routineMenuRow}
              onPress={() => selectedRoutine && openDeloadConfirm(selectedRoutine)}
              disabled={!selectedRoutine}
            >
              <Text style={styles.linkText}>Apply deload</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.routineMenuRow}
              onPress={handleAskDeleteSelectedRoutine}
              disabled={!selectedRoutine}
            >
              <Text style={[styles.linkText, { color: colors.danger }]}>Delete routine</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.routineMenuRow}
              onPress={closeRoutineActions}
            >
              <Text style={styles.linkText}>Close</Text>
            </TouchableOpacity>
          </AdaptiveModalCard>
        </View>
      </Modal>

      <WorkoutModalShell
        visible={showWorkoutLengthModal}
        backdropStyle={styles.modalBackdrop}
        cardStyle={styles.modalCard}
        onRequestClose={() => setShowWorkoutLengthModal(false)}
      >
            <Text style={styles.modalTitle}>Build workout</Text>
            <Text style={styles.modalText}>Choose the amount of work you want today.</Text>
            <View style={styles.recommendationLengthList}>
              {RECOMMENDATION_LENGTHS.map((option) => {
                const selected = option.id === recommendationLength;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.recommendationLengthOption, selected && styles.recommendationLengthOptionActive]}
                    onPress={() => selectRecommendationLength(option.id)}
                    disabled={recommending}
                  >
                    <View>
                      <Text style={[styles.recommendationLengthTitle, selected && styles.recommendationLengthTitleActive]}>
                        {option.title}
                      </Text>
                      <Text style={[styles.recommendationLengthDetail, selected && styles.recommendationLengthDetailActive]}>
                        {option.detail}
                      </Text>
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.accent} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 12 }]}
              onPress={() => setShowWorkoutLengthModal(false)}
              disabled={recommending}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
      </WorkoutModalShell>

      <Modal visible={showDeloadConfirmModal} transparent animationType="fade" onRequestClose={() => setShowDeloadConfirmModal(false)}>
        <View style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>Apply deload?</Text>
            <Text style={styles.modalText}>
              This creates a lighter session with 15% less weight and about 40% fewer sets. Your saved routine will not be changed.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={() => setShowDeloadConfirmModal(false)}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.modalActionButton, styles.modalPrimaryButton]}
                onPress={applySelectedRoutineDeload}
              >
                <Text style={styles.primaryText}>Apply deload</Text>
              </TouchableOpacity>
            </View>
          </AdaptiveModalCard>
        </View>
      </Modal>

      <Modal visible={showExerciseHistoryModal} transparent animationType="fade" onRequestClose={() => setShowExerciseHistoryModal(false)}>
        <View style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>{historyExerciseName ?? "Exercise"} history</Text>
            {exerciseHistory.length ? (
              <ScrollView style={styles.exerciseHistoryList}>
                {shouldShowStrengthProgress ? (
                  <ExerciseProgressSummary insights={exerciseProgressInsights} effortScale={effortScale} />
                ) : null}
                {exerciseHistory.map((entry, index) => (
                  <View key={`${entry.date.getTime()}-${entry.sets.length}-${index}`} style={styles.exerciseHistoryRow}>
                    <View style={styles.exerciseHistoryDateRow}>
                      <Text style={styles.exerciseHistoryDate}>
                        {entry.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                      {exerciseProgressByDate.get(entry.date.getTime())?.isStrengthPr ? (
                        <Text style={styles.exerciseHistoryPrBadge}>PR</Text>
                      ) : null}
                    </View>
                    <View style={styles.exerciseHistorySetList}>
                      {entry.sets.map((set, setIndex) => (
                        <Text key={`${entry.date.getTime()}-${index}-${setIndex}`} style={styles.exerciseHistorySets}>
                          Set {setIndex + 1}: {formatLastSetSummary(set)}
                        </Text>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.modalText}>No completed records yet.</Text>
            )}
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 12 }]}
              onPress={() => setShowExerciseHistoryModal(false)}
            >
              <Text style={styles.secondaryText}>Close</Text>
            </TouchableOpacity>
          </AdaptiveModalCard>
        </View>
      </Modal>

      <Modal visible={showRoutineDeleteModal} transparent animationType="fade" onRequestClose={() => { setShowRoutineDeleteModal(false); setSelectedRoutine(null); }}>
        <View style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
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
          </AdaptiveModalCard>
        </View>
      </Modal>

      <Modal visible={showWorkoutSavedModal} transparent animationType="fade" onRequestClose={closeRoutineUpdateAfterFinish}>
        <View style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>Workout saved</Text>
            <Text style={styles.modalText}>Your workout has been saved.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.primaryButton, styles.modalActionButton, styles.modalPrimaryButton]}
                onPress={continueAfterWorkoutSaved}
              >
                <Text style={styles.primaryText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </AdaptiveModalCard>
        </View>
      </Modal>

      <Modal visible={showRoutineUpdateAfterFinishModal} transparent animationType="fade" onRequestClose={closeRoutineUpdateAfterFinish}>
        <View style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update routine?</Text>
            <Text style={styles.modalText}>
              Use this workout&apos;s exercise order, sets, and weights as the new routine baseline? Effort ratings are not saved to routines.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={closeRoutineUpdateAfterFinish}
              >
                <Text style={styles.secondaryText}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.modalActionButton, styles.modalPrimaryButton]}
                onPress={() => void updateAppliedRoutineAfterFinish()}
              >
                <Text style={styles.primaryText}>Update routine</Text>
              </TouchableOpacity>
            </View>
          </AdaptiveModalCard>
        </View>
      </Modal>

      <Modal visible={showRoutineUpdatedConfirmationModal} transparent animationType="fade" onRequestClose={closeRoutineUpdateAfterFinish}>
        <View style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>Routine updated</Text>
            <Text style={styles.modalText}>
              Your routine now uses this workout&apos;s exercise order, sets, and weights. Effort ratings were not saved.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.primaryButton, styles.modalActionButton, styles.modalPrimaryButton]}
                onPress={closeRoutineUpdateAfterFinish}
              >
                <Text style={styles.primaryText}>Done</Text>
              </TouchableOpacity>
            </View>
          </AdaptiveModalCard>
        </View>
      </Modal>

      <Modal visible={showRoutineNameModal} transparent animationType="fade" onRequestClose={() => { setShowRoutineNameModal(false); setEditingRoutineId(null); setRoutineFormError(null); }}>
        <KeyboardAwareModalFrame style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingRoutineId ? "Update routine" : "Save routine"}</Text>
            <TextInput disableFullscreenUI
              placeholder="Routine name"
              placeholderTextColor={colors.muted}
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
          </AdaptiveModalCard>
        </KeyboardAwareModalFrame>
      </Modal>

      <Modal visible={showDatePickerModal} transparent animationType="fade" onRequestClose={() => setShowDatePickerModal(false)}>
        <View style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() =>
                  setDatePickerMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }
              >
                <Ionicons name="chevron-back" size={16} color={colors.muted} />
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
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
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
          </AdaptiveModalCard>
        </View>
      </Modal>

      <Modal visible={showDurationModal} transparent animationType="fade" onRequestClose={() => setShowDurationModal(false)}>
        <KeyboardAwareModalFrame style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>Adjust duration</Text>
            <Text style={styles.modalText}>Set workout duration (hours and minutes).</Text>
            <View style={styles.durationFieldRow}>
              <TextInput selectTextOnFocus disableFullscreenUI
                placeholder="00"
                placeholderTextColor={colors.muted}
                value={durationAdjustHoursText}
                onChangeText={setDurationAdjustHoursText}
                keyboardType="numeric"
                maxLength={2}
                style={styles.durationFieldInput}
              />
              <Text style={styles.durationFieldColon}>:</Text>
              <TextInput selectTextOnFocus disableFullscreenUI
                placeholder="00"
                placeholderTextColor={colors.muted}
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
          </AdaptiveModalCard>
        </KeyboardAwareModalFrame>
      </Modal>

      <Modal visible={showCardioTimeModal} transparent animationType="fade" onRequestClose={() => { setShowCardioTimeModal(false); setCardioTimeTarget(null); }}>
        <KeyboardAwareModalFrame style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set Cardio Time</Text>
            <View style={styles.durationFieldRow}>
              <TextInput selectTextOnFocus disableFullscreenUI
                placeholder="00"
                placeholderTextColor={colors.muted}
                value={cardioTimeHoursText}
                onChangeText={setCardioTimeHoursText}
                keyboardType="numeric"
                maxLength={2}
                style={styles.durationFieldInput}
              />
              <Text style={styles.durationFieldColon}>:</Text>
              <TextInput selectTextOnFocus disableFullscreenUI
                placeholder="00"
                placeholderTextColor={colors.muted}
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
          </AdaptiveModalCard>
        </KeyboardAwareModalFrame>
      </Modal>

      <Modal visible={showCardioDistanceModal} transparent animationType="fade" onRequestClose={() => { setShowCardioDistanceModal(false); setCardioDistanceTarget(null); }}>
        <KeyboardAwareModalFrame style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set Distance</Text>
            <Text style={styles.modalText}>Whole and decimal values.</Text>
            <View style={styles.durationFieldRow}>
              <TextInput selectTextOnFocus={false} disableFullscreenUI
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={cardioDistanceWholeText}
                ref={distanceWholeRef}
                onFocus={() => distanceWholeEntry.selectInitial(cardioDistanceWholeText)}
                onChangeText={(value) => { distanceWholeEntry.changed(); setCardioDistanceWholeText(value); }}
                keyboardType="numeric"
                maxLength={3}
                style={styles.durationFieldInput}
              />
              <Text style={styles.durationFieldColon}>.</Text>
              <TextInput selectTextOnFocus={false} disableFullscreenUI
                placeholder="00"
                placeholderTextColor={colors.muted}
                value={cardioDistanceDecimalText}
                ref={distanceDecimalRef}
                onFocus={() => distanceDecimalEntry.selectInitial(cardioDistanceDecimalText)}
                onChangeText={(value) => { distanceDecimalEntry.changed(); setCardioDistanceDecimalText(value); }}
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
          </AdaptiveModalCard>
        </KeyboardAwareModalFrame>
      </Modal>

      <Modal visible={showFinishModal} transparent animationType="fade" onRequestClose={() => setShowFinishModal(false)}>
        <KeyboardAwareModalFrame style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>Finish workout</Text>
            <Text style={styles.modalText}>{totalSets} sets planned. Only completed sets are saved.</Text>
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
                <TextInput disableFullscreenUI
                  placeholder="e.g., Upper body"
                  placeholderTextColor={colors.muted}
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
          </AdaptiveModalCard>
        </KeyboardAwareModalFrame>
      </Modal>

      <Modal visible={showTempoEditorModal} transparent animationType="fade" onRequestClose={closeTempoEditor}>
        <View style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
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
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.rule}
                  thumbTintColor={colors.muted}
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
          </AdaptiveModalCard>
        </View>
      </Modal>

      <Modal visible={showDiscardConfirmModal} transparent animationType="fade" onRequestClose={() => setShowDiscardConfirmModal(false)}>
        <View style={styles.modalBackdrop}>
          <AdaptiveModalCard style={styles.modalCard}>
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
          </AdaptiveModalCard>
        </View>
      </Modal>

      <WorkoutModalShell visible={showSetTypeHelp} onRequestClose={() => setShowSetTypeHelp(false)} backdropStyle={styles.modalBackdrop} cardStyle={styles.modalCard}>
        <Text style={styles.modalTitle}>Set types</Text>
        <Text style={styles.modalText}>Warm-up: lighter preparation set.</Text><Text style={styles.modalText}>Normal: standard working set.</Text><Text style={styles.modalText}>Failure: pushed to failure.</Text><Text style={styles.modalText}>Drop: reduce load and continue.</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowSetTypeHelp(false)}><Text style={styles.secondaryText}>Close</Text></TouchableOpacity>
      </WorkoutModalShell>
      <Modal visible={Boolean(activeSetMenu) && !showSetTypeHelp} transparent animationType="fade" onRequestClose={closeSetMenu}>
        <View style={[styles.sheetBackdrop, { paddingBottom: insets.bottom + 16, paddingTop: insets.top + 16 }]}>
          <TouchableWithoutFeedback onPress={closeSetMenu} accessibilityLabel="Dismiss set options">
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <AdaptiveModalCard contentSized style={[styles.sheetCard, { maxHeight: Math.max(120, (height - insets.top - insets.bottom - 32) * 0.65) }]}>
            <View style={styles.sheetTitleRow}>
              <Text style={styles.modalTitle}>Set options</Text>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setShowSetTypeHelp(true)}
                accessibilityLabel="Explain set types"
              >
                <Ionicons name="help-circle-outline" size={18} color={colors.muted} />
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
          </AdaptiveModalCard>
        </View>
      </Modal>

          </ScrollView>
        </GestureDetector>
        {runningRest && keyboardHeight === 0 ? <View style={[styles.sourceRow, { borderTopWidth: 1, borderTopColor: colors.rule, paddingHorizontal: 20, paddingVertical: 8 }]}><View style={{ flex: 1 }}><Text style={styles.muted}>{runningRest.name}</Text><RestTimerText style={styles.sectionTitle} clock={restTimerByExercise[runningRest.id]} prefix="Rest " /></View><TouchableOpacity style={styles.textAction} onPress={() => restTimerByExercise[runningRest.id]?.running ? pauseRestTimer(runningRest.id) : startRestTimer(runningRest.id)}><Text style={styles.linkText}>{restTimerByExercise[runningRest.id]?.running ? "Pause" : "Resume"}</Text></TouchableOpacity><TouchableOpacity style={styles.textAction} onPress={() => resetRestTimer(runningRest.id)}><Text style={styles.linkText}>Skip</Text></TouchableOpacity></View> : null}
        </View>
      </KeyboardAvoidingView>

      {availableWeightsTarget ? (
        <AvailableWeightsModal
          key={`${activeUid}:${availableWeightsTarget.name}`}
          name={availableWeightsTarget.name}
          defaultUnit={availableWeightsTarget.unit}
          settings={availableWeightsPreferences.values[weightPreferenceKey(availableWeightsTarget.name)] ?? null}
          onClose={() => setAvailableWeightsTarget(null)}
          onSave={(settings) => availableWeightsPreferences.save(availableWeightsTarget.name, settings)}
        />
      ) : null}
      <TodayPlanContextModal
        key={`${todayPlan.contextVisible}:${todayGuidance?.createdAt.toMillis() ?? 0}`}
        visible={todayPlan.contextVisible}
        context={todayGuidance?.inputs.dailyContext ?? null}
        plan={guidanceWorkout}
        saving={todayPlan.contextSaving}
        onClose={() => { todayPlan.setContextVisible(false); setShowTodayGuidance(true); }}
        onSave={(context) => void todayPlan.saveContext(context)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: NotebookColors) => { const base = notebookSheet({
  screen: { flex: 1, backgroundColor: colors.canvas },
  keyboardAvoiding: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.canvas },
  scrollShell: { flex: 1 },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 20, paddingTop: 8, paddingBottom: 140 },
  header: { width: "100%", maxWidth: 760, alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
      backgroundColor: colors.subtle,
      alignItems: "center",
      justifyContent: "center",
    },
  discardHeaderButton: {
    borderColor: colors.danger,
    borderWidth: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.danger,
  },
  headerSpacer: { width: 22 },
  title: { color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: 22, fontWeight: "800" },
  card: {
    backgroundColor: colors.subtle,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "700", marginBottom: 10 },
  input: {
    backgroundColor: colors.subtle,
    color: colors.ink,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    backgroundColor: colors.canvas,
    zIndex: 2,
    columnGap: 10,
    rowGap: 8,
  },
  sessionButtonRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  sessionActionButton: { flex: 1, marginTop: 0 },
  halfInput: { flexBasis: "48%", flexGrow: 1, minWidth: 120, marginBottom: 0 },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  primaryText: { color: colors.onPrimary, fontWeight: "700" },
  secondaryButton: {
    backgroundColor: colors.ink,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryText: { color: colors.accent, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  muted: { color: colors.muted },
  exerciseBlock: { marginTop: 8 },
  exerciseNameButton: { flex: 1, flexShrink: 1, marginLeft: 6 },
  exerciseName: { color: colors.ink, fontWeight: "700", marginBottom: 0 },
  exerciseDemoThumbButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    backgroundColor: colors.subtle,
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
    borderColor: colors.rule,
    backgroundColor: colors.subtle,
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
    color: colors.ink,
  },
  restTimerInlineButton: {
    marginBottom: 0,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    backgroundColor: colors.subtle,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  restTimerInlineText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  durationFieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 6,
  },
  durationFieldInput: {
    width: 88,
    backgroundColor: colors.subtle,
    color: colors.ink,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "800",
  },
  durationFieldColon: { color: colors.ink, fontSize: 28, fontWeight: "800" },
  durationFieldLabelRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 36,
    marginBottom: 8,
  },
  durationFieldLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  tempoSliderRow: { marginBottom: 10 },
  tempoSliderLabel: { color: colors.ink, marginBottom: 4, fontWeight: "600" },
  tempoSlider: { width: "100%", height: 28 },
  tempoSliderValue: { color: colors.ink, fontWeight: "700", textAlign: "right" },
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
  calendarWeekdayText: { color: colors.muted, width: 34, textAlign: "center", fontWeight: "700" },
  calendarDayButton: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDayOutside: { opacity: 0.45 },
  calendarDaySelected: { backgroundColor: colors.primary },
  calendarDayText: { color: colors.muted, fontWeight: "600" },
  calendarDayTextOutside: { color: colors.muted },
  calendarDayTextSelected: { color: colors.ink, fontWeight: "700" },
  setHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    marginBottom: 2,
  },
  setHeaderRowTablet: { gap: 10 },
  // Mirrors the native notebook row: Set, 96px Last, three fields, then 44px Done.
  nativeSetHeaderRow: { gap: 0, paddingHorizontal: 0 },
  setHeaderText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  setHeaderSet: { width: 24, textAlign: "center" },
  setHeaderCheck: { width: 24, textAlign: "center" },
  cardioSetHeaderCheck: { width: 34 },
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
  setLabel: { color: colors.muted, fontWeight: "700", fontSize: 13, width: 24, textAlign: "center" },
  setLabelTablet: { width: 28, fontSize: 15 },
  lastSetButton: { width: 84 },
  lastSetText: { width: 84, color: colors.muted, fontSize: 11, lineHeight: 14 },
  cardioTapValue: { color: colors.ink, textAlign: "center", fontWeight: "700" },
  cardioMetaRow: { marginTop: 8 },
  cardioMetaLabel: { color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  distanceUnitSuffix: { color: colors.muted, fontSize: 16, fontWeight: "700", marginLeft: 4 },
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
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.accent,
  },
  cardioCheckboxMark: { color: colors.onPrimary, fontSize: 12, fontWeight: "700", lineHeight: 14 },
  inlineUndoBanner: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  inlineUndoBannerText: { color: colors.ink, fontSize: 13, fontWeight: "600", flex: 1 },
  inlineUndoBannerAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
  inlineUndoBannerActionText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  replacementEmptyText: { color: colors.muted, fontSize: 13, lineHeight: 19, paddingVertical: 12 },
  pickerCard: {
    backgroundColor: colors.subtle,
    borderRadius: 12,
    padding: 8,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  pickerRow: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pickerRowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  pickerText: { color: colors.ink, fontWeight: "600" },
  exercisePickerLoading: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  customRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  miniButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  miniButtonText: { color: colors.ink, fontWeight: "700" },
  emptyCard: {
    backgroundColor: colors.subtle,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  routineActionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  routineActionButton: { flex: 1 },
  routineBuilderBanner: {
    marginTop: 10,
    borderRadius: 12,
    padding: 10,
    backgroundColor: colors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 4,
  },
  feedbackBanner: {
    marginTop: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.subtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  feedbackBannerText: { color: colors.ink, fontSize: 12, fontWeight: "700", flex: 1 },
  feedbackBannerAction: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  feedbackBannerActionText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  recommendationCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 4,
  },
  recommendationLine: { color: colors.ink, fontSize: 12, lineHeight: 18 },
  routineCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    backgroundColor: colors.subtle,
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
    backgroundColor: colors.primary,
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
    borderColor: colors.rule,
    backgroundColor: colors.subtle,
  },
  toggleChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.accent,
  },
  toggleText: { color: colors.ink, fontWeight: "700" },
  toggleTextActive: { color: colors.onPrimary },
  groupChips: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  groupChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    backgroundColor: colors.subtle,
  },
  groupChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.accent,
  },
  groupChipText: { color: colors.ink, fontWeight: "700" },
  groupChipTextActive: { color: colors.onPrimary },
  focusChipRow: { gap: 8, paddingTop: 10 },
  exerciseHistoryList: { maxHeight: 460 },
  exerciseHistoryRow: { gap: 4, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
  exerciseHistorySetList: { gap: 3 },
  exerciseHistoryDateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  exerciseHistoryDate: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  exerciseHistoryPrBadge: {
    color: colors.ink,
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 9,
    fontWeight: "900",
  },
  exerciseHistorySets: { color: colors.ink, fontSize: 13, lineHeight: 19 },
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
    backgroundColor: colors.danger,
    borderRadius: 10,
    width: 88,
    height: 42,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  swipeDeleteText: { color: colors.ink, fontWeight: "700", fontSize: 12 },
  iconButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.subtle,
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
  phaseLinkText: { color: colors.accent, fontWeight: "700" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: colors.canvas,
    borderRadius: 16,
    padding: 20,
    width: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  modalTitle: { color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  modalText: { color: colors.ink, marginBottom: 4 },
  recommendationLengthList: { gap: 8, marginTop: 12 },
  recommendationLengthOption: {
    minHeight: 70,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    backgroundColor: colors.subtle,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recommendationLengthOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  recommendationLengthTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  recommendationLengthTitleActive: { color: colors.accent },
  recommendationLengthDetail: { color: colors.muted, fontSize: 13, marginTop: 3 },
  recommendationLengthDetailActive: { color: colors.ink },
  exerciseOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rule,
  },
  exerciseOptionUnits: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  exerciseReorderRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rule,
  },
  exerciseMoveRow: { flexDirection: "row", gap: 6, marginLeft: "auto" },
  exerciseMoveButton: {
    minWidth: 66,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    backgroundColor: colors.subtle,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  exerciseMoveText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  exerciseUnitChip: { paddingVertical: 6, paddingHorizontal: 10 },
  exerciseOptionText: { color: colors.ink, fontWeight: "700", fontSize: 14 },
  demoImageRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  demoImage: { width: "48%", aspectRatio: 1, borderRadius: 10 },
  modalErrorText: { color: colors.danger, marginBottom: 8, fontWeight: "600" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  modalActionButton: { flex: 1 },
  modalPrimaryButton: { marginTop: 0, paddingVertical: 12 },
  dangerButton: {
    backgroundColor: colors.danger,
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
    borderColor: colors.rule,
    backgroundColor: colors.subtle,
  },
  answerChipActive: { backgroundColor: colors.primary, borderColor: colors.accent },
  answerText: { color: colors.ink, fontWeight: "700", fontSize: 12 },
  answerTextActive: { color: colors.onPrimary },
  baselineBanner: {
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  baselineText: { color: colors.ink, fontWeight: "700" },
  baselineSub: { color: colors.muted, marginTop: 4 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  sheetCard: {
    width: "100%",
    backgroundColor: colors.canvas,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
}); return { ...base, ...notebookSheet({
  card: { backgroundColor: colors.canvas, borderRadius: 0, paddingVertical: 24, paddingHorizontal: 0, marginTop: 0, borderWidth: 0, borderTopWidth: 1, borderColor: colors.rule },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "600", marginBottom: 16 },
  input: { backgroundColor: colors.surface, color: colors.ink, borderWidth: 1, borderColor: colors.border, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 10, minHeight: 48, fontSize: 16, marginBottom: 10 },
  primaryButton: { backgroundColor: colors.primary, minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 8 },
  secondaryButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  primaryText: { color: colors.onPrimary, fontWeight: "600", fontSize: 16 }, secondaryText: { color: colors.ink, fontWeight: "600", fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end", paddingHorizontal: 0 },
  modalCard: { width: "100%", maxWidth: 560, backgroundColor: colors.surface, borderRadius: 16, padding: 20, gap: 12 },
  modalActions: { flexDirection: "column", gap: 12, marginTop: 20 }, modalActionButton: { flex: 0, width: "100%" },
  exerciseOrdinal: { color: colors.muted, fontSize: 13, minWidth: 24 },
  exerciseName: { color: colors.ink, fontWeight: "600", fontSize: 20 },
  exerciseNameButton: { flex: 1, flexShrink: 1, marginLeft: 0, minHeight: 48, justifyContent: "center" },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  inlineTipRow: { flexDirection: "row", gap: 12, marginVertical: 4 },
  restTimerInlineButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 44, gap: 6 },
  restTimerInlineText: { color: colors.muted, fontSize: 13 },
  exerciseMetaNotesSingle: { marginTop: 4, marginBottom: 8 }, noteLabel: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  emptyHeading: { paddingVertical: 24, gap: 12 }, sessionTitle: { color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: 26, fontWeight: "600" },
  sourceRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  textAction: { minHeight: 48, justifyContent: "center", paddingVertical: 8 }, linkText: { color: colors.accent, fontSize: 16, fontWeight: "600" },
  setHeaderCheck: { width: 44, textAlign: "center" }, cardioSetHeaderCheck: { width: 44 },
  checkboxHitbox: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  nativeSetHeaderCheck: { width: 44 }, nativeSetHeaderLast: { width: 96, marginLeft: 4 },
  nativeSetHeaderInput: { marginLeft: 4 }, setColRpe: { flex: 1, textAlign: "center" },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderRadius: 4, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: "center", alignItems: "center" },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary }, cardioCheckboxMark: { color: colors.onPrimary, fontSize: 12, fontWeight: "700" },
  answerTextActive: { color: colors.onPrimary }, groupChipTextActive: { color: colors.onPrimary },
  sessionControls: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.rule },
  sessionActionRow: { flexDirection: "row", gap: 16 },
  sessionAction: { flex: 1, minHeight: 48, justifyContent: "center", paddingVertical: 8 },
  sessionActionRight: { alignItems: "flex-end" },
  routineMenuRow: { minHeight: 52, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.rule, justifyContent: "center" },
  activeSet: { backgroundColor: colors.accentSoft, borderLeftWidth: 2, borderLeftColor: colors.accent },
  setHelp: { gap: 8, paddingVertical: 12 },
  restCustomRow: { ...base.restCustomRow, marginTop: 20 },
  durationFieldInput: { ...base.durationFieldInput, width: 112, minWidth: 88, flexShrink: 1, fontSize: 24, paddingHorizontal: 8, minHeight: 52 },
}) }; };
