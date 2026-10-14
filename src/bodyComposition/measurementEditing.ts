import type { BodyCompositionHistoryEntry } from "../contracts/bodyComposition";
import { compareHistoryEntries } from "./normalizeBodyCompositionHistory";

export const measurementKeys = ["weightKg", "bodyFatPercent", "leanBodyMassKg", "skeletalMuscleMassKg"] as const;

export function measurementText(value: number | null, key: string, unit: "kg" | "lbs") {
  if (value == null) return "";
  const converted = key === "bodyFatPercent" || unit === "kg" ? value : value * 2.2046226218;
  return String(Math.round(converted * 100) / 100);
}

export function measurementValues(entry: BodyCompositionHistoryEntry | undefined, unit: "kg" | "lbs") {
  return Object.fromEntries(measurementKeys.map((key) => [key, measurementText(entry?.[key] ?? null, key, unit)]));
}

export function latestMeasurementExamples(history: BodyCompositionHistoryEntry[], unit: "kg" | "lbs") {
  const sorted = [...history].sort(compareHistoryEntries);
  return Object.fromEntries(measurementKeys.map((key) => [key, measurementText(sorted.find((entry) => entry[key] != null)?.[key] ?? null, key, unit)]));
}

export function deleteMeasurementHistory(history: BodyCompositionHistoryEntry[], original: BodyCompositionHistoryEntry) {
  const index = history.findIndex((entry) => entry.source === original.source && entry.recordedAt?.toMillis() === original.recordedAt?.toMillis());
  if (index < 0) throw new Error("This measurement no longer exists. Reopen it and try again.");
  if (measurementKeys.some((key) => history[index][key] !== original[key])) throw new Error("This measurement changed. Reopen it and try again.");
  return history.filter((_, i) => i !== index);
}

export function measurementDeletionMessage(original: BodyCompositionHistoryEntry, history: BodyCompositionHistoryEntry[]) {
  if (original.source === "health") return "Delete this entry from Lastrep? The original stays in your health service and may return after syncing.";
  if (history.some((entry) => entry.source === "health" && entry.recordedAt?.toMillis() === original.recordedAt?.toMillis())) return "Delete this manual correction? The original imported measurement will be shown again.";
  const date = original.recordedAt?.toDate();
  const earlierSameDay = date && history.some((entry) => {
    const other = entry.recordedAt?.toDate();
    return other && other.getTime() < date.getTime() && other.getFullYear() === date.getFullYear() && other.getMonth() === date.getMonth() && other.getDate() === date.getDate() && measurementKeys.some((key) => original[key] != null && entry[key] != null);
  });
  if (earlierSameDay) return "Delete this measurement entry? Earlier measurements from this day may be shown instead. This cannot be undone.";
  return "Delete this measurement entry? This cannot be undone.";
}

export function snapshotAfterMeasurementDeletion(snapshot: Record<string, unknown>, history: BodyCompositionHistoryEntry[], original: BodyCompositionHistoryEntry) {
  const next = { ...snapshot };
  for (const key of [...measurementKeys, "legacyMuscleMassKg"] as const) {
    if (original[key] != null && next[key] === original[key]) {
      next[key] = history.find((entry) => entry.source === original.source && entry[key] != null)?.[key] ?? null;
    }
  }
  return next;
}

export function editMeasurementHistory(history: BodyCompositionHistoryEntry[], original: BodyCompositionHistoryEntry, changes: Record<string, number>) {
  const index = history.findIndex((entry) => entry.source === original.source && entry.recordedAt?.toMillis() === original.recordedAt?.toMillis());
  if (index < 0) throw new Error("This measurement no longer exists. Reopen it and try again.");
  const current = history[index];
  for (const key of measurementKeys) {
    if (key in changes && current[key] !== original[key]) throw new Error("This measurement changed. Reopen it and try again.");
  }
  const manualAtSameTime = history.find((entry) => entry.source === "manual" && entry.recordedAt?.toMillis() === original.recordedAt?.toMillis());
  const replacement: BodyCompositionHistoryEntry = { ...current, ...(original.source === "health" ? manualAtSameTime : {}), ...changes, recordedAt: original.recordedAt, source: "manual", originLabel: null };
  return [replacement, ...history.filter((entry, i) => original.source === "manual" ? i !== index : entry !== manualAtSameTime)].sort(compareHistoryEntries);
}
