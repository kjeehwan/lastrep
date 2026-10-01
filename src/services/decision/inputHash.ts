import type { DecisionInputs } from "../../types/decision";

const fnv1a64Hex = (input: string): string => {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
};

const stableHashHex = (input: string): string => {
  // Compose multiple FNV-1a passes to get a longer deterministic key.
  const p1 = fnv1a64Hex(input);
  const p2 = fnv1a64Hex(`salt:1|${input}`);
  const p3 = fnv1a64Hex(`salt:2|${input}`);
  const p4 = fnv1a64Hex(`salt:3|${input}`);
  return `${p1}${p2}${p3}${p4}`;
};

export const hashDecisionInputs = (inputs: DecisionInputs): string => {
  const normalized = {
    sleepHours: inputs.sleepHours,
    sleepSource: inputs.sleepSource,
    sleepSampleAgeHours: inputs.sleepSampleAgeHours,
    soreness: inputs.soreness,
    fatigue: inputs.fatigue,
    motivation: inputs.motivation,
    trainingPhase: inputs.trainingPhase,
    dietPhase: inputs.dietPhase,
    nutrition: inputs.nutrition
      ? {
          caloriesConsumedToday: inputs.nutrition.caloriesConsumedToday,
          proteinGramsToday: inputs.nutrition.proteinGramsToday,
          calorieTarget: inputs.nutrition.calorieTarget,
          yesterdayCalories: inputs.nutrition.yesterdayCalories,
          yesterdayAdherence: inputs.nutrition.yesterdayAdherence,
          recentAdherence: inputs.nutrition.recentAdherence,
          recentCompletedDaysTracked: inputs.nutrition.recentCompletedDaysTracked,
        }
      : null,
  };
  const json = JSON.stringify(normalized);
  return stableHashHex(json);
};
