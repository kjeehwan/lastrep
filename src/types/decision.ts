import type { Timestamp } from "firebase/firestore";
import type { AvailableWeights } from "../workouts/availableWeights";

export type Decision = "PUSH" | "MAINTAIN" | "PULL_BACK";
export type TrainingPhase = "Hypertrophy" | "Strength" | "Power";
export type DietPhase = "Cut" | "Maintain" | "Bulk";
export type CalorieTargetAdherence = "below_target" | "on_target" | "above_target";
export type DecisionSleepSource = "manual" | "health";

export type PlannedWorkoutSource = "draft" | "program" | "rest_day" | "none";
export type PerformanceTrend = "improving" | "stable" | "declining" | "insufficient";
export type PainArea =
  | "shoulder"
  | "elbow"
  | "wrist_hand"
  | "upper_back"
  | "lower_back"
  | "hip"
  | "knee"
  | "ankle_foot"
  | "other";
export type PainSide = "left" | "right" | "both" | "not_applicable";
export type PainSeverity = "mild" | "moderate" | "severe";
export type PainTrigger =
  | "at_rest"
  | "pressing"
  | "pulling"
  | "overhead"
  | "squatting"
  | "hinging"
  | "running_impact"
  | "other";
export type ActivityType =
  | "long_walk_hike"
  | "running"
  | "cycling"
  | "sport"
  | "physical_work"
  | "travel"
  | "other";
export type ActivityTiming = "today" | "yesterday" | "two_days_ago";
export type ActivityEffort = "light" | "moderate" | "hard";
export type ActivityDuration = "under_1h" | "1_to_2h" | "over_2h";

export type PlannedWorkoutSummary = {
  source: PlannedWorkoutSource;
  title: string | null;
  exerciseNames: string[];
  exercises?: PlannedExerciseSummary[];
};

export type PlannedExerciseSummary = {
  name: string;
  mode: "resistance" | "cardio";
  availableWeights?: AvailableWeights;
  sets: {
    weightKg: number | null;
    reps: number | null;
    setType: "warmup" | "normal" | "failure" | "drop";
    done: boolean;
  }[];
};

export type ExercisePerformanceSummary = {
  exerciseName: string;
  sessions: number;
  daysSinceLast: number | null;
  lastTopWeightKg: number | null;
  lastTopReps: number | null;
  lastAverageRpe: number | null;
  estimated1RmKg: number | null;
  trend: PerformanceTrend;
};

export type RecentTrainingSummary = {
  lastWorkoutHoursAgo: number | null;
  lastWorkoutTitle: string | null;
  workoutsLast7Days: number;
  exercisePerformance: ExercisePerformanceSummary[];
};

export type PainContext = {
  area: PainArea;
  side: PainSide;
  severity: PainSeverity;
  trigger: PainTrigger;
  note: string | null;
  affectsPlannedWorkout: boolean;
};

export type AdditionalActivityContext = {
  type: ActivityType;
  timing: ActivityTiming;
  effort: ActivityEffort;
  duration: ActivityDuration;
  overlapsPlannedWorkout: boolean;
};

export type DailyDecisionContext = {
  dateKey: string;
  pain: PainContext | null;
  additionalActivity: AdditionalActivityContext | null;
  note: string | null;
};

export type DecisionNutritionSummary = {
  caloriesConsumedToday: number;
  proteinGramsToday: number | null;
  calorieTarget: number | null;
  yesterdayCalories: number | null;
  yesterdayAdherence: CalorieTargetAdherence | null;
  recentAdherence: CalorieTargetAdherence | null;
  recentCompletedDaysTracked: number;
};

export type DecisionInputs = {
  sleepHours: number;
  sleepSource: DecisionSleepSource;
  sleepSampleAgeHours: number | null;
  soreness: number;
  fatigue: number;
  motivation: number;
  trainingPhase: TrainingPhase;
  dietPhase: DietPhase;
  nutrition?: DecisionNutritionSummary | null;
  plannedWorkout?: PlannedWorkoutSummary | null;
  recentTraining?: RecentTrainingSummary | null;
  dailyContext?: DailyDecisionContext | null;
};

export type DecisionOutput = {
  decision: Decision;
  headline?: string;
  todayAction?: string;
  explanation: string[];
  caution?: string;
  adjustments?: { intensityPct?: number; volumePct?: number };
  exerciseAdjustments?: ExercisePlanAdjustment[];
};

export type ExercisePlanAction = "as_planned" | "progress" | "reduce" | "avoid";

export type ExercisePlanAdjustment = {
  exerciseName: string;
  action: ExercisePlanAction;
  loadPct: number;
  setDelta: number;
  repsDelta: number;
  targetRpe: number | null;
  reason: string;
  plannedPrescription?: ExercisePrescription;
  recommendedPrescription?: ExercisePrescription;
  availableWeights?: AvailableWeights;
};

export type ExercisePrescription = {
  weightKg: number | null;
  reps: number | null;
  sets: number;
};

export type LastResultPayload = {
  createdAt: Timestamp;
  inputs: DecisionInputs;
  result: DecisionOutput;
};
