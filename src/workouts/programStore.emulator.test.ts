import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, setDoc, Timestamp } from "firebase/firestore";
import { afterAll,beforeAll,beforeEach,describe,it,expect,vi } from "vitest";
import { newProgramRun, programDayLink, type ProgramRecord } from "./programFlow";
import { activateStoredProgram, deleteStoredProgram, reconcileStoredProgramCalendar, saveLinkedWorkout, saveProgram } from "./programStore";
const harness = vi.hoisted(() => ({db:null as any,auth:{currentUser:{uid:"alice"} as {uid:string}|null}}));
vi.mock("../config/firebaseConfig",()=>({get db(){return harness.db;},auth:harness.auth}));
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
describe.skipIf(!enabled)("program persistence",()=>{
 let environment:RulesTestEnvironment;
 const program:ProgramRecord={id:"p",name:"Two days",days:[{type:"workout",routineId:"routine",title:"Chest"},{type:"rest",routineId:null,title:"Rest"}],status:"saved",runId:"run",updatedAt:0};
 beforeAll(async()=>{const [host,port]=process.env.FIRESTORE_EMULATOR_HOST!.split(":");environment=await initializeTestEnvironment({projectId:"demo-lastrep-program-tests",firestore:{host,port:Number(port),rules:readFileSync("firestore.rules","utf-8")}});});
 beforeEach(async()=>{await environment.clearFirestore();harness.db=environment.authenticatedContext("alice").firestore();harness.auth.currentUser={uid:"alice"};await setDoc(doc(harness.db,"users","alice"),{nickname:"Local test"});});
 afterAll(async()=>environment?.cleanup());
 it("repairs stale program dates only from matching workout identities and is idempotent",async()=>{
  const p={...program,days:[program.days[0],{...program.days[0],routineId:"legs",title:"Legs"},program.days[1],program.days[0]]};
  await saveProgram("alice",p);
  const run={...newProgramRun(p,"run","2026-11-04"),cursor:3,marks:{
   "0":{status:"completed" as const,dateKey:"2026-11-04",workoutId:"chest"},
   "1":{status:"completed" as const,dateKey:"2026-11-05",workoutId:"legs"},
  }};
  const ref=doc(harness.db,"users","alice","workoutPrograms","p","runs","run");
  await setDoc(ref,run);
  for(const [ordinal,id,date] of [[0,"chest","2026-11-05"],[1,"legs","2026-11-06"]] as const){
   await setDoc(doc(harness.db,"users","alice","workouts",id),{date:Timestamp.fromDate(new Date(date+"T12:00:00")),programLink:programDayLink(p,{...run,marks:{}},ordinal)});
  }
  const [next,concurrent]=await Promise.all([reconcileStoredProgramCalendar("alice","p","run"),reconcileStoredProgramCalendar("alice","p","run")]);
  expect(concurrent).toEqual(next);
  expect(next?.revision).toBe(1);
  expect(next?.anchorDateKey).toBe("2026-11-06");
  expect(next?.marks["0"].dateKey).toBe("2026-11-05");
  expect(next?.marks["1"].dateKey).toBe("2026-11-06");
  expect(await reconcileStoredProgramCalendar("alice","p","run")).toEqual(next);
  expect((await getDoc(doc(harness.db,"users","alice","workouts","legs"))).data()?.date.toDate()).toEqual(new Date("2026-11-06T12:00:00"));
 });
 it("never infers a date correction from a same-named standalone workout",async()=>{
  await saveProgram("alice",program);
  const ref=doc(harness.db,"users","alice","workoutPrograms","p","runs","run");
  await setDoc(ref,{...newProgramRun(program,"run","2026-11-04"),marks:{"0":{status:"completed",dateKey:"2026-11-04",workoutId:"standalone"}}});
  await setDoc(doc(harness.db,"users","alice","workouts","standalone"),{title:"Chest",date:Timestamp.now(),programLink:null});
  expect((await reconcileStoredProgramCalendar("alice","p","run"))?.anchorDateKey).toBe("2026-11-04");
 });
 it("saves workout and completion atomically, and retry creates no duplicate",async()=>{
  await saveProgram("alice",program);const run=newProgramRun(program,"run","2026-11-02");await setDoc(doc(harness.db,"users","alice","workoutPrograms","p","runs","run"),run);
  const payload={title:"Chest",date:Timestamp.now(),exercises:[]},link=programDayLink(program,run,0)!;
  await saveLinkedWorkout("alice","w",payload,link);await saveLinkedWorkout("alice","w",payload,link);
  expect((await getDocs(collection(harness.db,"users","alice","workouts"))).size).toBe(1);
  expect((await getDoc(doc(harness.db,"users","alice","workoutPrograms","p","runs","run","occurrences","0"))).data()?.workoutId).toBe("w");
  expect((await getDoc(doc(harness.db,"users","alice","workouts","w"))).data()?.date).toBeInstanceOf(Timestamp);
  await expect(saveLinkedWorkout("alice","stale-other-device",payload,link)).rejects.toThrow("already finished");
  expect((await getDoc(doc(harness.db,"users","alice","workouts","stale-other-device"))).exists()).toBe(false);
 });
 it("a standalone workout cannot complete a same-named program day",async()=>{
  await saveProgram("alice",program);const run=newProgramRun(program,"run");await setDoc(doc(harness.db,"users","alice","workoutPrograms","p","runs","run"),run);
  await saveLinkedWorkout("alice","single",{title:"Chest",date:Timestamp.now()},null);
  expect((await getDoc(doc(harness.db,"users","alice","workoutPrograms","p","runs","run"))).data()?.cursor).toBe(0);
 });
 it("restart archives the old run and deletion preserves routines and workouts",async()=>{
  await saveProgram("alice",program);await setDoc(doc(harness.db,"users","alice","workoutPrograms","p","runs","run"),newProgramRun(program,"run"));
  await setDoc(doc(harness.db,"users","alice","routines","routine"),{name:"Chest"});
  await saveLinkedWorkout("alice","single",{title:"Chest"},null);
  const activated=await activateStoredProgram("alice",program,"restart");
  expect(activated.run.id).not.toBe("run");
  expect(activated.program.runId).toBe(activated.run.id);
  expect(programDayLink(activated.program,activated.run,0)).toMatchObject({dayNumber:1,routineId:"routine",runId:activated.run.id});
  expect((await getDoc(doc(harness.db,"users","alice","workoutPrograms","p","runs","run"))).data()?.endedDateKey).toBeTruthy();
  await deleteStoredProgram("alice","p");
  expect((await getDoc(doc(harness.db,"users","alice","routines","routine"))).exists()).toBe(true);
  expect((await getDoc(doc(harness.db,"users","alice","workouts","single"))).exists()).toBe(true);
  expect((await getDoc(doc(harness.db,"users","alice"))).data()?.activeWorkoutProgramId).toBeNull();
 });
 it("rejects a stale account before creating records",async()=>{
  harness.auth.currentUser={uid:"bob"};await expect(saveLinkedWorkout("alice","w",{},null)).rejects.toThrow("account changed");
  expect((await getDoc(doc(harness.db,"users","alice","workouts","w"))).exists()).toBe(false);
 });
 it("cannot overwrite a run activated after the manager snapshot was loaded",async()=>{
  await saveProgram("alice",program);await setDoc(doc(harness.db,"users","alice","workoutPrograms","p","runs","run"),newProgramRun(program,"run"));
  await activateStoredProgram("alice",program,"restart");
  const current=(await getDoc(doc(harness.db,"users","alice","workoutPrograms","p"))).data()!;
  await expect(saveProgram("alice",{...program,name:"Stale edit"})).rejects.toThrow("another device");
  expect((await getDoc(doc(harness.db,"users","alice","workoutPrograms","p"))).data()?.runId).toBe(current.runId);
 });
});
