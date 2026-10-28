import { describe, expect, it } from "vitest";
import { plannedWorkoutTotals } from "./plannedWorkoutTotals";
import type { Exercise } from "./workoutLogModel";
const mode = (name: string) => name === "Treadmill" ? "cardio" as const : "resistance" as const;
const bench: Exercise = { id: "bench", name: "Bench Press", sets: [{ weightKg: 20, reps: "4", setType: "warmup", done: true }, { weightKg: 60, reps: "8", done: false }, { weightKg: 60, reps: "8", done: false }] };
describe("planned workout totals", () => {
  it("includes warm-ups without changing the totals as working sets are completed", () => {
    expect(plannedWorkoutTotals([bench], mode)).toEqual({ sets: 3, volumeKg: 1040, cardioExercises: 0 });
    expect(plannedWorkoutTotals([{ ...bench, sets: bench.sets.map(set => ({ ...set, done: true })) }], mode).volumeKg).toBe(1040);
  });
  it("counts bodyweight sets but excludes cardio from both set and weighted volume totals", () => {
    const bodyweight: Exercise = { id: "bw", name: "Push-up", sets: [{ weightKg: null, reps: "12", done: false }] };
    const cardio: Exercise = { id: "run", name: "Treadmill", sets: [{ weightKg: 100, reps: "10", durationSec: 1200, done: false }] };
    expect(plannedWorkoutTotals([bench, bodyweight, cardio], mode)).toEqual({ sets: 4, volumeKg: 1040, cardioExercises: 1 });
  });
  it("does not turn blank, partially entered or non-finite prescriptions into volume", () => {
    const exercise = { ...bench, sets: [{ weightKg: 60, reps: "8x", done: false }, { weightKg: null, reps: "8", done: false }, { weightKg: Infinity, reps: "8", done: false }] };
    expect(plannedWorkoutTotals([exercise], mode)).toEqual({ sets: 3, volumeKg: 0, cardioExercises: 0 });
  });
  it("handles empty plans", () => { expect(plannedWorkoutTotals([], mode)).toEqual({ sets: 0, volumeKg: 0, cardioExercises: 0 }); });
});
