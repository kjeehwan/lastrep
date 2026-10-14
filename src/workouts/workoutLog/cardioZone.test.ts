import { expect, it } from "vitest";
import { applyCardioZone, resolveCardioZone, toggleCardioChoice } from "./cardioZone";
import { serializeWorkoutDraft } from "./workoutDraft";
it("allows session type and effort level to be selected, changed and deselected", () => {
  for (const value of ["steady", "intervals", "sprint", "recovery", "easy", "moderate", "hard", "max"]) {
    expect(toggleCardioChoice(undefined, value)).toBe(value);
    expect(toggleCardioChoice(value, value)).toBeUndefined();
    expect(toggleCardioChoice("different", value)).toBe(value);
  }
});
it("sets and clears cardio zones while preserving completed rows and other values", () => {
  const exercise = { tempo: "2", sets: [{ done: false, zone: "2", durationSec: 600 }, { done: true, zone: "1", durationSec: 300 }] };
  const updated = applyCardioZone(exercise, "3");
  expect(updated.tempo).toBe("3");
  expect(updated.sets).toEqual([{ done: false, zone: "3", durationSec: 600 }, { done: true, zone: "1", durationSec: 300 }]);
  expect(applyCardioZone(updated, "").sets[0].zone).toBe("");
  expect(resolveCardioZone(applyCardioZone(updated, ""))).toBe("");
  expect(resolveCardioZone({ sets: [{ zone: "2" }] })).toBe("2");
  expect(exercise.sets[0].zone).toBe("2");
  expect(() => applyCardioZone(exercise, "6")).toThrow();
});
it("preserves zones in the existing draft schema", () => {
  const exercise = applyCardioZone({ sets: [{ done: false }] }, "4");
  const stored = JSON.parse(serializeWorkoutDraft({ exercises: [exercise], exerciseUnits: {}, sessionTitle: "Cardio", sessionDateText: "2026-10-14", elapsedSeconds: 0, workoutTimerRunning: false }));
  expect(stored.exercises[0].tempo).toBe("4");
  expect(stored.exercises[0].sets[0].zone).toBe("4");
});
