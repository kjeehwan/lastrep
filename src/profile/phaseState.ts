import { doc, runTransaction, Timestamp } from "firebase/firestore";
import { db } from "../config/firebaseConfig";

export function phaseWeek(startMs: number | null, nowMs: number): number | null {
  if (startMs == null || !Number.isFinite(startMs)) return null;
  return Math.max(1, Math.floor((nowMs - startMs) / 604800000) + 1);
}

export type PhaseKey = "trainingPhase" | "dietPhase";
export type PhaseHistoryDateEdit = { index: number; startDateKey: string };
export type PhaseEdit = { mode: "edit" | "new"; phase: string; name: string; week: number | null; expectedPhase: string; expectedStartMs: number | null; requestId?: string; startDateKey?: string; historyDates?: PhaseHistoryDateEdit[]; removedHistoryIndices?: number[]; expectedHistory?: string };
export type PhaseChanges = Partial<Record<PhaseKey, string | PhaseEdit>>;
export function phaseType(data: Record<string, any>, key: PhaseKey): string {
  const allowed = key === "trainingPhase" ? ["Hypertrophy", "Strength", "Power"] : ["Cut", "Maintain", "Bulk"];
  return allowed.includes(data[key]) ? data[key] : key === "trainingPhase" ? "Hypertrophy" : "Maintain";
}
export function phaseName(data: Record<string, any>, key: PhaseKey): string {
  return typeof data[`${key}Name`] === "string" && data[`${key}Name`].trim() ? data[`${key}Name`].trim() : phaseType(data, key);
}
export function currentPhaseWeek(data: Record<string, any>, key: PhaseKey, nowMs: number): number | null {
  const confirmed = data[`${key}StartDateAnchorAt`];
  const started = data[`${key}StartedAt`];
  const startDate = data[`${key}StartDateKey`];
  if (started instanceof Timestamp && confirmed instanceof Timestamp && started.isEqual(confirmed) && parsePhaseStartDate(startDate)) return phaseWeekFromDate(startDate, new Date(nowMs));
  const anchor = data[`${key}WeekAnchorAt`];
  const base = data[`${key}WeekBase`];
  const start = data[`${key}StartedAt`];
  if (anchor instanceof Timestamp && (!(start instanceof Timestamp) || anchor.toMillis() >= start.toMillis()) && Number.isInteger(base) && base >= 1) return base + (phaseWeek(anchor.toMillis(), nowMs) ?? 1) - 1;
  return phaseWeek(data[`${key}StartedAt`] instanceof Timestamp ? data[`${key}StartedAt`].toMillis() : null, nowMs);
}

export function phaseForDate(history: unknown, currentPhase: string, startedAtMs: number | null, targetMs: number): string | null {
  const entries = Array.isArray(history) ? history.filter((entry) => typeof entry?.phase === "string" && entry?.startedAt instanceof Timestamp && entry.startedAt.toMillis() <= targetMs) : [];
  if (startedAtMs != null && startedAtMs <= targetMs) entries.push({ phase: currentPhase, startedAt: Timestamp.fromMillis(startedAtMs) });
  entries.sort((a, b) => a.startedAt.toMillis() - b.startedAt.toMillis());
  return entries.at(-1)?.phase ?? null;
}

