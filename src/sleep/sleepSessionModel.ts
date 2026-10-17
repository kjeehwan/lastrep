export type SleepEntry = {
  id: string;
  dateKey: string;
  source: "manual" | "health";
  kind: "session" | "duration" | "legacy";
  hours: number;
  startMs: number | null;
  endMs: number | null;
  startOffsetMinutes: number | null;
  endOffsetMinutes: number | null;
  timeZone: string | null;
  allocationTimeZone?: string | null;
  recordedAtMs: number | null;
  excluded: boolean;
  providerDeleted: boolean;
  corrects: string | null;
  providerId: string | null;
  origin: string | null;
  importDevice: string | null;
  modifiedAt: string | null;
  clientVersion: number | null;
  stages: { startMs: number; endMs: number; stage: number }[];
};
export type SleepDay = {
  dateKey: string; hours: number; recordedAtMs: number | null;
  source: "manual" | "health"; mixed: boolean; sessionCount: number; needsReview: boolean;
  mayIncludeAwakeTime: boolean;
};
export type CountedSleepEntry = SleepEntry & { countedHours: number; needsReview: boolean };
export const HOUR_MS = 3_600_000;
export const sleepDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function shiftSleepDate(key: string, days: number): string {
  const date = parseSleepDate(key);
  date.setDate(date.getDate() + days);
  return sleepDateKey(date);
}
export function parseSleepDate(key: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw Error("Choose a valid date.");
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  if (sleepDateKey(date) !== key) throw Error("Choose a valid date.");
  return date;
}
export function sleepDurationText(hours: number | null): string {
  if (hours == null) return "Not recorded";
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}
export function sleepTimeMinutes(time: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
export function sleepMinutesTime(minutes: number): string {
  const value = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
export function validateSleepHours(raw: string): number {
  const hours = Number(raw.trim());
  if (!raw.trim() || !Number.isFinite(hours) || hours <= 0 || hours > 24 || Math.round(hours * 60) === 0) throw Error("Enter more than 0 and no more than 24 hours.");
  return hours;
}
/** Local Date resolves actual instants, including DST; reject normalized/nonexistent times. */
export function localSleepInstant(dateKey: string, time: string): Date {
  const date = parseSleepDate(dateKey), minutes = sleepTimeMinutes(time);
  if (minutes == null) throw Error("Use 24-hour HH:MM times, for example 23:00.");
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (sleepDateKey(date) !== dateKey || date.getHours() * 60 + date.getMinutes() !== minutes) throw Error("This local time does not exist because the clocks changed. Choose another time.");
  return date;
}
export function timedSleepEntry(bedDate: string, bedtime: string, wakeDate: string, wakeTime: string, now = new Date()) {
  const start = localSleepInstant(bedDate, bedtime), end = localSleepInstant(wakeDate, wakeTime);
  const hours = (end.getTime() - start.getTime()) / HOUR_MS;
  if (hours <= 0 || hours > 24) throw Error("Wake time must follow bedtime by more than 0 and no more than 24 hours.");
  if (end > now) throw Error("Wake time cannot be in the future.");
  // Repeated local times are ambiguous without an offset. Do not silently choose a DST occurrence.
  for (const date of [start, end]) {
    for (const delta of [30, 60, 120]) {
      const later = new Date(date.getTime() + delta * 60_000);
      if (sleepDateKey(later) === sleepDateKey(date) && later.getHours() === date.getHours() && later.getMinutes() === date.getMinutes()) throw Error("This time occurs twice when clocks change. Use Duration only for this entry.");
    }
  }
  return { dateKey: wakeDate, hours, startMs: start.getTime(), endMs: end.getTime(), startOffsetMinutes: -start.getTimezoneOffset(), endOffsetMinutes: -end.getTimezoneOffset(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}
export function emptySleepEntry(id: string, dateKey: string, hours: number, now: Date): SleepEntry {
  return { id, dateKey, hours, kind: "duration", source: "manual", startMs: null, endMs: null, startOffsetMinutes: null, endOffsetMinutes: null, timeZone: null, recordedAtMs: now.getTime(), excluded: false, providerDeleted: false, corrects: null, providerId: null, origin: null, importDevice: null, modifiedAt: null, clientVersion: null, stages: [] };
}
type Range = [number, number];
function union(ranges: Range[]): Range[] {
  const result: Range[] = [];
  for (const range of ranges.slice().sort((a, b) => a[0] - b[0])) {
    const last = result.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else result.push([...range]);
  }
  return result;
}
/** Legacy imports stored elapsed hours rounded to tenths, not asleep-stage hours. */
export function isSupersededSleepTotal(entry: SleepEntry, entries: SleepEntry[]): boolean {
  if (entry.kind !== "legacy" || entry.source !== "health" || entry.dateKey === "undated") return false;
  const replacements = entries.filter((item) => item.dateKey === entry.dateKey && !item.excluded && !item.providerDeleted);
  if (replacements.some((item) => item.corrects === entry.id)) return true;
  const windows = union(replacements.filter((item) => item.source === "health" && item.kind === "session" && item.startMs != null && item.endMs != null).map((item) => [item.startMs!, item.endMs!]));
  const elapsed = windows.reduce((sum, [start, end]) => sum + end - start, 0) / HOUR_MS;
  // Same-date presence alone is not evidence that a partial import replaces a night.
  return windows.length > 0 && Math.abs(elapsed - entry.hours) <= 0.051;
}
function completeSleepStages(entry: SleepEntry): SleepEntry["stages"] | null {
  if (entry.startMs == null || entry.endMs == null) return null;
  // Only use asleep stages if they cover the complete session; partial staging is not a full sleep measurement.
  const stages = entry.stages.filter((stage) => stage.startMs >= entry.startMs! && stage.endMs <= entry.endMs! && stage.endMs > stage.startMs);
  const coverage = union(stages.map((stage) => [stage.startMs, stage.endMs]));
  const complete = coverage.length === 1 && coverage[0][0] === entry.startMs && coverage[0][1] === entry.endMs && stages.reduce((sum, stage) => sum + stage.endMs - stage.startMs, 0) === entry.endMs - entry.startMs && stages.every((stage) => [1, 2, 3, 4, 5, 6, 7].includes(stage.stage));
  return complete ? stages : null;
}
function entryRanges(entry: SleepEntry): Range[] {
  if (entry.startMs == null || entry.endMs == null) return [];
  const stages = completeSleepStages(entry);
  return stages ? union(stages.filter((stage) => [2, 4, 5, 6].includes(stage.stage)).map((stage) => [stage.startMs, stage.endMs])) : [[entry.startMs, entry.endMs]];
}
export function sleepEntryAsleepHours(entry: SleepEntry): number | null {
  if (!completeSleepStages(entry)) return null;
  const ranges = entryRanges(entry);
  return ranges.reduce((sum, [start, end]) => sum + end - start, 0) / HOUR_MS;
}
export function sleepEntrySignature(entry: SleepEntry): string {
  return JSON.stringify(entry, (_key, value) => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
}
export function sleepEntriesConflict(a: SleepEntry, b: SleepEntry): boolean {
  if (a.id === b.id || b.excluded || b.providerDeleted) return false;
  if (a.startMs == null || b.startMs == null || a.endMs == null || b.endMs == null) return a.dateKey === b.dateKey;
  return Math.min(a.endMs, b.endMs) > Math.max(a.startMs, b.startMs);
}
export class SleepOverlapError extends Error {
  constructor(public readonly conflicts: SleepEntry[]) { super("These entries may describe the same sleep. Review them before saving."); }
}
export function removeSleepEntry(entries: SleepEntry[], expected: SleepEntry): SleepEntry[] {
  const current = entries.find((entry) => entry.id === expected.id);
  if (!current || current.excluded || current.providerDeleted || sleepEntrySignature(current) !== sleepEntrySignature(expected)) throw Error("This entry changed. Close it and try again.");
  // Keep imported identities excluded so a later sync cannot resurrect them.
  // Deleting a manual correction leaves its original provider marker untouched.
  return current.source === "manual" ? entries.filter((entry) => entry.id !== current.id) : entries.map((entry) => entry.id === current.id ? { ...entry, excluded: true } : entry);
}
/** Manual corrections win, then the user's chosen provider; fallback is stable origin ordering. */
export function deriveSleepDays(entries: SleepEntry[], preferredOrigin: string | null = null): { days: SleepDay[]; entries: CountedSleepEntry[] } {
  const active = entries.filter((entry) => entry.dateKey !== "undated" && !entry.excluded && !entry.providerDeleted && !isSupersededSleepTotal(entry, entries));
  const unknownDates = new Set(active.filter((entry) => entry.startMs == null).map((entry) => entry.dateKey));
  const counted = new Map<string, CountedSleepEntry>();
  let covered: Range[] = [];
  const rank = (entry: SleepEntry) => entry.source === "manual" ? 0 : entry.origin === preferredOrigin ? 1 : 2;
  for (const entry of [...active].sort((a, b) => rank(a) - rank(b) || (a.origin ?? "").localeCompare(b.origin ?? "") || a.id.localeCompare(b.id))) {
    let countedHours = entry.hours, needsReview = false;
    if (entry.startMs != null) {
      if (unknownDates.has(entry.dateKey)) { countedHours = 0; needsReview = true; }
      else {
        const ranges = entryRanges(entry);
        const fullMs = ranges.reduce((sum, [start, end]) => sum + end - start, 0);
        const overlap = ranges.reduce((sum, [start, end]) => sum + covered.reduce((value, [a, b]) => value + Math.max(0, Math.min(end, b) - Math.max(start, a)), 0), 0);
        countedHours = Math.max(0, fullMs - overlap) / HOUR_MS;
        needsReview = covered.some(([start, end]) => Math.min(end, entry.endMs!) > Math.max(start, entry.startMs!));
        // Lower-priority sources must not fill minutes the preferred source explicitly marked awake.
        covered = union([...covered, [entry.startMs, entry.endMs!]]);
      }
    } else {
      // Unknown-time totals cannot be safely added together. Keep one, retaining the rest for review.
      if ([...counted.values()].some((item) => item.dateKey === entry.dateKey && item.startMs == null)) { countedHours = 0; needsReview = true; }
    }
    counted.set(entry.id, { ...entry, countedHours, needsReview });
  }
  const days = new Map<string, SleepDay>();
  for (const entry of counted.values()) {
    const day = days.get(entry.dateKey) ?? { dateKey: entry.dateKey, hours: 0, recordedAtMs: null, source: entry.source, mixed: false, sessionCount: 0, needsReview: false, mayIncludeAwakeTime: false };
    day.hours += entry.countedHours;
    if (entry.countedHours > 0 && sleepEntryAsleepHours(entry) == null) day.mayIncludeAwakeTime = true;
    if (entry.recordedAtMs != null) day.recordedAtMs = Math.max(day.recordedAtMs ?? 0, entry.recordedAtMs);
    day.mixed ||= day.source !== entry.source;
    if (entry.source === "manual") day.source = "manual";
    day.sessionCount += entry.kind === "legacy" ? 0 : 1;
    day.needsReview ||= entry.needsReview;
    days.set(entry.dateKey, day);
  }
  return { days: [...days.values()].sort((a, b) => b.dateKey.localeCompare(a.dateKey)), entries: entries.map((entry) => counted.get(entry.id) ?? { ...entry, countedHours: 0, needsReview: false }) };
}
export function commitManualSleep(entries: SleepEntry[], candidate: SleepEntry, editingId: string | null, replaceIds: string[] = []): SleepEntry[] {
  const editing = editingId ? entries.find((entry) => entry.id === editingId && !entry.excluded && !entry.providerDeleted) : null;
  if (editingId && !editing) throw Error("This entry changed. Close it and try again.");
  const conflicts = entries.filter((entry) => entry.id !== editingId && sleepEntriesConflict(candidate, entry));
  if (conflicts.some((entry) => !replaceIds.includes(entry.id))) throw new SleepOverlapError(conflicts);
  const id = editing?.source === "manual" ? editing.id : candidate.id;
  const row = { ...candidate, id, corrects: editing?.source === "health" ? editing.id : editing?.corrects ?? null };
  return [...entries.filter((entry) => entry.id !== id).map((entry) => entry.id === editingId || conflicts.some((conflict) => conflict.id === entry.id) ? { ...entry, excluded: true } : entry), row];
}
export function weeklySleepSummary(days: SleepDay[], selected: string, target: number) {
  const first = shiftSleepDate(selected, -6);
  const rows = days.filter((day) => day.dateKey >= first && day.dateKey <= selected);
  return { count: rows.length, average: rows.length ? rows.reduce((sum, day) => sum + day.hours, 0) / rows.length : null, met: rows.filter((day) => day.hours >= target).length };
}
