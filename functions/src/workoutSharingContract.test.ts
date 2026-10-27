import { describe, expect, it } from "vitest";
import {
  parseSharedWorkoutPlan,
  validSharingUsername,
} from "./workoutSharingContract";
const plan = () => ({
  version: 1,
  title: "Chest",
  effortScale: "rpe",
  exercises: [
    {
      name: "Bench Press",
      mode: "resistance",
      unit: "kg",
      restSec: 90,
      tempo: "3-0-X-0",
      instructions: "Pause",
      sets: [
        {
          weightKg: 100,
          reps: "8",
          targetRpe: 8,
          setType: "normal",
          durationSec: null,
          distanceKm: null,
        },
      ],
    },
  ],
});
describe("sharing payload boundary", () => {
  it("retains deliberate prescription fields", () =>
    expect(parseSharedWorkoutPlan(plan()).exercises[0].sets[0].targetRpe).toBe(
      8,
    ));
  for (const field of ["rpe", "done", "notes", "history", "email"])
    it(`rejects unintended ${field}`, () => {
      const p = plan();
      Object.assign(p.exercises[0].sets[0], { [field]: "private" });
      expect(() => parseSharedWorkoutPlan(p)).toThrow();
    });
  it("rejects excessive plans and invalid values", () => {
    const p = plan();
    p.exercises[0].sets[0].weightKg = NaN;
    expect(() => parseSharedWorkoutPlan(p)).toThrow();
    p.exercises = Array(41).fill(plan().exercises[0]);
    expect(() => parseSharedWorkoutPlan(p)).toThrow();
  });
  it("validates usernames without treating nickname as unique", () => {
    expect(validSharingUsername("lifter.one")).toBe(true);
    expect(validSharingUsername("support")).toBe(false);
    expect(validSharingUsername("a/b")).toBe(false);
  });
});
