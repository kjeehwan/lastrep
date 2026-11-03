import {describe,it,expect} from "vitest";
import {activeDeload,newDeloadPeriod,deloadSuggestion,restoreDeloadExercises} from "./deload";
import type {DecisionInputs} from "../types/decision";
import type {WorkoutSummary} from "./homeInsights";
const inputs:DecisionInputs={sleepHours:7,sleepSource:"manual",sleepSampleAgeHours:null,soreness:7,fatigue:8,motivation:5,trainingPhase:"Strength",trainingPhaseWeek:6,dietPhase:"Maintain"};
const now=new Date("2026-11-02T12:00:00");
const workouts:WorkoutSummary[]=[1,8].map(days=>({id:String(days),title:"Gym",date:new Date(now.getTime()-days*86400000),trainingPhase:"Strength",exercises:[{name:"Bench Press",mode:"resistance",sets:[1,2,3].map(()=>({weightKg:80,reps:"6",rpe:9,setType:"normal"}))}]}));
describe("explicit deload week",()=>{
 it("restores an untouched prescription after native hydration without treating defaults as edits",()=>{
  const before=[{id:"a",name:"Bench",sets:[{weightKg:80,reps:"6"}]}];
  const after=[{...before[0],sets:[{weightKg:70,reps:"6"}]}];
  const hydrated=[{...after[0],sets:[{reps:"6",rpe:"",done:false,setType:"normal",weightKg:70,zone:"",targetRpe:null,baselineAdjusted:false}]}];
  expect(restoreDeloadExercises(hydrated,{before,after}).exercises[0].sets).toEqual(before[0].sets);
  const recorded=[{...hydrated[0],sets:[{...hydrated[0].sets[0],done:true}]}];
  expect(restoreDeloadExercises(recorded,{before,after}).manual).toEqual(["Bench"]);
 });
 it("lasts seven local dates and expires without changing phase dates",()=>{
  const period=newDeloadPeriod("d","2026-11-02");expect(period.endsDateKey).toBe("2026-11-08");expect(activeDeload(period,"2026-11-08")).toEqual(period);expect(activeDeload(period,"2026-11-09")).toBeNull();
 });
 it("requires repeated high effort and recovery evidence, never week number alone",()=>{
  expect(deloadSuggestion(inputs,workouts,now)).toMatch(/training week 6/);
  expect(deloadSuggestion({...inputs,fatigue:2,soreness:2},workouts,now)).toBeNull();
  expect(deloadSuggestion(inputs,[],now)).toBeNull();
  expect(deloadSuggestion({...inputs,trainingPhaseWeek:1},workouts,now)).toBeNull();
 });
 it("restores untouched prescriptions while preserving recorded or edited sets",()=>{
  const before=[{id:"a",name:"Bench",sets:[{weightKg:80,rpe:""}]},{id:"b",name:"Squat",sets:[{weightKg:100,rpe:""}]}];
  const after=[{...before[0],sets:[{weightKg:72,rpe:""}]},{...before[1],sets:[{weightKg:90,rpe:""}]}];
  const current=[after[0],{...after[1],sets:[{weightKg:90,rpe:"8"}]}];
  const restored=restoreDeloadExercises(current,{before,after});expect(restored.exercises[0].sets[0].weightKg).toBe(80);expect(restored.exercises[1].sets[0]).toEqual({weightKg:90,rpe:"8"});expect(restored.manual).toEqual(["Squat"]);
 });
});
