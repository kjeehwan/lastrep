import type {
  AdditionalActivityContext,
  DecisionInputs,
  DecisionOutput,
  ExercisePerformanceSummary,
  ExercisePlanAdjustment,
  ExercisePrescription,
  PainContext,
  PlannedWorkoutSummary,
} from "../../types/decision";
import type { ExerciseCatalogItem } from "../../workouts/exerciseCatalog";
import type { WorkoutSummary } from "../../workouts/homeInsights";
import { parsePlannedExerciseName } from "./todayPlanContext";
import { fitAvailableWeight, type AvailableWeights } from "../../workouts/availableWeights";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const roundLoad = (value: number) => Math.max(0, Math.round(value * 2) / 2);
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const formatPainArea = (area: PainContext["area"]) => {
  if (area === "wrist_hand") return "wrist / hand";
  if (area === "ankle_foot") return "ankle / foot";
  return area.replace("_", " ");
};
const findCatalogExercise = (catalog: ExerciseCatalogItem[], name: string) => {
  const needle = normalize(name);
  return catalog.find(
    (exercise) => normalize(exercise.name) === needle || exercise.aliases.some((alias) => normalize(alias) === needle)
  ) ?? null;
};

const recoveryScore = (inputs: DecisionInputs) => Math.round(clamp(
  (inputs.sleepHours / 8) * 100 * 0.3 +
    (10 - inputs.soreness) * 10 * 0.3 +
    (10 - inputs.fatigue) * 10 * 0.3 +
    inputs.motivation * 10 * 0.1,
  0,
  100
));

const muscleSet = (exercise: ExerciseCatalogItem | null) =>
  new Set([...(exercise?.primaryMuscles ?? []), ...(exercise?.secondaryMuscles ?? [])].map(normalize));

const hasAny = (values: Iterable<string>, patterns: RegExp[]) =>
  Array.from(values).some((value) => patterns.some((pattern) => pattern.test(value)));

const painDemand = (pain: PainContext | null | undefined, exercise: ExerciseCatalogItem | null, name: string) => {
  if (!pain) return 0;
  const pattern = normalize(exercise?.movementPattern ?? "");
  const muscles = muscleSet(exercise);
  const exerciseName = normalize(name);
  const matches = (...values: RegExp[]) => values.some((value) => value.test(`${exerciseName} ${pattern}`));
  let demand = 0;

  if (pain.trigger === "pressing" && matches(/push|press|adduction|fly|dip/)) demand = 3;
  if (pain.trigger === "pulling" && matches(/pull|row|curl|flexion/)) demand = 3;
  if (pain.trigger === "overhead" && matches(/overhead|vertical push|abduction|raise/)) demand = 3;
  if (pain.trigger === "squatting" && matches(/squat|lunge|leg press|knee extension/)) demand = 3;
  if (pain.trigger === "hinging" && matches(/hinge|deadlift|good morning|back extension/)) demand = 3;
  if (pain.trigger === "running_impact" && matches(/cardio|run|squat|lunge|calf/)) demand = 3;

  if (pain.area === "lower_back") {
    if (matches(/hinge|deadlift|good morning|back extension/)) demand = Math.max(demand, 3);
    else if (matches(/squat|row|hip extension|hip thrust/)) demand = Math.max(demand, 2);
  } else if (pain.area === "upper_back") {
    if (matches(/pull|row|hinge/) || hasAny(muscles, [/back/, /trap/, /rhomboid/])) demand = Math.max(demand, 2);
  } else if (pain.area === "shoulder") {
    if (matches(/push|press|fly|raise|abduction|pull/) || hasAny(muscles, [/shoulder/, /delt/])) demand = Math.max(demand, 2);
  } else if (pain.area === "elbow") {
    if (matches(/press|push|pull|curl|elbow/) || hasAny(muscles, [/biceps/, /triceps/, /brachialis/])) demand = Math.max(demand, 2);
  } else if (pain.area === "wrist_hand") {
    if (matches(/press|push|pull|row|curl|deadlift/)) demand = Math.max(demand, 2);
  } else if (pain.area === "hip") {
    if (matches(/hinge|squat|lunge|hip|run|cycle/) || hasAny(muscles, [/glute/, /hip/])) demand = Math.max(demand, 2);
  } else if (pain.area === "knee") {
    if (matches(/squat|lunge|leg press|knee extension|run|cycle/) || hasAny(muscles, [/quad/])) demand = Math.max(demand, 2);
  } else if (pain.area === "ankle_foot") {
    if (matches(/squat|lunge|calf|run|cardio/) || hasAny(muscles, [/calf/])) demand = Math.max(demand, 2);
  } else if (pain.area === "other") {
    demand = Math.max(demand, pain.affectsPlannedWorkout ? 2 : 0);
  }

  if (pain.trigger === "at_rest" && demand > 0) demand = 3;
  return demand;
};