export const phaseDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
/** Display-only intervals; adjacent phases of the same type stay separate. */
export function phaseTimeline(past: { index: number; phase: string; name?: string; startDate: string }[], current: { phase: string; name?: string; startDate: string }) {
  const entries = [...past.map(item => ({ ...item, current: false })), { ...current, index: -1, current: true }]
    .filter(item => parsePhaseStartDate(item.startDate)).sort((a, b) => a.startDate.localeCompare(b.startDate) || Number(a.current) - Number(b.current));
  return entries.map((item, index) => {
    const next = entries[index + 1];
    const precedingDay = next ? new Date(Date.parse(next.startDate + "T00:00:00Z") - 86400000).toISOString().slice(0, 10) : null;
    return { ...item, endDate: item.current ? null : precedingDay && precedingDay >= item.startDate ? precedingDay : next?.startDate ?? null };
  });
}
export function phaseHistorySignature(history: unknown): string {
  return JSON.stringify(Array.isArray(history) ? history.map(entry => [entry?.phase, entry?.startedAt instanceof Timestamp ? entry.startedAt.toMillis() : null]) : []);
}
function editHistoryDates(current: Record<string, any>, key: PhaseKey, edit: PhaseEdit, today: string) {
  const history = Array.isArray(current[`${key}History`]) ? [...current[`${key}History`]] : [];
  if (!edit.historyDates?.length && !edit.removedHistoryIndices?.length) return history;
  if (edit.expectedHistory !== phaseHistorySignature(history)) throw new Error("Your phase history changed elsewhere. Reopen it and try again.");
  const currentStart = current[`${key}StartedAt`];
  const currentIndex = history.findLastIndex(entry => entry?.phase === current[key] && entry?.startedAt instanceof Timestamp && currentStart instanceof Timestamp && entry.startedAt.isEqual(currentStart));
  const seen = new Set<number>();
  for (const change of edit.historyDates ?? []) {
    const entry = history[change.index], date = parsePhaseStartDate(change.startDateKey);
    if (!Number.isInteger(change.index) || seen.has(change.index) || change.index === currentIndex || !(entry?.startedAt instanceof Timestamp)) throw new Error("Reopen phase history and try again.");
    if (!date || change.startDateKey > today) throw new Error("Choose a valid phase date on or before today.");
    seen.add(change.index);
    // Retain known time-of-day and other metadata; the user is correcting the date.
    const old = entry.startedAt.toDate();
    date.setHours(old.getHours(), old.getMinutes(), old.getSeconds(), old.getMilliseconds());
    history[change.index] = { ...entry, startedAt: Timestamp.fromDate(date) };
  }
  const removed = new Set<number>();
  for (const index of edit.removedHistoryIndices ?? []) {
    if (!Number.isInteger(index) || removed.has(index) || index === currentIndex || !(history[index]?.startedAt instanceof Timestamp)) throw new Error("Only past phase entries can be removed. Reopen phase history and try again.");
    removed.add(index);
  }
  return history.filter((_, index) => !removed.has(index));
}
function validateHistoryOrder(history: any[]) {
  let previous = "";
  for (const entry of history) {
    if (!(entry?.startedAt instanceof Timestamp)) continue;
    const date = phaseDateKey(entry.startedAt.toDate());
    if (date < previous) throw new Error("Phase dates must follow their history order. Adjust earlier dates in Phase history first.");
    previous = date;
  }
}
export function parsePhaseStartDate(key: unknown): Date | null {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split("-").map(Number);
  if (year < 1900) return null;
  const date = new Date(year, month - 1, day);
  return phaseDateKey(date) === key ? date : null;
}
export function phaseWeekFromDate(key: string, today = new Date()): number | null {
  if (!parsePhaseStartDate(key)) return null;
  const dayNumber = (value: string) => Date.parse(value + "T00:00:00Z") / 86400000;
  return Math.max(1, Math.floor((dayNumber(phaseDateKey(today)) - dayNumber(key)) / 7) + 1);
}

