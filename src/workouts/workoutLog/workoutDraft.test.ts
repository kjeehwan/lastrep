import { describe, expect, it } from "vitest";
import { readWorkoutDraftRoutineId, serializeWorkoutDraft } from "./workoutDraft";

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

describe("draft source routine", () => {
  it("restores the stable routine id independently of an edited workout title", () => {
    const raw = serializeWorkoutDraft({ exercises: [{ name: "Bench Press", sets: [{ reps: "8", done: true }] }], exerciseUnits: {}, sessionTitle: "Edited session title", lastAppliedRoutineId: "routine-back-biceps", lastAppliedRoutineName: "Back + Biceps", sessionDateText: "2026-10-28", elapsedSeconds: 123, workoutTimerRunning: false });
    const restored = JSON.parse(raw);
    expect(readWorkoutDraftRoutineId(restored.lastAppliedRoutineId)).toBe("routine-back-biceps");
    expect(restored.lastAppliedRoutineName).toBe("Back + Biceps");
    expect(restored.exercises[0].sets[0].done).toBe(true);
    expect(restored.elapsedSeconds).toBe(123);
  });
  it.each([undefined, null, "", "   ", 1, {}, []])("does not invent a routine for legacy or invalid metadata: %s", value => {
    expect(readWorkoutDraftRoutineId(value)).toBeNull();
  });
  it("serializes a deliberately cleared association", () => {
    const restored = JSON.parse(serializeWorkoutDraft({ exercises: [], exerciseUnits: {}, sessionTitle: "Back + Biceps", lastAppliedRoutineId: null, sessionDateText: "2026-10-28", elapsedSeconds: 0, workoutTimerRunning: false }));
    expect(readWorkoutDraftRoutineId(restored.lastAppliedRoutineId)).toBeNull();
  });
});
