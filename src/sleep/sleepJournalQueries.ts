import { collection, documentId, getDocsFromServer, limit, orderBy, query, startAfter, where,
  type Firestore, type QueryConstraint, type QueryDocumentSnapshot } from "firebase/firestore";
import { readSleepEntry } from "./sleepJournalRecords";
import { SleepScopeFallback, type SleepDateRange } from "./sleepWindowScope";
import type { SleepEntry } from "./sleepSessionModel";

/** One transport/budget boundary for display and mutation dependency queries. */
export function createSleepJournalReader(uid: string, database: Firestore) {
  const ledger = collection(database, "users", uid, "sleepSessions");
  const readCounts = { documents: 0, queries: 0 };
  const page = async (constraints: QueryConstraint[], cursor?: QueryDocumentSnapshot, bounded = true) => {
    const result = await getDocsFromServer(query(ledger, ...constraints, ...(cursor ? [startAfter(cursor)] : []), limit(100)));
    readCounts.queries++; readCounts.documents += result.size;
    if (bounded && readCounts.documents > 500) throw new SleepScopeFallback("scope-budget");
    return { entries: result.docs.map(row => readSleepEntry(row.id, row.data())),
      cursor: result.docs.at(-1), done: result.size < 100 };
  };
  const read = async (constraints: QueryConstraint[], bounded = true) => {
    const rows: SleepEntry[] = [];
    let cursor: QueryDocumentSnapshot | undefined;
    while (true) {
      const result = await page(constraints, cursor, bounded);
      rows.push(...result.entries);
      if (result.done) return rows;
      cursor = result.cursor;
    }
  };
  const chunks = async (values: string[], build: (chunk: string[]) => QueryConstraint[]) => {
    const rows: SleepEntry[] = [];
    const unique = [...new Set(values)];
    for (let offset = 0; offset < unique.length; offset += 10) rows.push(...await read(build(unique.slice(offset, offset + 10))));
    return rows;
  };
  return {
    readCounts,
    all: () => read([orderBy(documentId())], false),
    range: (dates: SleepDateRange) => read([where("dateKey", ">=", dates.start), where("dateKey", "<=", dates.end), orderBy("dateKey"), orderBy(documentId())]),
    undated: () => read([where("dateKey", "==", "undated"), orderBy(documentId())]),
    dates: (dates: string[]) => chunks(dates, values => [where("dateKey", "in", values), orderBy(documentId())]),
    overlaps: (start: number, end: number) => read([where("endMs", ">", start), where("startMs", "<", end), orderBy("endMs"), orderBy("startMs"), orderBy(documentId())]),
    ids: (ids: string[]) => chunks(ids, values => [where(documentId(), "in", values), orderBy(documentId())]),
    corrections: (ids: string[]) => chunks(ids, values => [where("corrects", "in", values), orderBy(documentId())]),
    providerIds: (ids: string[]) => chunks(ids, values => [where("providerId", "in", values), orderBy(documentId())]),
    legacy: () => read([where("kind", "==", "legacy"), orderBy(documentId())]),
    contained: (start: number, end: number) => read([where("endMs", "<=", end), where("startMs", ">=", start), orderBy("startMs"), orderBy("endMs"), orderBy(documentId())]),
    older: (before: string, cursor?: QueryDocumentSnapshot) => page([
      where("dateKey", "<", before), orderBy("dateKey", "desc"), orderBy(documentId(), "desc"),
    ], cursor),
  };
}
