import { toDateKey } from "./homeInsights";

export type WorkoutDetailsDraft = { date: string; hours: string; minutes: string };
export type SavedWorkoutDetails = { date: Date; durationMin: number | null };

export function recordedDuration(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function detailsDraft(details: SavedWorkoutDetails): WorkoutDetailsDraft {
  const minutes = recordedDuration(details.durationMin);
  return { date: toDateKey(details.date), hours: minutes == null ? "" : String(Math.floor(minutes / 60)).padStart(2, "0"),
    minutes: minutes == null ? "" : String(Math.floor(minutes % 60)).padStart(2, "0") };
}

export function parseWorkoutDetails(draft: WorkoutDetailsDraft, original: SavedWorkoutDetails, now = new Date()): SavedWorkoutDetails {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(draft.date);
  const date = parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 12) : new Date(NaN);
  if (!Number.isFinite(date.getTime()) || toDateKey(date) !== draft.date) throw new Error("Choose a valid workout date.");
  if (draft.date > toDateKey(now)) throw new Error("Choose today or an earlier date for a completed workout.");
  const initial = detailsDraft(original);
  // Changing only the date must preserve a legacy fractional duration exactly.
  if (draft.hours === initial.hours && draft.minutes === initial.minutes) return { date: draft.date === initial.date ? original.date : date, durationMin: original.durationMin };
  if (![draft.hours, draft.minutes].every(value => value === "" || /^\d{1,2}$/.test(value)) || Number(draft.minutes) > 59) {
    throw new Error("Use whole hours from 0 to 99 and minutes from 0 to 59.");
  }
  return { date: draft.date === initial.date ? original.date : date,
    durationMin: draft.hours === "" && draft.minutes === "" ? null : Number(draft.hours || 0) * 60 + Number(draft.minutes || 0) };
}

export function detailsChanged(next: SavedWorkoutDetails, original: SavedWorkoutDetails) {
  return next.date.getTime() !== original.date.getTime() || next.durationMin !== original.durationMin;
}

export function workoutDurationLabel(duration: unknown) {
  const minutes = recordedDuration(duration);
  if (minutes == null) return "Duration not recorded";
  const whole = Math.floor(minutes);
  return whole < 60 ? `${whole} min` : `${Math.floor(whole / 60)} h ${whole % 60} min`;
}
