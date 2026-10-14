import { deleteField, doc, FieldPath, onSnapshot, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { db } from "../../config/firebaseConfig";
import { parseAvailableWeightsByExercise, weightPreferenceKey, type AvailableWeights, type AvailableWeightsByExercise } from "../availableWeights";
import { EMPTY_AVAILABLE_WEIGHTS, retainAvailableWeightsSnapshot } from "./availableWeightsSnapshot";

export function useAvailableWeights(uid: string | null) {
  const [snapshot, setSnapshot] = useState<{ uid: string; values: AvailableWeightsByExercise } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(doc(db, "users", uid), (document) => {
      const next = { uid, values: parseAvailableWeightsByExercise(document.data()?.availableWeights) };
      setSnapshot((previous) => retainAvailableWeightsSnapshot(previous, next));
      setError(null);
    }, (failure) => {
      console.log("Failed to load available weights", failure);
      setError("Could not load your saved weight settings.");
    });
  }, [uid]);
  const save = useCallback(async (name: string, settings: AvailableWeights | null) => {
    if (!uid) throw new Error("Sign in to save available weights");
    await updateDoc(doc(db, "users", uid), new FieldPath("availableWeights", weightPreferenceKey(name)), settings ?? deleteField());
  }, [uid]);
  return { values: snapshot?.uid === uid ? snapshot.values : EMPTY_AVAILABLE_WEIGHTS, loaded: snapshot?.uid === uid, error, save };
}
