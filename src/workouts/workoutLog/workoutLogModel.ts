import type { EffortInput } from "../effortScale";
export type Unit = "kg" | "lbs" | "km" | "mi";
export type SetType = "warmup" | "normal" | "failure" | "drop";
export type ExerciseMode = "resistance" | "cardio";
export type RecommendationFocusId =
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
export type RecommendationLengthId = "quick" | "standard" | "extended";
export type SetEntry = {
  weightKg: number | null;
  // Preserve partially typed decimals such as "20." until the user finishes the value.
  weightText?: string;
  reps: string;
  rpe?: string;
  targetRpe?: number | null;
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
export type Exercise = {
  plannedRestSec?: number;
  mode?: ExerciseMode;
  id: string;
  name: string;
  notes?: string;
  tempo?: string;
  cardioSessionType?: "steady" | "intervals" | "sprint" | "recovery";
  cardioEffortLevel?: "easy" | "moderate" | "hard" | "max";
  sets: SetEntry[];
};
export type FollowedAnswer = "yes" | "partial" | "no";
export type HelpfulAnswer = "yes" | "neutral" | "no";
export type PastWorkout = {
  id: string;
  title: string;
  date: Date;
  durationMin?: number | null;
  exercises: {
    name: string;
    notes?: string;
    tempo?: string;
    zone?: string;
    unit?: Unit;
    restSec?: number;
    mode?: ExerciseMode;
    cardioSessionType?: "steady" | "intervals" | "sprint" | "recovery";
    cardioEffortLevel?: "easy" | "moderate" | "hard" | "max";
    sets: {
      weightKg: number | null;
      reps: string;
      rpe?: string;
      targetRpe?: number | null;
      distanceKm?: number | null;
      durationSec?: number | null;
      zone?: string;
      setType?: SetType;
    }[];
  }[];
};

export const isSameDateKey = (left: string, right: string) =>
  left.trim() === right.trim();

export type Routine = {
  id: string;
  name: string;
  sharedSnapshotId?: string;
  exercises: {
    name: string;
    notes?: string;
    tempo?: string;
    zone?: string;
    unit?: Unit;
    restSec?: number;
    mode?: ExerciseMode;
    cardioSessionType?: "steady" | "intervals" | "sprint" | "recovery";
    cardioEffortLevel?: "easy" | "moderate" | "hard" | "max";
    sets: {
      reps: string;
      targetRpe?: number | null;
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

export const DRAFT_KEY_PREFIX = "workout-log-draft-v1";
export const FAVORITES_KEY = "workout-favorite-exercises-v1";
export const FAVORITES_KEY_PREFIX = "workout-favorite-exercises-v1";
export const REST_PREFS_KEY = "workout-rest-preferences-v1";
export const REST_PREFS_KEY_PREFIX = "workout-rest-preferences-v1";
export const RECOMMENDATION_LENGTH_KEY_PREFIX =
  "workout-recommendation-length-v1";
export const TEMPO_FORMAT_HINT =
  "Use eccentric-hold-concentric-hold (e.g. 3-0-X-0). Numbers are seconds, X is explosive.";
export const TEMPO_TOKENS = ["X", "0", "1", "2", "3"] as const;
export const DEFAULT_TEMPO = "3-0-X-0";
export const DEFAULT_TEMPO_INDICES = [4, 1, 0, 1];
export const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;
export const MONTH_LABELS = [
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
export const SET_TYPE_LABELS: {
  value: SetType;
  title: string;
  marker: string;
  description: string;
}[] = [
  {
    value: "warmup",
    title: "Warm-up",
    marker: "W",
    description: "Prep set with lighter load.",
  },
  {
    value: "normal",
    title: "Normal",
    marker: "N",
    description: "Standard working set.",
  },
  {
    value: "failure",
    title: "Failure",
    marker: "F",
    description: "Set pushed to failure.",
  },
  {
    value: "drop",
    title: "Drop",
    marker: "D",
    description: "Immediately reduce load and continue.",
  },
];
export const CARDIO_SESSION_TYPES = [
  { value: "steady", label: "Steady" },
  { value: "intervals", label: "Intervals" },
  { value: "sprint", label: "Sprint" },
  { value: "recovery", label: "Recovery" },
] as const;
export const CARDIO_EFFORT_LEVELS = [
  { value: "easy", label: "Easy" },
  { value: "moderate", label: "Moderate" },
  { value: "hard", label: "Hard" },
  { value: "max", label: "Max" },
] as const;
export const RECOMMENDATION_FOCUSES: {
  id: RecommendationFocusId;
  label: string;
  template?: { name: string; primaryGroup: string; exercises: string[] };
}[] = [
  { id: "auto", label: "Auto" },
  {
    id: "chest",
    label: "Chest",
    template: {
      name: "Chest",
      primaryGroup: "chest",
      exercises: ["Bench Press", "Incline Dumbbell Press", "Cable Fly"],
    },
  },
  {
    id: "chest-triceps",
    label: "Chest + Triceps",
    template: {
      name: "Chest + Triceps",
      primaryGroup: "chest",
      exercises: ["Bench Press", "Incline Dumbbell Press", "Tricep Pushdown"],
    },
  },
  {
    id: "back",
    label: "Back",
    template: {
      name: "Back",
      primaryGroup: "back",
      exercises: ["Barbell Row", "Lat Pulldown", "Seated Cable Row"],
    },
  },
  {
    id: "back-biceps",
    label: "Back + Biceps",
    template: {
      name: "Back + Biceps",
      primaryGroup: "back",
      exercises: ["Barbell Row", "Lat Pulldown", "Bicep Curl"],
    },
  },
  {
    id: "legs",
    label: "Legs",
    template: {
      name: "Legs",
      primaryGroup: "legs",
      exercises: ["Squat", "Romanian Deadlift", "Leg Press"],
    },
  },
  {
    id: "anterior-legs",
    label: "Anterior Legs",
    template: {
      name: "Anterior Legs",
      primaryGroup: "legs",
      exercises: ["Squat", "Leg Press", "Leg Extension"],
    },
  },
  {
    id: "posterior-legs",
    label: "Posterior Legs",
    template: {
      name: "Posterior Legs",
      primaryGroup: "legs",
      exercises: ["Romanian Deadlift", "Leg Curl", "Hip Thrust"],
    },
  },
  {
    id: "shoulders",
    label: "Shoulders",
    template: {
      name: "Shoulders",
      primaryGroup: "shoulders",
      exercises: ["Overhead Press", "Lateral Raise", "Rear Delt Fly"],
    },
  },
  {
    id: "shoulders-arms",
    label: "Shoulders + Arms",
    template: {
      name: "Shoulders + Arms",
      primaryGroup: "shoulders",
      exercises: [
        "Overhead Press",
        "Lateral Raise",
        "Bicep Curl",
        "Tricep Pushdown",
      ],
    },
  },
  {
    id: "arms",
    label: "Arms",
    template: {
      name: "Arms",
      primaryGroup: "arms",
      exercises: ["Bicep Curl", "Tricep Pushdown", "Skullcrusher"],
    },
  },
  {
    id: "push",
    label: "Push",
    template: {
      name: "Push",
      primaryGroup: "chest",
      exercises: ["Bench Press", "Overhead Press", "Tricep Pushdown"],
    },
  },
  {
    id: "pull",
    label: "Pull",
    template: {
      name: "Pull",
      primaryGroup: "back",
      exercises: ["Barbell Row", "Lat Pulldown", "Bicep Curl"],
    },
  },
];
export const RECOMMENDATION_LENGTHS: {
  id: RecommendationLengthId;
  title: string;
  detail: string;
  exerciseCount: number;
  targetHardSets: number;
}[] = [
  {
    id: "quick",
    title: "Quick",
    detail: "30-40 min | 8-10 hard sets",
    exerciseCount: 3,
    targetHardSets: 9,
  },
  {
    id: "standard",
    title: "Standard",
    detail: "45-60 min | 12-16 hard sets",
    exerciseCount: 4,
    targetHardSets: 14,
  },
  {
    id: "extended",
    title: "Extended",
    detail: "60-75 min | 16-20 hard sets",
    exerciseCount: 5,
    targetHardSets: 18,
  },
];
export const isValidSetType = (value: string): value is SetType =>
  value === "warmup" ||
  value === "normal" ||
  value === "failure" ||
  value === "drop";
export const toSetType = (value: unknown): SetType =>
  typeof value === "string" && isValidSetType(value) ? value : "normal";
export const toLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

export const isValidTempo = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^(?:\d+|[xX])-(?:\d+|[xX])-(?:\d+|[xX])-(?:\d+|[xX])$/.test(trimmed);
};

export const tempoTokenToIndex = (token: string) => {
  const normalized = token.trim().toUpperCase();
  const idx = TEMPO_TOKENS.findIndex((item) => item === normalized);
  return idx >= 0 ? idx : null;
};

export const parseTempoToIndices = (tempo?: string) => {
  const candidate = (tempo || "").trim() || DEFAULT_TEMPO;
  const parts = candidate.split("-");
  if (parts.length !== 4) return [...DEFAULT_TEMPO_INDICES];
  const mapped = parts.map((part) => tempoTokenToIndex(part));
  if (mapped.some((value) => value == null)) return [...DEFAULT_TEMPO_INDICES];
  return mapped as number[];
};

export const formatTempoFromIndices = (indices: number[]) =>
  indices
    .slice(0, 4)
    .map(
      (index) =>
        TEMPO_TOKENS[Math.max(0, Math.min(TEMPO_TOKENS.length - 1, index))],
    )
    .join("-");

export const formatWeightInput = (
  weightKg: number | null,
  targetUnit: Unit,
) => {
  if (weightKg === null || Number.isNaN(weightKg)) return "";
  const val = targetUnit === "kg" ? weightKg : weightKg * 2.20462;
  return `${Math.round(val * 10) / 10}`;
};

export const normalizeExerciseName = (value: string) =>
  value.trim().toLowerCase();
export function indexPreviousExerciseSets(pastWorkouts: PastWorkout[]) {
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

export const getSetTypeMarker = (
  set: SetEntry,
  index: number,
  sets: SetEntry[],
) => {
  const type = toSetType(set.setType);
  if (type === "warmup") return "W";
  if (type === "failure") return "F";
  if (type === "drop") return "D";
  return String(
    sets.slice(0, index + 1).filter((row) => row.setType !== "warmup").length,
  );
};

export const formatDistanceInput = (distanceKm: number | null, unit: Unit) => {
  if (distanceKm == null || Number.isNaN(distanceKm)) return "";
  const value = unit === "mi" ? distanceKm / 1.60934 : distanceKm;
  return `${Math.round(value * 100) / 100}`;
};

export const formatDurationHoursMinutes = (durationSec: number | null) => {
  if (durationSec == null || Number.isNaN(durationSec)) return "";
  const totalMinutes = Math.floor(durationSec / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

export const formatDurationInput = (durationSec: number | null) => {
  if (durationSec == null || Number.isNaN(durationSec)) return "";
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const imageLookupKey = (exerciseName: string) =>
  exerciseName.trim().toLowerCase();
