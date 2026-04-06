import type { DecisionInputs } from "../types/decision";

export type DecisionSleepProfileSnapshot = {
  source: "manual" | "health";
  latestSleepHours: number | null;
  sampleAgeHours: number | null;
};

export type ResolvedDecisionSleepInput = Pick<
  DecisionInputs,
  "sleepHours" | "sleepSource" | "sleepSampleAgeHours"
> & {
  shouldPersistManualSample: boolean;
};

const HEALTH_SLEEP_STALE_HOURS = 36;

export const resolveDecisionSleepInput = (
  manualSleepHours: number,
  sleepProfile: DecisionSleepProfileSnapshot | null
): ResolvedDecisionSleepInput => {
  if (
    sleepProfile &&
    sleepProfile.source === "health" &&
    typeof sleepProfile.latestSleepHours === "number" &&
    sleepProfile.sampleAgeHours != null &&
    sleepProfile.sampleAgeHours <= HEALTH_SLEEP_STALE_HOURS
  ) {
    return {
      sleepHours: sleepProfile.latestSleepHours,
      sleepSource: "health",
      sleepSampleAgeHours: sleepProfile.sampleAgeHours,
      shouldPersistManualSample: false,
    };
  }

  return {
    sleepHours: manualSleepHours,
    sleepSource: "manual",
    sleepSampleAgeHours: 0,
    shouldPersistManualSample: true,
  };
};
