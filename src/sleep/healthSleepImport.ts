import { emptySleepEntry, HOUR_MS, isSupersededSleepTotal, sleepDateKey, type SleepEntry } from "./sleepSessionModel";

export type ProviderSleepRecord = {
  recordType?: string; startTime: string; endTime: string;
  startZoneOffset?: { totalSeconds: number }; endZoneOffset?: { totalSeconds: number };
  metadata?: { id?: string; dataOrigin?: string; lastModifiedTime?: string; clientRecordVersion?: number };
  stages?: { startTime: string; endTime: string; stage: number }[];
};
export function providerSleepEntry(record: ProviderSleepRecord, device: string): SleepEntry {
  const startMs = Date.parse(record.startTime), endMs = Date.parse(record.endTime);
  const origin = record.metadata?.dataOrigin, providerId = record.metadata?.id;
  if (!origin || !providerId || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs || endMs - startMs > 24 * HOUR_MS) throw Error("A health sleep record has invalid times or missing identity. Nothing was imported.");
  const endOffset = record.endZoneOffset?.totalSeconds;
  const dateKey = Number.isFinite(endOffset) ? new Date(endMs + endOffset! * 1000).toISOString().slice(0, 10) : sleepDateKey(new Date(endMs));
  return {
    ...emptySleepEntry(`health-${encodeURIComponent(origin)}-${encodeURIComponent(providerId)}`, dateKey, (endMs - startMs) / HOUR_MS, new Date(endMs)),
    source: "health", kind: "session", startMs, endMs, origin, providerId, importDevice: device,
    allocationTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    startOffsetMinutes: record.startZoneOffset ? record.startZoneOffset.totalSeconds / 60 : null,
    endOffsetMinutes: record.endZoneOffset ? record.endZoneOffset.totalSeconds / 60 : null,
    modifiedAt: record.metadata?.lastModifiedTime ?? null, clientVersion: record.metadata?.clientRecordVersion ?? null,
    stages: (record.stages ?? []).map((stage) => ({ startMs: Date.parse(stage.startTime), endMs: Date.parse(stage.endTime), stage: stage.stage })).filter((stage) => Number.isFinite(stage.startMs) && Number.isFinite(stage.endMs) && stage.endMs > stage.startMs),
  };
}
export function reconcileHealthSleep(entries: SleepEntry[], incoming: SleepEntry[], deletedIds: string[], device: string, fullWindow?: { start: number; end: number }): SleepEntry[] {
  const next = new Map(entries.map((entry) => [entry.id, entry]));
  const seen = new Set(incoming.map((entry) => entry.id));
  for (const entry of entries) {
    if (entry.source === "health" && entry.importDevice === device && (deletedIds.includes(entry.providerId ?? "") || (fullWindow && entry.startMs != null && entry.startMs >= fullWindow.start && entry.endMs! <= fullWindow.end && !seen.has(entry.id)))) next.set(entry.id, { ...entry, providerDeleted: true });
  }
  for (const entry of incoming) {
    const previous = next.get(entry.id);
    // Re-apply the original allocation timezone, even if the provider corrects the end instant during travel.
    let dateKey = entry.dateKey;
    const allocationTimeZone = previous?.allocationTimeZone ?? entry.allocationTimeZone ?? null;
    if (entry.endOffsetMinutes == null && previous) {
      if (allocationTimeZone) {
        const parts = new Intl.DateTimeFormat("en-US", { timeZone: allocationTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(entry.endMs!));
        const part = (type: string) => parts.find((value) => value.type === type)!.value;
        dateKey = `${part("year")}-${part("month")}-${part("day")}`;
      } else if (entry.endMs === previous.endMs) dateKey = previous.dateKey;
    }
    next.set(entry.id, { ...entry, dateKey, allocationTimeZone, excluded: previous?.excluded ?? false, providerDeleted: false });
  }
  const reconciled = [...next.values()];
  for (const legacy of reconciled) if (isSupersededSleepTotal(legacy, reconciled)) next.set(legacy.id, { ...legacy, excluded: true });
  return [...next.values()];
}
export async function readAllSleepPages(read: (pageToken?: string) => Promise<{ records: ProviderSleepRecord[]; pageToken?: string }>) {
  const records: ProviderSleepRecord[] = [], seen = new Set<string>();
  let token: string | undefined;
  do {
    const page = await read(token);
    records.push(...page.records);
    token = page.pageToken || undefined;
    if (token && seen.has(token)) throw Error("Health Connect repeated a page. Import was stopped without saving partial data.");
    if (token) seen.add(token);
  } while (token);
  return records;
}
