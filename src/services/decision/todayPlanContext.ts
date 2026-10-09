import type {
  ActivityDuration,
  ActivityEffort,
  ActivityTiming,
  ActivityType,
  AdditionalActivityContext,
  DailyDecisionContext,
  PainArea,
  PainContext,
  PainSeverity,
  PainSide,
  PainTrigger,
  PlannedWorkoutSummary,
  RecentTrainingSummary,
} from "../../types/decision";
import type { WorkoutSummary } from "../../workouts/homeInsights";

export const PAIN_AREAS: { value: PainArea; label: string; sided: boolean }[] = [
  { value: "shoulder", label: "Shoulder", sided: true },
  { value: "elbow", label: "Elbow", sided: true },
  { value: "wrist_hand", label: "Wrist / hand", sided: true },
  { value: "upper_back", label: "Upper back", sided: false },
  { value: "lower_back", label: "Lower back", sided: false },
  { value: "hip", label: "Hip", sided: true },
  { value: "knee", label: "Knee", sided: true },
  { value: "ankle_foot", label: "Ankle / foot", sided: true },
  { value: "other", label: "Other", sided: false },
];

export const PAIN_SIDES: { value: PainSide; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "both", label: "Both" },
];

export const PAIN_SEVERITIES: { value: PainSeverity; label: string }[] = [
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
];

export const PAIN_TRIGGERS: { value: PainTrigger; label: string }[] = [
  { value: "at_rest", label: "At rest" },
  { value: "pressing", label: "Pressing" },
  { value: "pulling", label: "Pulling" },
  { value: "overhead", label: "Overhead" },
  { value: "squatting", label: "Squatting" },
  { value: "hinging", label: "Hip hinging" },
  { value: "running_impact", label: "Running / impact" },
  { value: "other", label: "Other" },
];

export const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: "long_walk_hike", label: "Long walk / hike" },
  { value: "running", label: "Running" },
  { value: "cycling", label: "Cycling" },
  { value: "sport", label: "Sport" },
  { value: "physical_work", label: "Physical work" },
  { value: "travel", label: "Travel" },
  { value: "other", label: "Other" },
];

export const ACTIVITY_TIMINGS: { value: ActivityTiming; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "two_days_ago", label: "2 days ago" },
];

export const ACTIVITY_EFFORTS: { value: ActivityEffort; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "hard", label: "Hard" },
];

export const ACTIVITY_DURATIONS: { value: ActivityDuration; label: string }[] = [
  { value: "under_1h", label: "Under 1h" },
  { value: "1_to_2h", label: "1-2h" },
  { value: "over_2h", label: "2h+" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const isOptionValue = <T extends string>(options: { value: T }[], value: unknown): value is T =>
  typeof value === "string" && options.some((option) => option.value === value);

export const toLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const parsePlannedExerciseName = (value: string) =>
  value.replace(/\s+-\s+\d+\s*x\s*.*$/i, "").trim();

export const parseWorkoutDraftPlan = (raw: string | null, today = new Date()): PlannedWorkoutSummary | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const sessionDateText = typeof parsed.sessionDateText === "string" ? parsed.sessionDateText : "";
    const savedAt = typeof parsed.draftSavedAt === "number" ? new Date(parsed.draftSavedAt) : null;
    if (sessionDateText !== toLocalDateKey(today) && (!savedAt || toLocalDateKey(savedAt) !== toLocalDateKey(today))) {
      return null;
    }
    const exercises = Array.isArray(parsed.exercises)
      ? parsed.exercises
          .map((item) => {
            if (!item || typeof item !== "object" || typeof item.name !== "string" || !item.name.trim()) return null;
            const hasCardioSet = Array.isArray(item.sets) && item.sets.some(
              (set: any) => typeof set?.distanceKm === "number" || typeof set?.durationSec === "number"
            );
            const mode = item.mode === "cardio" || item.cardioSessionType || hasCardioSet
              ? "cardio" as const
              : "resistance" as const;
            const sets = Array.isArray(item.sets)
              ? item.sets.map((set: any) => ({
                  weightKg: typeof set?.weightKg === "number" && Number.isFinite(set.weightKg) ? set.weightKg : null,
                  reps: typeof set?.reps === "number"
                    ? set.reps
                    : typeof set?.reps === "string" && set.reps.trim() && Number.isFinite(Number(set.reps))
                      ? Number(set.reps)
                      : null,
                  setType: set?.setType === "warmup" || set?.setType === "failure" || set?.setType === "drop"
                    ? set.setType
                    : "normal" as const,
                  done: Boolean(set?.done),
                }))
              : [];
            return { name: item.name.trim(), mode, sets };
          })
          .filter((item): item is NonNullable<typeof item> => item != null)
      : [];
    const exerciseNames = exercises.map((item) => item.name);
    if (!exerciseNames.length) return null;
    const title = typeof parsed.sessionTitle === "string" && parsed.sessionTitle.trim()
      ? parsed.sessionTitle.trim()
      : "Workout draft";
    return { source: "draft", title, exerciseNames, exercises };
  } catch {
    return null;
  }
};

