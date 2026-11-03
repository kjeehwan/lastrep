import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteField,doc,getDoc,Timestamp,updateDoc } from "firebase/firestore";
import { auth,db } from "../../config/firebaseConfig";
import type { DailyDecisionContext } from "../../types/decision";
import { normalizeDailyDecisionContext, toLocalDateKey } from "./todayPlanContext";
export type RecoveryRatings={soreness:number|null;fatigue:number|null;motivation:number|null};
export type DailyRecoveryCheckIn={dateKey:string;ratings:RecoveryRatings;context:DailyDecisionContext;painAnswered:boolean};
export const emptyRecoveryRatings=():RecoveryRatings=>({soreness:null,fatigue:null,motivation:null});
export function readRecoveryCheckIn(raw:any,today=toLocalDateKey(new Date())):DailyRecoveryCheckIn|null {
 if(raw?.dateKey!==today||!raw.ratings)return null;
 const ratings=Object.fromEntries(["soreness","fatigue","motivation"].map(key=>[key,typeof raw.ratings[key]==="number"&&raw.ratings[key]>=0&&raw.ratings[key]<=10?raw.ratings[key]:null])) as RecoveryRatings;
 return {dateKey:today,ratings,painAnswered:raw.painAnswered===true,context:normalizeDailyDecisionContext(raw.context,{source:"none",title:null,exerciseNames:[]},new Date(today+"T12:00:00"))??{dateKey:today,pain:null,additionalActivity:null,note:null}};
}
export const recoveryComplete=(value:DailyRecoveryCheckIn|null)=>Boolean(value?.painAnswered&&Object.values(value.ratings).every(v=>v!==null));
export async function loadRecoveryCheckIn(uid:string){const snapshot=await getDoc(doc(db,"users",uid));return readRecoveryCheckIn(snapshot.data()?.recoveryCheckIn);}
export async function saveRecoveryCheckIn(uid:string,value:DailyRecoveryCheckIn){
 if(auth.currentUser?.uid!==uid)throw new Error("Your account changed.");
 await updateDoc(doc(db,"users",uid),{recoveryCheckIn:value,todayPlanContext:{...value.context,updatedAt:Timestamp.now()},activePainContext:value.context.pain?{...value.context.pain,updatedAt:Timestamp.now()}:deleteField()});
 // The cloud record is authoritative. A local cache failure must not report a failed save.
 await AsyncStorage.setItem(`home-inputs-v1:${uid}`,JSON.stringify({...value.ratings,dateKey:value.dateKey})).catch(()=>undefined);
}
