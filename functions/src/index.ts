import * as functions from "firebase-functions";

type Decision = "PUSH" | "MAINTAIN" | "PULL_BACK";
type TrainingPhase = "Hypertrophy" | "Strength" | "Power";
type DietPhase = "Cut" | "Maintain" | "Bulk";

type DecisionInputs = {
  sleepHours: number;
  soreness: number;
  fatigue: number;
  motivation: number;
  trainingPhase: TrainingPhase;
  dietPhase: DietPhase;
};

type DecisionOutput = {
  decision: Decision;
  explanation: string[];
  adjustments?: { intensityPct?: number; volumePct?: number };
};

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

export const getDailyDecision = functions
  .region("asia-northeast3")
  .https.onCall((data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    const input = data as DecisionInputs;
    return heuristicDecision(input);
  });