export const normalizeDailyDecisionContext = (
  raw: unknown,
  plan: PlannedWorkoutSummary,
  today = new Date()
): DailyDecisionContext | null => {
  const candidate = raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
  const isToday = candidate?.dateKey === toLocalDateKey(today);
  const painSource = isToday && candidate?.pain && typeof candidate.pain === "object"
    ? candidate.pain as Record<string, unknown>
    : null;
  const pain = painSource &&
    isOptionValue(PAIN_AREAS, painSource.area) &&
    isOptionValue(PAIN_SEVERITIES, painSource.severity) &&
    isOptionValue(PAIN_TRIGGERS, painSource.trigger)
    ? {
        area: painSource.area,
        side: isOptionValue(PAIN_SIDES, painSource.side) ? painSource.side : "not_applicable" as const,
        severity: painSource.severity,
        trigger: painSource.trigger,
        note: typeof painSource.note === "string" && painSource.note.trim() ? painSource.note.trim().slice(0, 240) : null,
        affectsPlannedWorkout: painAffectsWorkout(
          { area: painSource.area, severity: painSource.severity, trigger: painSource.trigger },
          plan
        ),
      }
    : null;
  const activitySource = candidate?.additionalActivity && typeof candidate.additionalActivity === "object"
    ? candidate.additionalActivity as Record<string, unknown>
    : null;
  const additionalActivity = activitySource &&
    isOptionValue(ACTIVITY_TYPES, activitySource.type) &&
    isOptionValue(ACTIVITY_TIMINGS, activitySource.timing) &&
    isOptionValue(ACTIVITY_EFFORTS, activitySource.effort) &&
    isOptionValue(ACTIVITY_DURATIONS, activitySource.duration)
    ? {
        type: activitySource.type,
        timing: activitySource.timing,
        effort: activitySource.effort,
        duration: activitySource.duration,
        overlapsPlannedWorkout: activityOverlapsWorkout(
          { type: activitySource.type, effort: activitySource.effort },
          plan
        ),
      }
    : null;
  const note = isToday && typeof candidate?.note === "string" && candidate.note.trim()
    ? candidate.note.trim().slice(0, 300)
    : null;
  const contextActivity = isToday ? additionalActivity : null;
  if (!pain && !contextActivity && !note) return null;
  return {
    dateKey: toLocalDateKey(today),
    pain,
    additionalActivity: contextActivity,
    note,
  };
};

const lowerBodyPattern = /squat|leg|lunge|deadlift|hinge|hip thrust|glute|hamstring|calf|run|cycle|bike/i;
const pressPattern = /press|push[- ]?up|dip|fly|raise|triceps/i;
const pullPattern = /row|pull|curl|lat|back|chin[- ]?up/i;
const overheadPattern = /overhead|shoulder press|military press|lateral raise|front raise/i;

export const painAffectsWorkout = (
  pain: Pick<PainContext, "area" | "severity" | "trigger">,
  plan: PlannedWorkoutSummary
) => {
  if (plan.source === "none" || plan.source === "rest_day") return false;
  if (pain.severity === "severe" || pain.trigger === "at_rest" || pain.trigger === "other") return true;
  const names = plan.exerciseNames.join(" ");
  if (pain.trigger === "pressing") return pressPattern.test(names);
  if (pain.trigger === "pulling") return pullPattern.test(names);
  if (pain.trigger === "overhead") return overheadPattern.test(names);
  if (pain.trigger === "squatting" || pain.trigger === "hinging" || pain.trigger === "running_impact") {
    return lowerBodyPattern.test(names);
  }
  return false;
};

export const activityOverlapsWorkout = (
  activity: Pick<AdditionalActivityContext, "type" | "effort">,
  plan: PlannedWorkoutSummary
) => {
  if (plan.source === "none" || plan.source === "rest_day") return false;
  if (activity.type === "travel") return false;
  if (activity.type === "sport" || activity.type === "physical_work" || activity.type === "other") {
    return activity.effort === "hard";
  }
  return lowerBodyPattern.test(plan.exerciseNames.join(" "));
};

