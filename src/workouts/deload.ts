import { painEntries } from "../services/decision/painContext";
import type { DecisionInputs } from "../types/decision";
import type { WorkoutSummary } from "./homeInsights";
import { dateKey, addProgramDays } from "./programFlow";
export type DeloadPeriod={id:string;startedDateKey:string;endsDateKey:string};
export function newDeloadPeriod(id:string,today=dateKey()):DeloadPeriod{return{id,startedDateKey:today,endsDateKey:addProgramDays(today,6)};}
export function activeDeload(raw:any,today=dateKey()):DeloadPeriod|null {
 return raw&&typeof raw.id==="string"&&typeof raw.startedDateKey==="string"&&raw.endsDateKey===addProgramDays(raw.startedDateKey,6)&&raw.startedDateKey<=today&&raw.endsDateKey>=today?raw:null;
}
/** Phase duration adds context; it never schedules a deload by itself. */
export function deloadSuggestion(inputs:DecisionInputs,workouts:WorkoutSummary[],now=new Date()):string|null {
 if(inputs.deload||painEntries(inputs.dailyContext).length>0||inputs.fatigue<7&&inputs.soreness<7)return null;
 const recent=[...workouts].filter(workout=>workout.date<=now&&now.getTime()-workout.date.getTime()<21*86400000).sort((a,b)=>b.date.getTime()-a.date.getTime()).slice(0,3);
 const hard=recent.filter(workout=>{const sets=workout.exercises.flatMap(exercise=>exercise.mode==="cardio"?[]:exercise.sets.filter(set=>!set.setType||set.setType==="normal"));const efforts=sets.filter(set=>set.rpe!=null);return efforts.length>=2&&efforts.filter(set=>Number(set.rpe)>=9).length>=Math.ceil(efforts.length/2);}).length;
 if(hard<2||hard<3&&Math.max(inputs.trainingPhaseWeek??0,inputs.dietPhaseWeek??0)<4)return null;
 return `Recent sessions repeatedly reached high effort and today's recovery is limited${inputs.trainingPhaseWeek?` in training week ${inputs.trainingPhaseWeek}`:""}${inputs.dietPhaseWeek?` and diet week ${inputs.dietPhaseWeek}`:""}. Consider seven lighter days, then return to your normal routine prescriptions.`;
}
// Native hydration supplies optional defaults and rebuilds object keys. Compare
// editable set values, not JSON object layout, before restoring a prescription.
const setValues=(sets:unknown[])=>JSON.stringify(sets.map(value=>{
 const set=(value??{}) as Record<string,any>;
 return {weightKg:set.weightKg??null,weightText:set.weightText??null,reps:String(set.reps??""),
  rpe:String(set.rpe??""),targetRpe:set.targetRpe??null,done:Boolean(set.done),setType:set.setType??"normal",
  distanceKm:set.distanceKm??null,durationSec:set.durationSec??null,zone:set.zone??"",
  effortInput:set.effortInput?{scale:set.effortInput.scale,value:String(set.effortInput.value??""),canonicalRpe:String(set.effortInput.canonicalRpe??"")}:null};
}));
export function restoreDeloadExercises<T extends {id:string;name:string;sets:unknown[]}>(current:T[],backup:{before:T[];after:T[]}) {
 const manual:string[]=[];
 const exercises=current.map(exercise=>{
  const after=backup.after.find(item=>item.id===exercise.id),before=backup.before.find(item=>item.id===exercise.id);
  if(!after||!before||setValues(before.sets)===setValues(after.sets))return exercise;
  if(setValues(exercise.sets)!==setValues(after.sets)){manual.push(exercise.name);return exercise;}
  return {...exercise,sets:before.sets,deloadAppliedId:null};
 });
 return {exercises,manual};
}
