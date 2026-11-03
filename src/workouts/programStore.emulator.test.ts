import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, setDoc, Timestamp } from "firebase/firestore";
import { afterAll,beforeAll,beforeEach,describe,it,expect,vi } from "vitest";
import { newProgramRun, programDayLink, type ProgramRecord } from "./programFlow";
import { activateStoredProgram, deleteStoredProgram, saveLinkedWorkout, saveProgram } from "./programStore";
const harness = vi.hoisted(() => ({db:null as any,auth:{currentUser:{uid:"alice"} as {uid:string}|null}}));
vi.mock("../config/firebaseConfig",()=>({get db(){return harness.db;},auth:harness.auth}));
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
describe.skipIf(!enabled)("program persistence",()=>{
 let environment:RulesTestEnvironment;
 const program:ProgramRecord={id:"p",name:"Two days",days:[{type:"workout",routineId:"routine",title:"Chest"},{type:"rest",routineId:null,title:"Rest"}],status:"saved",runId:"run",updatedAt:0};
 beforeAll(async()=>{const [host,port]=process.env.FIRESTORE_EMULATOR_HOST!.split(":");environment=await initializeTestEnvironment({projectId:"demo-lastrep-program-tests",firestore:{host,port:Number(port),rules:readFileSync("firestore.rules","utf-8")}});});
 beforeEach(async()=>{await environment.clearFirestore();harness.db=environment.authenticatedContext("alice").firestore();harness.auth.currentUser={uid:"alice"};await setDoc(doc(harness.db,"users","alice"),{nickname:"Local test"});});
 afterAll(async()=>environment?.cleanup());
 it("saves workout and completion atomically, and retry creates no duplicate",async()=>{
  await saveProgram("alice",program);const run=newProgramRun(program,"run","2026-11-02");await setDoc(doc(harness.db,"users","alice","workoutPrograms","p","runs","run"),run);
  const payload={title:"Chest",date:Timestamp.now(),exercises:[]},link=programDayLink(program,run,0)!;
  await saveLinkedWorkout("alice","w",payload,link);await saveLinkedWorkout("alice","w",payload,link);
  expect((await getDocs(collection(harness.db,"users","alice","workouts"))).size).toBe(1);
  expect((await getDoc(doc(harness.db,"users","alice","workoutPrograms","p","runs","run","occurrences","0"))).data()?.workoutId).toBe("w");
  expect((await getDoc(doc(harness.db,"users","alice","workouts","w"))).data()?.date).toBeInstanceOf(Timestamp);
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
