export type Decision = "PUSH" | "MAINTAIN" | "PULL_BACK";
export type TrainingPhase = "Hypertrophy" | "Strength" | "Power";
export type DietPhase = "Cut" | "Maintain" | "Bulk";
export type CalorieTargetAdherence = "below_target" | "on_target" | "above_target";
export type DecisionSleepSource = "manual" | "health";
export type PlannedWorkoutSource = "draft" | "program" | "rest_day" | "none";
export type PerformanceTrend = "improving" | "stable" | "declining" | "insufficient";

export type PlannedWorkoutSummary = {
  source: PlannedWorkoutSource;
  title: string | null;
  exerciseNames: string[];
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
  area: "shoulder" | "elbow" | "wrist_hand" | "upper_back" | "lower_back" | "hip" | "knee" | "ankle_foot" | "other";
  side: "left" | "right" | "both" | "not_applicable";
  severity: "mild" | "moderate" | "severe";
  trigger: "at_rest" | "pressing" | "pulling" | "overhead" | "squatting" | "hinging" | "running_impact" | "other";
  note: string | null;
  affectsPlannedWorkout: boolean;
};

export type AdditionalActivityContext = {
  type: "long_walk_hike" | "running" | "cycling" | "sport" | "physical_work" | "travel" | "other";
  timing: "today" | "yesterday" | "two_days_ago";
  effort: "light" | "moderate" | "hard";
  duration: "under_1h" | "1_to_2h" | "over_2h";
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
};

export type DecisionPathUsed = "OPENAI" | "FALLBACK_HEURISTIC" | "CACHE_HIT" | "RATE_LIMITED";
