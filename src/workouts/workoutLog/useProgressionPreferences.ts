import { doc, FieldPath, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "../../config/firebaseConfig";
import { normalizeProgressionPreferences, type ProgressionPreferences } from "../performanceProgression";
import { weightPreferenceKey } from "../availableWeights";
export function useProgressionPreferences(uid: string | null) {
  const [snapshot, setSnapshot] = useState<{ uid: string; values: Record<string, ProgressionPreferences> } | null>(null);
  const [error,setError] = useState<string | null>(null);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db,"users",uid), document => {
      const raw = document.data()?.progressionPreferences;
      setSnapshot({ uid, values: raw && typeof raw === "object" ? Object.fromEntries(Object.entries(raw).map(([name,value]) => [weightPreferenceKey(name),normalizeProgressionPreferences(value)])) : {} });
      setError(null);
    }, () => setError("Couldn't load progression settings."));
  },[uid]);
  const save = async (name: string,value: ProgressionPreferences) => {
    if (!uid || auth.currentUser?.uid !== uid) throw new Error("Your account changed.");
    await updateDoc(doc(db,"users",uid),new FieldPath("progressionPreferences",weightPreferenceKey(name)),value);
  };
  return { loaded:snapshot?.uid===uid,error,values:snapshot?.uid===uid ? snapshot.values : {},save };
}
