import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import type { DecisionInputs } from "../../types/decision";

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
  const data = new TextEncoder().encode(json);
  return bytesToHex(sha256(data));
};
