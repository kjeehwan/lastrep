import { doc, getDocFromServer, type DocumentData, type Firestore } from "firebase/firestore";
import { createSleepJournalReader } from "./sleepJournalQueries";
import { db } from "../config/firebaseConfig";
import { legacySleepEntries, sleepJournalProfileKey } from "./sleepJournalRecords";
import { deriveSleepDays, shiftSleepDate, sleepDateKey, type SleepEntry } from "./sleepSessionModel";
import { readSleepWindowScope, SleepScopeFallback, type SleepDateRange } from "./sleepWindowScope";

export { sleepJournalProfileKey } from "./sleepJournalRecords";
export function sleepDisplayRange(selected: string, chartSelected: string, anchor: string): SleepDateRange {
  return { start: [selected, shiftSleepDate(chartSelected, -6), shiftSleepDate(anchor, -13)].sort()[0],
    end: [selected, chartSelected, anchor].sort().at(-1)! };
}
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Server-complete scopes only. The hook retains previously completed windows offline. */
export async function getSleepJournalWindow(uid: string, requested: SleepDateRange | null = null, database: Firestore = db) {
  const ref = doc(database, "users", uid);
  for (let attempt = 0; attempt < 4; attempt++) {
    const root = await getDocFromServer(ref), data = root.data(), profile = data?.sleepProfile;
    const summary = profile?.journalSummary ?? profile;
    const recordedDates = (Array.isArray(summary?.recentNightlyHours) ? summary.recentNightlyHours : [])
      .map((row: DocumentData) => row.dateKey).filter(validDate).sort().reverse() as string[];
    let initialDate = recordedDates[0] ?? sleepDateKey(new Date());
    const today = sleepDateKey(new Date());
    let range = requested ?? sleepDisplayRange(initialDate, initialDate, initialDate < shiftSleepDate(today, -13) ? initialDate : today);
    const reader = createSleepJournalReader(uid, database);
    let entries: SleepEntry[], fallback: string | null = null;
    try {
      if (!(profile?.journalRevision > 0) || !Array.isArray(summary?.recentNightlyHours)) throw new SleepScopeFallback("legacy-profile");
      entries = (await readSleepWindowScope(reader, range)).entries;
    } catch (error) {
      if (!(error instanceof SleepScopeFallback) && (error as { code?: string }).code !== "failed-precondition") throw error;
      fallback = error instanceof SleepScopeFallback ? error.message : "index-unavailable";
      entries = await reader.all();
      if (!entries.length && !profile?.journalRevision) entries = legacySleepEntries(data);
      if (!requested) {
        initialDate = deriveSleepDays(entries, profile?.originAppPackage ?? null).days[0]?.dateKey ?? today;
        range = sleepDisplayRange(initialDate, initialDate, initialDate < shiftSleepDate(today, -13) ? initialDate : today);
      }
    }
    const current = await getDocFromServer(ref);
    if (sleepJournalProfileKey(current.data()) !== sleepJournalProfileKey(data)) continue;
    return { entries, range, initialDate, profileKey: sleepJournalProfileKey(data), origin: profile?.originAppPackage ?? null,
      target: data?.sleepSettings?.targetHours, fallback, readCounts: reader.readCounts };
  }
  throw Error("Sleep data changed on another device. Please try again.");
}
export type SleepJournalWindow = Awaited<ReturnType<typeof getSleepJournalWindow>>;
