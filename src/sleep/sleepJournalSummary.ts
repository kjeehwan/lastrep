import { Timestamp, type DocumentData } from "firebase/firestore";
import type { SleepDay } from "./sleepSessionModel";
import { SleepScopeFallback } from "./sleepWindowScope";

export type SleepSummaryRow = { dateKey: string; sleepHours: number; source: "manual" | "health"; recordedAt: Timestamp | null };
export function summarizeSleepDays(days: SleepDay[]): SleepSummaryRow[] {
  return days.map(day => ({ dateKey: day.dateKey, sleepHours: Math.round(day.hours * 1000) / 1000,
    source: day.source, recordedAt: day.recordedAtMs == null ? null : Timestamp.fromMillis(day.recordedAtMs) }));
}
export function sleepSummary(rows: SleepSummaryRow[]) {
  const recentNightlyHours = rows.slice().sort((a, b) => b.dateKey.localeCompare(a.dateKey)).slice(0, 30);
  const latest = recentNightlyHours[0];
  return { latestSleepHours: latest?.sleepHours ?? null, source: latest?.source ?? "manual",
    sampleRecordedAt: latest?.recordedAt ?? null, recentNightlyHours };
}
export function savedSleepSummary(data: DocumentData | undefined): SleepSummaryRow[] {
  const rows = data?.sleepProfile?.journalSummary?.recentNightlyHours;
  if (!(data?.sleepProfile?.journalRevision > 0) || !Array.isArray(rows) || rows.length > 30 || rows.some(row =>
    !/^\d{4}-\d{2}-\d{2}$/.test(row.dateKey) || !Number.isFinite(row.sleepHours) || row.sleepHours < 0 || row.sleepHours > 24 ||
    !["manual", "health"].includes(row.source) || row.recordedAt != null && !(row.recordedAt instanceof Timestamp)) ||
    new Set(rows.map(row => row.dateKey)).size !== rows.length) throw new SleepScopeFallback("legacy-summary");
  return rows.slice().sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}
export function mergeSleepSummary(saved: SleepSummaryRow[], touchedDates: Set<string>, days: SleepDay[]) {
  return sleepSummary([...saved.filter(row => !touchedDates.has(row.dateKey)), ...summarizeSleepDays(days)]);
}
