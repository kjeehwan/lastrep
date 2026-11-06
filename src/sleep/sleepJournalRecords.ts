import { Timestamp, type DocumentData } from "firebase/firestore";
import { emptySleepEntry, type SleepEntry } from "./sleepSessionModel";

export const sleepJournalRevision = (data: DocumentData | undefined) => Number(data?.sleepProfile?.journalRevision ?? 0);
const millis = (value: unknown): number | null => value instanceof Timestamp ? value.toMillis() : null;

export function legacySleepEntries(data: DocumentData | undefined): SleepEntry[] {
  const profile = data?.sleepProfile;
  if (!profile || sleepJournalRevision(data) > 0) return [];
  const rows = Array.isArray(profile.recentNightlyHours) ? profile.recentNightlyHours : [];
  // Retain the exact saved diary date; never invent start/end times from a daily total.
  const entries = rows.flatMap((row: DocumentData) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.dateKey) || typeof row.sleepHours !== "number" || row.sleepHours < 0 || row.sleepHours > 24) return [];
    return [{ ...emptySleepEntry(`legacy-${row.dateKey}`, row.dateKey, row.sleepHours, new Date(0)), kind: "legacy" as const, source: row.source === "health" ? "health" as const : "manual" as const, recordedAtMs: millis(row.recordedAt) }];
  });
  if (!entries.length && typeof profile.latestSleepHours === "number" && profile.latestSleepHours >= 0 && profile.latestSleepHours <= 24) {
    entries.push({ ...emptySleepEntry("legacy-undated", "undated", profile.latestSleepHours, new Date(0)), kind: "legacy", source: profile.source === "health" ? "health" : "manual", recordedAtMs: millis(profile.sampleRecordedAt) });
  }
  return entries;
}
export function readSleepEntry(id: string, data: DocumentData): SleepEntry {
  // Documents are owned by the user; reject malformed saved records rather than inventing a total.
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(data.dateKey) || (data.dateKey === "undated" && data.kind === "legacy");
  if (data.id !== id || !validDate || !Number.isFinite(data.hours) || data.hours < 0 || data.hours > 24 || !["manual", "health"].includes(data.source) || !["legacy", "duration", "session"].includes(data.kind)) throw Error("A saved sleep entry could not be read.");
  return data as SleepEntry;
}

export function sleepJournalProfileKey(data: DocumentData | undefined) {
  const profile = data?.sleepProfile;
  return JSON.stringify([profile?.journalRevision ?? 0, profile?.originAppPackage ?? null,
    profile?.journalSummary ?? null, profile?.recentNightlyHours ?? null, profile?.sampleRecordedAt ?? null]);
}
