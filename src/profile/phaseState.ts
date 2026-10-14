import { doc, runTransaction, Timestamp } from "firebase/firestore";
import { db } from "../config/firebaseConfig";

export function phaseWeek(startMs: number | null, nowMs: number): number | null {
  if (startMs == null || !Number.isFinite(startMs)) return null;
  return Math.max(1, Math.floor((nowMs - startMs) / 604800000) + 1);
}

export function phaseForDate(history: unknown, currentPhase: string, startedAtMs: number | null, targetMs: number): string | null {
  const entries = Array.isArray(history) ? history.filter((entry) => typeof entry?.phase === "string" && entry?.startedAt instanceof Timestamp && entry.startedAt.toMillis() <= targetMs) : [];
  if (startedAtMs != null && startedAtMs <= targetMs) entries.push({ phase: currentPhase, startedAt: Timestamp.fromMillis(startedAtMs) });
  entries.sort((a, b) => a.startedAt.toMillis() - b.startedAt.toMillis());
  return entries.at(-1)?.phase ?? null;
}

export function phasePatch(current: Record<string, any>, changes: { trainingPhase?: string; dietPhase?: string }, now: Timestamp) {
  const patch: Record<string, any> = {};
  for (const key of ["trainingPhase", "dietPhase"] as const) {
    const next = changes[key];
    if (!next || next === current[key]) continue;
    const allowed = key === "trainingPhase" ? ["Hypertrophy", "Strength", "Power"] : ["Cut", "Maintain", "Bulk"];
    if (!allowed.includes(next)) throw new Error("Invalid phase");
    const historyKey = `${key}History`;
    const startKey = `${key}StartedAt`;
    const history = Array.isArray(current[historyKey]) ? [...current[historyKey]] : [];
    // Preserve a known historical start, but never invent one for legacy accounts.
    if (!history.length && current[startKey] instanceof Timestamp && allowed.includes(current[key])) {
      history.push({ phase: current[key], startedAt: current[startKey] });
    }
    patch[key] = next;
    patch[startKey] = now;
    patch[historyKey] = [...history, { phase: next, startedAt: now }];
  }
  return patch;
}

export async function saveUserPhases(uid: string, changes: { trainingPhase?: string; dietPhase?: string }, otherFields: Record<string, unknown> = {}) {
  return runTransaction(db, async (transaction) => {
    const ref = doc(db, "users", uid);
    const current = (await transaction.get(ref)).data() || {};
    const patch = { ...otherFields, ...phasePatch(current, changes, Timestamp.now()) };
    if (Object.keys(patch).length) transaction.set(ref, patch, { merge: true });
    return { ...current, ...patch };
  });
}
