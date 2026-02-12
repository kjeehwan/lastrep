import crypto from "crypto";
import type { DecisionInputs } from "./decisionTypes";

export const hashDecisionInputs = (inputs: DecisionInputs): string => {
  const normalized = {
    sleepHours: inputs.sleepHours,
    soreness: inputs.soreness,
    fatigue: inputs.fatigue,
    motivation: inputs.motivation,
    trainingPhase: inputs.trainingPhase,
    dietPhase: inputs.dietPhase,
  };
  const json = JSON.stringify(normalized);
  return crypto.createHash("sha256").update(json).digest("hex");
};