const activityDemand = (
  activity: AdditionalActivityContext | null | undefined,
  exercise: ExerciseCatalogItem | null,
  name: string
) => {
  if (!activity) return 0;
  if (activity.type === "travel") return activity.effort === "hard" || activity.duration === "over_2h" ? 1 : 0;
  const pattern = normalize(exercise?.movementPattern ?? "");
  const muscles = muscleSet(exercise);
  const lowerBody = /squat|hinge|lunge|leg|hip|calf|cardio|run/.test(`${normalize(name)} ${pattern}`) ||
    hasAny(muscles, [/quad/, /hamstring/, /glute/, /calf/, /hip/, /posterior chain/]);
  if (["long_walk_hike", "running", "cycling"].includes(activity.type)) {
    return lowerBody ? (activity.effort === "hard" ? 2 : 1) : 0;
  }
  if (["sport", "physical_work", "other"].includes(activity.type)) {
    return activity.overlapsPlannedWorkout ? (activity.effort === "hard" ? 2 : 1) : 0;
  }
  return 0;
};

const recentMuscleDemand = (
  exercise: ExerciseCatalogItem | null,
  workouts: WorkoutSummary[],
  now: Date,
  catalog: ExerciseCatalogItem[]
) => {
  if (!exercise) return 0;
  const targetMuscles = muscleSet(exercise);
  if (!targetMuscles.size) return 0;
  return workouts.some((workout) => {
    const age = now.getTime() - workout.date.getTime();
    if (age < 0 || age > 72 * 60 * 60 * 1000) return false;
    return workout.exercises.some((completed) => {
      const completedCatalog = findCatalogExercise(catalog, completed.name);
      const completedMuscles = muscleSet(completedCatalog);
      return Array.from(targetMuscles).some((muscle) => completedMuscles.has(muscle));
    });
  }) ? 1 : 0;
};

const performanceFor = (name: string, inputs: DecisionInputs): ExercisePerformanceSummary | null => {
  const needle = normalize(parsePlannedExerciseName(name));
  return inputs.recentTraining?.exercisePerformance.find(
    (item) => normalize(item.exerciseName) === needle
  ) ?? null;
};

const plannedPrescriptionFor = (name: string, inputs: DecisionInputs): ExercisePrescription | null => {
  const needle = normalize(parsePlannedExerciseName(name));
  const exercise = inputs.plannedWorkout?.exercises?.find((item) => normalize(item.name) === needle);
  if (!exercise || exercise.mode === "cardio") return null;
  const workingSets = exercise.sets.filter((set) => !set.done && set.setType !== "warmup");
  if (!workingSets.length) return null;
  const representative = workingSets.find((set) => set.weightKg != null || set.reps != null) ?? workingSets[0];
  return {
    weightKg: representative.weightKg,
    reps: representative.reps,
    sets: workingSets.length,
  };
};

