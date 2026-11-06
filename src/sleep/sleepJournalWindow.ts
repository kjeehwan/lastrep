import { collection, doc, documentId, getDocFromServer, getDocsFromServer, limit, orderBy, query, startAfter, where,
  type DocumentData, type Firestore, type QueryConstraint, type QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import { legacySleepEntries, readSleepEntry } from "./sleepJournal";
import { deriveSleepDays, shiftSleepDate, sleepDateKey, type SleepEntry } from "./sleepSessionModel";
import { readSleepWindowScope, SleepScopeFallback, type SleepDateRange } from "./sleepWindowScope";

export function sleepJournalProfileKey(data: DocumentData | undefined) {
  const profile = data?.sleepProfile;
  return JSON.stringify([profile?.journalRevision ?? 0, profile?.originAppPackage ?? null,
    profile?.journalSummary ?? null, profile?.recentNightlyHours ?? null, profile?.sampleRecordedAt ?? null]);
}
export function sleepDisplayRange(selected: string, chartSelected: string, anchor: string): SleepDateRange {
  return { start: [selected, shiftSleepDate(chartSelected, -6), shiftSleepDate(anchor, -13)].sort()[0],
    end: [selected, chartSelected, anchor].sort().at(-1)! };
}
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Server-complete scopes only. The hook retains previously completed windows offline. */
export async function getSleepJournalWindow(uid: string, requested: SleepDateRange | null = null, database: Firestore = db) {
  const ref = doc(database, "users", uid), ledger = collection(ref, "sleepSessions");
  for (let attempt = 0; attempt < 4; attempt++) {
    const root = await getDocFromServer(ref), data = root.data(), profile = data?.sleepProfile;
    const summary = profile?.journalSummary ?? profile;
    const recordedDates = (Array.isArray(summary?.recentNightlyHours) ? summary.recentNightlyHours : [])
      .map((row: DocumentData) => row.dateKey).filter(validDate).sort().reverse() as string[];
    let initialDate = recordedDates[0] ?? sleepDateKey(new Date());
    const today = sleepDateKey(new Date());
    let range = requested ?? sleepDisplayRange(initialDate, initialDate, initialDate < shiftSleepDate(today, -13) ? initialDate : today);
    const readCounts = { documents: 0, queries: 0 };
    const read = async (constraints: QueryConstraint[], bounded = true): Promise<SleepEntry[]> => {
      const rows: SleepEntry[] = [];
      let cursor: QueryDocumentSnapshot | undefined;
      while (true) {
        const page = await getDocsFromServer(query(ledger, ...constraints, ...(cursor ? [startAfter(cursor)] : []), limit(100)));
        readCounts.queries++; readCounts.documents += page.size;
        if (bounded && readCounts.documents > 500) throw new SleepScopeFallback("scope-budget");
        rows.push(...page.docs.map(row => readSleepEntry(row.id, row.data())));
        if (page.size < 100) return rows;
        cursor = page.docs.at(-1);
      }
    };
    const chunks = async (values: string[], build: (chunk: string[]) => QueryConstraint[]) => {
      const rows: SleepEntry[] = [];
      for (let offset = 0; offset < values.length; offset += 10) rows.push(...await read(build(values.slice(offset, offset + 10))));
      return rows;
    };
    let entries: SleepEntry[], fallback: string | null = null;
    try {
      if (!(profile?.journalRevision > 0) || !Array.isArray(summary?.recentNightlyHours)) throw new SleepScopeFallback("legacy-profile");
      entries = (await readSleepWindowScope({
        range: dates => read([where("dateKey", ">=", dates.start), where("dateKey", "<=", dates.end), orderBy("dateKey"), orderBy(documentId())]),
        undated: () => read([where("dateKey", "==", "undated"), orderBy(documentId())]),
        dates: dates => chunks(dates, values => [where("dateKey", "in", values), orderBy(documentId())]),
        overlaps: (start, end) => read([where("endMs", ">", start), where("startMs", "<", end), orderBy("endMs"), orderBy("startMs"), orderBy(documentId())]),
        ids: ids => chunks(ids, values => [where(documentId(), "in", values), orderBy(documentId())]),
        corrections: ids => chunks(ids, values => [where("corrects", "in", values), orderBy(documentId())]),
      }, range)).entries;
    } catch (error) {
      if (!(error instanceof SleepScopeFallback) && (error as { code?: string }).code !== "failed-precondition") throw error;
      fallback = error instanceof SleepScopeFallback ? error.message : "index-unavailable";
      entries = await read([orderBy(documentId())], false);
      if (!entries.length && !profile?.journalRevision) entries = legacySleepEntries(data);
      if (!requested) {
        initialDate = deriveSleepDays(entries, profile?.originAppPackage ?? null).days[0]?.dateKey ?? today;
        range = sleepDisplayRange(initialDate, initialDate, initialDate < shiftSleepDate(today, -13) ? initialDate : today);
      }
    }
    const current = await getDocFromServer(ref);
    if (sleepJournalProfileKey(current.data()) !== sleepJournalProfileKey(data)) continue;
    return { entries, range, initialDate, profileKey: sleepJournalProfileKey(data), origin: profile?.originAppPackage ?? null,
      target: data?.sleepSettings?.targetHours, fallback, readCounts };
  }
  throw Error("Sleep data changed on another device. Please try again.");
}
export type SleepJournalWindow = Awaited<ReturnType<typeof getSleepJournalWindow>>;
