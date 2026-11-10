import { collection,doc,getDocs,runTransaction,writeBatch,Timestamp } from "firebase/firestore";
import { auth,db } from "../config/firebaseConfig";
import { normalizeProgram } from "./program";
import { completedProgramCalendar,completeProgramOccurrence,dateKey,newProgramRun,normalizeProgramLink,normalizeProgramRecord,programOccurrence,programSetupError,resumeProgramRun,type ProgramRecord,type ProgramRun,type ProgramLink } from "./programFlow";
const owner=(uid:string)=>{if(auth.currentUser?.uid!==uid)throw new Error("Your account changed. Reopen Workout.");};
export const programRef=(uid:string,id:string)=>doc(db,"users",uid,"workoutPrograms",id);
export const runRef=(uid:string,programId:string,runId:string)=>doc(programRef(uid,programId),"runs",runId);
export function cleanProgramWrite<T>(value:T):T {
 if(value instanceof Timestamp||value instanceof Date)return value;
 if(Array.isArray(value))return value.map(cleanProgramWrite) as T;
 if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,cleanProgramWrite(v)])) as T;
 return value;
}
export async function saveProgram(uid:string,program:ProgramRecord){owner(uid);await runTransaction(db,async tx=>{const ref=programRef(uid,program.id),previous=await tx.get(ref);owner(uid);if(previous.data()?.deleting)throw new Error("This program is being deleted.");if(previous.exists()&&(previous.data()?.runId??null)!==program.runId)throw new Error("This program changed on another device. Reopen it before saving.");tx.set(ref,{...cleanProgramWrite(program),updatedAt:Date.now()},{merge:true});});}
/** One-time copy; never invent routines or infer completion from same-date workouts. */
export async function migrateLegacyProgram(uid:string){
 owner(uid);await runTransaction(db,async tx=>{const userRef=doc(db,"users",uid),user=await tx.get(userRef);if(user.data()?.workoutProgramsMigrated)return;const legacy=normalizeProgram(user.data()?.workoutProgram);owner(uid);
  if(legacy){const id="legacy-program",p:ProgramRecord={id,name:"7-day program",status:"saved",runId:"legacy-run",updatedAt:Date.now(),days:legacy.days.map(d=>({type:d.type==="rest"?"rest":d.routineId?"workout":"unassigned",routineId:d.routineId??null,title:d.title}))};const started=legacy.startedAt?dateKey(legacy.startedAt.toDate()):dateKey();tx.set(programRef(uid,id),{...p,deleting:false});tx.set(runRef(uid,id,"legacy-run"),newProgramRun(p,"legacy-run",started));tx.set(userRef,{activeWorkoutProgramId:legacy.isActive?id:null,workoutProgramsMigrated:true},{merge:true});}
  else tx.set(userRef,{workoutProgramsMigrated:true,activeWorkoutProgramId:null},{merge:true});
 });
}
export async function activateStoredProgram(uid:string,program:ProgramRecord,mode:"start"|"resume"|"restart"){
 owner(uid);const nextRunId=doc(collection(programRef(uid,program.id),"runs")).id;
 return runTransaction(db,async tx=>{const pRef=programRef(uid,program.id),pSnap=await tx.get(pRef);const current=normalizeProgramRecord(program.id,pSnap.data());if(!current||pSnap.data()?.deleting)throw new Error("Program is unavailable.");const error=programSetupError(current);if(error)throw new Error(error);
  const previous=current.runId?await tx.get(runRef(uid,current.id,current.runId)):null;owner(uid);const today=dateKey();
  const run=mode==="resume"&&previous?.exists()?resumeProgramRun(current,previous.data() as ProgramRun,today):newProgramRun(current,nextRunId,today);
  run.revision=(previous?.data()?.revision??0)+1;
  if(mode==="restart"&&previous?.exists())tx.update(previous.ref,{endedDateKey:today});
  tx.set(runRef(uid,current.id,run.id),run);tx.update(pRef,{runId:run.id,status:"saved",updatedAt:Date.now()});
  // The compatibility field is read by older versions; new clients use explicit runs.
  tx.set(doc(db,"users",uid),{activeWorkoutProgramId:current.id,workoutProgram:{isActive:true,startedAt:Timestamp.fromDate(new Date(run.startedDateKey+"T12:00:00")),days:current.days.map((d,i)=>({...d,dayNumber:i+1,type:d.type==="rest"?"rest":"workout"}))}},{merge:true});
  return {program:{...current,runId:run.id},run};
 });
}
export async function updateProgramRun(uid:string,program:ProgramRecord,run:ProgramRun,next:ProgramRun){
 owner(uid);await runTransaction(db,async tx=>{const ref=runRef(uid,program.id,run.id),snap=await tx.get(ref);owner(uid);if(!snap.exists()||(snap.data()?.revision??0)!==(run.revision??0))throw new Error("The schedule changed. Reopen it and try again.");
  tx.set(ref,{...next,revision:(run.revision??0)+1});Object.entries(next.marks).forEach(([key,mark])=>{if(JSON.stringify(run.marks[key])!==JSON.stringify(mark))tx.set(doc(ref,"occurrences",key),{...mark,...programOccurrence(program,next,Number(key))},{merge:true});});
 });
}
export async function saveLinkedWorkout(uid:string,workoutId:string,payload:Record<string,unknown>,link:ProgramLink|null){
 owner(uid);await runTransaction(db,async tx=>{const workout=doc(db,"users",uid,"workouts",workoutId);if((await tx.get(workout)).exists())return;
  const pSnap=link?await tx.get(programRef(uid,link.programId)):null;
  const rSnap=link&&pSnap?.exists()&&!pSnap.data()?.deleting?await tx.get(runRef(uid,link.programId,link.runId)):null;
  const occurrence=link&&rSnap?.exists()?await tx.get(doc(rSnap.ref,"occurrences",String(link.ordinal))):null;owner(uid);
    if (link && (occurrence?.data()?.status === "completed" || rSnap?.data()?.marks?.[String(link.ordinal)]?.status === "completed")) throw new Error("This program workout is already finished. Open it from workout history instead.");
  tx.set(workout,cleanProgramWrite({...payload,programLink:link}));
  if(link&&pSnap?.exists()&&rSnap?.exists()){
   const p=normalizeProgramRecord(link.programId,pSnap.data())!,run=rSnap.data() as ProgramRun;
   if(occurrence?.data()?.status==="completed")return;
   const savedDate=payload.date instanceof Timestamp?dateKey(payload.date.toDate()):dateKey();
   const next=completeProgramOccurrence(p,run,link,workoutId,dateKey(),savedDate);
   tx.set(doc(rSnap.ref,"occurrences",String(link.ordinal)),{...programOccurrence(p,next,link.ordinal),completedAt:Date.now(),workoutId},{merge:true});
   // Older completed occurrences live in their own documents, keeping the current run small.
   next.marks=Object.fromEntries(Object.entries(next.marks).filter(([key])=>Number(key)>=next.cursor-p.days.length*2));
   tx.set(rSnap.ref,{...next,revision:(run.revision??0)+1});
  }
 });
}
/** Bounded, one-time repair using only explicitly linked completed workouts. */
export async function reconcileStoredProgramCalendar(uid:string,programId:string,runId:string){
 owner(uid);return runTransaction(db,async tx=>{
  const ref=runRef(uid,programId,runId),[pSnap,rSnap]=await Promise.all([tx.get(programRef(uid,programId)),tx.get(ref)]);
  const program=normalizeProgramRecord(programId,pSnap.data());
  if(!program||pSnap.data()?.deleting||!rSnap.exists())return null;
  const run=rSnap.data() as ProgramRun;
  if(Object.values(run.marks).every(mark=>mark.status!=="completed"||mark.completionDateVersion===1))return run;
  const dates:Record<string,string>={};
  for(const [key,mark] of Object.entries(run.marks)){
   if(mark.status!=="completed"||!mark.workoutId)continue;
   const workout=(await tx.get(doc(db,"users",uid,"workouts",mark.workoutId))).data();
   const link=normalizeProgramLink(workout?.programLink);
   if(link?.programId===programId&&link.runId===runId&&link.ordinal===Number(key)&&workout?.date instanceof Timestamp)dates[key]=dateKey(workout.date.toDate());
  }
  owner(uid);
  const next={...completedProgramCalendar(program,run,dates,dateKey()),revision:(run.revision??0)+1};
  for(const [key,mark] of Object.entries(next.marks))if(mark.status==="completed")next.marks[key]={...mark,completionDateVersion:1};
  tx.set(ref,next);
  for(const [key,mark] of Object.entries(next.marks))if(JSON.stringify(mark)!==JSON.stringify(run.marks[key])){
   tx.set(doc(ref,"occurrences",key),programOccurrence(program,next,Number(key)),{merge:true});
  }
  return next;
 });
}
export async function deleteStoredProgram(uid:string,id:string){
 owner(uid);await runTransaction(db,async tx=>{const ref=programRef(uid,id),userRef=doc(db,"users",uid),[p,u]=await Promise.all([tx.get(ref),tx.get(userRef)]);if(!p.exists())return;owner(uid);tx.update(ref,{deleting:true});if(u.data()?.activeWorkoutProgramId===id)tx.set(userRef,{activeWorkoutProgramId:null,"workoutProgram":{isActive:false}},{merge:true});});
 const runs=await getDocs(collection(programRef(uid,id),"runs"));
 for(const run of runs.docs){const occurrences=await getDocs(collection(run.ref,"occurrences"));for(let i=0;i<occurrences.docs.length;i+=400){owner(uid);const batch=writeBatch(db);occurrences.docs.slice(i,i+400).forEach(d=>batch.delete(d.ref));await batch.commit();}owner(uid);const batch=writeBatch(db);batch.delete(run.ref);await batch.commit();}
 owner(uid);const batch=writeBatch(db);batch.delete(programRef(uid,id));await batch.commit();
}
export async function stopStoredProgram(uid:string,id:string){
 owner(uid);await runTransaction(db,async tx=>{const ref=doc(db,"users",uid),snapshot=await tx.get(ref);owner(uid);if(snapshot.data()?.activeWorkoutProgramId===id)tx.set(ref,{activeWorkoutProgramId:null,workoutProgram:{isActive:false}},{merge:true});});
}
