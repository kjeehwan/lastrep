import type { DocumentData, Firestore, QueryDocumentSnapshot } from "firebase/firestore";
import { applySleepCommand, type SleepCommand } from "./sleepCommands";
import { reconcileHealthSleep } from "./healthSleepImport";
import { createSleepJournalReader } from "./sleepJournalQueries";
import { legacySleepEntries } from "./sleepJournalRecords";
import { mergeSleepSummary, savedSleepSummary, sleepSummary, summarizeSleepDays } from "./sleepJournalSummary";
import { deriveSleepDays, type SleepEntry } from "./sleepSessionModel";
import { closeSleepScope, SleepScopeFallback } from "./sleepWindowScope";

/** Returned arrays are a complete calculation component, never an account-wide deletion authority. */
export async function prepareSleepCommand(uid: string, command: SleepCommand, data: DocumentData | undefined,
  preferred: string | null, database: Firestore) {
  const reader = createSleepJournalReader(uid, database);
  const finish = (stored: SleepEntry[], entries: SleepEntry[], mode: "scoped" | "full", fallback: string | null) => {
    const next = applySleepCommand(entries, command), { days } = deriveSleepDays(next, preferred);
    return { stored, next, days, summary: sleepSummary(summarizeSleepDays(days)),
      diagnostics: { ...reader.readCounts, mode, fallback, derivedEntries: next.length } };
  };
  try {
    const saved = savedSleepSummary(data);
    if (preferred !== (data?.sleepProfile?.originAppPackage ?? null)) throw new SleepScopeFallback("origin-change");
    const seeds = command.kind === "manual" ? [command.candidate, ...(command.expected ? [command.expected] : []), ...(command.replacements ?? [])]
      : command.kind === "remove" ? [command.expected] : command.incoming;
    const initial = (await Promise.all([
      reader.ids(seeds.map(row => row.id)), reader.undated(),
      command.kind === "health" ? reader.legacy() : [],
      command.kind === "health" ? reader.providerIds(command.deletedIds) : [],
      command.kind === "health" && command.fullWindow ? reader.contained(command.fullWindow.start, command.fullWindow.end) : [],
    ])).flat();
    // Resolve the original allocation timezone before discovering new date dependencies.
    const allocated = command.kind === "health"
      ? reconcileHealthSleep(initial, command.incoming, command.deletedIds, command.device, command.fullWindow) : [];
    const dependencySeeds = [...seeds, ...initial, ...allocated];
    const dates = [...new Set(dependencySeeds.map(row => row.dateKey).filter(date => date !== "undated"))];
    const timed = dependencySeeds.filter(row => row.startMs != null || row.endMs != null);
    if (timed.some(row => !Number.isFinite(row.startMs) || !Number.isFinite(row.endMs) || row.endMs! <= row.startMs!)) throw new SleepScopeFallback("unprovable-interval");
    const intervals = timed.length ? await reader.overlaps(Math.min(...timed.map(row => row.startMs!)), Math.max(...timed.map(row => row.endMs!))) : [];
    const dated = await reader.dates(dates);
    let stored = (await closeSleepScope(reader, [...initial, ...intervals, ...dated], date => date === "undated" || dates.includes(date))).entries;
    let cursor: QueryDocumentSnapshot | undefined;
    let frontier = saved.at(-1)?.dateKey;
    for (let refill = 0; refill < 8; refill++) {
      const result = finish(stored, stored, "scoped", null);
      const touched = new Set([...stored, ...result.next].map(row => row.dateKey));
      result.summary = mergeSleepSummary(saved, touched, result.days);
      // An unlisted date is older than the saved 30th date. Only refill if it can enter the new top 30.
      if (saved.length < 30 || !frontier || result.summary.recentNightlyHours.length === 30 && result.summary.recentNightlyHours[29].dateKey >= frontier) return result;
      const page = await reader.older(saved[29].dateKey, cursor);
      cursor = page.cursor;
      stored = (await closeSleepScope(reader, [...stored, ...page.entries])).entries;
      frontier = page.done ? undefined : page.entries.at(-1)?.dateKey;
      // Each boundary date is completed by closeSleepScope, even if the transport page cut it in half.
    }
    throw new SleepScopeFallback("summary-refill-budget");
  } catch (error) {
    if (!(error instanceof SleepScopeFallback) && (error as { code?: string }).code !== "failed-precondition") throw error;
    const stored = await reader.all();
    const entries = stored.length || data?.sleepProfile?.journalRevision ? stored : legacySleepEntries(data);
    return finish(stored, entries, "full", error instanceof SleepScopeFallback ? error.message : "index-unavailable");
  }
}
