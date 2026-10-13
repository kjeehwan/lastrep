import { Timestamp } from "firebase/firestore";
import type { BodyCompositionHistoryEntry } from "../contracts/bodyComposition";

export const BODY_COMPOSITION_HISTORY_LIMIT = 400;

export const compareHistoryEntries = (a: BodyCompositionHistoryEntry, b: BodyCompositionHistoryEntry) => {
  const timeDiff = (b.recordedAt?.toMillis() ?? 0) - (a.recordedAt?.toMillis() ?? 0);
  if (timeDiff !== 0) return timeDiff;
  if (a.source === b.source) return 0;
  return a.source === "manual" ? -1 : 1;
};

const numberOrNull = (value: unknown, max: number): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max
    ? Math.round(value * 10) / 10
    : null;

// Shared by Profile reads and Home's existing account subscription; no native health imports.
export const normalizeBodyCompositionHistory = (value: unknown): BodyCompositionHistoryEntry[] => {
  if (!Array.isArray(value)) return [];
  const history: BodyCompositionHistoryEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const source = row.source;
    if ((source !== "manual" && source !== "health") || !(row.recordedAt instanceof Timestamp)) continue;
    const legacy = numberOrNull(row.muscleMassKg, 500);
    history.push({
      recordedAt: row.recordedAt,
      source,
      originLabel: typeof row.originLabel === "string" ? row.originLabel.trim() || null : null,
      weightKg: numberOrNull(row.weightKg, 500),
      bodyFatPercent: numberOrNull(row.bodyFatPercent, 100),
      leanBodyMassKg: numberOrNull(row.leanBodyMassKg, 500),
      skeletalMuscleMassKg: numberOrNull(row.skeletalMuscleMassKg, 500) ?? (source === "manual" ? legacy : null),
      legacyMuscleMassKg: numberOrNull(row.legacyMuscleMassKg, 500) ?? (source === "health" ? legacy : null),
    });
  }
  return history.sort(compareHistoryEntries).slice(0, BODY_COMPOSITION_HISTORY_LIMIT);
};
