import type { BodyCompositionHistoryEntry } from "../contracts";

export type BodyCompositionMetric =
  | "weight"
  | "bodyFat"
  | "leanBodyMass"
  | "skeletalMuscleMass";

export type BodyCompositionHistoryPoint = {
  key: string;
  recordedAtMs: number;
  value: number;
  source: BodyCompositionHistoryEntry["source"];
  originLabel: string | null;
};

const metricValue = (
  entry: BodyCompositionHistoryEntry,
  metric: BodyCompositionMetric
): number | null => {
  if (metric === "weight") return entry.weightKg;
  if (metric === "bodyFat") return entry.bodyFatPercent;
  if (metric === "leanBodyMass") return entry.leanBodyMassKg;
  return entry.skeletalMuscleMassKg;
};

export const getBodyCompositionHistoryPoints = (
  history: BodyCompositionHistoryEntry[],
  metric: BodyCompositionMetric
): BodyCompositionHistoryPoint[] => {
  const byDay = new Map<string, BodyCompositionHistoryPoint>();

  for (const entry of history) {
    const recordedAtMs = entry.recordedAt?.toMillis() ?? null;
    const value = metricValue(entry, metric);
    if (recordedAtMs == null || typeof value !== "number" || !Number.isFinite(value)) continue;

    const date = new Date(recordedAtMs);
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const existing = byDay.get(dayKey);
    if (!existing || recordedAtMs > existing.recordedAtMs || (recordedAtMs === existing.recordedAtMs && entry.source === "manual" && existing.source !== "manual")) {
      byDay.set(dayKey, {
        key: `${metric}-${recordedAtMs}`,
        recordedAtMs,
        value,
        source: entry.source,
        originLabel: entry.originLabel,
      });
    }
  }

  return [...byDay.values()].sort(
    (left, right) => left.recordedAtMs - right.recordedAtMs
  );

};

export const hasLegacyMuscleMassHistory = (history: BodyCompositionHistoryEntry[]): boolean =>
  history.some((entry) => typeof entry.legacyMuscleMassKg === "number");