const attachPrescriptions = (
  adjustment: ExercisePlanAdjustment,
  planned: ExercisePrescription | null,
  availableWeights?: AvailableWeights
): ExercisePlanAdjustment => {
  if (!planned || adjustment.action === "avoid") return adjustment;
  let recommendedWeight = planned.weightKg == null
    ? null
    : roundLoad(planned.weightKg * (1 + adjustment.loadPct / 100));
  if (availableWeights && planned.weightKg != null && planned.weightKg > 0 && adjustment.loadPct !== 0) {
    const fitted = fitAvailableWeight(planned.weightKg, planned.weightKg * (1 + adjustment.loadPct / 100), availableWeights);
    recommendedWeight = fitted.weightKg;
    adjustment = { ...adjustment,
      loadPct: (recommendedWeight / planned.weightKg - 1) * 100,
      repsDelta: fitted.repFallback > 0 ? Math.max(adjustment.repsDelta, 1) :
        fitted.repFallback < 0 ? Math.min(adjustment.repsDelta, -1) : adjustment.repsDelta,
      reason: fitted.repFallback > 0 ? "The next available weight exceeds today's supported load increase, so add a rep at the current weight instead." :
        fitted.repFallback < 0 ? "No suitable lighter weight is available; reduce reps at the current weight and stay within the suggested effort." : adjustment.reason,
    };
  }
  return {
    ...adjustment,
    ...(availableWeights ? { availableWeights } : {}),
    plannedPrescription: planned,
    recommendedPrescription: {
      weightKg: recommendedWeight,
      reps: planned.reps == null ? null : Math.max(1, Math.round(planned.reps + adjustment.repsDelta)),
      sets: Math.max(1, planned.sets + adjustment.setDelta),
    },
  };
};

