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

  if (isLowSleep || isHighFatigue || isHighSoreness || shouldPullBackForNutrition) {
    decision = "PULL_BACK";
    explanation.push("Recovery signals are low today.");
    if (isLowSleep) explanation.push("Sleep is below 6 hours.");
    if (isHighFatigue || isHighSoreness) explanation.push("Fatigue or soreness is elevated.");
    if (isUnderTarget) explanation.push("Recent calorie intake has trailed your target.");
    if (dietPhase === "Cut") explanation.push("Given you're in a cut, keep increases conservative.");
    intensityPct = isLowSleep || isHighFatigue || isHighSoreness ? -20 : -10;
  } else if (isStrongRecovery) {
    if (isUnderTarget) {
      decision = "MAINTAIN";
      explanation.push("Recovery looks solid overall.");
      explanation.push("Recent calorie intake has trailed your target, so keep the session steady.");
      if (dietPhase === "Cut") explanation.push("Given you're in a cut, keep increases conservative.");
    } else {
      decision = "PUSH";
      explanation.push("Recovery looks solid.");
      explanation.push("Motivation is high with manageable fatigue.");
      if (isOnTarget) explanation.push("Completed-day nutrition has stayed on target.");
      if (dietPhase === "Cut") explanation.push("You're in a cut, so push conservatively.");
      intensityPct = pushIntensity;
    }
  } else {
    decision = "MAINTAIN";
    explanation.push("Keep a steady session today.");
    explanation.push("No strong signal to push or pull back.");
    if (isUnderTarget) explanation.push("Recent calorie intake has trailed your target.");
    if (isOnTarget) explanation.push("Recent calorie intake has stayed close to target.");
    if (dietPhase === "Cut") explanation.push("Given you're in a cut, keep increases conservative.");
  }

  return intensityPct === undefined
    ? { decision, explanation }
    : { decision, explanation, adjustments: { intensityPct } };
};
