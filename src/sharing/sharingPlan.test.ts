import { describe, expect, it } from "vitest";
import {
  omitSharingWeights,
  sharingPlanToExercises,
  workoutToSharingPlan,
} from "./sharingPlan";
describe("sharing adapters", () => {
  it("does not copy personal notes, recorded effort or completion", () => {
    const original = [
      {
        id: "active",
        name: "Bench Press",
        notes: "private",
        sets: [{ weightKg: 100, reps: "8", rpe: "9", done: true }],
      },
    ];
    const plan = workoutToSharingPlan(
      "Chest",
      original,
      { active: "kg" },
      () => "resistance",
      {},
      "rpe",
    );
    expect(plan.exercises[0].instructions).toBe("");
    expect(plan.exercises[0].sets[0].targetRpe).toBeNull();
    const without = omitSharingWeights(plan);
    expect(without.exercises[0].sets[0].weightKg).toBeNull();
    expect(plan.exercises[0].sets[0].weightKg).toBe(100);
    plan.exercises[0].sets[0].targetRpe = 8;
    const imported = sharingPlanToExercises(plan, "new");
    expect(imported.exercises[0].sets[0]).toMatchObject({
      done: false,
      rpe: "",
    });
    expect(original[0].sets[0].done).toBe(true);
    expect(imported.exercises[0].id).not.toBe("active");
  });
  it("preserves mixed prescriptions and creates independent editable imports", () => {
    const plan = workoutToSharingPlan(
      "Mixed plan",
      [
        {
          id: "lift",
          name: "Bench Press",
          tempo: "3-0-X-0",
          notes: "Private",
          sets: [
            {
              weightKg: 20,
              reps: "4",
              rpe: "",
              done: false,
              setType: "warmup",
            },
            {
              weightKg: 80,
              reps: "8",
              rpe: "9",
              targetRpe: 8,
              done: true,
              setType: "drop",
            },
          ],
        },
        {
          id: "run",
          name: "Running",
          cardioSessionType: "intervals",
          cardioEffortLevel: "hard",
          sets: [
            {
              weightKg: null,
              reps: "",
              rpe: "",
              done: true,
              durationSec: 90,
              distanceKm: 1.6,
            },
          ],
        },
      ],
      { lift: "lbs", run: "mi" },
      (name) => (name === "Running" ? "cardio" : "resistance"),
      { lift: 150, run: 30 },
      "rir",
    );
    plan.exercises[0].instructions = "Deliberate recipient instruction";
    const first = sharingPlanToExercises(plan, "first"),
      second = sharingPlanToExercises(plan, "second");
    expect(first.units[first.exercises[0].id]).toBe("lbs");
    expect(first.exercises[0]).toMatchObject({
      plannedRestSec: 150,
      tempo: "3-0-X-0",
      notes: "Deliberate recipient instruction",
    });
    expect(first.exercises[0].sets[1]).toMatchObject({
      weightKg: 80,
      targetRpe: 8,
      rpe: "",
      done: false,
      setType: "drop",
    });
    expect(first.exercises[1]).toMatchObject({
      mode: "cardio",
      cardioSessionType: "intervals",
      cardioEffortLevel: "hard",
    });
    expect(first.exercises[1].sets[0]).toMatchObject({
      durationSec: 90,
      distanceKm: 1.6,
      done: false,
    });
    first.exercises[0].sets[0].reps = "12";
    expect(second.exercises[0].sets[0].reps).toBe("4");
    expect(plan.exercises[0].sets[0].reps).toBe("4");
    expect(first.exercises[0].id).not.toBe(second.exercises[0].id);
  });
});
