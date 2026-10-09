import type { Decision, DecisionInputs, DecisionOutput } from "./decisionTypes";

export const heuristicDecision = (input: DecisionInputs): DecisionOutput => {
  const { sleepHours, soreness, fatigue, motivation, dietPhase, nutrition } = input;
  const isLowSleep = sleepHours < 6;
  const isHighFatigue = fatigue >= 7;
  const isHighSoreness = soreness >= 7;
  const isHighMotivation = motivation >= 7;
  const isStrongRecovery = sleepHours >= 7 && fatigue <= 4 && soreness <= 4 && isHighMotivation;
  const isRepeatedUnderTarget = nutrition?.recentAdherence === "below_target";
  const isUnderTarget =
    isRepeatedUnderTarget ||
    (nutrition?.recentAdherence == null && nutrition?.yesterdayAdherence === "below_target");
  const isOnTarget =
    nutrition?.recentAdherence === "on_target" ||
    nutrition?.recentAdherence === "above_target" ||
    (nutrition?.recentAdherence == null &&
      (nutrition?.yesterdayAdherence === "on_target" ||
        nutrition?.yesterdayAdherence === "above_target"));
  const shouldPullBackForNutrition = isUnderTarget && (fatigue >= 5 || soreness >= 6);
  const pushIntensity = dietPhase === "Cut" ? 10 : 20;

  let decision: Decision = "MAINTAIN";
  const explanation: string[] = [];
  let intensityPct: number | undefined;
  let headline = "Train at a steady effort.";
  let todayAction = "Follow the planned session without forcing additional weight, reps, or sets.";
  let caution: string | undefined;

  const pain = input.dailyContext?.pain;
  const activity = input.dailyContext?.additionalActivity;
  const hasRelevantPain = Boolean(pain?.affectsPlannedWorkout);
  const hasSeverePain = pain?.severity === "severe";
  const hasHardOverlappingActivity = Boolean(
    activity?.overlapsPlannedWorkout &&
      activity.effort === "hard" &&
      activity.timing !== "two_days_ago"
  );
  const lastPlannedPerformance = input.recentTraining?.exercisePerformance.find(
    (item) => item.sessions > 0
  );

  if (hasSeverePain || hasRelevantPain || isLowSleep || isHighFatigue || isHighSoreness || shouldPullBackForNutrition) {
    decision = "PULL_BACK";
    headline = "Reduce today's training stress.";
    todayAction = hasRelevantPain
      ? "Avoid movements that reproduce the reported discomfort and reduce the session load or volume."
      : "Reduce the load or working sets and avoid training to failure today.";
    if (hasRelevantPain) {
      explanation.push("Reported discomfort overlaps with the planned workout.");
      caution = "Stop any movement that causes sharp, worsening, or unusual pain.";
    } else {
      explanation.push("Recovery signals are low today.");
    }
    if (isLowSleep) explanation.push("Sleep is below 6 hours.");
    if (isHighFatigue || isHighSoreness) explanation.push("Fatigue or soreness is elevated.");
    if (isUnderTarget) explanation.push("Recent calorie intake has trailed your target.");
    if (dietPhase === "Cut") explanation.push("Given you're in a cut, keep increases conservative.");
    intensityPct = hasSeverePain || isLowSleep || isHighFatigue || isHighSoreness ? -20 : -10;
  } else if (hasHardOverlappingActivity) {
    decision = "PULL_BACK";
    headline = "Account for the extra workload.";
    todayAction = "Reduce working sets or load for the affected session and keep several reps in reserve.";
    explanation.push("Recent hard activity overlaps with the planned workout.");
    explanation.push("A lighter session can preserve training quality without compounding fatigue.");
    intensityPct = -10;
  } else if (isStrongRecovery) {
    if (isUnderTarget) {
      decision = "MAINTAIN";
      headline = "Keep today's session steady.";
      explanation.push("Recovery looks solid overall.");
      explanation.push("Recent calorie intake has trailed your target, so keep the session steady.");
      if (dietPhase === "Cut") explanation.push("Given you're in a cut, keep increases conservative.");
    } else {
      decision = "PUSH";
      headline = "You are ready to progress.";
      todayAction = lastPlannedPerformance?.lastAverageRpe != null && lastPlannedPerformance.lastAverageRpe >= 9
        ? "Progress with reps or execution quality instead of adding load to the hardest recent exercise."
        : "Progress one variable conservatively while keeping the planned effort target.";
      explanation.push("Recovery looks solid.");
      explanation.push("Motivation is high with manageable fatigue.");
      if (lastPlannedPerformance?.lastAverageRpe != null && lastPlannedPerformance.lastAverageRpe >= 9) {
        explanation.push(`${lastPlannedPerformance.exerciseName} recently averaged RPE ${lastPlannedPerformance.lastAverageRpe}.`);
      }
      if (isOnTarget) explanation.push("Completed-day nutrition has stayed on target.");
      if (dietPhase === "Cut") explanation.push("You're in a cut, so push conservatively.");
      intensityPct = pushIntensity;
    }
  } else {
    decision = "MAINTAIN";
    headline = input.plannedWorkout?.source === "none"
      ? "Your readiness is mixed today."
      : "Train at a steady effort.";
    todayAction = input.plannedWorkout?.source === "none"
      ? "Choose today's workout, then update this plan for session-specific guidance."
      : "Follow the planned session without forcing additional weight, reps, or sets.";
    explanation.push("Keep a steady session today.");
    explanation.push("No strong signal to push or pull back.");
    if (isUnderTarget) explanation.push("Recent calorie intake has trailed your target.");
    if (isOnTarget) explanation.push("Recent calorie intake has stayed close to target.");
    if (dietPhase === "Cut") explanation.push("Given you're in a cut, keep increases conservative.");
  }

  return {
    decision,
    headline,
    todayAction,
    explanation,
    ...(caution ? { caution } : {}),
    ...(intensityPct === undefined ? {} : { adjustments: { intensityPct } }),
  };
};
