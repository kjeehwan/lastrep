import type { SleepEntry } from "./sleepSessionModel";

export type SleepDateRange = { start: string; end: string };
export const containsSleepRange = (outer: SleepDateRange | null, inner: SleepDateRange) =>
  !!outer && outer.start <= inner.start && outer.end >= inner.end;
export class SleepScopeFallback extends Error {}
export type SleepScopeReader = {
  range: (range: SleepDateRange) => Promise<SleepEntry[]>;
  undated: () => Promise<SleepEntry[]>;
  dates: (dates: string[]) => Promise<SleepEntry[]>;
  overlaps: (start: number, end: number) => Promise<SleepEntry[]>;
  ids: (ids: string[]) => Promise<SleepEntry[]>;
  corrections: (ids: string[]) => Promise<SleepEntry[]>;
};

/** Close all date, interval and identity dependencies before publishing totals. */
export async function readSleepWindowScope(reader: SleepScopeReader, range: SleepDateRange,
  budget = { records: 500, rounds: 8 }) {
  const initial = (await Promise.all([reader.range(range), reader.undated()])).flat();
  return closeSleepScope(reader, initial, date => date === "undated" || date >= range.start && date <= range.end, budget);
}

/** Expand saved records to a closed calculation component; new command intervals are seeded by the caller. */
export async function closeSleepScope(reader: SleepScopeReader, initial: SleepEntry[], completeDate: (date: string) => boolean = () => false,
  budget = { records: 500, rounds: 8 }) {
  const entries = new Map<string, SleepEntry>(), expanded = new Set<string>(), dates = new Set<string>();
  let fetched = 0, coveredStart = Infinity, coveredEnd = -Infinity;
  const add = (rows: SleepEntry[]) => {
    fetched += rows.length;
    if (fetched > budget.records) throw new SleepScopeFallback("scope-budget");
    for (const row of rows) entries.set(row.id, row);
  };
  add(initial);
  for (let round = 0; round < budget.rounds; round++) {
    const fresh = [...entries.values()].filter(row => !expanded.has(row.id));
    if (!fresh.length) return { entries: [...entries.values()], fetched };
    fresh.forEach(row => expanded.add(row.id));
    const missingDates = [...new Set(fresh.map(row => row.dateKey))].filter(date =>
      !completeDate(date) && !dates.has(date));
    missingDates.forEach(date => dates.add(date));
    const active = fresh.filter(row => !row.excluded && !row.providerDeleted);
    if (active.some(row => (row.startMs == null) !== (row.endMs == null))) throw new SleepScopeFallback("unprovable-interval");
    const timed = active.filter(row => row.startMs != null);
    if (timed.some(row => !Number.isFinite(row.startMs) || !Number.isFinite(row.endMs) || row.endMs! <= row.startMs!)) {
      throw new SleepScopeFallback("unprovable-interval");
    }
    const start = Math.min(...timed.map(row => row.startMs!)), end = Math.max(...timed.map(row => row.endMs!));
    const needsInterval = timed.length > 0 && (start < coveredStart || end > coveredEnd);
    if (needsInterval) { coveredStart = Math.min(coveredStart, start); coveredEnd = Math.max(coveredEnd, end); }
    const references = [...new Set(fresh.flatMap(row => row.corrects && !entries.has(row.corrects) ? [row.corrects] : []))];
    const rows = await Promise.all([
      missingDates.length ? reader.dates(missingDates) : [],
      needsInterval ? reader.overlaps(coveredStart, coveredEnd) : [],
      references.length ? reader.ids(references) : [],
      reader.corrections(fresh.map(row => row.id)),
    ]);
    rows.forEach(add);
  }
  throw new SleepScopeFallback("scope-rounds");
}
