import type { RestClock } from "./timerClock";
import type { RecommendationUsage } from "./recommendationFeedback";

export type WorkoutDraftSnapshot<TExercises, TUnits> = {
  exercises: TExercises;
  exerciseUnits: TUnits;
  sessionTitle: string;
  sessionDateText: string;
  elapsedSeconds: number;
  workoutTimerRunning: boolean;
  workoutTimerStartedAtMs?: number | null;
  restTimerByExercise?: Record<string, RestClock>;
  recommendationUsage?: RecommendationUsage;
};

/** Keeps the on-device draft schema stable while persistence moves out of the screen. */
export function serializeWorkoutDraft<TExercises, TUnits>(
  draft: WorkoutDraftSnapshot<TExercises, TUnits>,
  savedAt = Date.now()
) {
  return JSON.stringify({ ...draft, draftSavedAt: savedAt });
}
