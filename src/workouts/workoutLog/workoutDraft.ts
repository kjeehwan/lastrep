import type { RestClock } from "./timerClock";
import type { RecommendationUsage } from "./recommendationFeedback";

export type WorkoutDraftSnapshot<TExercises, TUnits> = {
  exercises: TExercises;
  exerciseUnits: TUnits;
  sessionTitle: string;
  lastAppliedRoutineId?: string | null;
  lastAppliedRoutineName?: string | null;
  sessionDateText: string;
  elapsedSeconds: number;
  workoutTimerRunning: boolean;
  workoutTimerHasStarted?: boolean;
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

/** Older/custom drafts have no source routine; never infer one from the title. */
export function readWorkoutDraftRoutineId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
