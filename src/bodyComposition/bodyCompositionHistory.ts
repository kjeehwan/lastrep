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
  const byTimestamp = new Map<number, BodyCompositionHistoryPoint>();

  for (const entry of history) {
    const recordedAtMs = entry.recordedAt?.toMillis() ?? null;
    const value = metricValue(entry, metric);
    if (recordedAtMs == null || typeof value !== "number" || !Number.isFinite(value)) continue;

    const existing = byTimestamp.get(recordedAtMs);
    if (!existing || (entry.source === "manual" && existing.source !== "manual")) {
      byTimestamp.set(recordedAtMs, {
        key: `${metric}-${recordedAtMs}`,
        recordedAtMs,
        value,
        source: entry.source,
        originLabel: entry.originLabel,
      });
    }
  }

  const sorted = [...byTimestamp.values()].sort(
    (left, right) => left.recordedAtMs - right.recordedAtMs
  );

  // Older records stored a full snapshot even when only one metric changed. Collapsing
  // consecutive identical values avoids presenting carried-forward values as measurements.
  return sorted.filter((point, index) => index === 0 || sorted[index - 1].value !== point.value);
};

export const hasLegacyMuscleMassHistory = (history: BodyCompositionHistoryEntry[]): boolean =>
  history.some((entry) => typeof entry.legacyMuscleMassKg === "number");
