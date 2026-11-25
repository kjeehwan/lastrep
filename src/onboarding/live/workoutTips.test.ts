import { expect, it } from "vitest";
import { planTip, programTip, routineTip, workoutTip, type WorkoutGuideFacts } from "./workoutTips";
const facts: WorkoutGuideFacts = { hasCompletedSet: false, hasDraft: false, hasProgram: false, choices: false, hasExercises: true, builder: false, routineLoaded: false, workoutSaved: false, routineSaved: false, planApplied: false, planReady: false };
it("does not repeat a saved-workout instruction after starting another workout", () => {
  expect(workoutTip({ ...facts, workoutSaved: true }).id).toBe("workout-record");
  expect(workoutTip({ ...facts, choices: true, workoutSaved: true }).id).toBe("workout-complete");
});
it("guides routine creation instead of exercise logging in an empty builder", () => {
  expect(routineTip({ ...facts, builder: true, hasExercises: false }).id).toBe("routine-builder");
});
it("acknowledges a loaded routine instead of repeatedly asking to load it", () => {
  expect(routineTip({ ...facts, routineSaved: true, routineLoaded: true }).id).toBe("routine-loaded");
});

it("acknowledges a completed review without requiring changes or another review", () => {
  expect(planTip({ ...facts, planReady: true }).id).toBe("plan-reviewed");
  expect(planTip({ ...facts, planReady: true, planApplied: true }).id).toBe("plan-applied");
  expect(planTip({ ...facts, planReady: true, choices: true }).id).toBe("plan-entry");
});

it("mentions only entry options available to this user", () => {
  const fresh = {...facts, choices: true};
  expect(workoutTip(fresh).text).toBe("Tap Start workout, then add the exercises you plan to do. Record each set as you finish it.");
  expect(workoutTip({...fresh, hasProgram:true}).id).toBe("workout-program");
  expect(workoutTip({...fresh, hasDraft:true, hasProgram:true}).id).toBe("workout-resume");
  expect(routineTip(fresh).text).toContain("Tap Create routine");
});
it("follows actual recording and builder state without requiring acknowledgment", () => {
  expect(workoutTip({...facts, hasCompletedSet:true}).id).toBe("workout-finish");
  expect(workoutTip({...facts, builder:true, hasCompletedSet:true}).id).toBe("workout-routine-draft");
});

it("orients a resumed routine draft without turning Workout choices into a routine lesson", () => {
  expect(workoutTip({...facts,builder:true}).title).toBe("You have a routine draft open");
  expect(workoutTip({...facts,builder:true,choices:true,hasDraft:true}).id).toBe("workout-resume");
  expect(routineTip({...facts,builder:true,choices:true}).id).toBe("routine-entry");
});

it("does not tell someone with a completed program day to continue training", () => {
  const completed={...facts,choices:true,hasProgram:true,programCompleted:true};
  expect(workoutTip(completed).title).toBe("Today's workout is complete");
  expect(workoutTip({...completed,hasDraft:true}).id).toBe("program-day-complete");
  expect(workoutTip({...completed,programCompleted:false,programRest:true}).id).toBe("program-rest-day");
});

it("orients program users to their current state rather than repeatedly asking to create one", () => {
  expect(programTip({...facts,choices:true,hasProgram:false}).id).toBe("program-entry");
  expect(programTip({...facts,choices:true,hasProgram:true}).id).toBe("program-ready");
  expect(programTip({...facts,choices:true,hasProgram:true,programRest:true}).id).toBe("program-rest-day");
  expect(programTip({...facts,choices:true,hasProgram:true,programCompleted:true}).id).toBe("program-day-complete");
  expect(programTip({...facts,choices:false,hasProgram:true}).id).toBe("program-workout-open");
  expect(programTip({...facts,choices:false,builder:true}).id).toBe("program-routine-draft");
});
