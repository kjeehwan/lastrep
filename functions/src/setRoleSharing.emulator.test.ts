import { beforeAll, describe, expect, it } from "vitest";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { handleWorkoutSharing } from "./workoutSharing";

const enabled=Boolean(process.env.FIRESTORE_EMULATOR_HOST);
describe.skipIf(!enabled)("set-role sharing compatibility",()=>{
  const suffix=Date.now().toString(36),sender=`roles-s-${suffix}`,recipient=`roles-r-${suffix}`;
  const call=(uid:string|null,input:Record<string,unknown>)=>handleWorkoutSharing({supportedPlanVersion:2,...input},uid) as Promise<any>;
  const exercise={name:"Deadlift",mode:"resistance",unit:"kg",restSec:120,tempo:"",instructions:"",targets:{minReps:6,maxReps:8,targetRpe:8},groupTargets:{backoff:{minReps:8,maxReps:10,targetRpe:9}},
    sets:[{weightKg:130,reps:"8",targetRpe:null,setType:"top",durationSec:null,distanceKm:null},{weightKg:110,reps:"8",targetRpe:null,setType:"backoff",durationSec:null,distanceKm:null}]};
  const workout={version:1,title:"Role test",effortScale:"rpe",exercises:[exercise]};
  beforeAll(async()=>{
    if(!getApps().length)initializeApp({projectId:"demo-lastrep-sharing"});
    if(!getApps()[0].options.projectId?.startsWith("demo-"))throw Error("Disposable project required");
    for(const uid of [sender,recipient]){
      await getFirestore().doc(`users/${uid}`).set({nickname:"Synthetic role QA"});
      await call(uid,{op:"username",username:uid.replaceAll("-",".")});await call(uid,{op:"enabled",enabled:true});
    }
  });
  it("gates old clients, supports public previews and imports role targets intact",async()=>{
    const result=await call(sender,{op:"send",plan:workout,recipients:[recipient],requestId:`roles-${suffix}`,intentCreatedAtMs:Date.now()});
    expect(result.recipients).toHaveLength(1);
    const entries=await getFirestore().collection(`users/${recipient}/sharingInbox`).get(),deliveryId=entries.docs[0].id;
    await call(recipient,{op:"respond",deliveryId,action:"accept"});
    await expect(call(recipient,{op:"snapshot",deliveryId})).rejects.toMatchObject({code:"failed-precondition",message:expect.stringContaining("Update Lastrep")});
    await expect(call(recipient,{op:"importRoutine",deliveryId})).rejects.toMatchObject({code:"failed-precondition"});
    const received=await call(recipient,{op:"snapshot",deliveryId,supportsSetRoles:true});
    expect(received.plan.exercises[0].sets.map((s:any)=>s.setType)).toEqual(["top","backoff"]);
    const saved=await call(recipient,{op:"importRoutine",deliveryId,supportsSetRoles:true});
    const routine=(await getFirestore().doc(`users/${recipient}/routines/${saved.id}`).get()).data()!;
    expect(routine.exercises[0].groupTargets.backoff.targetRpe).toBe(9);
    expect(routine.exercises[0].sets.map((s:any)=>s.setType)).toEqual(["top","backoff"]);
    const link=await call(sender,{op:"link",plan:workout});
    await expect(call(null,{op:"snapshot",token:link.token})).rejects.toMatchObject({code:"failed-precondition"});
    expect((await call(null,{op:"snapshot",token:link.token,supportsSetRoles:true})).plan.exercises[0].groupTargets.backoff.targetRpe).toBe(9);
  });
  it("also gates roles nested in a program and retains them in imported routines",async()=>{
    const plan={version:2,kind:"program",title:"Roles program",effortScale:"rpe",days:[{type:"workout",title:"Legs",routineKey:"r1"}],routines:[{key:"r1",plan:workout}]};
    const link=await call(sender,{op:"link",plan});
    await expect(call(recipient,{op:"importProgram",token:link.token})).rejects.toMatchObject({code:"failed-precondition"});
    const saved=await call(recipient,{op:"importProgram",token:link.token,supportsSetRoles:true});
    const program=(await getFirestore().doc(`users/${recipient}/workoutPrograms/${saved.id}`).get()).data()!;
    const routine=(await getFirestore().doc(`users/${recipient}/routines/${program.days[0].routineId}`).get()).data()!;
    expect(routine.exercises[0].groupTargets.backoff.targetRpe).toBe(9);
  });
});
