import { describe, expect, it } from "vitest";
import { effectiveTargetRpe, exerciseTargetsChanged, exerciseTargetsDraft, exerciseTargetsText, normalizeExerciseTargets, readExerciseTargetsDraft, routineSetTargets } from "./exerciseTargets";
import { parseExerciseTargets, parseSharedWorkoutPlan } from "../sharing/sharingContract";
import { sharingPlanToExercises, workoutToSharingPlan } from "../sharing/sharingPlan";

const targets = { minReps: 8, maxReps: 12, targetRpe: 8 };
describe("optional exercise targets", () => {
  it("does not invent targets for legacy data or recorded effort", () => {
    expect(normalizeExerciseTargets(undefined)).toBeNull();
    expect(normalizeExerciseTargets({ rpe: 8, reps: "10" })).toBeNull();
    expect(exerciseTargetsDraft(null, "rpe")).toEqual({ min: "", max: "", effort: "" });
    expect(readExerciseTargetsDraft({ min: "", max: "", effort: "" }, "rpe")).toBeNull();
  });
  it("accepts independent range and effort, including zero RIR and decimals", () => {
    expect(readExerciseTargetsDraft({ min: "8", max: "12", effort: "" }, "rpe")).toEqual({ ...targets, targetRpe: null });
    expect(readExerciseTargetsDraft({ min: "", max: "", effort: "0" }, "rir")).toEqual({ minReps: null, maxReps: null, targetRpe: 10 });
    expect(readExerciseTargetsDraft({ min: "", max: "", effort: "1,5" }, "rir")?.targetRpe).toBe(8.5);
    expect(exerciseTargetsDraft(targets, "rir").effort).toBe("2");
    expect(exerciseTargetsText(targets, "rir")).toBe("8–12 reps · RIR 2");
    expect(exerciseTargetsChanged(targets, { min: "08", max: "12", effort: "2.0" }, "rir")).toBe(false);
    expect(exerciseTargetsChanged(targets, { min: "", max: "", effort: "" }, "rpe")).toBe(true);
  });
  it("rejects partial/reversed/fractional ranges and meaningless effort", () => {
    for (const [min, max] of [["8", ""], ["12", "8"], ["0", "8"], ["8.5", "12"], ["8", "101"]]) expect(() => readExerciseTargetsDraft({ min, max, effort: "" }, "rpe")).toThrow();
    for (const effort of ["20", "5.5", "NaN", ".", "-1"]) expect(() => readExerciseTargetsDraft({ min: "", max: "", effort }, "rpe")).toThrow();
    for (const effort of ["-1", "4.5", "20"]) expect(() => readExerciseTargetsDraft({ min: "", max: "", effort }, "rir")).toThrow();
    expect(normalizeExerciseTargets({ ...targets, targetRpe: 20 })).toBeNull();
    expect(() => parseExerciseTargets({ ...targets, recordedRpe: 9 })).toThrow();
  });
  it("applies exercise defaults to normal sets without replacing individual prescriptions", () => {
    expect(effectiveTargetRpe({ targets }, {})).toBe(8);
    for (const setType of ["warmup", "drop", "failure"]) expect(effectiveTargetRpe({ targets }, { setType })).toBeNull();
    expect(effectiveTargetRpe({ targets }, { targetRpe: 7 })).toBe(7);
  });
  it("keeps routine targets aligned by set type when history adds a warmup", () => {
    const history = [{ setType: "warmup", rpe: "6" }, { setType: "normal", rpe: "9" }, { setType: "normal", rpe: "10" }];
    const result = routineSetTargets(history, [{ targetRpe: 7 }, { targetRpe: 8 }]);
    expect(result.map(set => set.targetRpe)).toEqual([null, 7, 8]);
    expect(history).not.toHaveProperty("0.targetRpe");
    expect(result[1].rpe).toBe("9");
  });
  it("round-trips exercise and per-set targets without sharing recorded effort", () => {
    const original = [{ id: "a", name: "Bench Press", targets, sets: [{ weightKg: 60, reps: "10", rpe: "9", targetRpe: 7, done: true }] }];
    const before = JSON.stringify(original);
    const shared = workoutToSharingPlan("Upper", original, {}, () => "resistance", {}, "rir");
    const wire = parseSharedWorkoutPlan(JSON.parse(JSON.stringify(shared)));
    const received = sharingPlanToExercises(wire, "test").exercises[0];
    expect(received.targets).toEqual(targets);
    expect(received.sets[0]).toMatchObject({ reps: "10", targetRpe: 7, rpe: "", done: false });
    expect(JSON.stringify(original)).toBe(before);
    expect(() => parseSharedWorkoutPlan({ ...shared, exercises: [{ ...shared.exercises[0], targets: { ...targets, targetRpe: 20 } }] })).toThrow();
    expect(wire.exercises[0].sets[0]).not.toHaveProperty("rpe");
    expect(workoutToSharingPlan("Legacy", [{ ...original[0], targets: null }], {}, () => "resistance", {}, "rpe").exercises[0]).not.toHaveProperty("targets");
  });
});
