import { doc, runTransaction, Timestamp } from "firebase/firestore";
import { db } from "../config/firebaseConfig";

export function phaseWeek(startMs: number | null, nowMs: number): number | null {
  if (startMs == null || !Number.isFinite(startMs)) return null;
  return Math.max(1, Math.floor((nowMs - startMs) / 604800000) + 1);
}

export type PhaseKey = "trainingPhase" | "dietPhase";
export type PhaseEdit = { mode: "edit" | "new"; phase: string; name: string; week: number | null; expectedPhase: string; expectedStartMs: number | null; requestId?: string };
export type PhaseChanges = Partial<Record<PhaseKey, string | PhaseEdit>>;
export function phaseType(data: Record<string, any>, key: PhaseKey): string {
  const allowed = key === "trainingPhase" ? ["Hypertrophy", "Strength", "Power"] : ["Cut", "Maintain", "Bulk"];
  return allowed.includes(data[key]) ? data[key] : key === "trainingPhase" ? "Hypertrophy" : "Maintain";
}
export function phaseName(data: Record<string, any>, key: PhaseKey): string {
  return typeof data[`${key}Name`] === "string" && data[`${key}Name`].trim() ? data[`${key}Name`].trim() : phaseType(data, key);
}
export function currentPhaseWeek(data: Record<string, any>, key: PhaseKey, nowMs: number): number | null {
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
      if (edit.mode === "edit") {
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