const buildExerciseAdjustment = (
  name: string,
  inputs: DecisionInputs,
  workouts: WorkoutSummary[],
  score: number,
  now: Date,
  catalog: ExerciseCatalogItem[]
): ExercisePlanAdjustment => {
  const exerciseName = parsePlannedExerciseName(name);
  const catalogExercise = findCatalogExercise(catalog, exerciseName);
  const isCardio = catalogExercise?.group === "cardio" || catalogExercise?.movementPattern === "cardio";
  const toleratesFrequentTraining = isCardio || catalogExercise?.group === "core";
  const performance = performanceFor(exerciseName, inputs);
  const plannedPrescription = plannedPrescriptionFor(exerciseName, inputs);
  const availableWeights = inputs.plannedWorkout?.exercises?.find((exercise) => normalize(exercise.name) === normalize(exerciseName))?.availableWeights;
  const hasExternalLoad = (plannedPrescription?.weightKg ?? 0) > 0;
  const isBodyweight = !hasExternalLoad && (catalogExercise?.equipment.includes("bodyweight") ||
    /hanging (leg|knee) raise|plank|crunch|sit[- ]?up/i.test(exerciseName));
  const finish = (adjustment: ExercisePlanAdjustment) => {
    if (plannedPrescription && !hasExternalLoad && adjustment.loadPct !== 0) {
      let repsDelta = adjustment.repsDelta;
      if (isBodyweight && plannedPrescription?.reps != null && plannedPrescription.reps > 0) {
        repsDelta = adjustment.loadPct > 0 ? Math.max(1, repsDelta) :
          -Math.max(1, Math.round(plannedPrescription.reps * Math.abs(adjustment.loadPct) / 100),
            Math.ceil(Math.max(0, (performance?.lastAverageRpe ?? 0) - (adjustment.targetRpe ?? 8))));
        repsDelta = Math.max(1 - plannedPrescription.reps, repsDelta);
      }
      adjustment = { ...adjustment, loadPct: 0, repsDelta,
        reason: isBodyweight && repsDelta !== 0
          ? `${adjustment.reason.replace(/load/gi, "reps")} Adjust reps rather than weight for this bodyweight movement.`
          : adjustment.reason,
      };
    }
    return attachPrescriptions(adjustment, plannedPrescription, availableWeights);
  };
  const pain = inputs.dailyContext?.pain;
  const painLevel = painDemand(pain, catalogExercise, exerciseName);
  const activityLevel = activityDemand(inputs.dailyContext?.additionalActivity, catalogExercise, exerciseName);
  const recentOverlap = toleratesFrequentTraining ? 0 : recentMuscleDemand(catalogExercise, workouts, now, catalog);
  const recentMaxEffort = (performance?.lastAverageRpe ?? 0) >= 9;
  const nutritionLimitsProgression =
    (inputs.nutrition?.recentCompletedDaysTracked ?? 0) >= 3 &&
    inputs.nutrition?.recentAdherence === "below_target";

  if (painLevel >= 3 && pain?.severity === "severe") {
    return finish({
      exerciseName,
      action: "avoid",
      loadPct: 0,
      setDelta: 0,
      repsDelta: 0,
      targetRpe: null,
      reason: `Skip or replace this movement because it places high demand on the reported ${formatPainArea(pain.area)}.`,
    });
  }
  if (painLevel >= 2) {
    if (isCardio) {
      return finish({
        exerciseName,
        action: "reduce",
        loadPct: 0,
        setDelta: 0,
        repsDelta: 0,
        targetRpe: 6,
        reason: `Use an easier pace or shorter duration because impact may aggravate the reported ${formatPainArea(pain!.area)} discomfort.`,
      });
    }
    const reduction = pain?.severity === "moderate" || painLevel >= 3 ? -20 : -10;
    return finish({
      exerciseName,
      action: "reduce",
      loadPct: reduction,
      setDelta: pain?.severity === "moderate" || painLevel >= 3 ? -1 : 0,
      repsDelta: 0,
      targetRpe: pain?.severity === "moderate" ? 6 : 7,
      reason: `This movement overlaps with the reported ${formatPainArea(pain!.area)} discomfort.`,
    });
  }
  if (isCardio) {
    if (activityLevel >= 2 || score < 55 || inputs.fatigue >= 7) {
      return finish({
        exerciseName,
        action: "reduce",
        loadPct: 0,
        setDelta: 0,
        repsDelta: 0,
        targetRpe: 6,
        reason: "Keep the cardio easy or shorten its duration because recovery demand is elevated today.",
      });
    }
    return finish({
      exerciseName,
      action: "as_planned",
      loadPct: 0,
      setDelta: 0,
      repsDelta: 0,
      targetRpe: null,
      reason: "Keep the planned pace and duration.",
    });
  }
  if (activityLevel >= 2) {
    return finish({
      exerciseName,
      action: "reduce",
      loadPct: -10,
      setDelta: -1,
      repsDelta: 0,
      targetRpe: 7,
      reason: "Recent hard activity already stressed the muscles used by this exercise.",
    });
  }
  if (recentMaxEffort) {
    const supportedWeight = plannedPrescription?.weightKg != null && plannedPrescription.reps != null && performance?.estimated1RmKg
      ? roundLoad(performance.estimated1RmKg / (1 + (plannedPrescription.reps + 2) / 30))
      : null;
    if (
      supportedWeight != null &&
      plannedPrescription?.weightKg != null &&
      plannedPrescription.weightKg <= supportedWeight * 1.025
    ) {
      return finish({
        exerciseName,
        action: "as_planned",
        loadPct: 0,
        setDelta: 0,
        repsDelta: 0,
        targetRpe: null,
        reason: `The planned load already accounts for the latest RPE ${performance?.lastAverageRpe} effort.`,
      });
    }
    const loadPct = supportedWeight != null && plannedPrescription?.weightKg
      ? (supportedWeight / plannedPrescription.weightKg - 1) * 100
      : -5;
    return finish({
      exerciseName,
      action: "reduce",
      loadPct,
      setDelta: 0,
      repsDelta: 0,
      targetRpe: 8,
      reason: supportedWeight != null
        ? `The latest comparable session averaged RPE ${performance?.lastAverageRpe}; this load better matches the planned reps with about two reps in reserve.`
        : `The latest comparable session averaged RPE ${performance?.lastAverageRpe}, so do not progress load today.`,
    });
  }
  if (score < 55 || inputs.fatigue >= 7 || inputs.soreness >= 7) {
    return finish({
      exerciseName,
      action: "reduce",
      loadPct: -10,
      setDelta: recentOverlap ? -1 : 0,
      repsDelta: 0,
      targetRpe: 7,
      reason: recentOverlap
        ? "Recovery is limited and these muscles were trained within the last 72 hours."
        : "Current recovery signals favor a controlled working load.",
    });
  }
  if (recentOverlap && (score < 70 || inputs.fatigue >= 5 || inputs.soreness >= 5)) {
    return finish({
      exerciseName,
      action: "as_planned",
      loadPct: 0,
      setDelta: -1,
      repsDelta: 0,
      targetRpe: 8,
      reason: "These muscles were trained within the last 72 hours, so keep the load and trim one set.",
    });
  }
  if (nutritionLimitsProgression && score >= 80 && performance?.sessions) {
    return finish({
      exerciseName,
      action: "as_planned",
      loadPct: 0,
      setDelta: 0,
      repsDelta: 0,
      targetRpe: null,
      reason: "Recovery is strong, but recent calorie intake is below target, so repeat the proven prescription instead of progressing it.",
    });
  }
  if (
    score >= 80 &&
    performance &&
    performance.sessions > 0 &&
    (performance.lastAverageRpe == null || performance.lastAverageRpe <= 8) &&
    performance.trend !== "declining"
  ) {
    const progressLoad = inputs.trainingPhase === "Hypertrophy" ? 0 : 2.5;
    const progressReps = inputs.trainingPhase === "Hypertrophy" ? 1 : 0;
    return finish({
      exerciseName,
      action: "progress",
      loadPct: progressLoad,
      setDelta: 0,
      repsDelta: progressReps,
      targetRpe: 8,
      reason: inputs.trainingPhase === "Hypertrophy"
        ? "Recovery is strong and recent performance supports adding one rep before adding load."
        : `Recovery is strong and recent performance supports a small load increase for the ${inputs.trainingPhase.toLowerCase()} phase.`,
    });
  }
  return finish({
    exerciseName,
    action: "as_planned",
    loadPct: 0,
    setDelta: 0,
    repsDelta: 0,
    targetRpe: null,
    reason: performance?.sessions
      ? "Repeat the proven prescription and use today's effort to guide the next progression."
      : "No comparable history is available, so keep the planned prescription conservative.",
  });
};

