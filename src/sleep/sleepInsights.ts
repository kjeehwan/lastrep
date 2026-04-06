export type SleepTargetStatus = "below_target" | "on_target" | "above_target";

export const classifySleepVsTarget = (
  hours: number | null,
  targetHours: number | null
): SleepTargetStatus | null => {
  if (hours == null || targetHours == null || targetHours <= 0) return null;
  const lower = targetHours - 0.5;
  const upper = targetHours + 0.5;
  if (hours < lower) return "below_target";
  if (hours > upper) return "above_target";
  return "on_target";
};

export const getSleepDeltaText = (hours: number | null, targetHours: number | null): string | null => {
  if (hours == null || targetHours == null || targetHours <= 0) return null;
  const delta = Math.round((hours - targetHours) * 10) / 10;
  if (Math.abs(delta) < 0.1) return "On target";
  if (delta > 0) return `+${delta.toFixed(1)}h vs target`;
  return `${delta.toFixed(1)}h vs target`;
};

export const getSleepRecoveryHint = (
  lastNightStatus: SleepTargetStatus | null,
  consistencyPct: number | null
): string => {
  if (lastNightStatus === "below_target") {
    return "Last night was below target. Keep training steady and prioritize sleep tonight.";
  }
  if (lastNightStatus === "above_target") {
    return "Last night exceeded target. Recovery signal is supportive today.";
  }
  if (consistencyPct != null && consistencyPct >= 70) {
    return "Sleep consistency looks solid. Keep this routine.";
  }
  return "Sleep data is limited. Keep logging for stronger recovery insights.";
};
