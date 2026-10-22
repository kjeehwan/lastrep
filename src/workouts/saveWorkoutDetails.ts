import { doc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";
import { detailsChanged, parseWorkoutDetails, recordedDuration, type SavedWorkoutDetails, type WorkoutDetailsDraft } from "./workoutDetails";

export class WorkoutDetailsConflict extends Error {}

/** Update metadata on the existing record; never replay the new-workout save path. */
export async function saveWorkoutDetails(uid: string, workoutId: string, original: SavedWorkoutDetails, draft: WorkoutDetailsDraft) {
  if (auth.currentUser?.uid !== uid) throw new Error("Your account changed. Close this editor and sign in again.");
  const next = parseWorkoutDetails(draft, original);
  if (!detailsChanged(next, original)) return next;
  await runTransaction(db, async transaction => {
    const ref = doc(db, "users", uid, "workouts", workoutId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new WorkoutDetailsConflict("This workout was deleted. Refresh your history to see the latest records.");
    const data = snapshot.data();
    const date = (data.date ?? data.endedAt ?? data.createdAt)?.toDate?.();
    if (!(date instanceof Date) || date.getTime() !== original.date.getTime() || recordedDuration(data.durationMin) !== original.durationMin) {
      throw new WorkoutDetailsConflict("This workout's details changed elsewhere. Refresh the workout before editing again.");
    }
    if (auth.currentUser?.uid !== uid) throw new Error("Your account changed. Close this editor and sign in again.");
    const changes: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (next.date.getTime() !== original.date.getTime()) changes.date = Timestamp.fromDate(next.date);
    if (next.durationMin !== original.durationMin) changes.durationMin = next.durationMin;
    transaction.update(ref, changes);
  }, { maxAttempts: 1 });
  return next;
}