const planLabel = (plan: PlannedWorkoutSummary) => plan.title?.trim() || "the planned workout";

export const buildDeterministicTodayPlan = (
  inputs: DecisionInputs,
  workouts: WorkoutSummary[],
  now = new Date(),
  catalog: ExerciseCatalogItem[] = [],
  sleepTargetHours = 7
): DecisionOutput => {
  const score = recoveryScore(inputs);
  const plan = inputs.plannedWorkout ?? { source: "none", title: null, exerciseNames: [] };
  const pain = inputs.dailyContext?.pain;
  const activity = inputs.dailyContext?.additionalActivity;

  if (plan.source === "none") {
    const decision = score >= 75 ? "PUSH" : score < 55 ? "PULL_BACK" : "MAINTAIN";
    return {
      decision,
      headline: score >= 75 ? "You look ready to train." : score < 55 ? "Recovery needs attention today." : "Readiness is mixed today.",
      todayAction: "Choose today's workout to receive exercise-specific load, set, and effort guidance.",
      explanation: [
        `Sleep was ${inputs.sleepHours.toFixed(1)} hours with soreness ${inputs.soreness} and fatigue ${inputs.fatigue}.`,
        "No workout is selected, so specific exercise changes are intentionally withheld.",
      ],
    };
  }

  if (plan.source === "rest_day") {
    return {
      decision: "MAINTAIN",
      headline: "Keep the rest day focused on recovery.",
      todayAction: "Use easy movement, nutrition, and sleep to support the next training session.",
      explanation: [
        `Today's program is scheduled as ${planLabel(plan)}.`,
        `Current recovery inputs are soreness ${inputs.soreness}, fatigue ${inputs.fatigue}, and motivation ${inputs.motivation}.`,
      ],
    };
  }

  const exerciseAdjustments = plan.exerciseNames.map((name) =>
    buildExerciseAdjustment(name, inputs, workouts, score, now, catalog)
  );
  const avoidCount = exerciseAdjustments.filter((item) => item.action === "avoid").length;
  const reduceCount = exerciseAdjustments.filter((item) => item.action === "reduce" || item.setDelta < 0).length;
  const progressCount = exerciseAdjustments.filter((item) => item.action === "progress").length;
  const hardTravel = activity?.type === "travel" && (activity.effort === "hard" || activity.duration === "over_2h");
  const hardActivity = Boolean(activity && activity.effort === "hard" && activity.timing !== "two_days_ago");
  const decision = avoidCount > 0 || reduceCount > 0 || score < 55
    ? "PULL_BACK"
    : hardTravel || hardActivity
      ? "MAINTAIN"
      : progressCount > 0 && score >= 80
        ? "PUSH"
        : "MAINTAIN";
  const changedCount = exerciseAdjustments.filter(
    (item) => item.action !== "as_planned" || item.loadPct !== 0 || item.setDelta !== 0 || item.repsDelta !== 0
  ).length;
  const painArea = pain ? formatPainArea(pain.area) : null;
  const headline = decision === "PUSH"
    ? `${changedCount} exercise${changedCount === 1 ? " can" : "s can"} progress; keep the rest as planned.`
    : decision === "PULL_BACK"
      ? pain?.affectsPlannedWorkout && painArea
        ? `${painArea.charAt(0).toUpperCase()}${painArea.slice(1)} discomfort changes ${changedCount} exercise${changedCount === 1 ? "" : "s"}; keep the rest as planned.`
        : `${changedCount} exercise${changedCount === 1 ? " needs" : "s need"} changes; keep the rest as planned.`
      : `${planLabel(plan)} needs no changes.`;
  const comparable = inputs.recentTraining?.exercisePerformance.filter((item) => item.sessions > 0) ?? [];
  const highEffort = comparable.filter((item) => (item.lastAverageRpe ?? 0) >= 9);
  const highestEffort = comparable
    .filter((item) => item.lastAverageRpe != null)
    .sort((a, b) => (b.lastAverageRpe ?? 0) - (a.lastAverageRpe ?? 0))[0] ?? null;
  const sleepDifference = Math.round((inputs.sleepHours - sleepTargetHours) * 10) / 10;
  const recoveryExplanation = sleepDifference < 0
    ? inputs.soreness <= 3 && inputs.fatigue <= 3
      ? `Sleep was ${Math.abs(sleepDifference).toFixed(1)} hours below target, but low soreness and fatigue support the planned session.`
      : `Sleep was ${Math.abs(sleepDifference).toFixed(1)} hours below target and recovery ratings support a lighter session.`
    : `Sleep met the ${sleepTargetHours.toFixed(1)}-hour target and soreness and fatigue do not require a workout-wide reduction.`;
  const performanceExplanation = !comparable.length
    ? "No comparable exercise history was available, so no performance-based progression was added."
    : highEffort.length
      ? `${highEffort.slice(0, 2).map((item) => `${item.exerciseName} reached RPE ${item.lastAverageRpe}`).join(" and ")}; those planned loads were checked before allowing progression.`
      : highestEffort
        ? `Recent loads and RPEs support the planned workout; ${highestEffort.exerciseName} was the highest tracked effort at RPE ${highestEffort.lastAverageRpe}.`
        : "Recent loads support the planned workout; no comparable RPE values were recorded.";
  const contextExplanation = pain?.affectsPlannedWorkout
    ? null
    : hardTravel
      ? "Recent travel may add stiffness or general fatigue, so use early sets to confirm readiness."
      : hardActivity
        ? "Recent hard activity adds fatigue that should be accounted for in today's session."
        : inputs.nutrition?.recentCompletedDaysTracked && inputs.nutrition.recentAdherence === "below_target"
          ? `Recent calories are below the ${inputs.dietPhase.toLowerCase()} target, so progression is conservative.`
          : progressCount > 0
            ? inputs.trainingPhase === "Hypertrophy"
              ? "The hypertrophy phase favors adding a rep before increasing load."
              : `The ${inputs.trainingPhase.toLowerCase()} phase supports a small load progression on the listed exercises.`
            : changedCount === 0
              ? "No pain, overlapping hard activity, or recovery signal justified changing the workout."
              : `${changedCount} exercise-specific change${changedCount === 1 ? "" : "s"} address the limiting signals without reducing the entire workout.`;
  const explanation = [
    recoveryExplanation,
    performanceExplanation,
    contextExplanation,
  ].filter((item): item is string => item != null);

  const caution = pain?.affectsPlannedWorkout
    ? "Stop an exercise if discomfort becomes sharp, worsens, or changes your technique."
    : null;
  return {
    decision,
    headline,
    explanation,
    ...(caution ? { caution } : {}),
    ...(decision === "PULL_BACK" ? { adjustments: { intensityPct: -10 as const } } : {}),
    exerciseAdjustments,
  };
};
