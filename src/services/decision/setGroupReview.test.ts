import { describe, expect, it } from "vitest";
import type { DecisionInputs, PlannedExerciseSummary } from "../../types/decision";
import type { WorkoutSummary } from "../../workouts/homeInsights";
import { buildDeterministicTodayPlan } from "./todayPlanEngine";
import { applyTodayPlanToWorkoutDraft } from "./todayPlanDraft";
import { exerciseAdjustmentText } from "./todayPlanPrescription";
import { safeParseDecisionInputs, safeParseDecisionOutput } from "./decisionValidation";
import { parseWorkoutDraftPlan } from "./todayPlanContext";
import { workoutGuidanceSignature } from "./workoutGuidance";

const now = new Date("2026-11-25T12:00:00");
function fixture() {
  const exercise: PlannedExerciseSummary = {name:"Deadlift",mode:"resistance",targets:{minReps:6,maxReps:8,targetRpe:8},
    groupTargets:{backoff:{minReps:8,maxReps:10,targetRpe:8}},availableWeights:{mode:"regular",unit:"kg",minimum:20,increment:2.5},
    sets:[{weightKg:130,reps:8,setType:"top",done:false},{weightKg:110,reps:8,setType:"backoff",done:false},{weightKg:110,reps:8,setType:"backoff",done:false}]};
  const inputs: DecisionInputs = {sleepHours:8,sleepSource:"manual",sleepSampleAgeHours:null,soreness:1,fatigue:1,motivation:9,trainingPhase:"Strength",dietPhase:"Maintain",
    plannedWorkout:{source:"draft",title:"Legs",exerciseNames:["Deadlift"],exercises:[exercise]}};
  const history: WorkoutSummary[] = [{id:"last",title:"Legs",date:new Date("2026-11-20T12:00:00"),trainingPhase:"Strength",
    exercises:[{name:"Deadlift",mode:"resistance",sets:exercise.sets.map(set=>({...set,reps:String(set.reps),rpe:set.setType==="top"?8:9}))}]}];
  const review=()=>buildDeterministicTodayPlan(inputs,history,now).exerciseAdjustments![0];
  const raw=()=>JSON.stringify({sessionDateText:"2026-11-25",exercises:[{...exercise,sets:exercise.sets.map(set=>({...set,reps:String(set.reps),rpe:set.rpe==null?"":String(set.rpe)}))}]});
  return {exercise,inputs,history,review,raw};
}
describe("role-scoped Today's Plan",()=>{
  it("qualifies Top independently while Back-off repeats above its own effort target",()=>{
    const f=fixture(),review=f.review();expect(review.action).toBe("progress");
    expect(review.groupAdjustments?.[0]).toMatchObject({role:"top",action:"progress",recommendedPrescription:{weightKg:132.5,reps:6,sets:1}});
    expect(review.groupAdjustments?.[1]).toMatchObject({role:"backoff",action:"as_planned",loadPct:0,repsDelta:0});
    const applied=applyTodayPlanToWorkoutDraft(f.raw(),[review]);const sets=JSON.parse(applied.raw).exercises[0].sets;
    expect(sets.map((s:any)=>[s.setType,s.weightKg,s.reps,s.rpe])).toEqual([["top",132.5,"6",""],["backoff",110,"8",""],["backoff",110,"8",""]]);
    expect(exerciseAdjustmentText(review.groupAdjustments![0],"kg",f.exercise)).toContain("132.5");
  });
  it("does not skip a latest ambiguous exercise block to borrow older success",()=>{
    const f=fixture(),older=structuredClone(f.history[0]);older.date=new Date("2026-11-10T12:00:00");f.history.push(older);
    f.history[0].exercises.push(structuredClone(f.history[0].exercises[0]));
    expect(f.review().groupAdjustments!.some(group=>group.action==="progress")).toBe(false);
    expect(f.review().groupAdjustments![0].reason).toContain("listed this exercise more than once");
    expect(f.review().groupAdjustments![0].reason).not.toContain("No sets were labeled");
  });
  it("selects only Back-off when it independently meets an RPE 9 override",()=>{
    const f=fixture();f.exercise.groupTargets!.backoff!.targetRpe=9;
    const review=f.review(),groups=review.groupAdjustments!;
    expect(groups[1]).toMatchObject({action:"progress",repsDelta:2});
    const result=JSON.parse(applyTodayPlanToWorkoutDraft(f.raw(),[{...review,groupAdjustments:[groups[1]]}]).raw);
    expect(result.exercises[0].sets.map((s:any)=>s.reps)).toEqual(["8","10","10"]);
  });
  it("never borrows Normal history for explicit roles or skips the latest missing role",()=>{
    const f=fixture();f.history[0].exercises[0].sets.forEach(s=>s.setType="normal");
    const groups=f.review().groupAdjustments!;
    expect(groups.every(g=>g.action!=="progress")).toBe(true);
    expect(groups[0].reason).toContain("No sets were labeled Top");
    expect(groups[1].reason).toContain("No sets were labeled Back-off");
    expect(groups.every(g=>!g.reason.includes("missing or mixed"))).toBe(true);
  });
  it("explains missing and mismatched group history separately",()=>{
    const f=fixture();f.history.length=0;
    expect(f.review().groupAdjustments![0].reason).toContain("No workout for this exercise was recorded in the last six weeks");
    const g=fixture();g.history[0].exercises[0].sets.pop();
    const groups=g.review().groupAdjustments!;
    expect(groups[0].action).toBe("progress");
    expect(groups[1].reason).toContain("different number of Back-off sets");
  });
  it("does not borrow older effort or hide recovery advice behind history explanations",()=>{
    const f=fixture(),older=structuredClone(f.history[0]);older.date=new Date("2026-11-15T12:00:00");f.history.push(older);
    f.history[0].exercises[0].sets.forEach(set=>set.rpe=null);
    expect(f.review().groupAdjustments!.every(group=>group.action!=="progress"&&group.reason.includes("effort ratings are missing"))).toBe(true);
    f.history[0].exercises[0].sets.forEach(set=>set.setType="normal");f.inputs.fatigue=9;
    expect(f.review().groupAdjustments!.every(group=>group.action==="reduce"&&!group.reason.includes("set history"))).toBe(true);
  });
  it.each(["recording","mixed","extra-top","recovery","nutrition"])("holds increases for %s",kind=>{
    const f=fixture();
    if(kind==="recording") f.exercise.sets[2].rpe=8;
    if(kind==="mixed") f.exercise.sets[2].weightKg=105;
    if(kind==="extra-top") f.exercise.sets[2].setType="top";
    if(kind==="recovery") f.inputs.fatigue=9;
    if(kind==="nutrition") f.inputs.nutrition={caloriesConsumedToday:100,proteinGramsToday:null,calorieTarget:3000,yesterdayCalories:100,yesterdayAdherence:"below_target",recentAdherence:"below_target",recentCompletedDaysTracked:3};
    expect(f.review().groupAdjustments!.some(g=>g.action==="progress")).toBe(false);
  });
  it("does not apply a stale group after a role, load or completion change",()=>{
    for(const kind of ["role","load","done"]){const f=fixture(),review=f.review();
      if(kind==="role")f.exercise.sets[0].setType="normal";
      if(kind==="load")f.exercise.sets[0].weightKg=125;
      if(kind==="done")f.exercise.sets[1].done=true;
      expect(applyTodayPlanToWorkoutDraft(f.raw(),[review]).changedExercises).toBe(0);
    }
  });
  it("preserves warmups and drops; duplicates do not receive automatic changes",()=>{
    const f=fixture(),review=f.review(),parsed=JSON.parse(f.raw());
    parsed.exercises[0].sets.unshift({setType:"warmup",weightKg:60,reps:"5",rpe:"",done:true});
    const result=JSON.parse(applyTodayPlanToWorkoutDraft(JSON.stringify(parsed),[review]).raw);
    expect(result.exercises[0].sets[0]).toEqual(parsed.exercises[0].sets[0]);
    parsed.exercises.push(structuredClone(parsed.exercises[0]));
    expect(applyTodayPlanToWorkoutDraft(JSON.stringify(parsed),[review]).changedExercises).toBe(0);
  });
  it("retains roles/targets through context validation and invalidates review on target edits",()=>{
    const f=fixture(),parsed=parseWorkoutDraftPlan(f.raw(),now)!;
    expect(parsed.exercises![0].groupTargets).toEqual({...f.exercise.groupTargets,top:null});
    const before=workoutGuidanceSignature(parsed);parsed.exercises![0].groupTargets!.backoff!.targetRpe=9;
    expect(workoutGuidanceSignature(parsed)).not.toBe(before);
    expect(safeParseDecisionInputs(f.inputs).success).toBe(true);
    expect(safeParseDecisionOutput(buildDeterministicTodayPlan(f.inputs,f.history,now)).success).toBe(true);
  });
  it("does not repeat a deload reduction already applied to one group",()=>{
    const f=fixture();f.inputs.deload={id:"d",startedDateKey:"2026-11-25",endsDateKey:"2026-12-01"};
    f.exercise.deloadAppliedGroups={top:"d"};
    const groups=f.review().groupAdjustments!;
    expect(groups[0]).toMatchObject({action:"as_planned",loadPct:0,setDelta:0});
    expect(groups[1]).toMatchObject({action:"reduce",recommendedPrescription:{weightKg:97.5}});
  });
  it("uses available weights and rep steps per group, without leapfrogging a rebuild",()=>{
    const f=fixture();f.exercise.groupTargets!.backoff!.targetRpe=9;
    f.exercise.progression={repSteps:[6,8,10,12,15,18],preferredIncreaseKg:10,maxIncreaseKg:10};
    const older=structuredClone(f.history[0]);older.date=new Date("2026-11-10T12:00:00");
    older.exercises[0].sets[0].weightKg=150;older.exercises[0].sets[0].reps="8";
    f.history.push(older);
    expect(f.review().groupAdjustments![0].recommendedPrescription?.weightKg).toBe(132.5);
    f.exercise.availableWeights={mode:"custom",unit:"kg",values:[130,150]};
    expect(f.review().groupAdjustments![0].action).toBe("as_planned");
  });
});
