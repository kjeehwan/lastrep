import { describe, expect, it, vi } from "vitest";
import { retireCompletedDraft, resumableProgramDrafts, completedProgramWorkoutId } from "./programDraftCompletion";
vi.mock("../../config/firebaseConfig", () => ({ auth: {}, db: {} }));

describe("completed program draft retirement", () => {
  it("requires explicit completion evidence, never elapsed time or a later program cursor", () => {
    expect(completedProgramWorkoutId({ status: "pending", workoutId: "old" })).toBeNull();
    expect(completedProgramWorkoutId({ status: "completed" })).toBeNull();
    expect(completedProgramWorkoutId({ cursor: 7, elapsedSeconds: 18000 })).toBeNull();
    expect(completedProgramWorkoutId({ status: "completed", workoutId: "finished" })).toBe("finished");
  });
  it("retires finished drafts without deleting local differences or changing the saved workout", () => {
    const draft = { sessionTitle: "Posterior Legs", exercises: [{ name: "Deadlift", notes: "Local note", sets: [{ reps: "8", rpe: "9", done: true }] }], exerciseUnits: { lift: "kg" },
      programLink: { runId: "run", ordinal: 5 }, workoutSaveId: "original", completedProgramWorkoutId: "finished",
      elapsedSeconds: 17838, workoutTimerRunning: true, workoutTimerStartedAtMs: 100,
      restTimerByExercise: { lift: { running: true, endsAtMs: 1000 } } };
    const next = retireCompletedDraft(draft, "finished");
    expect(next).toMatchObject({ sessionTitle: draft.sessionTitle, exercises: draft.exercises, exerciseUnits: draft.exerciseUnits,
      programLink: draft.programLink, workoutSaveId: "original", completedProgramWorkoutId: "finished", elapsedSeconds: 17838, workoutTimerRunning: false, workoutTimerStartedAtMs: null, restTimerByExercise: {} });
    const pending = { exercises: [{ name: "Bench" }], programLink: {runId:"other",ordinal:1} };
    const separate = { exercises: [{ name: "Targets QA" }] };
    expect(resumableProgramDrafts({ finished: next, pending, separate })).toEqual({ pending, separate });
    expect(resumableProgramDrafts({ finished: next })).toEqual({});
    expect(draft.programLink.ordinal).toBe(5);
    expect(draft.workoutTimerRunning).toBe(true);
  });
});
