import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { Decision, DecisionInputs, DecisionOutput } from "../../types/decision";

const USE_CLOUD_DECISION = false;
const FUNCTIONS_REGION = "asia-northeast3";

const heuristicDecision = (input: DecisionInputs): DecisionOutput => {
  const { sleepHours, soreness, fatigue, motivation, dietPhase } = input;
  const isLowSleep = sleepHours < 6;
  const isHighFatigue = fatigue >= 7;
  const isHighSoreness = soreness >= 7;
  const isHighMotivation = motivation >= 7;

  let decision: Decision = "MAINTAIN";
  const explanation: string[] = [];
  let intensityPct: number | undefined;

  if (isLowSleep || isHighFatigue || isHighSoreness) {
    decision = "PULL_BACK";
    explanation.push("Recovery signals are low today.");
    if (isLowSleep) explanation.push("Sleep is below 6 hours.");
    if (isHighFatigue || isHighSoreness) explanation.push("Fatigue/soreness is elevated.");
    if (dietPhase === "Cut") explanation.push("Given you're in a cut, keep increases conservative.");
    intensityPct = -20;
  } else if (sleepHours >= 7 && fatigue <= 4 && isHighMotivation) {
    decision = "PUSH";
    explanation.push("Recovery looks solid.");
    explanation.push("Motivation is high with manageable fatigue.");
    if (dietPhase === "Cut") explanation.push("Given you're in a cut, keep increases conservative.");
    intensityPct = 20;
  } else {
    decision = "MAINTAIN";
    explanation.push("Keep a steady session today.");
    explanation.push("No strong signal to push or pull back.");
    if (dietPhase === "Cut") explanation.push("Given you're in a cut, keep increases conservative.");
  }

  return intensityPct === undefined
    ? { decision, explanation }
    : { decision, explanation, adjustments: { intensityPct } };
};

const cloudDecision = async (input: DecisionInputs): Promise<DecisionOutput> => {
  try {
    const functions = getFunctions(getApp(), FUNCTIONS_REGION);
    const callable = httpsCallable<DecisionInputs, DecisionOutput>(functions, "getDailyDecision");
    const res = await callable(input);
    return res.data;
  } catch (err) {
    if (__DEV__) {
      const code = (err as { code?: string })?.code;
      const message = (err as { message?: string })?.message;
      console.warn("getDailyDecision failed, falling back to heuristic", code ?? "", message ?? "");
    }
    return heuristicDecision(input);
  }
};

export const getDecision = async (inputs: DecisionInputs): Promise<DecisionOutput> => {
  if (USE_CLOUD_DECISION) {
    return cloudDecision(inputs);
  }
  return heuristicDecision(inputs);
};
