import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { NormalizedDecisionError, ReasonCode } from "../../contracts";
import type { Decision, DecisionInputs, DecisionOutput } from "../../types/decision";
import { formatZodError, safeParseDecisionInputs, safeParseDecisionOutput } from "./decisionValidation";

const USE_CLOUD_DECISION = true;
const FUNCTIONS_REGION = "asia-northeast3";

const isReasonCode = (value: unknown): value is ReasonCode =>
  value === "FREE_WINDOW_EXHAUSTED" || value === "DAILY_LIMIT" || value === "COOLDOWN_ACTIVE";

export const isNormalizedDecisionError = (value: unknown): value is NormalizedDecisionError => {
  if (typeof value !== "object" || value === null) return false;
  const bucket = (value as { bucket?: unknown }).bucket;
  if (bucket === "business_gate") {
    return isReasonCode((value as { reasonCode?: unknown }).reasonCode);
  }
  return bucket === "seatbelt" || bucket === "other";
};

const heuristicDecision = (input: DecisionInputs): DecisionOutput => {
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

const cloudDecision = async (input: DecisionInputs): Promise<DecisionOutput> => {
  try {
    const functions = getFunctions(getApp(), FUNCTIONS_REGION);
    const callable = httpsCallable<DecisionInputs, DecisionOutput>(functions, "getDailyDecision");
    const res = await callable(input);
    const parsed = safeParseDecisionOutput(res.data);
    if (!parsed.success) {
      if (__DEV__) {
        console.warn("getDailyDecision returned invalid output", formatZodError(parsed.error));
      }
      throw {
        bucket: "other",
        message: "Decision response format was invalid.",
      } as NormalizedDecisionError;
    }
    return parsed.data;
  } catch (err) {
    if (isNormalizedDecisionError(err)) {
      throw err;
    }

    const code = String((err as { code?: string })?.code ?? "");

    if (code.includes("failed-precondition")) {
      const details = (err as { details?: unknown }).details as
        | { reasonCode?: unknown; retryAfterSeconds?: unknown }
        | undefined;
      const reasonCode = details?.reasonCode;
      const retryAfterSeconds =
        typeof details?.retryAfterSeconds === "number"
          ? Math.max(0, Math.floor(details.retryAfterSeconds))
          : undefined;

      if (isReasonCode(reasonCode)) {
        throw {
          bucket: "business_gate",
          reasonCode,
          retryAfterSeconds,
          message: (err as { message?: string })?.message ?? "Decision request blocked by server gate.",
        } as NormalizedDecisionError;
      }
    }

    if (code.includes("resource-exhausted")) {
      throw {
        bucket: "seatbelt",
        message: "Too many requests. Try again shortly.",
      } as NormalizedDecisionError;
    }

    throw {
      bucket: "other",
      message: (err as { message?: string })?.message ?? "Unable to get a decision right now.",
    } as NormalizedDecisionError;
  }
};

export const getDecision = async (inputs: DecisionInputs): Promise<DecisionOutput> => {
  const parsedInputs = safeParseDecisionInputs(inputs);
  if (!parsedInputs.success) {
    const message = `Invalid decision inputs: ${formatZodError(parsedInputs.error)}`;
    if (__DEV__) {
      throw new Error(message);
    }
    throw new Error("Invalid decision inputs.");
  }

  if (USE_CLOUD_DECISION) {
    return cloudDecision(parsedInputs.data);
  }

  const local = heuristicDecision(parsedInputs.data);
  if (__DEV__) {
    const parsedOutput = safeParseDecisionOutput(local);
    if (!parsedOutput.success) {
      throw new Error(`Invalid decision output: ${formatZodError(parsedOutput.error)}`);
    }
  }
  return local;
};
