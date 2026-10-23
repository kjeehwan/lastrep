export type DailyStepsSnapshot = { dateKey: string; timeZone: string; steps: number | null; asOfMs: number };
export function localStepsWindow(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Providers can export a running daily total in a record ending at day end.
  // Cutting that record at now makes Health Connect prorate its count.
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { dateKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, startTime: start.toISOString(), endTime: end.toISOString() };
}
export function parseDailySteps(raw: unknown): DailyStepsSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as DailyStepsSnapshot;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.dateKey) || !Number.isFinite(Date.parse(s.dateKey)) || new Date(s.dateKey).toISOString().slice(0, 10) !== s.dateKey || typeof s.timeZone !== "string" || !s.timeZone || !Number.isSafeInteger(s.asOfMs) || s.asOfMs <= 0 || !Number.isFinite(new Date(s.asOfMs).getTime())) return null;
  if (s.steps !== null && (!Number.isSafeInteger(s.steps) || s.steps < 0 || s.steps > 1_000_000)) return null;
  return { dateKey: s.dateKey, timeZone: s.timeZone, steps: s.steps, asOfMs: s.asOfMs };
}
export function isCurrentSteps(s: DailyStepsSnapshot, now = new Date()) {
  const current = localStepsWindow(now);
  return s.dateKey === current.dateKey && s.timeZone === current.timeZone;
}
