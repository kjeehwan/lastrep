import { describe, expect, it } from "vitest";
import { serializeWorkoutDraft } from "./workoutDraft";

describe("serializeWorkoutDraft", () => {
  it("preserves the workout draft fields expected by hydration", () => {
    const serialized = serializeWorkoutDraft(
      {
        exercises: [{ id: "squat", sets: [{ reps: "5" }] }],
        exerciseUnits: { squat: "kg" },
        sessionTitle: "Lower",
        sessionDateText: "2026-10-03",
        elapsedSeconds: 315,
        workoutTimerRunning: true,
        workoutTimerStartedAtMs: 1_759_449_285_000,
        restTimerByExercise: { squat: { remainingSec: 90, running: true, endsAtMs: 1_759_449_690_000 } },
      },
      1_759_449_600_000
    );

    expect(JSON.parse(serialized)).toEqual({
      exercises: [{ id: "squat", sets: [{ reps: "5" }] }],
      exerciseUnits: { squat: "kg" },
      sessionTitle: "Lower",
      sessionDateText: "2026-10-03",
      elapsedSeconds: 315,
      workoutTimerRunning: true,
      workoutTimerStartedAtMs: 1_759_449_285_000,
      restTimerByExercise: { squat: { remainingSec: 90, running: true, endsAtMs: 1_759_449_690_000 } },
      draftSavedAt: 1_759_449_600_000,
    });
  });
});
