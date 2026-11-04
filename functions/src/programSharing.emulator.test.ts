import { beforeAll, describe, expect, it } from "vitest";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { handleWorkoutSharing, deleteWorkoutSharingForAccount } from "./workoutSharing";
const enabled=!!process.env.FIRESTORE_EMULATOR_HOST;
const workout={version:1,title:"Same name",effortScale:"rpe",exercises:[{name:"Bench press",mode:"resistance",unit:"kg",restSec:120,tempo:"3-0-1-0",instructions:"",targets:{minReps:6,maxReps:8,targetRpe:8},sets:[{weightKg:80,reps:"8",targetRpe:8,setType:"normal",durationSec:null,distanceKm:null}]}]};
const plan={version:2,kind:"program",title:"Synthetic cycle",effortScale:"rpe",days:[{type:"workout",title:"Chest",routineKey:"r1"},{type:"rest",title:"Rest",routineKey:null},{type:"workout",title:"Arms",routineKey:"r2"},{type:"workout",title:"Chest again",routineKey:"r1"}],routines:[{key:"r1",plan:workout},{key:"r2",plan:{...workout,exercises:[{...workout.exercises[0],name:"Curl"}]}}]};
const call=(uid:string|null,input:Record<string,unknown>)=>handleWorkoutSharing({supportedPlanVersion:2,...input,...(input.op==="send"?{intentCreatedAtMs:Date.now()}: {})},uid) as Promise<any>;
describe.skipIf(!enabled)("program-sharing transactional imports",()=>{
  const suffix=Date.now().toString(36),a=`program-sender-${suffix}`,b=`program-recipient-${suffix}`,requestId=`program-send-${suffix}`;
  let deliveryId="";
  beforeAll(async()=>{
    if(!getApps().length)initializeApp({projectId:"demo-lastrep-sharing"});
    if(!getApps()[0].options.projectId?.startsWith("demo-"))throw Error("Disposable emulator project required.");
    for(const [uid,name] of [[a,"Program sender"],[b,"Program recipient"]]){
      await getFirestore().doc(`users/${uid}`).set({nickname:name,activeWorkoutProgramId:"existing-program"});
      await call(uid,{op:"username",username:uid.replaceAll("-",".").slice(0,24)});await call(uid,{op:"enabled",enabled:true});
    }
  },30000);
  it("shares with retry deduplication, requires acceptance and protects older clients",async()=>{
    const input={op:"send",plan,recipients:[b],requestId};await Promise.all([call(a,input),call(a,input)]);
    const docs=await getFirestore().collection(`users/${b}/sharingInbox`).get();expect(docs.size).toBe(1);deliveryId=docs.docs[0].id;expect(docs.docs[0].data().kind).toBe("program");
    await expect(call(b,{op:"importProgram",deliveryId})).rejects.toMatchObject({code:"permission-denied"});
    await call(b,{op:"respond",deliveryId,action:"accept"});
    await expect(call(b,{op:"snapshot",deliveryId,supportedPlanVersion:1})).rejects.toMatchObject({code:"failed-precondition"});
    expect((await call(b,{op:"snapshot",deliveryId})).plan).toMatchObject({version:2,kind:"program"});
  });
  it("atomically imports independent routines once per delivery without activating a run",async()=>{
    const [first,retry]=await Promise.all([call(b,{op:"importProgram",deliveryId}),call(b,{op:"importProgram",deliveryId})]);expect(first.id).toBe(retry.id);
    const p=(await getFirestore().doc(`users/${b}/workoutPrograms/${first.id}`).get()).data()!;
    expect(p.runId).toBeNull();expect(p.days[0].routineId).toBe(p.days[3].routineId);expect(p.days[0].routineId).not.toBe(p.days[2].routineId);
    const routines=await getFirestore().collection(`users/${b}/routines`).get();expect(routines.size).toBe(2);expect(routines.docs.map(d=>d.data().name)).toEqual(["Same name","Same name"]);
    expect(routines.docs[0].data().exercises[0].targets).toEqual({minReps:6,maxReps:8,targetRpe:8});expect(routines.docs[0].data().exercises[0].sets[0]).not.toHaveProperty("rpe");
    expect((await getFirestore().doc(`users/${b}`).get()).data()?.activeWorkoutProgramId).toBe("existing-program");
    await getFirestore().doc(`users/${b}/routines/${p.days[0].routineId}`).update({name:"Recipient edit"});
    expect((await call(b,{op:"snapshot",deliveryId})).plan.routines[0].plan.title).toBe("Same name");
  });
  it("allows deliberate repeat delivery to create another independent program and expires authorization",async()=>{
    await call(a,{op:"send",plan,recipients:[b],requestId:`program-again-${suffix}`});
    const docs=await getFirestore().collection(`users/${b}/sharingInbox`).get(),next=docs.docs.find(d=>d.id!==deliveryId)!;
    const imported=await call(b,{op:"importProgram",deliveryId:next.id});expect((await getFirestore().collection(`users/${b}/workoutPrograms`).get()).size).toBe(2);
    await next.ref.update({expiresAtMs:Date.now()-1});await expect(call(b,{op:"importProgram",deliveryId:next.id})).rejects.toMatchObject({code:"not-found"});
    expect((await getFirestore().doc(`users/${b}/workoutPrograms/${imported.id}`).get()).exists).toBe(true);
  });
  it("removing the sender's sharing data leaves independently imported programs and routines",async()=>{
    await deleteWorkoutSharingForAccount(a);
    expect((await getFirestore().collection(`users/${b}/workoutPrograms`).get()).size).toBe(2);
    expect((await getFirestore().collection(`users/${b}/routines`).get()).size).toBe(4);
    expect((await getFirestore().collection(`users/${b}/sharingInbox`).get()).size).toBe(0);
  });
});