export const getDailyContextSummary = (context: DailyDecisionContext | null) => {
  if (!context) return "Nothing reported";
  const items: string[] = [];
  if (context.pain) {
    const area = PAIN_AREAS.find((item) => item.value === context.pain?.area)?.label ?? "Discomfort";
    const side = context.pain.side === "not_applicable"
      ? ""
      : `${context.pain.side.charAt(0).toUpperCase()}${context.pain.side.slice(1)} `;
    items.push(`${side}${area.toLowerCase()} discomfort`);
  }
  if (context.additionalActivity) {
    const label = ACTIVITY_TYPES.find((item) => item.value === context.additionalActivity?.type)?.label;
    if (label) items.push(label);
  }
  if (context.note) items.push("Note added");
  return items.length ? items.join(" · ") : "Nothing reported";
};

const parseReps = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const buildRecentTrainingSummary = (
  workouts: WorkoutSummary[],
  plan: PlannedWorkoutSummary,
  now = new Date()
): RecentTrainingSummary => {
  const sorted = workouts.slice().sort((a, b) => b.date.getTime() - a.date.getTime());
  const lastWorkout = sorted[0] ?? null;
  const cutoff = now.getTime() - 42 * DAY_MS;
  const recent = sorted.filter((workout) => workout.date.getTime() >= cutoff);
  const workoutsLast7Days = sorted.filter(
    (workout) => workout.date.getTime() >= now.getTime() - 7 * DAY_MS
  ).length;
  const requestedNames = Array.from(new Set(plan.exerciseNames.map(parsePlannedExerciseName).filter(Boolean)));
  const exercisePerformance = requestedNames.map((exerciseName) => {
    const normalized = normalizeName(exerciseName);
    const sessions = recent
      .flatMap((workout) =>
        workout.exercises
          .filter((exercise) => normalizeName(exercise.name) === normalized)
          .map((exercise) => ({ date: workout.date, sets: exercise.sets }))
      )
      .slice(0, 3);
    const metrics = sessions.map((session) => {
      const resistanceSets = session.sets
        .map((set) => ({
          weightKg: typeof set.weightKg === "number" ? set.weightKg : null,
          reps: parseReps(set.reps),
          rpe: typeof set.rpe === "number" ? set.rpe : null,
        }))
        .filter((set) => set.weightKg != null && set.reps != null);
      const top = resistanceSets.slice().sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0))[0] ?? null;
      const estimated1Rm = resistanceSets.reduce(
        (best, set) => Math.max(best, (set.weightKg ?? 0) * (1 + (set.reps ?? 0) / 30)),
        0
      );
      const rpes = session.sets
        .map((set) => set.rpe)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      return {
        topWeightKg: top?.weightKg ?? null,
        topReps: top?.reps ?? null,
        estimated1Rm: estimated1Rm > 0 ? estimated1Rm : null,
        averageRpe: rpes.length ? rpes.reduce((sum, value) => sum + value, 0) / rpes.length : null,
      };
    });
    const newest = metrics[0] ?? null;
    const comparison = metrics.slice(1).map((item) => item.estimated1Rm).filter((value): value is number => value != null);
    const baseline = comparison.length ? comparison.reduce((sum, value) => sum + value, 0) / comparison.length : null;
    const change = newest?.estimated1Rm != null && baseline != null && baseline > 0
      ? (newest.estimated1Rm - baseline) / baseline
      : null;
    const trend = sessions.length < 2 || change == null
      ? "insufficient"
      : change > 0.02
        ? "improving"
        : change < -0.02
          ? "declining"
          : "stable";
    return {
      exerciseName,
      sessions: sessions.length,
      daysSinceLast: sessions[0]
        ? Math.max(0, Math.floor((now.getTime() - sessions[0].date.getTime()) / DAY_MS))
        : null,
      lastTopWeightKg: newest?.topWeightKg ?? null,
      lastTopReps: newest?.topReps == null ? null : Math.round(newest.topReps),
      lastAverageRpe: newest?.averageRpe == null ? null : Math.round(newest.averageRpe * 10) / 10,
      estimated1RmKg: newest?.estimated1Rm == null ? null : Math.round(newest.estimated1Rm * 10) / 10,
      trend,
    } as const;
  });

  return {
    lastWorkoutHoursAgo: lastWorkout
      ? Math.max(0, Math.round(((now.getTime() - lastWorkout.date.getTime()) / (60 * 60 * 1000)) * 10) / 10)
      : null,
    lastWorkoutTitle: lastWorkout?.title ?? null,
    workoutsLast7Days,
    exercisePerformance,
  };
};
