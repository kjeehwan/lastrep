import {describe,it,expect} from "vitest";
import type {DecisionInputs,PainContext,PlannedWorkoutSummary} from "../../types/decision";
import {normalizeDailyDecisionContext,getDailyContextSummary} from "./todayPlanContext";
import {painEntries} from "./painContext";
import {buildDeterministicTodayPlan} from "./todayPlanEngine";
import {hashDecisionInputs} from "./inputHash";

const shoulder:PainContext={area:"shoulder",side:"left",severity:"severe",trigger:"pressing",note:null,affectsPlannedWorkout:true};
const knee:PainContext={area:"knee",side:"right",severity:"moderate",trigger:"squatting",note:null,affectsPlannedWorkout:true};
const plan:PlannedWorkoutSummary={source:"draft",title:"Mixed",exerciseNames:["Bench Press","Barbell Squat"],
 exercises:["Bench Press","Barbell Squat"].map(name=>({name,mode:"resistance",sets:[{weightKg:80,reps:6,setType:"normal",done:false}]}))};
const now=new Date("2026-11-02T12:00:00");
const context={dateKey:"2026-11-02",pain:shoulder,pains:[shoulder,knee],additionalActivity:null,note:null};
const inputs:DecisionInputs={sleepHours:8,sleepSource:"manual",sleepSampleAgeHours:null,soreness:1,fatigue:1,motivation:8,trainingPhase:"Hypertrophy",dietPhase:"Maintain",plannedWorkout:plan,dailyContext:context};

describe("multiple reported pain areas",()=>{
 it("does not invent missing pain or activity selections",()=>{
  expect(normalizeDailyDecisionContext({dateKey:"2026-11-02",pains:[{area:"shoulder"}],additionalActivity:{type:"running"}},plan,now)).toBeNull();
 });
 it("reads legacy single-area check-ins and keeps every area in new check-ins",()=>{
  expect(painEntries({...context,pains:undefined})).toEqual([shoulder]);
  const normalized=normalizeDailyDecisionContext(context,plan,now);
  expect(painEntries(normalized)).toHaveLength(2);
  expect(getDailyContextSummary(normalized)).toContain("shoulder");
  expect(getDailyContextSummary(normalized)).toContain("knee");
  expect(normalizeDailyDecisionContext({...context,dateKey:"2026-11-01"},plan,now)).toBeNull();
  expect(normalizeDailyDecisionContext({...context,pains:[]},plan,now)).toBeNull();
 });
 it("uses the relevant area for each exercise rather than applying only the first report",()=>{
  const result=buildDeterministicTodayPlan(inputs,[],now);
  expect(result.exerciseAdjustments?.find(item=>item.exerciseName==="Bench Press")).toMatchObject({action:"avoid",reason:expect.stringContaining("shoulder")});
  expect(result.exerciseAdjustments?.find(item=>item.exerciseName==="Barbell Squat")).toMatchObject({action:"reduce",reason:expect.stringContaining("knee")});
  expect(buildDeterministicTodayPlan({...inputs,dailyContext:{...context,pains:[knee,shoulder]}},[],now).exerciseAdjustments).toEqual(result.exerciseAdjustments);
 });
 it("invalidates advice when only the second pain report changes",()=>{
  expect(hashDecisionInputs({...inputs,dailyContext:{...context,pains:[shoulder,{...knee,severity:"mild"}]}})).not.toBe(hashDecisionInputs(inputs));
 });
});
