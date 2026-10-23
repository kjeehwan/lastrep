import { rpeToEffort, type EffortScale } from "../effortScale";
export function setRowPresentation<T extends { setType?: string }>(sets: { setType?: string }[], previous: T[]) {
  let working = 0;
  const previousWorking = previous.filter(set => set.setType !== "warmup");
  return sets.map(set => {
    if (set.setType === "warmup") return { marker: "W", previous: undefined as T | undefined };
    const index = working++;
    return { marker: ({ failure: "F", drop: "D" } as Record<string, string>)[set.setType ?? "normal"] ?? String(index + 1), previous: previousWorking[index] };
  });
}
export function lastResistanceSet(set: { weightKg: number | null; reps: string; rpe?: string }, unit: string, scale: EffortScale) {
  const load = set.weightKg == null || !Number.isFinite(set.weightKg) || set.weightKg <= 0 ? "" : String(Math.round(set.weightKg * (unit === "lbs" ? 2.2046226218 : 1) * 100) / 100);
  const effort = rpeToEffort(set.rpe, scale);
  return `${load ? load + " x " : ""}${set.reps || "-"}${effort ? " @ " + effort : ""}`;
}
