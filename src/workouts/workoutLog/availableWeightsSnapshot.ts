import type { AvailableWeightsByExercise } from "../availableWeights";

export type AvailableWeightsSnapshot = { uid: string; values: AvailableWeightsByExercise };
export const EMPTY_AVAILABLE_WEIGHTS: AvailableWeightsByExercise = Object.freeze({});

/** Compare validated settings only, not unrelated fields in the user document. */
export function retainAvailableWeightsSnapshot(previous: AvailableWeightsSnapshot | null, next: AvailableWeightsSnapshot) {
  if (!previous || previous.uid !== next.uid) return next;
  const keys = Object.keys(previous.values);
  if (keys.length !== Object.keys(next.values).length) return next;
  for (const key of keys) {
    const left = previous.values[key];
    const right = next.values[key];
    if (!right || left.mode !== right.mode || left.unit !== right.unit) return next;
    if (left.mode === "regular" && right.mode === "regular") {
      if (left.minimum !== right.minimum || left.increment !== right.increment) return next;
    } else if (left.mode === "custom" && right.mode === "custom") {
      if (left.values.length !== right.values.length || left.values.some((value, index) => value !== right.values[index])) return next;
    }
  }
  return previous;
}