export function phasePatch(current: Record<string, any>, changes: PhaseChanges, now: Timestamp) {
  const patch: Record<string, any> = {};
  for (const key of ["trainingPhase", "dietPhase"] as const) {
    const change = changes[key];
    if (!change) continue;
    const edit = typeof change === "string" ? null : change;
    // Profile may retry after a later, unrelated save stage failed.
    if (edit?.requestId && edit.requestId === current[`${key}LastEditId`]) continue;
    const next = typeof change === "string" ? change : change.phase;
    if (!edit && next === current[key]) continue;
    const allowed = key === "trainingPhase" ? ["Hypertrophy", "Strength", "Power"] : ["Cut", "Maintain", "Bulk"];
    if (!allowed.includes(next)) throw new Error("Invalid phase");
    const historyKey = `${key}History`;
    const startKey = `${key}StartedAt`;
    if (edit) {
      const startMs = current[startKey] instanceof Timestamp ? current[startKey].toMillis() : null;
      if (edit.expectedPhase !== phaseType(current, key) || edit.expectedStartMs !== startMs) throw new Error("Your phase changed elsewhere. Reopen it and try again.");
      if (edit.mode !== "edit" && edit.mode !== "new") throw new Error("Invalid phase action");
      if (edit.mode === "edit" && next !== phaseType(current, key)) throw new Error("Use Start new phase to change phase type.");
      if (typeof edit.name !== "string" || edit.name.trim().length > 60) throw new Error("Use a phase name of 60 characters or fewer.");
      if ((edit.mode === "new" && edit.week == null) || (edit.week != null && (!Number.isInteger(edit.week) || edit.week < 1 || edit.week > 999))) throw new Error("Enter a whole week from 1 to 999.");
      patch[`${key}Name`] = edit.name.trim();
      if (current[key] !== next) patch[key] = next;
      if (edit.requestId) patch[`${key}LastEditId`] = edit.requestId;
      const editedHistory = editHistoryDates(current, key, edit, phaseDateKey(now.toDate()));
      if (edit.startDateKey !== undefined) {
        const startDate = parsePhaseStartDate(edit.startDateKey);
        if (!startDate || edit.startDateKey > phaseDateKey(now.toDate())) throw new Error("Enter a valid start date on or before today (YYYY-MM-DD).");
        const oldStart = current[startKey] instanceof Timestamp ? current[startKey] as Timestamp : null;
        const history = editedHistory;
        const earlier = history.filter(entry => entry?.startedAt instanceof Timestamp && (edit.mode === "new" || !oldStart || !entry.startedAt.isEqual(oldStart)));
        if (oldStart && edit.mode === "new") earlier.push({ startedAt: oldStart });
        if (earlier.some(entry => phaseDateKey(entry.startedAt.toDate()) > edit.startDateKey!)) throw new Error("The start date cannot precede the previous phase. Correct earlier dates in Phase history first.");
        // Preserve ordering when two phases start on the same calendar day.
        const start = edit.mode === "new" && oldStart && phaseDateKey(oldStart.toDate()) === edit.startDateKey
          ? Timestamp.fromMillis(Math.min(now.toMillis(), oldStart.toMillis() + 1)) : Timestamp.fromDate(startDate);
        patch[startKey] = start;
        patch[`${key}StartDateKey`] = edit.startDateKey;
        patch[`${key}StartDateAnchorAt`] = start;
        patch[`${key}WeekAnchorAt`] = start;
        patch[`${key}WeekBase`] = 1;
        const entry = { phase: next, name: edit.name.trim(), startedAt: start };
        if (edit.mode === "edit") {
          const index = oldStart ? history.findLastIndex(item => item?.startedAt instanceof Timestamp && item.startedAt.isEqual(oldStart)) : -1;
          if (index >= 0) history[index] = { ...history[index], ...entry }; else history.push(entry);
        } else {
          if (!history.length && oldStart && allowed.includes(current[key])) history.push({phase: current[key], name: current[`${key}Name`] ?? "", startedAt: oldStart});
          history.push(entry);
          patch[key] = next;
        }
        validateHistoryOrder(history);
        patch[historyKey] = history;
        continue;
      }
      if (edit.mode === "edit") {
        if (edit.historyDates?.length || edit.removedHistoryIndices?.length) {
          validateHistoryOrder(editedHistory);
          const latest = editedHistory.filter(entry => entry?.startedAt instanceof Timestamp).at(-1);
          if (current[startKey] instanceof Timestamp && latest && phaseDateKey(latest.startedAt.toDate()) > phaseDateKey(current[startKey].toDate())) throw new Error("Past phases cannot begin after the current phase.");
          patch[historyKey] = editedHistory;
        }
        if (edit.week != null) {
          patch[`${key}WeekAnchorAt`] = now;
          patch[`${key}WeekBase`] = edit.week;
        }
        continue;
      }
    }
    const history = Array.isArray(current[historyKey]) ? [...current[historyKey]] : [];
    // Preserve a known historical start, but never invent one for legacy accounts.
    if (!history.length && current[startKey] instanceof Timestamp && allowed.includes(current[key])) {
      history.push({ phase: current[key], startedAt: current[startKey] });
    }
    patch[key] = next;
    patch[startKey] = now;
    // Clear metadata from the preceding phase; old callers still start at Week 1.
    patch[`${key}Name`] = edit?.name.trim() ?? "";
    patch[`${key}WeekAnchorAt`] = now;
    patch[`${key}WeekBase`] = edit?.week ?? 1;
    patch[historyKey] = [...history, { phase: next, startedAt: now }];
  }
  return patch;
}

export async function saveUserPhases(uid: string, changes: PhaseChanges, otherFields: Record<string, unknown> = {}) {
  return runTransaction(db, async (transaction) => {
    const ref = doc(db, "users", uid);
    const current = (await transaction.get(ref)).data() || {};
    const patch = { ...otherFields, ...phasePatch(current, changes, Timestamp.now()) };
    if (Object.keys(patch).length) transaction.set(ref, patch, { merge: true });
    return { ...current, ...patch };
  });
}
