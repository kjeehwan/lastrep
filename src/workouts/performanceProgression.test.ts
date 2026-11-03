import { describe,it,expect } from "vitest";
import { performanceProgression } from "./performanceProgression";
import type { PlannedExerciseSummary } from "../types/decision";
import type { WorkoutSummary } from "./homeInsights";
const now = new Date("2026-11-02T12:00:00");
const plan = (reps=6): PlannedExerciseSummary => ({ name:"Bench Press",mode:"resistance",targets:{minReps:6,maxReps:8,targetRpe:8},
  availableWeights:{mode:"regular",unit:"kg",minimum:20,increment:2.5},
  sets:Array.from({length:3},()=>({weightKg:80,reps,setType:"normal",done:false})) });
const history = (weight=80,reps=6,rpe:number|null=8,days=7):WorkoutSummary => ({id:String(days),title:"Chest",date:new Date(now.getTime()-days*86400000),trainingPhase:"Hypertrophy",
  exercises:[{name:"Bench Press",mode:"resistance",sets:Array.from({length:3},()=>({weightKg:weight,reps:String(reps),rpe,setType:"normal"}))}]});
describe("performance-led progression",()=>{
  it("uses a custom rep sequence and graduates the full set count",()=>{
    const exercise={...plan(),targets:{minReps:6,maxReps:15,targetRpe:8},progression:{repSteps:[6,8,10,12,15,18],preferredIncreaseKg:5,maxIncreaseKg:10}};
    expect(performanceProgression(exercise,[history()],now).candidate?.reps).toBe(8);
    exercise.sets=exercise.sets.map(set=>({...set,reps:12}));
    expect(performanceProgression(exercise,[history(80,12)],now).candidate?.reps).toBe(15);
  });
  it("defaults to the smallest available load increase",()=>expect(performanceProgression(plan(8),[history(80,8)],now).candidate).toMatchObject({weightKg:82.5,reps:6}));
  it("repeats when effort is high, missing, old, or the completed sets are mixed",()=>{
    expect(performanceProgression(plan(),[history(80,6,9)],now).candidate).toBeNull();
    expect(performanceProgression(plan(),[history(80,6,null)],now).candidate).toBeNull();
    expect(performanceProgression(plan(),[history(80,6,8,43)],now).candidate).toBeNull();
    const mixed=history();mixed.exercises[0].sets[2].reps="5";
    expect(performanceProgression(plan(),[mixed],now).candidate).toBeNull();
  });
  it("does not use a different exercise, set count or already recorded prescription",()=>{
    const different=history();different.exercises[0].name="Incline Bench Press";
    expect(performanceProgression(plan(),[different],now).candidate).toBeNull();
    const count=history();count.exercises[0].sets.pop();expect(performanceProgression(plan(),[count],now).candidate).toBeNull();
    const recorded=plan();recorded.sets[0].rpe=8;expect(performanceProgression(recorded,[history()],now).candidate).toBeNull();
  });
  it("respects available-weight and maximum-increase limits",()=>{
    const exercise={...plan(8),availableWeights:{mode:"custom" as const,unit:"kg" as const,values:[20,80,90]}};
    expect(performanceProgression(exercise,[history(80,8)],now).candidate).toBeNull();
  });
  it("allows a proven preferred increase but does not leapfrog a recent reduction",()=>{
    const exercise={...plan(8),progression:{repSteps:[6,8],preferredIncreaseKg:10,maxIncreaseKg:10}};
    expect(performanceProgression(exercise,[history(80,8,8,7),history(90,6,8,14)],now).candidate?.weightKg).toBe(90);
    expect(performanceProgression(exercise,[history(80,8,8,7),history(70,6,8,14),history(90,6,8,21)],now).candidate?.weightKg).toBe(82.5);
  });
});
