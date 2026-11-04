import type { SharedWorkoutExercise } from "./sharingContract";
import { rpeToEffort } from "../workouts/effortScale";

/** Collapse only adjacent identical prescriptions; keep warm-up/drop/failure distinctions. */
export function sharingPrescriptionRows(exercise: SharedWorkoutExercise, scale: "rpe" | "rir") {
  const groups: {key:string;set:SharedWorkoutExercise["sets"][number];count:number;working:number}[]=[];
  let working=0;
  exercise.sets.forEach(set=>{
    if(set.setType!=="warmup")working++;
    const key=JSON.stringify(set),last=groups[groups.length-1];
    if(last?.key===key)last.count++;else groups.push({key,set,count:1,working});
  });
  const number=(n:number)=>String(Math.round(n*100)/100);
  return groups.map(({set,count,working})=>{
    const type=set.setType,grouped=count>1||groups.length===1;
    const label=grouped?`${count} ${type==="warmup"?"warm-up ":type==="drop"?"drop ":type==="failure"?"failure ":""}${count===1?"set":"sets"}`:type==="warmup"?"Warm-up":`Set ${working}${type==="drop"?" D":type==="failure"?" F":""}`;
    const prescription=exercise.mode==="cardio"?`${set.durationSec==null?"":`${number(set.durationSec/60)} min`}${set.distanceKm==null?"":` · ${number(set.distanceKm*(exercise.unit==="mi"?1/1.60934:1))} ${exercise.unit}`}`:`${set.weightKg==null?"":`${number(set.weightKg*(exercise.unit==="lbs"?2.2046226218:1))} ${exercise.unit} × `}${set.reps} reps`;
    return `${label} · ${prescription}${set.targetRpe==null?"":` · Target ${scale.toUpperCase()} ${rpeToEffort(set.targetRpe,scale)}`}`;
  });
}
