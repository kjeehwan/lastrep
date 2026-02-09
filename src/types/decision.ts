import type { Timestamp } from "firebase/firestore";

export type Decision = "PUSH" | "MAINTAIN" | "PULL_BACK";
export type TrainingPhase = "Hypertrophy" | "Strength" | "Power";
export type DietPhase = "Cut" | "Maintain" | "Bulk";

export type DecisionInputs = {
  sleepHours: number;
  soreness: number;
  fatigue: number;
  motivation: number;
  trainingPhase: TrainingPhase;
  dietPhase: DietPhase;
};

export type DecisionOutput = {
  decision: Decision;
  explanation: string[];
  adjustments?: { intensityPct?: number; volumePct?: number };
};

export type LastResultPayload = {
  createdAt: Timestamp;
  inputs: DecisionInputs;
  result: DecisionOutput;
};
