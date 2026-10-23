import { availableWeightAtOrBelow, type AvailableWeights } from "../availableWeights";

export type WarmupUnit = "kg" | "lbs";
export type WarmupSet = { weightKg: number | null; reps: string; setType?: string; done: boolean };
export type WarmupRow = { id: string; weight: string; reps: string; fixed: boolean };
export type WarmupPattern = ({ mode: "fixed"; weightKg: number; reps: number } | { mode: "ratio"; ratio: number; reps: number })[];
const KG_PER_LB = 0.45359237;
export const warmupKey = (uid: string, name: string) => `lastrep:warmup:v1:${uid}:${encodeURIComponent(name.trim().toLowerCase().replace(/\s+/g, " "))}`;
export const warmupKg = (value: number, unit: WarmupUnit) => value * (unit === "lbs" ? KG_PER_LB : 1);
export const warmupWeight = (kg: number, unit: WarmupUnit) => String(Math.round(kg / (unit === "lbs" ? KG_PER_LB : 1) * 100) / 100);
export function readWarmupPattern(raw: string | null): WarmupPattern | null {
  try {
    const rows: unknown = JSON.parse(raw ?? "null");
    if (!Array.isArray(rows) || !rows.length || rows.length > 12) return null;
    if (!rows.every(row => row && Number.isInteger(row.reps) && row.reps > 0 && row.reps <= 100 &&
      (row.mode === "fixed" ? Number.isFinite(row.weightKg) && row.weightKg > 0 && row.weightKg <= 10000 : row.mode === "ratio" && Number.isFinite(row.ratio) && row.ratio > 0 && row.ratio <= 1))) return null;
    return rows as WarmupPattern;
  } catch { return null; }
}
export function defaultWarmupPattern(barbell: boolean, unit: WarmupUnit): WarmupPattern {
  return [barbell ? { mode: "fixed", weightKg: warmupKg(unit === "kg" ? 20 : 45, unit), reps: 4 } : { mode: "ratio", ratio: .4, reps: 4 }, { mode: "ratio", ratio: .6, reps: 4 }, { mode: "ratio", ratio: .8, reps: 2 }];
}
export function suggestWarmupRows(referenceKg: number, unit: WarmupUnit, pattern: WarmupPattern, settings?: AvailableWeights): WarmupRow[] {
  if (!Number.isFinite(referenceKg) || referenceKg <= 0) return [];
  return pattern.flatMap((part, index) => {
    const target = part.mode === "fixed" ? part.weightKg : referenceKg * part.ratio;
    const weight = part.mode === "fixed" ? target : availableWeightAtOrBelow(target, settings ?? { mode: "regular", unit, minimum: 0, increment: unit === "kg" ? 2.5 : 5 });
    if (weight == null || weight <= 0 || weight > referenceKg + 1e-5) return [];
    return [{ id: `suggestion-${index}`, weight: warmupWeight(weight, unit), reps: String(part.reps), fixed: part.mode === "fixed" }];
  });
}
export function warmupValidation(rows: WarmupRow[], referenceKg: number, unit: WarmupUnit): string | null {
  if (!Number.isFinite(referenceKg) || referenceKg <= 0) return "Enter a working weight above zero.";
  if (!rows.length) return "Add a warm-up set to continue.";
  if (rows.length > 12) return "Use up to 12 warm-up sets.";
  if (rows.some(row => !/^\d+(?:\.\d*)?$/.test(row.weight.trim()) || Number(row.weight) <= 0 || warmupKg(Number(row.weight), unit) > referenceKg + .005)) return "Use weights above zero and no higher than the working weight.";
  if (rows.some(row => !/^\d+$/.test(row.reps.trim()) || Number(row.reps) < 1 || Number(row.reps) > 100)) return "Enter whole-number reps from 1 to 100.";
  return null;
}
export function warmupPatternFromRows(rows: WarmupRow[], referenceKg: number, unit: WarmupUnit): WarmupPattern {
  return rows.map(row => row.fixed ? { mode: "fixed", weightKg: warmupKg(Number(row.weight), unit), reps: Number(row.reps) } : { mode: "ratio", ratio: warmupKg(Number(row.weight), unit) / referenceKg, reps: Number(row.reps) });
}
export function orderedWarmupRows(kept: WarmupRow[], additions: WarmupRow[]) {
  const order = (row: WarmupRow) => row.id.startsWith("suggestion-") ? Number(row.id.slice(11)) : Infinity;
  return [...kept, ...additions].sort((a, b) => order(a) - order(b));
}
export function unmatchedWarmups(rows: WarmupRow[], existing: WarmupSet[], unit: WarmupUnit) {
  const remaining = existing.filter(set => set.setType === "warmup").slice();
  const kept: WarmupRow[] = [], additions: WarmupRow[] = [];
  rows.forEach(row => {
    // An explicit + Add a set is intentional, even when its values repeat.
    if (row.id.startsWith("manual-")) { additions.push(row); return; }
    const index = remaining.findIndex(set => set.weightKg != null && Math.abs(set.weightKg - warmupKg(Number(row.weight), unit)) < .006 && Number(set.reps) === Number(row.reps));
    if (index < 0) additions.push(row);
    else { kept.push(row); remaining.splice(index, 1); }
  });
  return { kept, additions };
}
export function insertWarmupSets<T extends WarmupSet>(sets: T[], rows: WarmupRow[], unit: WarmupUnit): (T | WarmupSet)[] {
  const first = sets.findIndex(set => set.setType !== "warmup");
  const added = rows.map(row => ({ weightKg: warmupKg(Number(row.weight), unit), reps: String(Number(row.reps)), rpe: "", setType: "warmup", done: false }));
  const index = first < 0 ? sets.length : first;
  return [...sets.slice(0, index), ...added, ...sets.slice(index)];
}
