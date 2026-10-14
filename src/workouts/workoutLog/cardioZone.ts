export function toggleCardioChoice<T>(current: T | undefined, next: T): T | undefined {
  return current === next ? undefined : next;
}

export function resolveCardioZone(exercise: { tempo?: string; sets: { zone?: string }[] }): string {
  // An explicit empty value means cleared, even if completed sets retain zones.
  if (typeof exercise.tempo === "string") return exercise.tempo.trim();
  return String(exercise.sets.find((set) => String(set.zone || "").trim())?.zone || "").trim();
}

export function applyCardioZone<T extends { tempo?: string; sets: { done: boolean; zone?: string }[] }>(exercise: T, zone: string): T {
  if (zone !== "" && !/^[1-5]$/.test(zone)) throw new Error("Invalid cardio zone");
  // Cardio uses the legacy tempo field for its exercise-level zone.
  return { ...exercise, tempo: zone, sets: exercise.sets.map((set) => set.done ? set : { ...set, zone }) };
}
