import { expect, it } from "vitest";
import { programRoutineDraft } from "./programRoutineDraft";
import { serializeWorkoutDraft } from "./workoutDraft";
import type { Routine } from "./workoutLogModel";

it("preserves role targets through program loading and local draft serialization",()=>{
  const groupTargets={backoff:{minReps:8,maxReps:10,targetRpe:9}};
  const routine:Routine={id:"r",name:"Legs",createdAt:null,updatedAt:null,exercises:[{name:"Deadlift",mode:"resistance",groupTargets,sets:[{defaultWeightKg:130,reps:"8",setType:"top"},{defaultWeightKg:110,reps:"8",setType:"backoff"}]}]};
  const draft=programRoutineDraft(routine,{programId:"p",runId:"run",ordinal:0,dayNumber:1,scheduledDateKey:"2026-11-25",routineId:"r",title:"Legs"},()=>"new");
  const saved=JSON.parse(serializeWorkoutDraft(draft));
  expect(saved.exercises[0].groupTargets.backoff).toEqual(groupTargets.backoff);
  expect(saved.exercises[0].sets.map((set:any)=>[set.setType,set.done,set.rpe])).toEqual([["top",false,""],["backoff",false,""]]);
  saved.exercises[0].groupTargets.backoff.targetRpe=8;
  expect(routine.exercises[0].groupTargets!.backoff!.targetRpe).toBe(9);
});
