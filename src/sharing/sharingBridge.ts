import type { SharedWorkoutPlan } from "./sharingService";
let pending: { uid: string; plan: SharedWorkoutPlan } | null = null;
export function queueSharedWorkout(uid: string, plan: SharedWorkoutPlan) {
  pending = { uid, plan };
}
export function popSharedWorkout(uid: string) {
  const value = pending;
  pending = null;
  return value?.uid === uid ? value.plan : null;
}
