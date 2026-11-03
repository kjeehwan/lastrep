import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import { normalizeProgramRecord, sortPrograms, type ProgramRecord, type ProgramRun } from "./programFlow";
import { migrateLegacyProgram, runRef } from "./programStore";

export function useWorkoutPrograms(uid: string | null) {
  const [snapshot,setSnapshot] = useState<{uid:string;programs:ProgramRecord[];loaded:boolean;activeId:string|null;error:string|null}|null>(null);
  const [runSnapshot,setRunSnapshot] = useState<{key:string;run:ProgramRun|null}|null>(null);
  const [attempt,retry] = useState(0);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    let stopPrograms = () => undefined as void, stopUser = () => undefined as void;
    const initial = {uid,programs:[] as ProgramRecord[],loaded:false,activeId:null as string|null,error:null as string|null};
    const error = (message:string) => { if(alive) setSnapshot(previous=>({...previous?.uid===uid?previous:initial,error:message})); };
    void migrateLegacyProgram(uid).then(() => {
      if (!alive) return;
      stopPrograms = onSnapshot(collection(db,"users",uid,"workoutPrograms"), documents => {
        if(!alive)return;
        const programs = documents.docs.flatMap(item=>{
          const program=normalizeProgramRecord(item.id,item.data());return program?[program]:[];
        });
        setSnapshot(previous=>({...previous?.uid===uid?previous:initial,programs,loaded:true,error:null}));
      },()=>error("Couldn't load your programs. Try again."));
      stopUser = onSnapshot(doc(db,"users",uid),document=>{
        if(alive)setSnapshot(previous=>({...previous?.uid===uid?previous:initial,activeId:document.data()?.activeWorkoutProgramId??null}));
      },()=>error("Couldn't load your active program."));
    }).catch(()=>error("Couldn't load your programs. Your saved data is unchanged."));
    return()=>{alive=false;stopPrograms();stopUser();};
  },[uid,attempt]);
  const current=snapshot?.uid===uid?snapshot:null;
  const active=current?.programs.find(program=>program.id===current.activeId&&!program.deleting)??null;
  const runKey=uid&&active?.runId?`${uid}:${active.id}:${active.runId}`:null;
  useEffect(()=>{
    if(!uid||!active?.runId||!runKey)return;
    return onSnapshot(runRef(uid,active.id,active.runId),document=>setRunSnapshot({key:runKey,run:document.exists()?document.data() as ProgramRun:null}),()=>{
      setSnapshot(previous=>previous?.uid===uid?{...previous,error:"Couldn't load the program schedule."}:previous);
    });
  },[uid,active?.id,active?.runId,runKey]);
  return {programs:sortPrograms(current?.programs??[],current?.activeId??null),activeId:current?.activeId??null,active,
    run:runSnapshot?.key===runKey?runSnapshot?.run??null:null,error:current?.error??null,loaded:current?.loaded??false,retry:()=>retry(value=>value+1)};
}
