import { describe, expect, it } from "vitest";
import { parseWorkoutDraftPlan } from "./todayPlanContext";
import { workoutGuidanceSignature, withAvailableWeights } from "./workoutGuidance";
import { applyTodayPlanToWorkoutDraft } from "./todayPlanDraft";

const draft = {
  draftSavedAt: Date.now(),
  exercises: [{ id: "bench", name: "Bench Press", sets: [
    { weightKg: 100, reps: "8", done: false },
    { weightKg: 100, reps: "8", done: false },
  ] }],
};

describe("workout guidance freshness", () => {
  it("requires new guidance when available equipment weights change", () => {
    const plan = parseWorkoutDraftPlan(JSON.stringify(draft));
    const configured = withAvailableWeights(plan, { "bench press": { mode: "regular", unit: "kg", minimum: 20, increment: 5 } });
    expect(workoutGuidanceSignature(configured)).not.toBe(workoutGuidanceSignature(plan));
    expect(configured?.exercises?.[0].availableWeights?.unit).toBe("kg");
  });
  const signature = (value: unknown) => workoutGuidanceSignature(parseWorkoutDraftPlan(JSON.stringify({ ...(value as object), draftSavedAt: Date.now() })));
  it("stays valid when a set is completed or display units change", () => {
    expect(signature({ ...draft, exerciseUnits: { bench: "lbs" }, exercises: [{ ...draft.exercises[0], sets: draft.exercises[0].sets.map((set) => ({ ...set, done: true })) }] })).toBe(signature(draft));
  });
  it("requires updated guidance after editing loads, reps, or exercises", () => {
    expect(signature({ exercises: [{ ...draft.exercises[0], sets: [{ weightKg: 110, reps: "8", done: false }] }] })).not.toBe(signature(draft));
    expect(signature({ exercises: [{ ...draft.exercises[0], sets: [{ weightKg: 100, reps: "10", done: false }] }] })).not.toBe(signature(draft));
    expect(signature({ exercises: [{ ...draft.exercises[0], name: "Squat" }] })).not.toBe(signature(draft));
  });
  it("recognizes the applied draft as a new prescription and preserves the original for undo", () => {
    const raw = JSON.stringify(draft);
    const applied = applyTodayPlanToWorkoutDraft(raw, [{ exerciseName: "Bench Press", action: "reduce", loadPct: -10, setDelta: -1, repsDelta: 0, targetRpe: 8, reason: "Recovery" }]);
    expect(workoutGuidanceSignature(parseWorkoutDraftPlan(applied.raw))).not.toBe(signature(draft));
    expect(JSON.parse(raw)).toEqual(draft);
    expect(JSON.parse(applied.raw).exercises[0].id).toBe("bench");
  });
});
