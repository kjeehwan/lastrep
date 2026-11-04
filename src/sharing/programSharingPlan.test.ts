import { describe, expect, it } from "vitest";
import { parseSharedPlan, type SharedProgramPlan } from "./sharingContract";
import { programToSharingPlan } from "./programSharingPlan";
import { omitSharingWeights } from "./sharingPlan";
import { sharingPrescriptionRows } from "./sharingPresentation";
import type { Routine } from "../workouts/workoutLog/workoutLogModel";

const routine: Routine={id:"private-routine-id",name:"Chest",createdAt:null,updatedAt:null,exercises:[{name:"Bench press",notes:"private personal note",targets:{minReps:6,maxReps:8,targetRpe:8},tempo:"3-0-1-0",restSec:120,unit:"kg",sets:[{reps:"8",defaultWeightKg:80,targetRpe:8,setType:"normal"},{reps:"8",defaultWeightKg:80,targetRpe:8,setType:"normal"}]}]};
const build=()=>programToSharingPlan({id:"private-program",name:"Cycle",runId:"private-run",status:"saved",updatedAt:123,days:[{type:"workout",routineId:routine.id,title:"Chest"},{type:"rest",routineId:null,title:"Rest"},{type:"workout",routineId:routine.id,title:"Chest again"}]},[routine],"rir");
describe("program sharing boundary",()=>{
  it("shares one referenced routine without account identities, personal notes or run progress",()=>{
    const p=build(),json=JSON.stringify(p);expect(p.routines).toHaveLength(1);expect(p.days[0].routineKey).toBe(p.days[2].routineKey);expect(p.days[1].routineKey).toBeNull();expect(json).not.toMatch(/private-|personal note|runId|updatedAt/);expect(p.routines[0].plan.exercises[0].targets?.targetRpe).toBe(8);expect(p.routines[0].plan.effortScale).toBe("rir");
  });
  it("omits weights throughout the actual outgoing program without mutating the source",()=>{
    const p=build(),out=omitSharingWeights(p) as SharedProgramPlan;expect(out.routines[0].plan.exercises[0].sets[0].weightKg).toBeNull();expect(p.routines[0].plan.exercises[0].sets[0].weightKg).toBe(80);
  });
  it("rejects missing references, private fields, duplicate keys and unassigned days",()=>{
    for(const mutate of [(p:any)=>p.days[0].routineKey="missing",(p:any)=>p.runId="private",(p:any)=>p.routines.push(p.routines[0]),(p:any)=>p.days[0].type="unassigned",(p:any)=>p.routines[0].plan.exercises[0].notes="private"]){const p=structuredClone(build());mutate(p);expect(()=>parseSharedPlan(p)).toThrow();}
  });
  it("bounds the whole program, not only each individual routine",()=>{
    const p=build();p.days=Array.from({length:15},()=>p.days[0]);expect(()=>parseSharedPlan(p)).toThrow();
    const long=build();long.routines=Array.from({length:14},(_,i)=>({key:`r${i}`,plan:{...long.routines[0].plan,exercises:Array.from({length:20},()=>long.routines[0].plan.exercises[0])}}));long.days=long.routines.map(r=>({type:"workout",title:"Day",routineKey:r.key}));expect(()=>parseSharedPlan(long)).toThrow(/too large/);
  });
  it("groups identical prescriptions while keeping warm-up and different target effort separate",()=>{
    const e=build().routines[0].plan.exercises[0];e.sets.unshift({...e.sets[0],setType:"warmup",weightKg:20,reps:"4"});expect(sharingPrescriptionRows(e,"rir")).toEqual(["Warm-up · 20 kg × 4 reps · Target RIR 2","2 sets · 80 kg × 8 reps · Target RIR 2"]);e.sets[2].targetRpe=9;expect(sharingPrescriptionRows(e,"rir")).toHaveLength(3);
  });
});
