import { collection, doc, getDoc, getDocs, getDocsFromServer, runTransaction, Timestamp, type DocumentData, type Firestore } from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import { deriveSleepDays, emptySleepEntry, sleepEntrySignature, type SleepEntry } from "./sleepSessionModel";

const userRef = (uid: string, database: Firestore) => doc(database, "users", uid);
const entriesRef = (uid: string, database: Firestore) => collection(database, "users", uid, "sleepSessions");
const revision = (data: DocumentData | undefined) => Number(data?.sleepProfile?.journalRevision ?? 0);
const millis = (value: unknown): number | null => value instanceof Timestamp ? value.toMillis() : null;

export function legacySleepEntries(data: DocumentData | undefined): SleepEntry[] {
  const profile = data?.sleepProfile;
  if (!profile || revision(data) > 0) return [];
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
function readEntry(id: string, data: DocumentData): SleepEntry {
  // Documents are owned by the user; reject malformed saved records rather than inventing a total.
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(data.dateKey) || (data.dateKey === "undated" && data.kind === "legacy");
  if (data.id !== id || !validDate || !Number.isFinite(data.hours) || data.hours < 0 || data.hours > 24 || !["manual", "health"].includes(data.source) || !["legacy", "duration", "session"].includes(data.kind)) throw Error("A saved sleep entry could not be read.");
  return data as SleepEntry;
}
export async function getSleepJournal(uid: string, database: Firestore = db) {
  const root = await getDoc(userRef(uid, database));
  const records = await getDocs(entriesRef(uid, database));
  const entries = records.docs.map((row) => readEntry(row.id, row.data()));
  return { entries: entries.length || revision(root.data()) ? entries : legacySleepEntries(root.data()), profile: root.data()?.sleepProfile, target: root.data()?.sleepSettings?.targetHours };
}

/** A root revision serializes session writes plus their derived compatibility summary. */
export async function mutateSleepJournal(uid: string, change: (entries: SleepEntry[]) => SleepEntry[], options: { syncedAt?: Date; origin?: string | null; authorize?: () => Promise<void> } = {}, database: Firestore = db) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await options.authorize?.();
    const root = await getDoc(userRef(uid, database));
    const records = await getDocsFromServer(entriesRef(uid, database));
    const stored = records.docs.map((row) => readEntry(row.id, row.data()));
    const entries = stored.length || revision(root.data()) ? stored : legacySleepEntries(root.data());
    const next = change(entries);
    const preferred = options.origin ?? root.data()?.sleepProfile?.originAppPackage ?? null;
    const { days } = deriveSleepDays(next, preferred);
    if (days.some((day) => day.hours > 24)) throw Error("The entries total more than 24 hours for one date. Review their dates and durations.");
    const byId = new Map(stored.map((entry) => [entry.id, entry]));
    const changed = next.filter((entry) => !byId.has(entry.id) || sleepEntrySignature(byId.get(entry.id)!) !== sleepEntrySignature(entry));
    const retainedIds = new Set(next.map((entry) => entry.id));
    const removed = stored.filter((entry) => !retainedIds.has(entry.id));
    if (removed.some((entry) => entry.source === "health")) throw Error("Imported sessions must be excluded, not deleted.");
    if (changed.length + removed.length > 450) throw Error("Too many sleep changes to save at once. Try a smaller import.");
    await options.authorize?.();
    const committed = await runTransaction(database, async (transaction) => {
      const current = await transaction.get(userRef(uid, database));
      if (revision(current.data()) !== revision(root.data())) return false;
      for (const entry of changed) transaction.set(doc(entriesRef(uid, database), entry.id), entry);
      for (const entry of removed) transaction.delete(doc(entriesRef(uid, database), entry.id));
      const summaries = days.slice(0, 30).map((day) => ({ dateKey: day.dateKey, sleepHours: Math.round(day.hours * 1000) / 1000, source: day.source, recordedAt: day.recordedAtMs == null ? null : Timestamp.fromMillis(day.recordedAtMs) }));
      const latest = summaries[0];
      const summary = { latestSleepHours: latest?.sleepHours ?? null, source: latest?.source ?? "manual", sampleRecordedAt: latest?.recordedAt ?? null, recentNightlyHours: summaries };
      transaction.set(userRef(uid, database), { sleepProfile: {
        journalRevision: revision(current.data()) + 1,
        ...summary,
        // Older installed clients may still write the original fields. Keep the ledger-derived snapshot separate.
        journalSummary: summary,
        ...(options.syncedAt ? { lastSyncedAt: Timestamp.fromDate(options.syncedAt) } : {}),
        ...(options.origin !== undefined ? { originAppPackage: options.origin, originLabel: options.origin?.includes("shealth") ? "Samsung Health / Galaxy Watch" : options.origin ? "Health Connect" : null } : {}),
      } }, { merge: true });
      return true;
    });
    if (committed) return next;
  }
  throw Error("Sleep data changed on another device. Please try again.");
}
